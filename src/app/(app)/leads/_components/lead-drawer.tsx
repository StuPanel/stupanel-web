"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2, CalendarPlus, CalendarX2, Camera, Check, FileText, Loader2, Mail, MessageCircle, NotebookPen,
  Phone, PhoneCall, Plus, Target, Trash2, Users, X, XCircle,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, PillPicker, inputCls } from "@/components/ui/form-kit";
import { CLIENT_SOURCES } from "@/components/client-form-fields";
import { waLink } from "@/lib/portal-session";
import {
  LOST_REASONS, STAGES, ago, followUpChoices, followUpInfo, longDay, lostLabel, money, stageOf, todayStr,
  type Lead, type LeadStage,
} from "./lead-kit";
import { currencySymbol, fmtMoney } from "@/lib/format";

type Form = {
  name: string; phone: string; email: string; eventType: string; eventDates: string[]; venue: string;
  budget: string; source: string; referredBy: string; notes: string; followUpAt: string | null; stage: LeadStage;
};
const blank: Form = {
  name: "", phone: "", email: "", eventType: "", eventDates: [], venue: "", budget: "", source: "",
  referredBy: "", notes: "", followUpAt: null, stage: "new",
};
const fromLead = (l: Lead): Form => ({
  name: l.name, phone: l.phone ?? "", email: l.email ?? "", eventType: l.eventType ?? "",
  eventDates: Array.isArray(l.eventDates) ? l.eventDates : [], venue: l.venue ?? "",
  budget: l.budget != null && money(l.budget) ? String(money(l.budget)) : "", source: l.source ?? "",
  referredBy: l.referredBy ?? "", notes: l.notes ?? "", followUpAt: l.followUpAt, stage: l.stage,
});

type DayCheck = { date: string; programs: { id: string; name: string }[]; busyMembers: number; freeMembers: number };

const ACT_ICON: Record<string, React.ElementType> = {
  call: PhoneCall, whatsapp: MessageCircle, email: Mail, meeting: Users, note: NotebookPen,
  stage: Target, quote: FileText, booked: Camera, client: Check, created: Plus,
};

/** Is the studio free on these dates? Shown while adding the lead, before you promise anything. */
function DateCheck({ dates }: { dates: string[] }) {
  const key = dates.filter(Boolean).sort().join(",");
  const [data, setData] = useState<{ team: number; dates: DayCheck[] } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!key) { setData(null); return; }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch(`${API}/leads/availability?dates=${encodeURIComponent(key)}`)
        .then(r => (r.ok ? r.json() : null)).then(d => { if (alive) setData(d); })
        .catch(() => {}).finally(() => alive && setLoading(false));
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [key]);
  if (!key) return null;
  return (
    <div className="px-4 py-3 space-y-2">
      {loading && !data && <p className="text-xs text-[#6B6680] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Checking your calendar…</p>}
      {data?.dates.map(d => {
        const free = d.programs.length === 0;
        return (
          <div key={d.date} className={cn("flex items-start gap-2.5 rounded-[12px] px-3 py-2.5", free ? "bg-[#E2F4EA]" : "bg-[#FCF0DE]")}>
            {free ? <CalendarCheck2 className="w-4 h-4 mt-0.5 text-[#1F8A5B] flex-shrink-0" /> : <CalendarX2 className="w-4 h-4 mt-0.5 text-[#B4690E] flex-shrink-0" />}
            <div className="min-w-0 text-[13px] leading-snug">
              <p className="font-semibold text-[#17151F]">{longDay(d.date)} — {free ? "you're free" : `${d.programs.length} program${d.programs.length > 1 ? "s" : ""} already`}</p>
              <p className="text-[#4A4658]">
                {!free && <>{d.programs.slice(0, 2).map(p => p.name).join(", ")}{d.programs.length > 2 ? ` +${d.programs.length - 2}` : ""} · </>}
                {data.team ? `${d.freeMembers} of ${data.team} team free` : "No team added yet"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LeadDrawer({ open, lead, workTypes, onClose, onSaved }: {
  open: boolean; lead: Lead | null; workTypes: string[];
  onClose: () => void; onSaved: (l?: Lead) => void;
}) {
  const router = useRouter();
  const isNew = !lead;
  const [f, setF] = useState<Form>(blank);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"" | "quote" | "program" | "log" | "lost">("");
  const [error, setError] = useState("");
  /** Same phone/email is already an open lead — open it, or add anyway. */
  const [dup, setDup] = useState<{ id: string; name: string; stage: string } | null>(null);
  const [logKind, setLogKind] = useState<"call" | "whatsapp" | "meeting" | "note">("call");
  const [logText, setLogText] = useState("");
  const [logFollow, setLogFollow] = useState<string | null | undefined>(undefined);
  const [lostOpen, setLostOpen] = useState(false);
  const [current, setCurrent] = useState<Lead | null>(lead);

  useEffect(() => {
    if (!open) return;
    setCurrent(lead);
    setF(lead ? fromLead(lead) : { ...blank, followUpAt: followUpChoices()[1].value });
    setError(""); setDup(null); setLogText(""); setLogFollow(undefined); setLogKind("call"); setLostOpen(false);
  }, [open, lead]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));
  const choices = useMemo(() => followUpChoices(), []);
  // `current` catches up one render after a new lead is opened — use the prop until then.
  const l = current && current.id === lead?.id ? current : lead;

  function body() {
    const dates = [...new Set(f.eventDates.filter(Boolean))].sort();
    return {
      name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), eventType: f.eventType.trim(),
      eventDates: dates, venue: f.venue.trim(), budget: f.budget.trim() ? Number(f.budget) : null,
      source: f.source, referredBy: f.source === "referral" ? f.referredBy.trim() : "", notes: f.notes.trim(),
      followUpAt: f.followUpAt, ...(isNew ? { stage: f.stage } : {}),
    };
  }

  async function save(close = true, allowDuplicate = false): Promise<Lead | null> {
    if (!f.name.trim()) { setError("Please write the name."); return null; }
    if (f.budget.trim() && isNaN(Number(f.budget))) { setError("Budget should be a number."); return null; }
    setSaving(true); setError(""); setDup(null);
    try {
      const r = await apiFetch(isNew ? `${API}/leads` : `${API}/leads/${l!.id}`, {
        method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body(), ...(isNew && allowDuplicate ? { allowDuplicate: true } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d?.code === "LEAD_EXISTS" && d.lead) { setDup(d.lead); return null; }
      if (!r.ok) { setError(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save."); return null; }
      notify(isNew ? "Lead added" : "Saved");
      onSaved(d);
      if (close) onClose();
      return d as Lead;
    } catch { setError("Something went wrong. Please try again."); return null; }
    finally { setSaving(false); }
  }

  async function setStage(stage: LeadStage, lostReason?: string) {
    if (!l || stage === l.stage) return;
    if (stage === "lost" && !lostReason) { setLostOpen(true); return; }
    setBusy(stage === "lost" ? "lost" : "");
    const r = await apiFetch(`${API}/leads/${l.id}/move`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, position: 0, ...(lostReason ? { lostReason } : {}) }),
    }).catch(() => null);
    setBusy("");
    if (!r?.ok) { notify("Couldn't move it", { error: true }); return; }
    const d = await r.json();
    setCurrent(d); setF(p => ({ ...p, stage: d.stage, followUpAt: d.followUpAt })); setLostOpen(false);
    notify(`Moved to ${stageOf(stage).label}`);
    onSaved(d);
  }

  async function logIt() {
    if (!l) return;
    if (logKind === "note" && !logText.trim()) { notify("Write the note first", { error: true }); return; }
    setBusy("log");
    const r = await apiFetch(`${API}/leads/${l.id}/activity`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: logKind, text: logText.trim() || undefined, ...(logFollow !== undefined ? { followUpAt: logFollow } : {}) }),
    }).catch(() => null);
    setBusy("");
    if (!r?.ok) { notify("Couldn't save", { error: true }); return; }
    const d = await r.json();
    setCurrent(d); setF(p => ({ ...p, stage: d.stage, followUpAt: d.followUpAt }));
    setLogText(""); setLogFollow(undefined);
    notify("Saved to the timeline");
    onSaved(d);
  }

  /** Make (or find) the client, then open the quote / program form for them. */
  async function goTo(kind: "quote" | "program") {
    if (!l) return;
    if (f.name !== l.name || f.phone !== (l.phone ?? "") || f.email !== (l.email ?? "")) {
      if (!(await save(false))) return;
    }
    setBusy(kind);
    const r = await apiFetch(`${API}/leads/${l.id}/convert`, { method: "POST" }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setBusy("");
    if (!r?.ok) { notify(Array.isArray(d?.message) ? d.message[0] : d?.message || "Couldn't save the client", { error: true }); return; }
    if (d.created) notify("Saved as a client");
    onClose();
    router.push(kind === "quote" ? `/quotes?newFor=${d.clientId}&lead=${l.id}` : `/programs?newFor=${d.clientId}&lead=${l.id}`);
  }

  async function remove() {
    if (!l) return;
    if (!(await askConfirm({ title: "Delete this lead?", message: `${l.name} will be removed from the board.`, confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/leads/${l.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't delete", { error: true }); return; }
    notify("Lead deleted"); onSaved(); onClose();
  }

  const st = stageOf(l?.stage ?? f.stage);
  const fu = followUpInfo(l?.followUpAt ?? null);
  const greet = `Hi ${f.name.split(" ")[0] || ""}, `;
  const wa = waLink(f.phone, greet);
  const closed = l?.stage === "booked" || l?.stage === "lost";

  return (
    <FormDrawer open={open} onClose={onClose} icon={Target} color="violet"
      title={isNew ? "New lead" : l!.name}
      sub={isNew ? "Someone asked about a shoot" : <>{st.label}{l!.eventType ? ` · ${l!.eventType}` : ""}{l!.lastContactAt ? ` · last talked ${ago(l!.lastContactAt)}` : ""}</>}
      footer={<>
        {!isNew && (
          <button type="button" onClick={remove} aria-label="Delete lead"
            className="h-11 w-11 flex items-center justify-center rounded-full bg-[#FDECEF] text-[#C2304F] hover:bg-[#F8D5DC] flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#EEEBF4] text-[#4A4658] text-sm font-semibold flex-1 sm:flex-none">Close</button>
        <button type="button" onClick={() => save()} disabled={saving}
          className="h-11 px-6 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{isNew ? "Add lead" : "Save changes"}
        </button>
      </>}>

      {error && <p className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-sm">{error}</p>}
      {dup && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FCF0DE] text-[#7A4A0B] text-sm">
          <p><b>{dup.name}</b> is already a lead with this phone or email ({stageOf(dup.stage).label}).</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => { const id = dup.id; setDup(null); onClose(); router.push(`/leads?open=${id}`); }}
              className="h-9 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold">Open that lead</button>
            <button type="button" onClick={() => save(true, true)} disabled={saving}
              className="h-9 px-4 rounded-full bg-white text-[#17151F] text-[13px] font-semibold disabled:opacity-50">Add as a new lead</button>
          </div>
        </div>
      )}

      {!isNew && l && (
        <>
          {/* Stage + contact */}
          <div className={cn("bg-white rounded-[20px] p-4 mb-5", CARD_SHADOW)}>
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Stage">
              {STAGES.map(s => {
                const on = s.key === l.stage;
                return (
                  <button key={s.key} type="button" role="radio" aria-checked={on} onClick={() => setStage(s.key)}
                    className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors flex-shrink-0",
                      on ? "text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}
                    style={on ? { background: s.color } : undefined}>
                    {s.label}
                  </button>
                );
              })}
            </div>
            {l.stage === "lost" && <p className="mt-2 text-[13px] text-[#6B6680]">Lost — {lostLabel(l.lostReason)}</p>}
            {lostOpen && (
              <div className="mt-3 rounded-[14px] bg-[#F5F3FA] p-3">
                <p className="text-[13px] font-semibold text-[#17151F] mb-2">Why was it lost?</p>
                <div className="flex flex-wrap gap-1.5">
                  {LOST_REASONS.map(r => (
                    <button key={r.value} type="button" disabled={busy === "lost"} onClick={() => setStage("lost", r.value)}
                      className="h-8 px-3 rounded-full bg-white text-[12.5px] font-semibold text-[#4A4658] hover:bg-[#EEEBF4]">{r.label}</button>
                  ))}
                  <button type="button" onClick={() => setLostOpen(false)} className="h-8 px-3 text-[12.5px] text-[#6B6680]">Cancel</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <a href={f.phone ? `tel:${f.phone}` : undefined} aria-disabled={!f.phone}
                className={cn("h-10 rounded-[12px] inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold", f.phone ? "bg-[#E3EEF9] text-[#1F5C99]" : "bg-[#F5F3FA] text-[#A29DB3] pointer-events-none")}>
                <Phone className="w-4 h-4" />Call
              </a>
              <a href={wa ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!wa}
                className={cn("h-10 rounded-[12px] inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold", wa ? "bg-[#E2F4EA] text-[#1F8A5B]" : "bg-[#F5F3FA] text-[#A29DB3] pointer-events-none")}>
                <MessageCircle className="w-4 h-4" />WhatsApp
              </a>
              <a href={f.email ? `mailto:${f.email}` : undefined} aria-disabled={!f.email}
                className={cn("h-10 rounded-[12px] inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold", f.email ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-[#F5F3FA] text-[#A29DB3] pointer-events-none")}>
                <Mail className="w-4 h-4" />Email
              </a>
            </div>
          </div>

          {/* Next step */}
          {!closed && (
            <FormGroup title="What happened?" note={fu ? <>Next follow-up: <b className={cn(fu.tone === "late" ? "text-[#C2304F]" : fu.tone === "today" ? "text-[#B4690E]" : "text-[#4A4658]")}>{fu.text}</b></> : "No follow-up set."}>
              <div className="px-4 py-3.5 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {([["call", "Called", PhoneCall], ["whatsapp", "WhatsApp", MessageCircle], ["meeting", "Met", Users], ["note", "Note", NotebookPen]] as const).map(([k, label, Icon]) => (
                    <button key={k} type="button" onClick={() => setLogKind(k)}
                      className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold inline-flex items-center gap-1.5",
                        logKind === k ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
                <textarea value={logText} onChange={e => setLogText(e.target.value)} rows={2}
                  placeholder={logKind === "note" ? "Write a note…" : "What did they say? (optional)"}
                  className={cn(inputCls, "h-auto py-2.5 resize-none")} />
                <div>
                  <p className="text-[12px] font-semibold text-[#6B6680] mb-1.5">Follow up again</p>
                  <div className="flex flex-wrap gap-1.5">
                    {choices.map(c => (
                      <button key={c.label} type="button" onClick={() => setLogFollow(logFollow === c.value ? undefined : c.value)}
                        className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold",
                          logFollow === c.value ? "bg-[#7D5CEF] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>{c.label}</button>
                    ))}
                    <input type="date" aria-label="Pick a follow-up date" min={todayStr()}
                      value={logFollow && !choices.some(c => c.value === logFollow) ? logFollow.slice(0, 10) : ""}
                      onChange={e => setLogFollow(e.target.value ? new Date(`${e.target.value}T10:00:00`).toISOString() : undefined)}
                      className="h-8 px-2.5 rounded-full bg-[#F5F3FA] text-[12.5px] text-[#4A4658] outline-none" />
                    <button type="button" onClick={() => setLogFollow(logFollow === null ? undefined : null)}
                      className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold", logFollow === null ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>None</button>
                  </div>
                </div>
                <button type="button" onClick={logIt} disabled={busy === "log"}
                  className="h-10 w-full rounded-full bg-[#17151F] hover:bg-black text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy === "log" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save to timeline
                </button>
              </div>
            </FormGroup>
          )}

          {/* Turn it into business */}
          <FormGroup title="Quote & booking">
            {l.quote && (
              <a href="/quotes" className="flex items-center gap-3 px-4 py-3 hover:bg-[#FBFAFE]">
                <FileText className="w-4 h-4 text-[#9E3A8C]" />
                <span className="flex-1 text-[14px] text-[#17151F]">Quote {l.quote.quoteNumber} <span className="text-[#6B6680]">· {l.quote.status}</span></span>
                <span className="text-[13px] font-semibold text-[#17151F]">{fmtMoney(money(l.quote.grandTotal))}</span>
              </a>
            )}
            {l.booking && (
              <a href={`/programs?view=${l.booking.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FBFAFE]">
                <Camera className="w-4 h-4 text-[#1F8A5B]" />
                <span className="flex-1 text-[14px] text-[#17151F]">{l.booking.eventName || l.booking.bookingNumber}</span>
                <span className="text-[13px] font-semibold text-[#17151F]">{fmtMoney(money(l.booking.grandTotal))}</span>
              </a>
            )}
            {!l.booking && (
              <div className="grid grid-cols-2 gap-2 px-4 py-3.5">
                <button type="button" onClick={() => goTo("quote")} disabled={!!busy}
                  className="h-11 rounded-[14px] bg-[#F7E6F3] text-[#9E3A8C] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {busy === "quote" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}{l.quote ? "New quote" : "Make a quote"}
                </button>
                <button type="button" onClick={() => goTo("program")} disabled={!!busy}
                  className="h-11 rounded-[14px] bg-[#1F8A5B] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {busy === "program" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}Book program
                </button>
              </div>
            )}
          </FormGroup>
        </>
      )}

      {/* Details */}
      <FormGroup title={isNew ? "Who is asking?" : "Details"}>
        <Field label="Name" required>{id => <input id={id} value={f.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Nusrat Jahan" className={inputCls} autoFocus={isNew} />}</Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-[#EEEBF4]">
          <Field label="Phone / WhatsApp">{id => <input id={id} value={f.phone} onChange={e => set("phone", e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" className={inputCls} />}</Field>
          <Field label="Email">{id => <input id={id} value={f.email} onChange={e => set("email", e.target.value)} inputMode="email" placeholder="name@gmail.com" className={inputCls} />}</Field>
        </div>
        <Field label="Where did they find you?">
          {() => <PillPicker label="Source" options={CLIENT_SOURCES} value={f.source} onChange={v => set("source", f.source === v ? "" : v)} />}
        </Field>
        {f.source === "referral" && (
          <Field label="Referred by">{id => <input id={id} value={f.referredBy} onChange={e => set("referredBy", e.target.value)} placeholder="Who sent them?" className={inputCls} />}</Field>
        )}
      </FormGroup>

      <FormGroup title="The event" note={f.eventDates.length ? "We check your programs and team for these dates." : undefined}>
        <Field label="Event type">
          {id => (
            <>
              <input id={id} list="lead-event-types" value={f.eventType} onChange={e => set("eventType", e.target.value)} placeholder="Wedding, Holud, Birthday…" className={inputCls} />
              <datalist id="lead-event-types">{workTypes.map(w => <option key={w} value={w} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Event dates" hint="Add every day of the event.">
          {id => (
            <div className="space-y-2">
              {f.eventDates.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input id={i === 0 ? id : undefined} type="date" value={d} min={isNew ? todayStr() : undefined}
                    onChange={e => set("eventDates", f.eventDates.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
                  <button type="button" aria-label="Remove date" onClick={() => set("eventDates", f.eventDates.filter((_, j) => j !== i))}
                    className="w-11 h-11 flex-shrink-0 rounded-[12px] bg-[#F5F3FA] text-[#6B6680] flex items-center justify-center hover:bg-[#EEEBF4]"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => set("eventDates", [...f.eventDates, ""])}
                className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />{f.eventDates.length ? "Add another day" : "Add a date"}
              </button>
            </div>
          )}
        </Field>
        <DateCheck dates={f.eventDates} />
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-[#EEEBF4]">
          <Field label="Venue">{id => <input id={id} value={f.venue} onChange={e => set("venue", e.target.value)} placeholder="Hall / area" className={inputCls} />}</Field>
          <Field label={`Budget (${currencySymbol().trim()})`}>{id => <input id={id} value={f.budget} onChange={e => set("budget", e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" placeholder="e.g. 60000" className={inputCls} />}</Field>
        </div>
      </FormGroup>

      {isNew && (
        <FormGroup title="Next step">
          <Field label="Follow up">
            {() => (
              <div className="flex flex-wrap gap-1.5">
                {choices.map(c => (
                  <button key={c.label} type="button" onClick={() => set("followUpAt", f.followUpAt === c.value ? null : c.value)}
                    className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold", f.followUpAt === c.value ? "bg-[#7D5CEF] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{c.label}</button>
                ))}
                <button type="button" onClick={() => set("followUpAt", null)}
                  className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold", f.followUpAt === null ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>None</button>
              </div>
            )}
          </Field>
          <Field label="Stage">
            {() => <PillPicker label="Stage" options={STAGES.filter(s => s.key !== "booked" && s.key !== "lost").map(s => ({ value: s.key, label: s.label }))} value={f.stage} onChange={v => set("stage", v)} />}
          </Field>
        </FormGroup>
      )}

      <FormGroup title="Notes">
        <div className="px-4 py-3.5">
          <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Package they liked, special requests…"
            className={cn(inputCls, "h-auto py-2.5 resize-none")} aria-label="Notes" />
        </div>
      </FormGroup>

      {!isNew && l && l.activity?.length > 0 && (
        <FormGroup title="Timeline">
          <ol className="px-4 py-3">
            {l.activity.slice(0, 40).map((a, i) => {
              const Icon = ACT_ICON[a.kind] ?? NotebookPen;
              return (
                <li key={i} className="flex gap-3 py-2">
                  <span className="w-7 h-7 rounded-full bg-[#F5F3FA] flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-[#5B3FD0]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-[#17151F] break-words whitespace-pre-line">{a.text}</p>
                    <p className="text-[11.5px] text-[#6B6680] mt-0.5">{a.byName ? `${a.byName} · ` : ""}{ago(a.at)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </FormGroup>
      )}
      {!isNew && l?.stage === "lost" && (
        <button type="button" onClick={() => setStage("new")} className="w-full h-10 mb-4 rounded-full bg-white text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
          <XCircle className="w-4 h-4" />Open it again
        </button>
      )}
    </FormDrawer>
  );
}
