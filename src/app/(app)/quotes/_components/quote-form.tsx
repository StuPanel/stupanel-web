"use client";

/**
 * New / edit quote — laid out like the program form so a quote turns into a program cleanly:
 * 1 Client · 2 Program (type + package) · 3 Days (Holud, Wedding… each with date & venue)
 * · 4 Price (package line, extras from Packages → Extras, own lines) · 5 Terms.
 */
import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, FileText, Loader2, MapPin, Minus, Package as PackageIcon, Plus, Sparkles, Trash2, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CURRENCY_OPTIONS, currencyPad, currencySymbol, fmtDate, formatCurrency, getStudioCurrency, localDateStr } from "@/lib/format";
import { notify } from "@/components/feedback";
import { Tile } from "@/components/ui/apple";
import { Field, inputCls } from "@/components/ui/form-kit";
import { blankClientForm, type ClientFormData } from "@/components/client-form-fields";
import { jumpToField } from "@/lib/jump-to-field";
import { countsDays, extraLook, unitLabel, type Extra } from "@/lib/extras";
import { Card, ClientPicker, Section, dayName, saveNewClient } from "../../programs/_components/program-drawer";
import { summaryLines, type Pkg } from "../../packages/_components/summary";
import { loadExtras } from "../../packages/_components/extras";

export type QClient = { id: string; firstName: string; lastName?: string | null; phone?: string | null };
export type QDay = { id: string; programType?: string; eventType: string; date: string; location: string };
export type QLine = {
  id: string; name: string; description?: string; qty: number; unitPrice: number; total: number;
  isPackageBase?: boolean; kind?: "package" | "extra" | "custom"; catalogId?: string; unit?: string; days?: string[];
};
export type QuoteForForm = {
  id: string; quoteNumber: string; version: number; status: string; currency: string;
  eventType?: string | null; eventDate?: string | null; venue?: string | null; eventDays?: QDay[] | null;
  programId?: string | null; items: QLine[];
  discountType?: string | null; discountValue?: number | string; taxPercent?: number | string; advanceRequired: number | string;
  validUntil?: string | null; notes?: string | null; termsAndConditions?: string | null;
  client: QClient;
};
export type QuotePrefill = { client: QClient; eventType?: string; eventDates?: string[]; venue?: string };
type WorkType = { id: string; name: string; active?: boolean; events?: { id: string; name: string }[] };

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: string | number | null | undefined) => { const n = Number(v); return isFinite(n) ? n : 0; };
const fullName = (c: { firstName: string; lastName?: string | null }) => `${c.firstName} ${c.lastName ?? ""}`.trim();
const DEFAULT_TERMS = "1. 50% advance payment required to confirm booking.\n2. Full payment due on event day.\n3. Edited photos delivered within 30 working days.\n4. This quote is valid until the date mentioned above.";
const lineOf = (l: QLine): QLine => ({ ...l, total: r2(l.qty * l.unitPrice) });

export function QuoteForm({ quote, prefill, onClose, onSaved }: {
  quote: QuoteForForm | null; prefill?: QuotePrefill | null; onClose: () => void; onSaved: (q: { id: string }) => void;
}) {
  const isEdit = !!quote;
  // ── who ──
  const [client, setClient] = useState<QClient | null>(quote?.client ?? prefill?.client ?? null);
  const [clientMode, setClientMode] = useState<"search" | "new">("search");
  const [newClient, setNewClient] = useState<ClientFormData>(blankClientForm);
  // ── studio setup ──
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  // ── program ──
  const initialDays = (): QDay[] => {
    if (quote?.eventDays?.length) return quote.eventDays.map(d => ({ ...d, location: d.location ?? "" }));
    if (quote?.eventDate) return [{ id: uid(), eventType: quote.eventType ?? "", date: String(quote.eventDate).slice(0, 10), location: quote.venue ?? "" }];
    if (prefill?.eventDates?.length) return prefill.eventDates.slice(0, 15).map(d => ({ id: uid(), eventType: "", date: d.slice(0, 10), location: prefill.venue ?? "" }));
    return [];
  };
  const [days, setDays] = useState<QDay[]>(initialDays);
  const [initialType] = useState(quote?.eventDays?.find(d => d.programType)?.programType ?? "");
  const [programType, setProgramType] = useState(initialType);
  const [typeText] = useState(quote?.eventType ?? prefill?.eventType ?? ""); // matched to a type once types load
  const [packageId, setPackageId] = useState(quote?.programId ?? "");
  // ── price ──
  const [lines, setLines] = useState<QLine[]>(() => (quote?.items ?? []).map(l => lineOf({ ...l, qty: num(l.qty) || 1, unitPrice: num(l.unitPrice), kind: l.kind ?? (l.isPackageBase ? "package" : "custom") })));
  const [currency, setCurrency] = useState(quote?.currency ?? getStudioCurrency());
  const [discountType, setDiscountType] = useState<"" | "percent" | "fixed">((quote?.discountType as "percent" | "fixed") || (isEdit ? "" : "percent"));
  const [discountValue, setDiscountValue] = useState(String(num(quote?.discountValue) || ""));
  const [taxPercent, setTaxPercent] = useState(String(num(quote?.taxPercent) || ""));
  const [advance, setAdvance] = useState(isEdit ? String(num(quote!.advanceRequired)) : "");
  const [advanceTouched, setAdvanceTouched] = useState(isEdit);
  const [advancePct, setAdvancePct] = useState(50);
  // ── terms ──
  const [validUntil, setValidUntil] = useState(quote?.validUntil ? String(quote.validUntil).slice(0, 10) : "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.termsAndConditions ?? DEFAULT_TERMS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => {
      const types: WorkType[] = (d?.workTypes ?? []).filter((w: WorkType) => w.active !== false);
      setWorkTypes(types);
      // An old quote / a lead knows the type by name ("Muslim wedding", "Wedding"); unnamed days take its parts in order.
      const known = types.find(w => w.id === initialType) ?? types.find(w => w.name.toLowerCase() === typeText.trim().toLowerCase());
      if (!known) return;
      setProgramType(cur => cur || known.id);
      const ps = (known.events ?? []).map(e => e.name).filter(Boolean);
      setDays(ds => ds.some(d => !d.eventType.trim()) ? ds.map((d, i) => d.eventType.trim() ? d : { ...d, eventType: ps[i] ?? "" }) : ds);
    }).catch(() => {});
    apiFetch(`${API}/packages`).then(r => (r.ok ? r.json() : [])).then(d => setPkgs(Array.isArray(d) ? d : (d?.data ?? []))).catch(() => {});
    loadExtras().then(setExtras).catch(() => {});
    if (!isEdit) {
      apiFetch(`${API}/companies/me`).then(r => (r.ok ? r.json() : null)).then(d => {
        if (!d) return;
        if (d.defaultTerms) setTerms(d.defaultTerms);
        if (d.defaultValidityDays) { const dt = new Date(); dt.setDate(dt.getDate() + Number(d.defaultValidityDays)); setValidUntil(localDateStr(dt)); }
        if (d.defaultAdvancePercent) setAdvancePct(Number(d.defaultAdvancePercent));
        // The studio's one tax setting (Settings → Tax).
        const vat = d.invoiceDesign?.vat;
        if (vat?.on && Number(vat.percent) > 0) setTaxPercent(String(vat.percent));
      }).catch(() => {});
    }
  }, [isEdit, typeText, initialType]);

  // ── type, package, days ──
  const type = workTypes.find(w => w.id === programType);
  function partsOf(id: string) {
    const w = workTypes.find(x => x.id === id);
    if (!w) return [] as string[];
    return (w.events ?? []).map(e => e.name).filter(Boolean);
  }
  const parts = programType ? partsOf(programType) : [];
  const missingParts = parts.filter(n => !days.some(d => d.eventType.trim().toLowerCase() === n.toLowerCase()));
  const untouched = (ds: QDay[]) => ds.every(d => !d.date && !d.location.trim());
  const makeDay = (eventType: string, location = ""): QDay => ({ id: uid(), eventType, date: "", location });
  const flash = (id: string) => {
    setFlashId(id);
    setTimeout(() => document.getElementById(`qd-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => setFlashId(f => (f === id ? null : f)), 1600);
  };

  /** Pick a type: while no day has a date or venue yet, its parts become the days. */
  function pickType(id: string) {
    const next = programType === id ? "" : id;
    setProgramType(next);
    if (!next) return;
    const ps = partsOf(next);
    setDays(ds => (untouched(ds) && ps.length ? ps.map(n => makeDay(n)) : ds));
  }
  const offered = pkgs.filter(p => p.isActive !== false || p.id === packageId);
  /** Pick a package: its line goes on top, its type and days fill in (days only while untouched; else missing ones are added). */
  function choosePackage(id: string) {
    setPackageId(id);
    const p = pkgs.find(x => x.id === id);
    if (!p) { setLines(ls => ls.filter(l => l.kind !== "package")); return; }
    const w = p.category ? workTypes.find(x => x.name.toLowerCase() === p.category!.trim().toLowerCase()) : undefined;
    if (w && !programType) setProgramType(w.id);
    const names = (p.eventTypesIncluded ?? []).map(dayName).filter(Boolean);
    const fromType = !names.length && w ? partsOf(w.id) : [];
    const want = names.length ? names : fromType;
    if (want.length) setDays(ds => {
      if (untouched(ds)) return want.map(n => makeDay(n, ds[0]?.location ?? ""));
      const have = new Set(ds.map(d => d.eventType.trim().toLowerCase()));
      return [...ds, ...want.filter(n => !have.has(n.toLowerCase())).map(n => makeDay(n, ds[ds.length - 1]?.location ?? ""))];
    });
    const what = summaryLines(p);
    // One point per line: the days, then what the client gets.
    const desc = [names.length ? names.join(" + ") : "", ...(what.length ? what : [p.deliverablesDescription ?? ""])].filter(Boolean).join("\n");
    const line: QLine = lineOf({ id: uid(), name: `${p.name} package`, description: desc.slice(0, 1000), qty: 1, unitPrice: num(p.basePrice), total: 0, isPackageBase: true, kind: "package" });
    setLines(ls => [line, ...ls.filter(l => l.kind !== "package")]);
    if (p.currency) setCurrency(p.currency);
  }
  const setDay = (id: string, patch: Partial<QDay>) => setDays(ds => ds.map(d => (d.id === id ? { ...d, ...patch } : d)));
  function addDay(name = "") {
    const d = makeDay(name, days[days.length - 1]?.location ?? "");
    const order = parts.map(x => x.toLowerCase());
    setDays(ds => {
      if (!name) return [...ds, d];
      const at = ds.findIndex(x => order.indexOf(x.eventType.trim().toLowerCase()) > order.indexOf(name.toLowerCase()));
      return at < 0 ? [...ds, d] : [...ds.slice(0, at), d, ...ds.slice(at)];
    });
    flash(d.id);
  }
  function removeDay(id: string) {
    setDays(ds => ds.filter(d => d.id !== id));
    // Extras counted per day lose that day.
    setLines(ls => ls.map(l => (l.days?.includes(id) ? lineOf({ ...l, days: l.days.filter(x => x !== id), qty: Math.max(1, l.days.length - 1) }) : l)));
  }

  // ── lines ──
  const offeredExtras = extras.filter(x => x.isActive !== false);
  function addExtra(x: Extra) {
    const have = lines.find(l => l.catalogId === x.id);
    if (have) { jumpToField(`line-${have.id}`, { focus: false, tone: "info" }); return; }
    const perDay = countsDays(x.unit);
    const dayIds = perDay ? days.map(d => d.id) : [];
    const line = lineOf({ id: uid(), name: x.name, description: x.description ?? "", qty: perDay ? Math.max(1, dayIds.length) : 1, unitPrice: num(x.defaultPrice), total: 0, kind: "extra", catalogId: x.id, unit: x.unit, ...(dayIds.length ? { days: dayIds } : {}) });
    setLines(ls => [...ls, line]);
    jumpToField(`line-${line.id}`, { focus: false, tone: "info" });
  }
  function addCustom() {
    const line: QLine = { id: uid(), name: "", qty: 1, unitPrice: 0, total: 0, kind: "custom" };
    setLines(ls => [...ls, line]);
    jumpToField(`line-${line.id}`, { tone: "info" });
  }
  const setLine = (id: string, patch: Partial<QLine>) => setLines(ls => ls.map(l => (l.id === id ? lineOf({ ...l, ...patch }) : l)));
  function toggleLineDay(l: QLine, dayId: string) {
    const on = l.days?.includes(dayId);
    const next = on ? (l.days ?? []).filter(x => x !== dayId) : [...(l.days ?? []), dayId];
    setLine(l.id, { days: next, qty: Math.max(1, next.length) });
  }
  const removeLine = (l: QLine) => { setLines(ls => ls.filter(x => x.id !== l.id)); if (l.kind === "package") setPackageId(""); };

  // ── money ──
  const subtotal = r2(lines.reduce((s, l) => s + l.total, 0));
  const dv = num(discountValue), tp = num(taxPercent);
  const discAmt = r2(discountType === "percent" ? subtotal * (dv / 100) : discountType === "fixed" ? dv : 0);
  const taxAmt = r2((subtotal - discAmt) * (tp / 100));
  const grand = r2(subtotal - discAmt + taxAmt);
  const advanceAmt = advanceTouched ? num(advance) : Math.round((grand * advancePct) / 100);
  const money = (n: number) => formatCurrency(n, currency);
  const sym = currencySymbol(currency).trim();
  const clientName = client ? fullName(client) : newClient.firstName.trim() ? fullName({ firstName: newClient.firstName, lastName: newClient.lastName }) : "";
  const datedDays = useMemo(() => days.filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date)), [days]);

  const step1 = !!client || (clientMode === "new" && !!newClient.firstName.trim() && !!newClient.phone.trim());
  const step2 = !!programType || !!packageId;
  const step3 = days.length > 0;
  const step4 = lines.some(l => l.name.trim());

  async function save() {
    setError("");
    const stop = (msg: string, field?: string) => { setError(msg); jumpToField(field); };
    if (!step1) return stop("Pick a client, or add a new one with name and phone.", clientMode === "new" ? undefined : "client");
    const named = lines.filter(l => l.name.trim());
    if (!named.length) return stop("Add the package, an extra or a line.", "lines");
    const noName = lines.find(l => !l.name.trim() && (l.unitPrice > 0));
    if (noName) return stop("A line has a price but no name.", `line-${noName.id}`);
    if (discAmt > subtotal) return stop("The discount is more than the total.", "discount");
    if (advanceAmt > grand) return stop("The advance can't be more than the total.", "advance");
    setSaving(true);
    try {
      let clientId = client?.id;
      if (!clientId) {
        const made = await saveNewClient(newClient);
        if ("error" in made) { stop(made.error); return; }
        clientId = made.id;
      }
      const body = {
        clientId, eventType: type?.name ?? (typeText || undefined), programId: packageId || undefined,
        eventDays: days.map(d => ({ id: d.id, ...(programType ? { programType } : {}), eventType: d.eventType.trim(), date: d.date, location: d.location.trim() })),
        items: named.map(l => ({ ...l, name: l.name.trim(), description: l.description?.trim() || undefined })),
        subtotal, discountType: discountType || undefined, discountValue: discountType ? dv : 0, taxPercent: tp,
        grandTotal: grand, advanceRequired: advanceAmt, currency,
        validUntil: validUntil || undefined, notes: notes.trim() || undefined, termsAndConditions: terms.trim() || undefined,
      };
      const r = await apiFetch(isEdit ? `${API}/quotes/${quote!.id}` : `${API}/quotes`, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { stop((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save the quote."); return; }
      notify(isEdit ? "Quote saved" : "Quote created");
      onSaved(d);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSaving(false); }
  }

  const smallIn = "h-10 px-3 rounded-[12px] bg-[#F5F3FA] text-[14px] text-[#17151F] placeholder:text-[#A29DB3] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF]";
  const summary = (
    <Card className="p-5">
      <p className="text-[13px] font-bold text-[#6B6680]">Summary</p>
      <p className="mt-1 text-[17px] font-extrabold text-[#17151F] leading-tight truncate">{clientName || "New quote"}</p>
      <p className="text-xs text-[#6B6680] truncate">{[type?.name ?? typeText, pkgs.find(p => p.id === packageId)?.name].filter(Boolean).join(" · ") || "—"}</p>
      {days.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {days.map(d => <span key={d.id} className="h-6 px-2.5 rounded-full bg-[#F5F3FA] text-[12px] font-semibold text-[#4A4658] inline-flex items-center">{d.eventType || "Day"}{d.date ? ` · ${fmtDate(d.date)}` : ""}</span>)}
        </div>
      )}
      <div className="mt-4 space-y-1.5 text-sm">
        <SumRow l="Subtotal" v={money(subtotal)} />
        {discAmt > 0 && <SumRow l="Discount" v={`− ${money(discAmt)}`} tone="green" />}
        {taxAmt > 0 && <SumRow l={`Tax (${tp}%)`} v={`+ ${money(taxAmt)}`} />}
        <SumRow l="Total" v={money(grand)} strong />
        {advanceAmt > 0 && <SumRow l="Advance to book" v={money(advanceAmt)} tone="amber" />}
      </div>
    </Card>
  );

  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={isEdit ? "Edit quote" : "New quote"} className="sp-drawer z-50 sm:max-w-[1100px] flex flex-col bg-[#F5F3FA]">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <Tile icon={FileText} color="deep" size={40} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{isEdit ? "Edit quote" : "New quote"}</h2>
            <p className="text-[13px] text-[#6B6680] truncate">{isEdit ? `${quote!.quoteNumber} · version ${quote!.version}` : "Pick the package and extras — the days and price fill in."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-[#EEEBF4] text-[#6B6680]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-6">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
            <div className="min-w-0">
              {error && <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{error}</div>}

              <Section n={1} title="Client" done={step1} name="client">
                <ClientPicker client={client as never} onPick={c => setClient(c as QClient | null)} mode={clientMode} setMode={setClientMode} newClient={newClient} setNewClient={setNewClient} />
              </Section>

              <Section n={2} title="Program" sub="The type brings its usual days; a package brings its price and days" done={step2}>
                <Card>
                  <div className="p-4">
                    <p className="text-[13px] font-semibold text-[#4A4658] mb-2">Type</p>
                    <div role="radiogroup" aria-label="Program type" className="flex flex-wrap gap-2">
                      {workTypes.map(w => (
                        <button key={w.id} type="button" role="radio" aria-checked={programType === w.id} onClick={() => pickType(w.id)}
                          className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold", programType === w.id ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>{w.name}</button>
                      ))}
                      {!workTypes.length && <p className="text-[13px] text-[#6B6680]">{typeText || "Set program types in Settings → Program types."}</p>}
                    </div>
                  </div>
                  <div className="border-t border-[#EEEBF4]">
                    <Field label="Package" hint={offered.length ? "Its price goes on top of the price list; its days are added below." : "Make packages in Packages — then pick one here."}>{id => (
                      <select id={id} value={packageId} onChange={e => choosePackage(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
                        <option value="">No package</option>
                        {offered.map(p => <option key={p.id} value={p.id}>{p.name}{num(p.basePrice) ? ` — ${formatCurrency(num(p.basePrice), p.currency)}` : ""}</option>)}
                      </select>
                    )}</Field>
                  </div>
                </Card>
              </Section>

              <Section n={3} title="Days" sub="Each part of the event with its date and venue" done={step3} name="days"
                right={days.length > 0 ? <button type="button" onClick={() => addDay()} className="h-9 px-3.5 rounded-full bg-white text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)]"><Plus className="w-3.5 h-3.5" />Day</button> : undefined}>
                {days.length === 0 && (
                  <Card className="p-5 text-center">
                    <Calendar className="w-7 h-7 text-[#A29DB3] mx-auto" />
                    <p className="mt-2 text-sm font-semibold text-[#17151F]">No days yet</p>
                    <p className="text-xs text-[#6B6680] mt-0.5">Pick a type or a package above, or add a day.</p>
                    <button type="button" onClick={() => addDay()} className="mt-3 h-10 px-4 rounded-full bg-[#F5F3FA] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add a day</button>
                  </Card>
                )}
                {days.length > 0 && (
                  <Card className="divide-y divide-[#EEEBF4]">
                    {days.map((d, i) => (
                      <div key={d.id} id={`qd-${d.id}`} className={cn("p-3 grid grid-cols-[28px_1fr_36px] sm:grid-cols-[28px_1fr_160px_1fr_36px] gap-2 items-center scroll-mt-24 transition-colors", flashId === d.id && "bg-[#F4F0FE]")}>
                        <span className="w-7 h-7 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
                        <input list="sp-quote-days" value={d.eventType} onChange={e => setDay(d.id, { eventType: e.target.value })} placeholder="Day name — Holud, Wedding…" aria-label={`Day ${i + 1} name`} className={cn(smallIn, "font-semibold")} />
                        <button type="button" onClick={() => removeDay(d.id)} aria-label={`Remove day ${i + 1}`} className="sm:order-last w-9 h-9 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]"><Trash2 className="w-4 h-4" /></button>
                        <input type="date" value={d.date} onChange={e => setDay(d.id, { date: e.target.value })} aria-label={`Day ${i + 1} date`} className={cn(smallIn, "col-start-2 sm:col-start-auto")} />
                        <div className="relative col-start-2 sm:col-start-auto">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B6680]" />
                          <input value={d.location} onChange={e => setDay(d.id, { location: e.target.value })} placeholder="Venue" aria-label={`Day ${i + 1} venue`} className={cn(smallIn, "w-full pl-8")} />
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
                {(days.length > 0 || missingParts.length > 0) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {missingParts.map(n => (
                      <button key={n} type="button" onClick={() => addDay(n)} className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#E4DCFB]"><Plus className="w-3.5 h-3.5" />{n}</button>
                    ))}
                    {days.length > 0 && <button type="button" onClick={() => addDay()} className="h-9 px-3.5 rounded-full border border-dashed border-[#C9C2DA] text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5 hover:bg-[#F5F3FA]"><Plus className="w-3.5 h-3.5" />Another day</button>}
                  </div>
                )}
                <datalist id="sp-quote-days">{(parts.length ? parts : [...new Set(workTypes.flatMap(w => partsOf(w.id)))]).map(n => <option key={n} value={n} />)}</datalist>
              </Section>

              <Section n={4} title="Price" sub="The package, extras and anything else" done={step4} name="lines">
                {offeredExtras.length > 0 ? (
                  <div className="mb-3">
                    <p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Add an extra</p>
                    <div className="flex flex-wrap gap-2">
                      {offeredExtras.map(x => {
                        const L = extraLook(x.category);
                        const on = lines.some(l => l.catalogId === x.id);
                        return (
                          <button key={x.id} type="button" onClick={() => addExtra(x)} aria-pressed={on}
                            className={cn("h-10 pl-1.5 pr-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 shadow-[0_1px_2px_rgba(22,18,40,.06)]", on ? "bg-[#17151F] text-white" : "bg-white text-[#17151F] hover:bg-[#F7F4FE]")}>
                            <Tile icon={L.icon} color={L.color} size={28} />{x.name}
                            <span className={cn("tabular-nums", on ? "text-white/70" : "text-[#6B6680]")}>{formatCurrency(num(x.defaultPrice), x.currency)}</span>
                            {on ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 text-[#5B3FD0]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="px-1 mb-3 text-[12.5px] text-[#6B6680] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#7D5CEF]" />Set extras (drone, album, extra photographer…) in Packages → Extras and they show here.</p>
                )}

                <Card className="divide-y divide-[#EEEBF4]">
                  {lines.length === 0 && <p className="p-4 text-sm text-[#A29DB3]">Pick a package or an extra above, or add a line.</p>}
                  {lines.map(l => {
                    const L = l.kind === "extra" ? extraLook(extras.find(x => x.id === l.catalogId)?.category) : null;
                    const perDay = l.kind === "extra" && countsDays(l.unit) && days.length > 0;
                    return (
                      <div key={l.id} data-field={`line-${l.id}`} className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <span className="hidden sm:block flex-shrink-0">{l.kind === "package" ? <Tile icon={PackageIcon} color="violet" size={34} /> : L ? <Tile icon={L.icon} color={L.color} size={34} /> : <Tile icon={FileText} color="ink" size={34} />}</span>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <input value={l.name} onChange={e => setLine(l.id, { name: e.target.value })} placeholder="What it is" aria-label="Line name" className={cn(smallIn, "flex-1 min-w-0 font-semibold")} />
                              {l.kind === "package" && <span className="hidden sm:inline text-[11px] font-bold text-[#5B3FD0] bg-[#EEE8FD] px-2 py-0.5 rounded-full">Package</span>}
                              {l.kind === "extra" && <span className="hidden sm:inline text-[11px] font-bold text-[#126B66] bg-[#E3F2F1] px-2 py-0.5 rounded-full">Extra</span>}
                            </div>
                            <textarea value={l.description ?? ""} onChange={e => setLine(l.id, { description: e.target.value })} placeholder="Details for the client (optional) — one point per line" aria-label="Line details"
                              rows={Math.min(8, Math.max(1, (l.description ?? "").split("\n").length))}
                              className={cn(smallIn, "w-full h-auto min-h-9 py-2 text-[13px] leading-relaxed resize-y")} />
                            {perDay && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="text-[12px] text-[#6B6680] mr-0.5">Which days:</span>
                                {days.map((d, i) => {
                                  const on = !!l.days?.includes(d.id);
                                  return <button key={d.id} type="button" aria-pressed={on} onClick={() => toggleLineDay(l, d.id)}
                                    className={cn("h-7 px-2.5 rounded-full text-[12px] font-semibold", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{d.eventType || `Day ${i + 1}`}</button>;
                                })}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              <div className="inline-flex items-center h-9 rounded-full bg-[#F5F3FA]">
                                <button type="button" aria-label="Less" onClick={() => setLine(l.id, { qty: Math.max(1, l.qty - 1) })} disabled={perDay} className="w-9 h-9 rounded-full flex items-center justify-center text-[#4A4658] disabled:opacity-40"><Minus className="w-3.5 h-3.5" /></button>
                                <input inputMode="numeric" aria-label="Quantity" value={String(l.qty)} readOnly={perDay}
                                  onChange={e => setLine(l.id, { qty: Math.max(1, Math.min(9999, parseInt(e.target.value.replace(/\D/g, "")) || 1)) })}
                                  className="w-10 bg-transparent text-center text-[14px] font-semibold tabular-nums outline-none" />
                                <button type="button" aria-label="More" onClick={() => setLine(l.id, { qty: Math.min(9999, l.qty + 1) })} disabled={perDay} className="w-9 h-9 rounded-full flex items-center justify-center text-[#4A4658] disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
                              </div>
                              <span className="text-[13px] text-[#6B6680]">×</span>
                              <div className="relative w-[130px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B6680]">{sym}</span>
                                <input inputMode="decimal" aria-label={`${l.name || "Line"} price`} value={l.unitPrice ? String(l.unitPrice) : ""} placeholder="0"
                                  onChange={e => setLine(l.id, { unitPrice: num(e.target.value.replace(/[^\d.]/g, "")) })}
                                  className={cn(smallIn, "w-full h-9 tabular-nums")} style={{ paddingLeft: currencyPad(currency) }} />
                              </div>
                              {l.unit && l.kind === "extra" && <span className="text-[12px] text-[#6B6680]">{unitLabel(l.unit)}</span>}
                              <span className="ml-auto text-[15px] font-bold text-[#17151F] tabular-nums">{money(l.total)}</span>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeLine(l)} aria-label={`Remove ${l.name || "line"}`} className="w-8 h-8 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-3">
                    <button type="button" onClick={addCustom} className="h-9 px-3.5 rounded-full border border-dashed border-[#C9C2DA] text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5 hover:bg-[#F5F3FA]"><Plus className="w-3.5 h-3.5" />Another line</button>
                  </div>
                </Card>

                <Card className="mt-3">
                  <div className="grid grid-cols-2">
                    <Field label="Discount" name="discount">{id => (
                      <div className="flex gap-1.5">
                        <select id={id} value={discountType} onChange={e => setDiscountType(e.target.value as "" | "percent" | "fixed")} aria-label="Discount type" className={cn(inputCls, "w-[84px] px-2.5 cursor-pointer")}>
                          <option value="">None</option><option value="percent">%</option><option value="fixed">{sym}</option>
                        </select>
                        {discountType && <input inputMode="decimal" aria-label="Discount amount" value={discountValue} onChange={e => setDiscountValue(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" className={cn(inputCls, "flex-1 min-w-0")} />}
                      </div>
                    )}</Field>
                    <Field label="Tax (%)">{id => <input id={id} inputMode="decimal" value={taxPercent} onChange={e => setTaxPercent(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" className={inputCls} />}</Field>
                  </div>
                  <div className="grid grid-cols-[1fr_130px] border-t border-[#EEEBF4]">
                    <Field label={<>Advance to book {grand > 0 && advanceAmt > 0 && <span className="font-normal text-[#6B6680]">({Math.round((advanceAmt / grand) * 100)}%)</span>}</>} name="advance">{id => (
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{sym}</span>
                        <input id={id} inputMode="decimal" value={advanceTouched ? advance : String(advanceAmt || "")} placeholder="0"
                          onChange={e => { setAdvanceTouched(true); setAdvance(e.target.value.replace(/[^\d.]/g, "")); }}
                          className={inputCls} style={{ paddingLeft: currencyPad(currency) }} />
                      </div>
                    )}</Field>
                    <Field label="Currency">{id => (
                      <select id={id} value={currency} onChange={e => setCurrency(e.target.value)} className={cn(inputCls, "cursor-pointer px-2.5")}>
                        {CURRENCY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
                      </select>
                    )}</Field>
                  </div>
                  <div className="px-4 py-3.5 bg-[#FAF9FC] rounded-b-[20px] space-y-1 text-sm">
                    <SumRow l="Subtotal" v={money(subtotal)} />
                    {discAmt > 0 && <SumRow l="Discount" v={`− ${money(discAmt)}`} tone="green" />}
                    {taxAmt > 0 && <SumRow l={`Tax (${tp}%)`} v={`+ ${money(taxAmt)}`} />}
                    <SumRow l="Total" v={money(grand)} strong />
                  </div>
                </Card>
              </Section>

              <Section n={5} title="Terms">
                <Card>
                  <Field label="Valid until">{id => <input id={id} type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} />}</Field>
                  <Field label="Note for the client">{id => <textarea id={id} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything special for this client…" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}</Field>
                  <Field label="Terms & conditions">{id => <textarea id={id} rows={4} value={terms} onChange={e => setTerms(e.target.value)} className={cn(inputCls, "h-auto py-2.5 resize-y text-[13.5px]")} />}</Field>
                </Card>
              </Section>
            </div>
            <aside className="hidden lg:block"><div className="sticky top-0">{summary}</div></aside>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-4 bg-white/80 backdrop-blur border-t border-[#EEEBF4] flex items-center gap-3">
          <p className="hidden sm:block flex-1 min-w-0 text-[13px] text-[#6B6680] truncate">Total <span className="font-bold text-[#17151F] tabular-nums">{money(grand)}</span>{advanceAmt > 0 && <> · Advance <span className="font-bold text-[#9A5B00] tabular-nums">{money(advanceAmt)}</span></>}{datedDays.length > 0 && <> · {fmtDate(datedDays[0].date)}{datedDays.length > 1 ? ` – ${fmtDate(datedDays[datedDays.length - 1].date)}` : ""}</>}</p>
          <button type="button" onClick={onClose} className="h-12 px-6 rounded-full bg-[#EEEBF4] hover:bg-[#E4E0EC] text-[#17151F] text-[15px] font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 sm:flex-none sm:min-w-[200px] h-12 px-6 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{isEdit ? "Save changes" : "Create quote"}
          </button>
        </div>
      </div>
    </>
  );
}

function SumRow({ l, v, strong, tone }: { l: string; v: string; strong?: boolean; tone?: "green" | "amber" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "pt-1.5 mt-0.5 border-t border-[#EEEBF4]")}>
      <span className={cn("text-[#6B6680]", strong && "font-bold text-[#17151F]")}>{l}</span>
      <span className={cn("tabular-nums font-semibold text-[#17151F]", strong && "font-extrabold text-[16px]", tone === "green" && "text-[#1F8A5B]", tone === "amber" && "text-[#9A5B00]")}>{v}</span>
    </div>
  );
}
