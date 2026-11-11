"use client";

/**
 * Write a contract: pick the program (its days, package and price fill in), pick a template,
 * adjust the details and text on the left — the page the client will sign is always on the right.
 * Also the home of one contract after it is saved: status, history, send, copy, delete.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Camera, Check, CheckCircle2, Copy, Eye, Loader2, PencilLine, Plus, Search, Send, Trash2, User, X,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { currencySymbol, getStudioCurrency } from "@/lib/format";
import { useAuth } from "@/context/auth-context";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW } from "@/components/ui/apple";
import { Field, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { ContractPaper } from "@/components/contracts/contract-paper";
import {
  BALANCE_OPTIONS, EMPTY_DETAILS, FIELDS, STATUS_META, clientFull, fieldValues, fmtDay, fmtDayTime,
  type ContractDetails, type ContractSection, type ContractStatus, type ContractStudio, type ContractTemplate,
} from "@/lib/contracts";
import { SectionsEditor } from "./sections-editor";
import { ShareDialog } from "./share-dialog";

type ClientLite = { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null };
type ProgramLite = { id: string; bookingNumber: string; eventName: string | null; eventDate: string | null; status?: string; client?: { firstName: string; lastName: string | null } | null };
type Activity = { at: string; type: string; note?: string };
type Saved = {
  id: string; contractNumber: string; status: ContractStatus; publicToken: string; activity: Activity[]; viewCount: number;
  signedAt: string | null; signerName: string | null; signatureKind: "drawn" | "typed" | null; signatureData: string | null; signerDevice: string | null;
  sentAt: string | null; createdAt: string; company?: ContractStudio;
};

const ACT_LABEL: Record<string, string> = { created: "Created", edited: "Changed", sent: "Sent to the client", viewed: "Opened by the client", signed: "Signed by the client" };
const errText = (d: { message?: string | string[] }, fallback: string) => (Array.isArray(d.message) ? d.message[0] : d.message) || fallback;

function Step({ n, title, sub, done, children }: { n: number; title: string; sub?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-3 px-1 mb-2.5">
        <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 transition-colors duration-300",
          done ? "bg-[#1F8A5B] text-white" : "bg-white text-[#5B3FD0] ring-1 ring-[#E4DEF8]")}>{done ? <Check className="w-4 h-4" strokeWidth={3} /> : n}</span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[#17151F] leading-tight">{title}</h2>
          {sub && <p className="text-[12.5px] text-[#6B6680]">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ContractEditor({ id, programId, templateId, openShare }: { id?: string; programId?: string; templateId?: string; /** open the share box as soon as it loads (just sent) */ openShare?: boolean }) {
  const router = useRouter();
  const { companyName, companyLogo } = useAuth();
  const [loading, setLoading] = useState(!!id);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [client, setClient] = useState<ClientLite | null>(null);
  const [program, setProgram] = useState<ProgramLite | null>(null);
  const [typedTitle, setTypedTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [details, setDetails] = useState<ContractDetails>({ ...EMPTY_DETAILS, currency: getStudioCurrency() });
  const [sections, setSections] = useState<ContractSection[]>([]);
  const [textTouched, setTextTouched] = useState(false);
  const [tpl, setTpl] = useState<{ starters: ContractTemplate[]; custom: ContractTemplate[] } | null>(null);
  const [tplId, setTplId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const [share, setShare] = useState(!!openShare);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [by, setBy] = useState<"program" | "client">("program");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<(ProgramLite | ClientLite)[] | null>(null);
  const seq = useRef(0);

  const signed = saved?.status === "signed";
  const tplName = useMemo(() => [...(tpl?.starters ?? []), ...(tpl?.custom ?? [])].find(t => t.id === tplId)?.name ?? "", [tpl, tplId]);

  // ── Load ────────────────────────────────────────────────────────────────────
  const applyTemplate = useCallback((t: ContractTemplate) => { setTplId(t.id); setSections(t.sections.map(s => ({ ...s }))); setTextTouched(false); }, []);

  useEffect(() => {
    apiFetch(`${API}/contracts/templates`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      setTpl(d);
      if (!id) { const all: ContractTemplate[] = [...d.starters, ...d.custom]; applyTemplate(all.find(t => t.id === templateId) ?? d.starters[0]); }
    }).catch(() => undefined);
  }, [id, templateId, applyTemplate]);

  useEffect(() => {
    if (!id) return;
    apiFetch(`${API}/contracts/${id}`).then(async r => {
      if (!r.ok) { notify("Contract not found", { error: true }); router.replace("/contracts"); return; }
      const c = await r.json();
      setSaved(c); setClient(c.client); setProgram(c.booking); setTypedTitle(c.title); setTitleTouched(true);
      setDetails({ ...EMPTY_DETAILS, ...c.details }); setSections(c.sections ?? []); setTextTouched(true); setLoading(false);
    }).catch(() => { notify("Couldn't load the contract", { error: true }); setLoading(false); });
  }, [id, router]);

  const applyPrefill = useCallback((d: { booking: ProgramLite; client: ClientLite; details: ContractDetails }) => {
    setProgram(d.booking); setClient(d.client); setDetails({ ...EMPTY_DETAILS, ...d.details }); setDirty(true);
  }, []);
  const pickProgram = useCallback((bookingId: string) => {
    apiFetch(`${API}/contracts/prefill/${bookingId}`).then(async r => {
      if (!r.ok) { notify("Couldn't read that program", { error: true }); return; }
      applyPrefill(await r.json());
    }).catch(() => notify("Couldn't read that program", { error: true }));
  }, [applyPrefill]);
  useEffect(() => {
    if (id || !programId) return;
    let live = true;
    apiFetch(`${API}/contracts/prefill/${programId}`).then(r => (r.ok ? r.json() : null)).then(d => { if (live && d) applyPrefill(d); }).catch(() => undefined);
    return () => { live = false; };
  }, [id, programId, applyPrefill]);

  // Search programs or clients
  useEffect(() => {
    if (id || client) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ limit: "20" }); if (q.trim()) p.set("search", q.trim());
      const r = await apiFetch(`${API}/${by === "program" ? "bookings" : "clients"}?${p}`).catch(() => null);
      const d = r?.ok ? await r.json() : { data: [] };
      if (n !== seq.current) return;
      setFound(by === "program" ? (d.data ?? []).filter((b: ProgramLite) => !["cancelled", "refunded"].includes(b.status ?? "")) : d.data ?? []);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, by, id, client]);

  // Title follows the template and client until the studio types its own
  const title = titleTouched ? typedTitle : [tplName || "Agreement", clientFull(client)].filter(Boolean).join(" — ");
  const setTitle = (v: string) => { setTypedTitle(v); setTitleTouched(true); };

  // ── Change helpers ──────────────────────────────────────────────────────────
  const patch = (p: Partial<ContractDetails>) => { setDetails(d => ({ ...d, ...p })); setDirty(true); };
  const setEvent = (i: number, p: Partial<ContractDetails["events"][number]>) => patch({ events: details.events.map((e, k) => (k === i ? { ...e, ...p } : e)) });
  const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;

  async function chooseTemplate(t: ContractTemplate) {
    if (t.id === tplId && !textTouched) return;
    if (textTouched && sections.some(s => s.text.trim()) && !(await askConfirm({ title: `Use "${t.name}"?`, message: "The text you have now will be replaced with this template.", confirmLabel: "Replace text" }))) return;
    applyTemplate(t); setDirty(true);
  }

  // Fields used in the text that have no value yet — the client would see "[Package]"
  const unfilled = useMemo(() => {
    const v = fieldValues(details, "x", clientFull(client) || "", null);
    const used = new Set(sections.flatMap(x => [...x.text.matchAll(/\{(\w+)\}/g)].map(m => m[1])));
    return FIELDS.filter(f => used.has(f.key) && f.key !== "client" && !v[f.key]).map(f => f.label);
  }, [details, sections, client]);
  const missing = !client ? "Choose the program or client" : !title.trim() ? "Give the contract a title" : !sections.some(s => s.text.trim()) ? "Add the contract text" : "";

  async function save(): Promise<Saved | null> {
    if (missing || !client) { notify(missing, { error: true }); return null; }
    const body = { title: title.trim(), details, sections };
    const r = saved
      ? await apiFetch(`${API}/contracts/${saved.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await apiFetch(`${API}/contracts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, clientId: client.id, bookingId: program?.id ?? null }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(errText(d, "Couldn't save"), { error: true }); return null; }
    setDirty(false);
    if (saved) { setSaved(d); return d; }
    return d; // a new contract: the caller moves to its own page
  }

  async function onSave() {
    setBusy("save");
    try {
      const isNew = !saved; const c = await save();
      if (!c) return;
      notify("Saved");
      if (isNew) router.replace(`/contracts/${c.id}`);
    } finally { setBusy(""); }
  }
  async function onSend() {
    setBusy("send");
    try {
      const isNew = !saved;
      const c = dirty || !saved ? await save() : saved;
      if (!c) return;
      const r = await apiFetch(`${API}/contracts/${c.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(errText(d, "Couldn't send"), { error: true }); if (isNew) router.replace(`/contracts/${c.id}`); return; }
      if (isNew) { router.replace(`/contracts/${c.id}?share=1`); return; }
      setSaved(s => (s ? { ...s, status: d.status, sentAt: s.sentAt ?? new Date().toISOString(), activity: [...(s.activity ?? []), { at: new Date().toISOString(), type: "sent" }] } : s));
      setShare(true);
    } finally { setBusy(""); }
  }
  async function onDuplicate() {
    if (!saved) return;
    const r = await apiFetch(`${API}/contracts/${saved.id}/duplicate`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(errText(d, "Couldn't copy"), { error: true }); return; }
    notify("Copy made — change it and send"); router.push(`/contracts/${d.id}`);
  }
  async function onDelete() {
    if (!saved) return;
    if (!(await askConfirm({ title: "Delete this contract?", message: signed ? "It is signed. The client's link will stop working." : "The client's link will stop working.", confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/contracts/${saved.id}`, { method: "DELETE" });
    if (!r.ok) { notify("Couldn't delete", { error: true }); return; }
    notify("Contract deleted"); router.push("/contracts");
  }
  async function back() {
    if (dirty && !(await askConfirm({ title: "Leave without saving?", message: "Your changes will be lost.", confirmLabel: "Leave", danger: true }))) return;
    router.push("/contracts");
  }

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" aria-label="Loading" /></div>;

  const studio: ContractStudio = saved?.company ?? { name: companyName || "Your studio", logoUrl: companyLogo || null };
  const st = saved ? STATUS_META[saved.status] : null;
  const sym = currencySymbol(details.currency || undefined).trim();
  const pill = "h-10 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 flex-shrink-0";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button type="button" onClick={back} aria-label="Back to contracts" className="w-10 h-10 rounded-full bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB] flex items-center justify-center text-[#17151F] flex-shrink-0"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] sm:text-[24px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{saved ? saved.contractNumber : "New contract"}</h1>
            {st && <span className={cn("h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center", st.cls)}>{st.label}</span>}
          </div>
          <p className="text-[13px] text-[#6B6680] mt-0.5">{st ? st.hint : "The client's page shows exactly what they will read and sign."}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!signed && (
            <button type="button" onClick={onSave} disabled={!!busy || (!!saved && !dirty)} className={cn(pill, "bg-white text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB] flex-1 sm:flex-none justify-center")}>
              {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />}{saved ? (dirty ? "Save changes" : "Saved") : "Save draft"}
            </button>
          )}
          {signed ? (
            <button type="button" onClick={() => setShare(true)} className={cn(pill, "bg-[#7D5CEF] hover:bg-[#6143CF] text-white flex-1 sm:flex-none justify-center")}><Send className="w-4 h-4" />Share signed copy</button>
          ) : (
            <button type="button" onClick={onSend} disabled={!!busy} className={cn(pill, "bg-[#7D5CEF] hover:bg-[#6143CF] text-white flex-1 sm:flex-none justify-center")}>
              {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{saved && saved.status !== "draft" ? "Send again" : "Send to client"}
            </button>
          )}
        </div>
      </div>

      {/* Phone: switch between writing and the client's page */}
      <div role="tablist" aria-label="Show" className="lg:hidden grid grid-cols-2 p-1 rounded-full bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)] mb-4">
        {([["edit", "Write", PencilLine], ["preview", "Client's page", Eye]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={pane === k} onClick={() => setPane(k)}
            className={cn("h-9 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5", pane === k ? "bg-[#16141D] text-white" : "text-[#4A4658]")}><Icon className="w-3.5 h-3.5" />{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)] gap-6 items-start">
        {/* ── Left: write ── */}
        <div className={cn("min-w-0", pane === "preview" && "hidden lg:block")}>
          {saved && (
            <section className={cn("bg-white rounded-[20px] p-4 mb-6", CARD_SHADOW)}>
              {signed ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1F8A5B] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-[#17151F]">Signed by {saved.signerName}</p>
                    <p className="text-[13px] text-[#6B6680]">{fmtDayTime(saved.signedAt)}{saved.signerDevice ? ` · ${saved.signerDevice}` : ""}</p>
                    <p className="text-[13px] text-[#6B6680] mt-1.5">A signed contract can&apos;t be changed. To change something, make a copy and send it again.</p>
                  </div>
                </div>
              ) : (
                <ol className="flex items-center" aria-label="Progress">
                  {(["draft", "sent", "viewed", "signed"] as const).map((k, i, arr) => {
                    const at = arr.indexOf(saved.status); const on = i <= at;
                    return (
                      <li key={k} className="flex items-center flex-1 last:flex-none">
                        <span className="flex flex-col items-center gap-1">
                          <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold", on ? "bg-[#7D5CEF] text-white" : "bg-[#F1EFF6] text-[#9893A8]")}>{i < at ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}</span>
                          <span className={cn("text-[11.5px] font-semibold", on ? "text-[#17151F]" : "text-[#9893A8]")}>{STATUS_META[k].label}</span>
                        </span>
                        {i < arr.length - 1 && <span className={cn("flex-1 h-0.5 mx-1.5 mb-5 rounded-full", i < at ? "bg-[#7D5CEF]" : "bg-[#EEEBF4]")} />}
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="mt-4 pt-3 border-t border-[#EEEBF4] flex flex-wrap gap-2">
                {saved.status !== "draft" && <button type="button" onClick={() => setShare(true)} className="h-9 px-3.5 rounded-full bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" />Link &amp; share</button>}
                <button type="button" onClick={onDuplicate} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" />Make a copy</button>
                {program && <Link href={`/programs?view=${program.id}`} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" />Open program</Link>}
                <button type="button" onClick={onDelete} className="h-9 px-3.5 rounded-full text-[#C2304F] hover:bg-[#FDECEF] text-[13px] font-semibold inline-flex items-center gap-1.5 ml-auto"><Trash2 className="w-3.5 h-3.5" />Delete</button>
              </div>
              {(saved.activity?.length ?? 0) > 0 && (
                <details className="mt-3 group">
                  <summary className="text-[13px] font-semibold text-[#5B3FD0] cursor-pointer list-none">History{saved.viewCount ? ` · opened ${saved.viewCount} time${saved.viewCount === 1 ? "" : "s"}` : ""}</summary>
                  <ul className="mt-2 space-y-1.5">
                    {[...saved.activity].reverse().slice(0, 20).map((a, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-[13px]">
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 translate-y-[-1px]", a.type === "signed" ? "bg-[#1F8A5B]" : a.type === "viewed" ? "bg-[#9E3A8C]" : a.type === "sent" ? "bg-[#1F5C99]" : "bg-[#B5B0C4]")} />
                        <span className="text-[#17151F] font-medium">{ACT_LABEL[a.type] ?? a.type}{a.note ? ` — ${a.note}` : ""}</span>
                        <span className="text-[#9893A8] ml-auto flex-shrink-0">{fmtDayTime(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          {!signed && (
            <>
              <Step n={1} title={saved ? "Client" : "Program"} sub={saved ? undefined : "Its days, places, package and price fill in by themselves."} done={!!client}>
                <div className={cn("bg-white rounded-[20px] p-3.5", CARD_SHADOW)}>
                  {client ? (
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#5B3FD0] font-bold flex items-center justify-center flex-shrink-0">{(client.firstName || "?").charAt(0).toUpperCase()}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[#17151F] truncate">{clientFull(client)}</p>
                        <p className="text-[13px] text-[#6B6680] truncate">{program ? `${program.eventName || "Program"} · ${program.bookingNumber}${program.eventDate ? ` · ${fmtDay(program.eventDate)}` : ""}` : "No program — a general agreement"}</p>
                      </div>
                      {!saved && <button type="button" onClick={() => { setClient(null); setProgram(null); setDetails({ ...EMPTY_DETAILS, currency: getStudioCurrency() }); }} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658]">Change</button>}
                    </div>
                  ) : (
                    <>
                      <div role="radiogroup" aria-label="Make the contract for" className="inline-flex p-1 rounded-full bg-[#F1EFF6] mb-2.5">
                        {([["program", "A program", Camera], ["client", "Client only", User]] as const).map(([k, l, Icon]) => (
                          <button key={k} type="button" role="radio" aria-checked={by === k} onClick={() => { setBy(k); setFound(null); setQ(""); }}
                            className={cn("h-8 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5", by === k ? "bg-white text-[#17151F] shadow-[0_1px_3px_rgba(22,18,40,.12)]" : "text-[#6B6680]")}><Icon className="w-3.5 h-3.5" />{l}</button>
                        ))}
                      </div>
                      <div className="relative mb-2">
                        <Search className="w-4 h-4 text-[#A29DB3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder={by === "program" ? "Search program, number or client" : "Search client by name or phone"} className={cn(inputCls, "pl-10")} aria-label="Search" />
                      </div>
                      <div className="max-h-[260px] overflow-y-auto -mx-1">
                        {found === null ? <div className="space-y-2 p-1">{[0, 1, 2].map(i => <div key={i} className="sp-skel h-12 rounded-[12px]" />)}</div>
                          : found.length === 0 ? <p className="text-[13px] text-[#6B6680] p-3">Nothing found.</p>
                          : found.map(x => by === "program" ? (
                            <button key={x.id} type="button" onClick={() => pickProgram(x.id)} className="w-full text-left px-3 py-2.5 rounded-[12px] hover:bg-[#F5F3FA]">
                              <span className="block text-[14px] font-semibold text-[#17151F] truncate">{(x as ProgramLite).eventName || (x as ProgramLite).bookingNumber}</span>
                              <span className="block text-[12.5px] text-[#6B6680] truncate">{clientFull((x as ProgramLite).client)} · {(x as ProgramLite).bookingNumber}{(x as ProgramLite).eventDate ? ` · ${fmtDay((x as ProgramLite).eventDate)}` : ""}</span>
                            </button>
                          ) : (
                            <button key={x.id} type="button" onClick={() => { setClient(x as ClientLite); setDirty(true); }} className="w-full text-left px-3 py-2.5 rounded-[12px] hover:bg-[#F5F3FA]">
                              <span className="block text-[14px] font-semibold text-[#17151F] truncate">{clientFull(x as ClientLite)}</span>
                              <span className="block text-[12.5px] text-[#6B6680] truncate">{(x as ClientLite).phone || (x as ClientLite).email || "—"}</span>
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </Step>

              <Step n={2} title="Template" sub="Start from ready wording. You can change any line below." done={sections.length > 0}>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[...(tpl?.starters ?? []), ...(tpl?.custom ?? [])].map(t => {
                    const on = t.id === tplId;
                    return (
                      <button key={t.id} type="button" onClick={() => chooseTemplate(t)} aria-pressed={on}
                        className={cn("text-left p-3 rounded-[16px] bg-white transition-shadow relative", on ? "ring-2 ring-[#7D5CEF]" : "shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:shadow-[0_4px_14px_rgba(22,18,40,.08)]")}>
                        <span className="block text-[14px] font-bold text-[#17151F] pr-6">{t.name}</span>
                        <span className="block text-[12.5px] text-[#6B6680] mt-0.5 leading-snug">{t.description || (tpl?.custom.includes(t) ? "Your template" : "")}</span>
                        {on && <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#7D5CEF] flex items-center justify-center"><Check className="w-3 h-3 text-white" strokeWidth={3} /></span>}
                      </button>
                    );
                  })}
                  {!tpl && [0, 1, 2, 3].map(i => <div key={i} className="sp-skel h-[68px] rounded-[16px]" />)}
                </div>
              </Step>

              <Step n={3} title="Details" sub="Shown at the top of the contract.">
                <FormGroup>
                  <Field label="Contract title" required>{fid => <input id={fid} value={title} maxLength={200} onChange={e => { setTitle(e.target.value); setDirty(true); }} className={inputCls} />}</Field>
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-semibold text-[#4A4658] mb-2">Event days</p>
                    <div className="space-y-2">
                      {details.events.map((e, i) => (
                        <div key={i} className="grid grid-cols-[minmax(0,1fr)_132px_32px] gap-2 items-center">
                          <input value={e.name} maxLength={80} onChange={ev => setEvent(i, { name: ev.target.value })} placeholder="Day" aria-label={`Name of day ${i + 1}`} className={cn(inputCls, "h-10")} />
                          <input type="date" value={e.date ?? ""} onChange={ev => setEvent(i, { date: ev.target.value || null })} aria-label={`Date of day ${i + 1}`} className={cn(inputCls, "h-10 px-2")} />
                          <button type="button" onClick={() => patch({ events: details.events.filter((_, k) => k !== i) })} aria-label={`Remove day ${i + 1}`} className="w-8 h-8 rounded-full text-[#C2304F] hover:bg-[#FDECEF] flex items-center justify-center"><X className="w-4 h-4" /></button>
                          <input value={e.venue} maxLength={200} onChange={ev => setEvent(i, { venue: ev.target.value })} placeholder="Place" aria-label={`Place of day ${i + 1}`} className={cn(inputCls, "h-10 col-span-2")} />
                        </div>
                      ))}
                    </div>
                    {details.events.length < 20 && (
                      <button type="button" onClick={() => patch({ events: [...details.events, { name: "", date: null, venue: "" }] })} className="mt-2.5 h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#EEE8FD]"><Plus className="w-4 h-4" />Add day</button>
                    )}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px]">
                    <Field label="Package">{fid => <input id={fid} value={details.packageName} maxLength={150} onChange={e => patch({ packageName: e.target.value })} className={inputCls} />}</Field>
                    <Field label="Delivery (days)" className="pl-0">{fid => <input id={fid} inputMode="numeric" value={details.deliveryDays || ""} onChange={e => patch({ deliveryDays: Math.min(730, Math.round(num(e.target.value))) })} className={inputCls} />}</Field>
                  </div>
                </FormGroup>

                <FormGroup>
                  <SwitchRow label="Show price and payment" hint="The contract states the price and advance. Payments themselves stay on invoices." on={details.showFees} onChange={v => patch({ showFees: v })} />
                  {details.showFees && (
                    <>
                      <div className="grid grid-cols-2">
                        <Field label={`Total (${sym})`}>{fid => <input id={fid} inputMode="decimal" value={details.total || ""} placeholder="0" onChange={e => { const t = num(e.target.value); patch({ total: t, advance: Math.min(details.advance, t) }); }} className={inputCls} />}</Field>
                        <Field label={`Advance (${sym})`} className="pl-0">{fid => <input id={fid} inputMode="decimal" value={details.advance || ""} placeholder="0" onChange={e => patch({ advance: Math.min(num(e.target.value), details.total || Infinity) })} className={inputCls} />}</Field>
                      </div>
                      {details.total > 0 && (
                        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] text-[#6B6680]">Advance:</span>
                          {[30, 50, 100].map(p => {
                            const v = Math.round(details.total * p / 100);
                            return <button key={p} type="button" onClick={() => patch({ advance: v })} aria-pressed={details.advance === v}
                              className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold", details.advance === v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>{p}%</button>;
                          })}
                        </div>
                      )}
                      <Field label="Balance is due">{fid => (
                        <select id={fid} value={BALANCE_OPTIONS.some(o => o.value === details.balanceDue) ? details.balanceDue : "event_day"} onChange={e => patch({ balanceDue: e.target.value })} className={inputCls}>
                          {BALANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}</Field>
                    </>
                  )}
                </FormGroup>
              </Step>

              <Step n={4} title="Contract text" sub="Each section is numbered on the client's page." done={sections.some(s => s.text.trim())}>
                <SectionsEditor sections={sections} onChange={s => { setSections(s); setTextTouched(true); setDirty(true); }} />
              </Step>

              <p className={cn("px-1 text-[13px]", missing ? "text-[#6B6680]" : "text-[#1F8A5B] font-semibold")}>{missing || "Ready to send"}</p>
              {unfilled.length > 0 && (
                <p className="px-1 mt-1.5 text-[13px] text-[#9E3A8C]" role="status">Not filled in yet: <strong>{unfilled.join(", ")}</strong>. Fill {unfilled.length === 1 ? "it" : "them"} in under Details, or remove {unfilled.length === 1 ? "it" : "them"} from the text.</p>
              )}
            </>
          )}
        </div>

        {/* ── Right: what the client sees ── */}
        <div className={cn("min-w-0 lg:sticky lg:top-4", pane === "edit" && "hidden lg:block")}>
          <p className="hidden lg:flex items-center gap-1.5 px-1 mb-2 text-[12.5px] font-semibold text-[#6B6680] max-w-[940px] mx-auto w-full"><Eye className="w-3.5 h-3.5" />Client&apos;s page{signed ? "" : " — live preview"}</p>
          <div className="lg:max-h-[calc(100dvh-150px)] lg:overflow-y-auto lg:rounded-[20px] lg:pb-1">
            <ContractPaper className="max-w-[940px] mx-auto" studio={studio} clientName={clientFull(client)} title={title} number={saved?.contractNumber} details={details} sections={sections}
              madeOn={saved?.sentAt ?? saved?.createdAt}
              signature={signed && saved ? { name: saved.signerName, kind: saved.signatureKind, image: saved.signatureData, signedAt: saved.signedAt, device: saved.signerDevice } : null} />
          </div>
        </div>
      </div>

      {share && saved && client && <ShareDialog contract={{ id: saved.id, title, publicToken: saved.publicToken, client }} studioName={studio.name} signed={signed} onClose={() => { setShare(false); if (openShare && saved) router.replace(`/contracts/${saved.id}`); }} />}
      <span className="sr-only" aria-live="polite">{busy === "save" ? "Saving" : busy === "send" ? "Sending" : ""}</span>
    </div>
  );
}
