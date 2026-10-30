"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Link2, Loader2, MessageCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { askConfirm, notify } from "@/components/feedback";
import { waLink } from "@/lib/portal-session";
import { fmtDate } from "@/lib/format";

type Status = { token: string; codeSetAt?: string | null; lastUsedAt?: string | null } | null;

/**
 * Studio side of the client portal: create the link with an access code,
 * share both on WhatsApp, or reset the code (signs every device out).
 * The code is shown only right after it is created — it is stored hashed.
 */
export function PortalAccessModal({ client, onClose }: {
  client: { id: string; firstName: string; lastName?: string | null; phone?: string | null };
  onClose: () => void;
}) {
  const { companyName } = useAuth();
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API}/client-portal/status/${client.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setStatus(d && d.token ? d : null))
      .catch(() => setStatus(null));
  }, [client.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const link = status?.token && typeof window !== "undefined" ? `${window.location.origin}/portal/${status.token}` : "";
  const studio = companyName || "our studio";
  const message = `Hi ${client.firstName}, here is your ${studio} client portal — see your programs, payments and photos:\n${link}${code ? `\nAccess code: ${code}` : ""}`;
  const wa = waLink(client.phone, message);

  async function call(path: string) {
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch(`${API}/client-portal/${path}/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customCode.trim() ? { code: customCode.trim() } : {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || "Something went wrong");
      setStatus({ token: d.token, codeSetAt: d.codeSetAt ?? new Date().toISOString() });
      setCode(d.code ?? null);
      setCustomCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resetCode() {
    const ok = await askConfirm({
      title: "Set a new access code?",
      message: "The old code stops working and every device is signed out. You'll need to send the new code to the client.",
      confirmLabel: "Set new code",
    });
    if (ok) await call("reset-code");
  }

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); }
    catch { notify("Couldn't copy", { error: true }); }
  }

  return (
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-labelledby="portal-modal-title"
          className="sp-modal pointer-events-auto w-full max-w-md p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#EEE8FD] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#5B3FD0]" />
              </div>
              <div>
                <h2 id="portal-modal-title" className="font-bold text-[#17151F] text-lg leading-tight">Client portal</h2>
                <p className="text-sm text-[#6B6680]">{client.firstName} {client.lastName ?? ""}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {status === undefined ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>
          ) : !status ? (
            /* No active link yet */
            <div className="mt-5 space-y-4">
              <p className="text-sm text-[#4A4658]">
                Create a private link for this client. They&apos;ll need the access code to open it — once per device.
              </p>
              <div>
                <label htmlFor="portal-custom-code" className="text-xs font-semibold text-[#4A4658]">Access code</label>
                <input id="portal-custom-code" value={customCode} onChange={e => setCustomCode(e.target.value.replace(/\s/g, ""))}
                  placeholder="Leave empty for a 6-digit code" maxLength={20}
                  className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-[#E3DFEC] text-sm text-[#17151F] placeholder:text-[#6B6680] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/30 focus:border-[#5B3FD0]" />
                <p className="mt-1 text-xs text-[#6B6680]">4–20 letters or numbers.</p>
              </div>
              {error && <p role="alert" className="text-sm text-[#C2304F]">{error}</p>}
              <button onClick={() => call("generate")} disabled={busy}
                className="w-full h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Create portal link
              </button>
            </div>
          ) : (
            /* Active link */
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-[#E3DFEC] p-3">
                <p className="text-xs font-semibold text-[#6B6680]">Link</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="flex-1 min-w-0 truncate text-sm text-[#17151F]">{link}</p>
                  <button onClick={() => copy(link, "link")} aria-label="Copy link"
                    className="h-8 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-xs font-semibold text-[#17151F] flex items-center gap-1.5">
                    {copied === "link" ? <Check className="w-3.5 h-3.5 text-[#1F8A5B]" /> : <Copy className="w-3.5 h-3.5" />} Copy
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E3DFEC] p-3">
                <p className="text-xs font-semibold text-[#6B6680]">Access code</p>
                {code ? (
                  <>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="flex-1 text-2xl font-bold tracking-[0.3em] text-[#17151F]">{code}</p>
                      <button onClick={() => copy(code, "code")} aria-label="Copy code"
                        className="h-8 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-xs font-semibold text-[#17151F] flex items-center gap-1.5">
                        {copied === "code" ? <Check className="w-3.5 h-3.5 text-[#1F8A5B]" /> : <Copy className="w-3.5 h-3.5" />} Copy
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-[#6B6680]">Send it now — for safety it won&apos;t be shown again.</p>
                  </>
                ) : (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-sm text-[#4A4658] flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-[#5B3FD0]" />
                      Set {status.codeSetAt ? fmtDate(status.codeSetAt) : ""}
                    </p>
                    <button onClick={resetCode} disabled={busy}
                      className="h-8 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-xs font-semibold text-[#17151F] flex items-center gap-1.5">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} New code
                    </button>
                  </div>
                )}
              </div>

              {error && <p role="alert" className="text-sm text-[#C2304F]">{error}</p>}

              <div className="flex gap-2 pt-1">
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                    className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                    <MessageCircle className="w-4 h-4" /> Send on WhatsApp
                  </a>
                ) : (
                  <p className="flex-1 text-xs text-[#6B6680] self-center">Add the client&apos;s phone number to send on WhatsApp.</p>
                )}
                <button onClick={() => copy(message, "all")}
                  className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold text-[#17151F] flex items-center gap-2">
                  {copied === "all" ? <Check className="w-4 h-4 text-[#1F8A5B]" /> : <Copy className="w-4 h-4" />} Copy message
                </button>
              </div>
              {!code && (
                <p className="text-xs text-[#6B6680]">The message won&apos;t include the code. Use &quot;New code&quot; if the client lost it.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
