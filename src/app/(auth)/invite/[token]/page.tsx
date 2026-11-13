"use client";

/**
 * A studio invited this person to its team (link from the invite email).
 *  • Already uses StuPanel → accept while logged in with that email (same password).
 *  • New to StuPanel → choose a password here and go straight in.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { StudioLogo } from "@/components/studio-logo";
import { inputCls } from "@/components/ui/form-kit";
import { apiFetch, API_URL as API } from "@/lib/api";
import { enterSession, postPublic, type Session } from "@/lib/studio-session";
import { clearAccessTokenCookie } from "@/lib/auth-cookie";
import { cn } from "@/lib/utils";

type Info = {
  studio: { name: string; logoUrl: string | null };
  email: string; firstName: string; invitedBy: string | null; expired: boolean; hasAccount: boolean;
};

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState<"" | "accept" | "decline">("");
  const [declined, setDeclined] = useState(false);
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    try { setLoggedIn(!!localStorage.getItem("access_token")); } catch { /* ignore */ }
    fetch(`${API}/auth/invites/${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) setInfo(d); else setError(Array.isArray(d.message) ? d.message[0] : d.message || "This invite is no longer valid.");
      })
      .catch(() => setError("Couldn't load the invite. Please check your internet and try again."));
  }, [token]);

  const here = `/invite/${token}`;

  async function acceptSignedIn() {
    setBusy("accept"); setFormError("");
    const r = await apiFetch(`${API}/auth/invites/${encodeURIComponent(token)}/accept-signed-in`, { method: "POST", credentials: "include" }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (r?.ok) { enterSession(d as Session); return; }
    setBusy("");
    setFormError(Array.isArray(d?.message) ? d.message[0] : d?.message || "Couldn't accept. Please try again.");
  }

  async function acceptNew(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8) { setFormError("Use at least 8 characters."); return; }
    if (!again) { setFormError("Type the same password again in the second box."); return; }
    if (pass !== again) { setFormError("The two passwords are not the same."); return; }
    setBusy("accept"); setFormError("");
    const r = await postPublic<Session>(`/auth/invites/${encodeURIComponent(token)}/accept`, { password: pass });
    if (r.ok) { enterSession(r.data); return; }
    setBusy(""); setFormError(r.error);
  }

  async function decline() {
    setBusy("decline");
    const r = await postPublic(`/auth/invites/${encodeURIComponent(token)}/decline`);
    setBusy("");
    if (r.ok) setDeclined(true); else setFormError(r.error);
  }

  function useOtherAccount() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    clearAccessTokenCookie();
    window.location.href = `/login?from=${encodeURIComponent(here)}`;
  }

  if (error) {
    return (
      <Message icon="bad" title="Invite not available" text={error}>
        <Link href="/login" className="text-sm font-semibold text-[#7D5CEF]">Go to sign in</Link>
      </Message>
    );
  }
  if (!info) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>;
  if (declined) return <Message icon="ok" title="Invite declined" text={`You won't join ${info.studio.name}. If this was a mistake, ask them to send a new invite.`} />;
  if (info.expired) return <Message icon="bad" title="This invite has expired" text={`Invites work for 7 days. Ask ${info.studio.name} to send it again.`} />;

  return (
    <div>
      <div className="mb-6">
        <StudioLogo url={info.studio.logoUrl} name={info.studio.name} size={56} className="rounded-[16px] mb-4" />
        <h2 className="text-2xl font-bold text-[#17151F]">Join {info.studio.name}</h2>
        <p className="text-[#6B6680] mt-1 text-sm">
          {info.invitedBy ? `${info.invitedBy} invited you` : "You're invited"} to their team on StuPanel as <span className="font-semibold text-[#33303F]">{info.email}</span>.
        </p>
      </div>

      {formError && <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{formError}</div>}

      {info.hasAccount ? (
        <>
          <div className="rounded-[16px] bg-[#F7F4FE] border border-[#E4DCFB] p-4 text-[13.5px] text-[#4A4658] leading-relaxed mb-5">
            You already use StuPanel with this email. Accept, and <b>{info.studio.name}</b> is added to your studio list — same login, same password. Each studio only sees its own work.
          </div>
          {loggedIn ? (
            <>
              <button type="button" onClick={acceptSignedIn} disabled={!!busy}
                className="w-full h-11 rounded-lg bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                {busy === "accept" && <Loader2 className="w-4 h-4 animate-spin" />}Accept and open {info.studio.name}
              </button>
              <button type="button" onClick={useOtherAccount} className="mt-3 w-full text-sm font-semibold text-[#7D5CEF]">Not {info.email}? Sign in with that account</button>
            </>
          ) : (
            <Link href={`/login?from=${encodeURIComponent(here)}`}
              className="w-full h-11 rounded-lg bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm inline-flex items-center justify-center">
              Sign in to accept
            </Link>
          )}
        </>
      ) : (
        <form onSubmit={acceptNew} className="space-y-4" noValidate>
          <p className="text-[13.5px] text-[#4A4658]">Hi {info.firstName}! Choose a password to accept. You&apos;ll sign in with <b>{info.email}</b>.</p>
          <label className="block">
            <span className="block text-sm font-medium text-[#33303F] mb-1.5">Password</span>
            <span className="relative block">
              <input type={show ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} autoComplete="new-password" autoFocus
                placeholder="At least 8 characters" className={cn(inputCls, "pr-10")} />
              <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6680]">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </span>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-[#33303F] mb-1.5">Type it again</span>
            <input type={show ? "text" : "password"} value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" placeholder="The same password again" className={inputCls} />
          </label>
          <button type="submit" disabled={!!busy}
            className="w-full h-11 rounded-lg bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy === "accept" && <Loader2 className="w-4 h-4 animate-spin" />}Accept and join
          </button>
        </form>
      )}

      <button type="button" onClick={decline} disabled={!!busy}
        className="mt-4 w-full h-10 rounded-lg text-sm font-semibold text-[#6B6680] hover:text-[#C2304F] hover:bg-[#FDECEF] inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy === "decline" && <Loader2 className="w-4 h-4 animate-spin" />}Decline invite
      </button>
    </div>
  );
}

function Message({ icon, title, text, children }: { icon: "ok" | "bad"; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-6">
      <span className={cn("w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center", icon === "ok" ? "bg-[#E7F5EE]" : "bg-[#FDECEF]")}>
        {icon === "ok" ? <CheckCircle2 className="w-7 h-7 text-[#1F8A5B]" /> : <XCircle className="w-7 h-7 text-[#C2304F]" />}
      </span>
      <h2 className="text-xl font-bold text-[#17151F]">{title}</h2>
      <p className="text-[#6B6680] mt-2 text-sm leading-relaxed">{text}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
