import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import { signActions } from "@/lib/convex-actions";
import { contractsActions } from "@/lib/convex-actions";
import { VariableInput } from "@/components/variable-input";

export const Route = createFileRoute("/_app/semneaza/$token")({
  component: SemneazaPage,
});

function SemneazaPage() {
  const { token } = Route.useParams();
  const searchParams = Route.useSearch({ strict: false });
  const backUrl = typeof searchParams.back === "string"
    ? decodeURIComponent(searchParams.back)
    : null;

  const session = useQuery(api.sign.getSignerByToken, token ? { token } : "skip");
  const sendOtpAction = useAction(signActions.sendOtp);
  const verifyOtpAction = useAction(signActions.verifyOtp);
  const submitSignatureAction = useAction(signActions.submitSignature);
  const getDocumentUrl = useAction(contractsActions.getDocumentUrl);

  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [claim, setClaim] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const previewRef = useRef<HTMLDivElement>(null);
  const [finalPreviewReady, setFinalPreviewReady] = useState(false);
  const [downloadDocLoading, setDownloadDocLoading] = useState(false);
  const [signedDocUrl, setSignedDocUrl] = useState<string | null>(null);
  const [localPreviewMeta, setLocalPreviewMeta] = useState<{
    contractNumbers: Array<{ name: string; label: string; value: string }>;
    signatures: Array<{ name: string; label: string; dataUrl: string }>;
  } | null>(null);

  useEffect(() => {
    setSignedDocUrl(null);
    setLocalPreviewMeta(null);
  }, [token]);

  const loadError = token && session === null ? "Link invalid sau expirat" : null;
  const showFinal =
    submitStatus === "success" ||
    (session && "alreadySigned" in session && session.alreadySigned === true);

  useEffect(() => {
    if (!showFinal || !session?.contractId || !previewRef.current || !finalPreviewReady) return;
    let cancelled = false;
    setPreviewStatus("loading");

    function loadBlob(blob: Blob): Promise<void> {
      if (cancelled || !previewRef.current) return Promise.resolve();
      return import("docx-preview").then(({ renderAsync }) => {
        if (cancelled || !previewRef.current) return;
        previewRef.current.innerHTML = "";
        return renderAsync(blob, previewRef.current, undefined, {
          className: "docx-contract-preview",
          inWrapper: true,
        });
      });
    }

    function loadFromUrl(url: string): Promise<void> {
      return fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("Document fetch failed");
          return r.blob();
        })
        .then((blob) => loadBlob(blob))
        .then(() => {
          if (!cancelled) setPreviewStatus("loaded");
        });
    }

    const primary = signedDocUrl;
    if (primary) {
      loadFromUrl(primary).catch(() => {
        if (cancelled) return;
        getDocumentUrl({ contractId: session.contractId })
          .then((fallback) => {
            if (cancelled || !fallback) throw new Error("No document");
            return loadFromUrl(fallback);
          })
          .catch(() => {
            if (!cancelled) setPreviewStatus("error");
          });
      });
    } else {
      getDocumentUrl({ contractId: session.contractId })
        .then((url) => {
          if (cancelled || !url) throw new Error("No document");
          return loadFromUrl(url);
        })
        .catch(() => {
          if (!cancelled) setPreviewStatus("error");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [showFinal, session?.contractId, finalPreviewReady, getDocumentUrl, signedDocUrl]);

  const sendOtp = useCallback(
    (isResend = false) => {
      if (!token || otpSending) return;
      if (isResend && otpResendCooldown > 0) return;
      setOtpSending(true);
      setOtpMessage(null);
      if (!isResend) setDevCode(null);
      sendOtpAction({ token })
        .then((data) => {
          if (data.success) {
            setOtpSent(true);
            if ("code" in data && data.code) setDevCode(data.code);
            if (isResend) {
              setOtpMessage(null);
              setOtpCode("");
            }
            setOtpResendCooldown(60);
          } else {
            setOtpMessage("message" in data ? data.message : "Eroare la trimitere OTP");
          }
        })
        .catch(() => setOtpMessage("Eroare de rețea"))
        .finally(() => setOtpSending(false));
    },
    [token, sendOtpAction, otpSending, otpResendCooldown]
  );

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const id = window.setTimeout(() => setOtpResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [otpResendCooldown]);

  const verifyOtp = useCallback(() => {
    if (!token || !otpCode.trim()) return;
    setOtpMessage(null);
    verifyOtpAction({ token, code: otpCode.trim() })
      .then((data) => {
        if (data.success && "claim" in data) {
          setClaim(data.claim);
        } else {
          setOtpMessage("message" in data ? data.message : "Cod invalid sau expirat");
        }
      })
      .catch(() => setOtpMessage("Eroare de rețea"));
  }, [token, otpCode, verifyOtpAction]);

  const submit = useCallback(async () => {
    if (!token || !claim || !session) return;
    if (!consent) {
      setSubmitError("Trebuie să confirmați că ați citit și sunteți de acord.");
      return;
    }
    if (!signatureDataUrl) {
      setSubmitError("Semnătura este obligatorie.");
      return;
    }
    setSubmitStatus("loading");
    setSubmitError(null);
    let clientIp: string | undefined;
    try {
      const ctrl = new AbortController();
      const id = window.setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
      window.clearTimeout(id);
      if (r.ok) {
        const j = (await r.json()) as { ip?: string };
        if (typeof j.ip === "string") clientIp = j.ip;
      }
    } catch {
      /* IP opțional */
    }
    try {
      const data = await submitSignatureAction({
        token,
        claim,
        consent,
        signatureDataUrl,
        signatureVariableName:
          "signatureVariableName" in session ? session.signatureVariableName : "signature",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        ip: clientIp,
      });
      if (data.success && "documentUrl" in data) {
        setSignedDocUrl(data.documentUrl);
        setLocalPreviewMeta(data.previewMeta);
        setSubmitStatus("success");
      } else {
        setSubmitError("message" in data ? data.message : "Eroare la semnare");
        setSubmitStatus("error");
      }
    } catch {
      setSubmitError("Eroare de rețea");
      setSubmitStatus("error");
    }
  }, [token, claim, consent, signatureDataUrl, session, submitSignatureAction]);

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6 flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Link invalid.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link to="/" className="text-sm text-zinc-900 dark:text-zinc-100 underline">
          Înapoi
        </Link>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6 flex items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
      </div>
    );
  }

  if (!session) return null;

  const steps = [
    { id: 1, label: "Citește contractul" },
    { id: 2, label: "Completează" },
    { id: 3, label: "Verifică datele" },
    { id: 4, label: "Semnează" },
  ];

  function Stepper({ allComplete = false }: { allComplete?: boolean }) {
    return (
      <nav className="flex items-center justify-center gap-2 sm:gap-4 mb-8" aria-label="Pași">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                allComplete || i < 3
                  ? "bg-green-600 text-white"
                  : i === 3
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {allComplete || i < 3 ? "✓" : i + 1}
            </div>
            <span className={`hidden sm:inline text-sm ${i === 3 && !allComplete ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 text-zinc-300 dark:text-zinc-600">→</span>}
          </div>
        ))}
      </nav>
    );
  }

  if (showFinal) {
    const signedBefore = session.alreadySigned === true;
    const previewMeta =
      localPreviewMeta ??
      ("previewMeta" in session && session.previewMeta ? session.previewMeta : null);
    const hasSignedExtras =
      previewMeta &&
      (previewMeta.contractNumbers.length > 0 || previewMeta.signatures.length > 0);
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6">
        <main className="w-full max-w-4xl mx-auto">
          <Stepper allComplete />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
            Finalizare
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
            {signedBefore
              ? "Ai semnat deja acest contract. Mai jos poți previzualiza și descărca documentul semnat."
              : "Contract semnat cu succes. Poți previzualiza și descărca documentul cu semnătura mai jos."}
          </p>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm mb-6">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
              <span>Previzualizare document</span>
              <button
                type="button"
                onClick={async () => {
                  if (!session.contractId) return;
                  setDownloadDocLoading(true);
                  try {
                    const url = await getDocumentUrl({ contractId: session.contractId });
                    if (url) window.open(url, "_blank");
                  } finally {
                    setDownloadDocLoading(false);
                  }
                }}
                disabled={downloadDocLoading}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm disabled:opacity-50"
              >
                {downloadDocLoading ? "Se încarcă…" : "Descarcă DOCX"}
              </button>
            </div>
            <div className="p-2 sm:p-4">
              <div
                ref={(el) => {
                  (previewRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                  setFinalPreviewReady(!!el);
                }}
                className="min-h-[260px] sm:min-h-[420px] max-h-[50vh] sm:max-h-[70vh] overflow-auto p-2 sm:p-4 docx-wrapper contract-preview bg-white text-zinc-900"
                style={{ maxHeight: "70vh" }}
              />
              {previewStatus === "loading" && (
                <p className="p-4 text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă documentul…</p>
              )}
              {previewStatus === "error" && (
                <p className="p-4 text-red-600 dark:text-red-400 text-sm">Nu s-a putut încărca previzualizarea. Poți descărca documentul mai sus.</p>
              )}
              {hasSignedExtras && previewMeta && (
                <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Număr contract și semnătură (incluse în fișierul DOCX descărcat)
                  </p>
                  {previewMeta.contractNumbers.length > 0 && (
                    <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                      {previewMeta.contractNumbers.map((c) => (
                        <li key={c.name}>
                          <span className="text-zinc-500 dark:text-zinc-400">{c.label}: </span>
                          <span className="font-mono font-medium">{c.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {previewMeta.signatures.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                      {previewMeta.signatures.map((s) => (
                        <div key={s.name} className="space-y-1">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
                          <img
                            src={s.dataUrl}
                            alt=""
                            className="max-h-24 w-auto border border-zinc-200 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {backUrl && (
              <Link to={backUrl} className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
                Înapoi la verificare
              </Link>
            )}
            <Link to="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
              Acasă
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6">
      <main className="max-w-2xl mx-auto space-y-6">
        <Stepper />
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Pasul 4: Semnare electronică
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
          Bună, {session.fullName}. Completează pașii de mai jos pentru semnare (OTP și semnătură).
        </p>
        {backUrl && (
          <Link
            to={backUrl}
            className="inline-block rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Înapoi la pasul 3
          </Link>
        )}

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Verificare identitate (OTP)</h2>
          {!otpSent ? (
            <button
              type="button"
              onClick={() => sendOtp(false)}
              disabled={otpSending}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {otpSending ? "Se trimite…" : "Trimite cod OTP pe email"}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Codul a fost trimis la {session.email}. Introdu codul de 6 cifre:
              </p>
              <button
                type="button"
                onClick={() => sendOtp(true)}
                disabled={otpSending || otpResendCooldown > 0}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {otpSending
                  ? "Se trimite…"
                  : otpResendCooldown > 0
                    ? `Retrimite codul (după ${otpResendCooldown}s)`
                    : "Retrimite cod OTP pe email"}
              </button>
              {devCode && (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-mono">
                  [Dev] Cod: {devCode}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-28 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-center font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={otpCode.length !== 6}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                >
                  Verifică
                </button>
              </div>
              {otpMessage && (
                <p className="text-sm text-red-600 dark:text-red-400">{otpMessage}</p>
              )}
            </div>
          )}
        </div>

        {claim && (
          <>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Consimțământ</h2>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 rounded border-zinc-300 dark:border-zinc-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Confirm că am citit documentul și sunt de acord să îl semnez electronic.
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Semnătura</h2>
              {"existingSignature" in session && session.existingSignature && !signatureDataUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Ai completat deja semnătura în formular. Poți o folosi sau desena una nouă mai jos.
                  </p>
                  <div className="flex items-center gap-3">
                    <img
                      src={session.existingSignature}
                      alt="Semnătură existentă"
                      className="border border-zinc-200 dark:border-zinc-700 rounded-lg max-h-20 w-auto object-contain bg-white dark:bg-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => setSignatureDataUrl(session.existingSignature ?? "")}
                      className="rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300"
                    >
                      Folosesc această semnătură
                    </button>
                  </div>
                </div>
              )}
              <VariableInput
                name="signature"
                type="signature"
                value={signatureDataUrl}
                onChange={setSignatureDataUrl}
                disabled={submitStatus === "loading"}
              />
            </div>

            {submitError && (
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={submitStatus === "loading" || !signatureDataUrl.trim()}
              className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {submitStatus === "loading" ? "Se trimite…" : "Semnează contractul"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
