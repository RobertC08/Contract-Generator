"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { VariableInput } from "@/app/components/variable-input";

type SignSession = {
  signerId: string;
  fullName: string;
  email: string;
  contractId: string;
  pdfUrl: string | null;
  signatureVariableName: string;
  existingSignature: string | null;
};

export default function SignPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [session, setSession] = useState<SignSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [claim, setClaim] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/sign/${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Link invalid sau expirat");
        return r.json();
      })
      .then(setSession)
      .catch(() => setLoadError("Link invalid sau expirat"));
  }, [token]);

  const sendOtp = useCallback(() => {
    if (!token) return;
    setOtpMessage(null);
    setDevCode(null);
    fetch("/api/sign/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setOtpMessage((data as { message?: string }).message ?? "Eroare la trimitere OTP");
          return;
        }
        if (data.success) {
          setOtpSent(true);
          if (data.code) setDevCode(data.code);
        } else {
          setOtpMessage(data.message ?? "Eroare la trimitere OTP");
        }
      })
      .catch(() => setOtpMessage("Eroare de rețea"));
  }, [token]);

  const verifyOtp = useCallback(() => {
    if (!token || !otpCode.trim()) return;
    setOtpMessage(null);
    fetch("/api/sign/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, code: otpCode.trim() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.claim) {
          setClaim(data.claim);
        } else {
          setOtpMessage(data.message ?? "Cod invalid sau expirat");
        }
      })
      .catch(() => setOtpMessage("Eroare de rețea"));
  }, [token, otpCode]);

  const submit = useCallback(() => {
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
    fetch("/api/sign/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        claim,
        consent,
        signatureDataUrl,
        signatureVariableName: session.signatureVariableName,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSubmitStatus("success");
        } else {
          setSubmitError(data.message ?? "Eroare la semnare");
          setSubmitStatus("error");
        }
      })
      .catch(() => {
        setSubmitError("Eroare de rețea");
        setSubmitStatus("error");
      });
  }, [token, claim, consent, signatureDataUrl, session]);

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Link invalid.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link href="/" className="text-sm text-zinc-900 dark:text-zinc-100 underline">
          Înapoi
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
      </div>
    );
  }

  if (submitStatus === "success") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium text-green-700 dark:text-green-400">Contract semnat cu succes.</p>
        <Link href="/" className="text-sm text-zinc-900 dark:text-zinc-100 underline">
          Înapoi
        </Link>
      </div>
    );
  }

  const pdfPreviewUrl = session.pdfUrl?.startsWith("/") ? session.pdfUrl : session.pdfUrl;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Semnare electronică
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
          Bună, {session.fullName}. Verifică documentul și completează pașii pentru semnare.
        </p>

        {pdfPreviewUrl && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Document
            </div>
            <iframe
              title="Document"
              src={pdfPreviewUrl}
              className="w-full min-h-[65vh] h-[70vh] border-0"
            />
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Verificare identitate (OTP)</h2>
          {!otpSent ? (
            <button
              type="button"
              onClick={sendOtp}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Trimite cod OTP pe email
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Codul a fost trimis la {session.email}. Introdu codul de 6 cifre:
              </p>
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
              {session.existingSignature && !signatureDataUrl && (
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
              disabled={submitStatus === "loading"}
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
