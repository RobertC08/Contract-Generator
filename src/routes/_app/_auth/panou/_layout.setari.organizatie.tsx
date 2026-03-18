import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export const Route = createFileRoute("/_app/_auth/panou/_layout/setari/organizatie")({
  component: SetariOrganizatiePage,
});

function SetariOrganizatiePage() {
  const orgs = useQuery(api.organizations.list, {});
  const activeOrgId = useQuery(api.organizations.getActiveOrgIdQuery, {});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [apiKeyName, setApiKeyName] = useState("");
  const [newApiKeyOnce, setNewApiKeyOnce] = useState<string | null>(null);
  const inviteMember = useMutation(api.organizations.invite);
  const createApiKey = useMutation(api.integrationApiKeys.create);
  const revokeApiKey = useMutation(api.integrationApiKeys.revoke);

  const activeOrg = orgs?.find((o) => o?._id === activeOrgId) ?? orgs?.[0];

  const apiKeys = useQuery(
    api.integrationApiKeys.list,
    activeOrg?._id ? { orgId: activeOrg._id } : "skip"
  );

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?._id) return;
    try {
      const r = await createApiKey({
        orgId: activeOrg._id,
        name: apiKeyName.trim() || "Integrare",
      });
      setNewApiKeyOnce(r.rawKey);
      setApiKeyName("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?._id || !inviteEmail.trim()) return;
    try {
      await inviteMember({ orgId: activeOrg._id, email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
    } catch (err) {
      console.error(err);
    }
  };

  if (!orgs) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Organizațiile tale</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Organizațiile la care ești membru.
          </p>
        </div>
        <div className="border-t border-stone-200 dark:border-stone-800 divide-y divide-stone-200 dark:divide-stone-800">
          {orgs.map((org) => (
            org && (
              <div key={org._id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100">{org.name}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{org.slug}</p>
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {activeOrg && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Invită membru</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Invită pe cineva în {activeOrg.name}.
            </p>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col gap-4 border-t border-stone-200 dark:border-stone-800 p-6">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
              className="max-w-xs rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-3 py-2 text-sm"
            >
              <option value="member">Membru</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" disabled={!inviteEmail.trim()}>
              Trimite invitație
            </Button>
          </form>
        </div>
      )}

      {activeOrg && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Chei API (integrări)</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Generează o cheie pentru ToneTrack sau alte servere. Folosește{" "}
              <code className="rounded bg-stone-100 dark:bg-stone-800 px-1">Authorization: Bearer &lt;cheie&gt;</code>{" "}
              la apelurile REST <code className="rounded bg-stone-100 dark:bg-stone-800 px-1">/api/v1/…</code>. Fiecare
              cheie este legată de această organizație și vede doar template-urile și contractele organizației.
            </p>
          </div>
          {newApiKeyOnce && (
            <div className="mx-6 mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-4">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Copiază acum — nu se mai afișează:</p>
              <code className="mt-2 block break-all text-xs text-stone-800 dark:text-stone-200">{newApiKeyOnce}</code>
              <Button type="button" variant="outline" className="mt-3" onClick={() => void navigator.clipboard.writeText(newApiKeyOnce)}>
                Copiază în clipboard
              </Button>
              <Button type="button" variant="ghost" className="mt-3 ml-2" onClick={() => setNewApiKeyOnce(null)}>
                Am salvat-o
              </Button>
            </div>
          )}
          <form
            onSubmit={handleCreateApiKey}
            className="flex flex-wrap items-end gap-4 border-t border-stone-200 dark:border-stone-800 p-6"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-500">Nume (ex. ToneTrack producție)</label>
              <Input
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="ToneTrack"
                className="max-w-xs"
              />
            </div>
            <Button type="submit">Generează cheie nouă</Button>
          </form>
          <div className="border-t border-stone-200 dark:border-stone-800">
            {apiKeys === undefined ? (
              <p className="p-4 text-sm text-stone-500">Se încarcă…</p>
            ) : apiKeys.length === 0 ? (
              <p className="p-4 text-sm text-stone-500">Nicio cheie încă.</p>
            ) : (
              <ul className="divide-y divide-stone-200 dark:divide-stone-800">
                {apiKeys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium text-stone-900 dark:text-stone-100">{k.name}</p>
                      <p className="text-sm text-stone-500">
                        {k.keyPrefix}
                        {k.revokedAt ? (
                          <span className="ml-2 text-red-600 dark:text-red-400">revocată</span>
                        ) : k.lastUsedAt ? (
                          <span className="ml-2">ultima utilizare: {new Date(k.lastUsedAt).toLocaleString()}</span>
                        ) : null}
                      </p>
                    </div>
                    {!k.revokedAt && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                        onClick={() => {
                          if (confirm("Revoci această cheie? Integrările care o folosesc vor înceta să funcționeze.")) {
                            void revokeApiKey({ keyId: k.id });
                          }
                        }}
                      >
                        Revocă
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
