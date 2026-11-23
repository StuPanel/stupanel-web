"use client";
/**
 * Settings → Security → Studio owner: give the studio to someone else. Nothing changes until they accept from
 * the email (7 days); the owner can cancel before that.
 */
import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { inputCls } from "@/components/ui/form-kit";

type Pending = { id: string; toEmail: string; toName: string | null; keepOld: boolean; expiresAt: string } | null;
type Member = { id: string; name: string; email: string; role: string };

const btn = "h-10 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50";
const lbl = "block text-[13px] font-semibold text-[#4A4658] mb-1.5";
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Choice({ on, onClick, title, text }: { on: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={cn("text-left rounded-[14px] border-2 px-3.5 py-2.5 min-h-[56px]", on ? "border-[#7D5CEF] bg-[#F5F3FA]" : "border-[#ECE9F2] hover:bg-[#F7F5FB]")}>
      <span className="block text-[14px] font-semibold text-[#17151F]">{title}</span>
      <span className="block text-[12.5px] text-[#6B6680] mt-0.5">{text}</span>
    </button>
  );
}

export function OwnershipPanel() {
  const [pending, setPending] = useState<Pending | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<"member" | "email">("member");
  const [memberId, setMemberId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [keepOld, setKeepOld] = useState(true);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notOwner, setNotOwner] = useState(false);

  const load = useCallback(() => {
    apiFetch(`${API}/account/ownership`).then(async r => {
      if (r.status === 403) { setNotOwner(true); return; }
      setPending(r.ok ? await r.json().catch(() => null) : null);
    }).catch(() => setPending(null));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    apiFetch(`${API}/account/ownership/candidates`).then(r => (r.ok ? r.json() : [])).then((m: Member[]) => { setMembers(m); if (!m.length) setTo("email"); }).catch(() => {});
  }, [open]);

  if (notOwner) return <p className="px-4 sm:px-5 py-4 text-[13.5px] text-[#6B6680]">Only the studio owner can give the studio to someone else.</p>;
  if (pending === undefined) return <div className="px-4 sm:px-5 py-4"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>;

  async function send() {
    setBusy(true); setErr("");
    const body = to === "member" ? { toUserId: memberId, keepOld, password: pw } : { toEmail: email, toName: name, keepOld, password: pw };
    const r = await apiFetch(`${API}/account/ownership`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) { const m = d?.message; return setErr((Array.isArray(m) ? m[0] : m) || "That did not work. Try again."); }
    notify(`Invitation sent to ${d.toEmail}`);
    setOpen(false); setPw(""); setPending(d);
  }
  async function cancel() {
    const r = await apiFetch(`${API}/account/ownership/cancel`, { method: "POST" }).catch(() => null);
    if (!r?.ok) return notify("Couldn't cancel. Try again.", { error: true });
    notify("Cancelled — you are still the owner");
    setPending(null);
  }

  if (pending) {
    return (
      <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Crown className="w-5 h-5 text-[#B45309] flex-shrink-0" />
        <p className="text-[14px] text-[#17151F] flex-1">Waiting for <b>{pending.toName || pending.toEmail}</b> ({pending.toEmail}) to accept, until {day(pending.expiresAt)}. You are the owner until then; after it, you {pending.keepOld ? "stay as a manager" : "leave the studio"}.</p>
        <button type="button" onClick={() => void cancel()} className={cn(btn, "border border-[#E3DFEC] text-[#C2304F]")}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <p className="text-[13.5px] text-[#4A4658] flex-1">Selling the studio, or someone else should run it? Make them the owner. They control the plan, the team and all the data; the studio&apos;s email becomes theirs.</p>
        {!open && <button type="button" onClick={() => setOpen(true)} className={cn(btn, "border border-[#E3DFEC] text-[#4A4658] bg-white flex-shrink-0")}>Give the studio</button>}
      </div>
      {open && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="New owner">
            <Choice on={to === "member"} onClick={() => setTo("member")} title="Someone in my team" text={members.length ? `${members.length} people can be chosen` : "Nobody in your team signs in with an email"} />
            <Choice on={to === "email"} onClick={() => setTo("email")} title="A new email" text="Someone not on StuPanel yet, or another email" />
          </div>
          {to === "member" ? (
            <label className="block"><span className={lbl}>New owner</span>
              <select value={memberId} onChange={e => setMemberId(e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.email}</option>)}
              </select>
            </label>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className={lbl}>Their email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></label>
              <label className="block"><span className={lbl}>Their name</span><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></label>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="After the change">
            <Choice on={keepOld} onClick={() => setKeepOld(true)} title="I stay as a manager" text="You keep working in the studio" />
            <Choice on={!keepOld} onClick={() => setKeepOld(false)} title="I leave the studio" text="Your email is then free for your own studio" />
          </div>
          <label className="block"><span className={lbl}>Your password</span><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" className={inputCls} /></label>
          {err && <p role="alert" className="text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (to === "member" ? !memberId : !email)} onClick={() => void send()} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send the invitation</button>
            <button type="button" onClick={() => { setOpen(false); setErr(""); setPw(""); }} className={cn(btn, "text-[#4A4658]")}>Close</button>
          </div>
          <p className="text-[12px] text-[#6B6680]">They get an email with a link (7 days). Nothing changes until they accept, and you can cancel before that.</p>
        </div>
      )}
    </div>
  );
}
