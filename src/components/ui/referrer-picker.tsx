"use client";
/**
 * "Who referred?" — pick a team member, a client, or anyone else (name + phone or email).
 * Used on the client form and the program form. The choice is saved as a referrer (POST /referrers/resolve).
 */
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, UserPlus, Users, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { inputCls } from "./form-kit";

export type ReferrerKind = "member" | "client" | "person";
export type Referrer = { id: string; kind: ReferrerKind; name: string; phone?: string | null; email?: string | null; userId?: string | null; clientId?: string | null };
type Options = {
  team: { userId: string; name: string; avatarUrl?: string | null; phone?: string | null; roles?: string[] }[];
  clients: { clientId: string; name: string; phone?: string | null }[];
  people: { referrerId: string; name: string; phone?: string | null; email?: string | null }[];
};

export const KIND_LABEL: Record<ReferrerKind, string> = { member: "Team", client: "Client", person: "Other" };
const KIND_TONE: Record<ReferrerKind, string> = { member: "bg-[#EEE8FD] text-[#5B3FD0]", client: "bg-[#E3F2F1] text-[#126B66]", person: "bg-[#FFF3E0] text-[#9A5B00]" };

export function KindChip({ kind }: { kind: ReferrerKind }) {
  return <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded-full", KIND_TONE[kind])}>{KIND_LABEL[kind]}</span>;
}

function Face({ name, src, kind }: { name: string; src?: string | null; kind: ReferrerKind }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />;
  return <span className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0", KIND_TONE[kind])}>{letters}</span>;
}

export function ReferrerPicker({ value, onChange, label = "Who referred?", hint }: {
  value: Referrer | null; onChange: (r: Referrer | null) => void; label?: string; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<Options | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [person, setPerson] = useState({ name: "", phone: "", email: "" });
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      apiFetch(`${API}/referrers/options?q=${encodeURIComponent(q.trim())}`).then(r => (r.ok ? r.json() : null)).then((d: Options | null) => d && setOpts(d)).catch(() => {});
    }, q ? 220 : 0);
    return () => clearTimeout(timer.current);
  }, [open, q]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc, true); };
  }, [open]);

  async function choose(key: string, body: Record<string, string>) {
    setBusy(key); setErr("");
    try {
      const r = await apiFetch(`${API}/referrers/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(Array.isArray(d.message) ? d.message[0] : d.message || "Could not save this."); return; }
      onChange(d as Referrer);
      setOpen(false); setAdding(false); setQ(""); setPerson({ name: "", phone: "", email: "" });
    } catch { setErr("Could not save this. Please try again."); }
    finally { setBusy(null); }
  }

  const addPerson = () => { void choose("p", { kind: "person", name: person.name, phone: person.phone, email: person.email }); };
  const s = q.trim().toLowerCase();
  const team = (opts?.team ?? []).filter(t => !s || t.name.toLowerCase().includes(s) || (t.phone ?? "").includes(s));
  const row = "w-full flex items-center gap-3 px-3 py-2 rounded-[12px] text-left hover:bg-[#F5F3FA] disabled:opacity-60";

  return (
    <div ref={box} className="relative">
      <p className="text-[13px] font-semibold text-[#4A4658] mb-1.5">{label}</p>
      {value ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-[#E4E0EC] bg-white px-3 py-2.5">
          <Face name={value.name} kind={value.kind} />
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2"><span className="text-[15px] font-semibold text-[#17151F] truncate">{value.name}</span><KindChip kind={value.kind} /></span>
            {(value.phone || value.email) && <span className="block text-[12.5px] text-[#6B6680] truncate">{value.phone || value.email}</span>}
          </span>
          <button type="button" onClick={() => setOpen(true)} className="h-9 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold text-[#4A4658]">Change</button>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove who referred" className="w-9 h-9 rounded-full hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#8A8599] flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="w-full h-12 rounded-[14px] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] bg-white px-3.5 text-left text-[15px] text-[#6B6680] inline-flex items-center gap-2.5">
          <Users className="w-4 h-4 text-[#7D5CEF]" />Choose a team member, a client or someone else
        </button>
      )}
      {hint && <p className="mt-1 text-[12.5px] text-[#8A8599]">{hint}</p>}

      {open && (
        // Opens in place (pushes what is below down), so no card around it can cover it
        <div className="mt-2 rounded-[18px] bg-white border border-[#E4E0EC] shadow-[0_12px_32px_-16px_rgba(40,28,96,.30)] overflow-hidden" role="dialog" aria-label="Who referred">
          <div className="p-2.5 border-b border-[#EEEBF4]">
            <label className="relative block">
              <span className="sr-only">Search</span>
              <Search className="w-4 h-4 text-[#8A8599] absolute left-3 top-1/2 -translate-y-1/2" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search a name or phone" className={cn(inputCls, "pl-9")} />
            </label>
          </div>
          <div className="max-h-[340px] overflow-y-auto p-1.5">
            {!opts ? <div className="py-8 flex justify-center text-[#B5B0C4]"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
              <>
                {team.length > 0 && <p className="px-3 pt-2 pb-1 text-[12px] font-bold text-[#8A8599]">Team</p>}
                {team.map(t => (
                  <button key={t.userId} type="button" disabled={!!busy} onClick={() => choose(`m:${t.userId}`, { kind: "member", userId: t.userId })} className={row}>
                    <Face name={t.name} src={t.avatarUrl} kind="member" />
                    <span className="flex-1 min-w-0"><span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{t.name}</span>{!!t.roles?.length && <span className="block text-[12.5px] text-[#6B6680] truncate">{t.roles.join(", ")}</span>}</span>
                    {busy === `m:${t.userId}` ? <Loader2 className="w-4 h-4 animate-spin text-[#7D5CEF]" /> : value?.userId === t.userId && <Check className="w-4 h-4 text-[#7D5CEF]" />}
                  </button>
                ))}
                {(opts.people.length > 0) && <p className="px-3 pt-3 pb-1 text-[12px] font-bold text-[#8A8599]">Others who referred before</p>}
                {opts.people.map(p => (
                  <button key={p.referrerId} type="button" disabled={!!busy} onClick={() => { onChange({ id: p.referrerId, kind: "person", name: p.name, phone: p.phone, email: p.email }); setOpen(false); setQ(""); }} className={row}>
                    <Face name={p.name} kind="person" />
                    <span className="flex-1 min-w-0"><span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{p.name}</span>{(p.phone || p.email) && <span className="block text-[12.5px] text-[#6B6680] truncate">{p.phone || p.email}</span>}</span>
                    {value?.id === p.referrerId && <Check className="w-4 h-4 text-[#7D5CEF]" />}
                  </button>
                ))}
                {opts.clients.length > 0 && <p className="px-3 pt-3 pb-1 text-[12px] font-bold text-[#8A8599]">{s ? "Clients" : "Recent clients"}</p>}
                {opts.clients.map(c => (
                  <button key={c.clientId} type="button" disabled={!!busy} onClick={() => choose(`c:${c.clientId}`, { kind: "client", clientId: c.clientId })} className={row}>
                    <Face name={c.name} kind="client" />
                    <span className="flex-1 min-w-0"><span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{c.name}</span>{c.phone && <span className="block text-[12.5px] text-[#6B6680] truncate">{c.phone}</span>}</span>
                    {busy === `c:${c.clientId}` ? <Loader2 className="w-4 h-4 animate-spin text-[#7D5CEF]" /> : value?.clientId === c.clientId && <Check className="w-4 h-4 text-[#7D5CEF]" />}
                  </button>
                ))}
                {!team.length && !opts.people.length && !opts.clients.length && <p className="px-3 py-4 text-[13.5px] text-[#6B6680]">Nobody matches “{q}”. Add them below.</p>}
              </>
            )}
          </div>
          <div className="border-t border-[#EEEBF4] p-2.5">
            {!adding ? (
              <button type="button" onClick={() => { setAdding(true); setPerson(p => ({ ...p, name: p.name || q })); }} className="w-full h-11 rounded-[12px] text-[14.5px] font-semibold text-[#5B3FD0] hover:bg-[#F5F3FA] inline-flex items-center gap-2 px-3"><UserPlus className="w-4 h-4" />Someone else</button>
            ) : (
              // Not a <form>: the picker sits inside the client / program form, and a form inside a form would send the outer one.
              <div className="grid gap-2" onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); e.stopPropagation(); addPerson(); } }}>
                <p className="text-[13px] font-semibold text-[#4A4658]">Someone else <span className="font-normal text-[#8A8599]">· name and a phone or an email</span></p>
                <input aria-label="Name" className={inputCls} placeholder="Name" value={person.name} maxLength={150} onChange={e => setPerson({ ...person, name: e.target.value })} />
                <div className="grid sm:grid-cols-2 gap-2">
                  <input aria-label="Phone" className={inputCls} inputMode="tel" placeholder="Phone" value={person.phone} maxLength={30} onChange={e => setPerson({ ...person, phone: e.target.value })} />
                  <input aria-label="Email" className={inputCls} inputMode="email" placeholder="Email" value={person.email} maxLength={255} onChange={e => setPerson({ ...person, email: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAdding(false)} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[14px] font-semibold text-[#4A4658]">Back</button>
                  <button type="button" onClick={addPerson} disabled={busy === "p"} className="flex-1 h-10 rounded-full bg-[#7D5CEF] text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">{busy === "p" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add</button>
                </div>
              </div>
            )}
            {err && <p role="alert" className="mt-2 text-[13px] text-[#C2304F]">{err}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
