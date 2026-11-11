"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Loader2, Search, Eye, Edit2, Copy, Trash2, Send,
  Check,
  Link2, MessageCircle, FileText, ArrowRight,
  Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Monitor, Smartphone, Tablet, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocCard, DocDrawer, DocLine, PillButton, StatusChip } from "@/components/ui/doc-drawer";
import { Field, FormDrawer, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { AccountPicker } from "@/components/account-picker";
import { API_URL as API } from "@/lib/api";
import { currencyPad, currencySymbol, fmtDate, formatCurrency, getStudioCurrency } from "@/lib/format";
import { askConfirm, notify } from "@/components/feedback";
import { Chips, DateBox, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField, StatCard } from "@/components/ui/apple";
import { jumpToField } from "@/lib/jump-to-field";
import { QuoteForm, type QDay, type QLine, type QuoteForForm, type QuotePrefill } from "./_components/quote-form";

const SITE = typeof window !== "undefined" ? window.location.origin : "";

function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const h = dt.getHours(), m = dt.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${fmtDate(dt)}  ${hh}:${String(m).padStart(2,"0")} ${ampm}`;
}
const currSym = (c?: string) => currencySymbol(c || getStudioCurrency());

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; badge: string; dot: string; icon: typeof Clock }> = {
  draft:     { label: "Draft",    badge: "bg-[#F1EFF6] text-[#4A4658]",   dot: "bg-[#8A8599]",   icon: FileText },
  sent:      { label: "Sent",     badge: "bg-[#E8F0FA] text-[#1F5C99]",     dot: "bg-[#2F6FB3]",    icon: Send },
  viewed:    { label: "Viewed",   badge: "bg-[#EEE8FD] text-[#5B3FD0]", dot: "bg-[#7D5CEF]",  icon: Eye },
  accepted:  { label: "Accepted", badge: "bg-[#E7F5EE] text-[#1F8A5B]",dot:"bg-[#1F8A5B]", icon: CheckCircle2 },
  rejected:  { label: "Rejected", badge: "bg-[#FDECEF] text-[#C2304F]",       dot: "bg-[#C2304F]",     icon: XCircle },
  expired:   { label: "Expired",  badge: "bg-[#FFF3E0] text-[#9A5B00]",   dot: "bg-[#D88A12]",   icon: AlertTriangle },
  converted: { label: "Converted",badge: "bg-[#E3F2F1] text-[#126B66]",     dot: "bg-[#1A8A84]",    icon: CheckCircle2 },
};


// ─── Types ─────────────────────────────────────────────────────────────────────
interface Client { id: string; firstName: string; lastName?: string; phone?: string; }
type QuoteItem = QLine;
interface ViewLog { id: string; viewedAt: string; ipAddress?: string; deviceType?: string; browser?: string; action?: string; }
interface Quote {
  id: string; quoteNumber: string; status: string; version: number;
  eventType?: string; eventDate?: string; eventEndDate?: string; venue?: string; currency: string; eventDays?: QDay[];
  programId?: string | null; discountType?: string | null; discountValue?: number; taxPercent?: number;
  subtotal: number; discountAmount: number; taxAmount: number; grandTotal: number;
  advanceRequired: number; validUntil?: string; notes?: string; termsAndConditions?: string;
  publicToken: string; sentAt?: string; viewedAt?: string; lastViewedAt?: string;
  viewCount: number; acceptedAt?: string; rejectedAt?: string; convertedAt?: string;
  convertedBookingId?: string; items: QuoteItem[];
  client: Client; program?: { name: string; category?: string };
  viewLogs?: ViewLog[];
  versions?: { id: string; version: number; createdAt: string }[];
  company?: { name: string; email?: string; phone?: string; address?: string; logoUrl?: string; currency: string };
}

// ─── View Drawer ───────────────────────────────────────────────────────────────
function ViewDrawer({ quote, onClose, onEdit, onRefresh }: {
  quote: Quote | null; onClose: () => void; onEdit: () => void; onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!quote) return;
    setLoading(true);
    apiFetch(`${API}/quotes/${quote.id}`)
      .then(r => r.json()).then(setDetail).finally(() => setLoading(false));
  }, [quote]);

  if (!quote) return null;
  const q = detail ?? quote;
  const sc = STATUS[q.status] ?? STATUS.draft;
  const sym = currSym(q.currency);
  const publicUrl = `${SITE}/q/${q.publicToken}`;

  async function sendQuote() {
    setSending(true);
    await apiFetch(`${API}/quotes/${q.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setSending(false); onRefresh();
    setDetail(d => d ? { ...d, status: "sent", sentAt: new Date().toISOString() } : d);
  }

  function onBooked(bookingId: string) {
    setConverting(false); onRefresh();
    setDetail(prev => prev ? { ...prev, status: "converted", convertedBookingId: bookingId, convertedAt: new Date().toISOString() } : prev);
    notify("Program created");
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  }

  function shareWA() {
    const msg = `Hi ${q.client.firstName},\n\nYour quotation is ready.\n\nQuote: ${q.quoteNumber}\nAmount: ${sym}${Number(q.grandTotal).toLocaleString()}\n\nView here:\n${publicUrl}`;
    window.open(`https://wa.me?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const chip = STATUS_HEX[q.status] ?? STATUS_HEX.draft;
  const money = (n: number | string) => formatCurrency(Number(n), q.currency);
  const DeviceIcon = (t?: string) => t === "mobile" ? Smartphone : t === "tablet" ? Tablet : Monitor;
  const views = (q.viewLogs ?? []).filter(l => l.action === "viewed").slice(0, 3);
  const timeline = [
    { label: "Created", at: (detail as { createdAt?: string } | null)?.createdAt, dot: "#8A8599" },
    { label: "Sent", at: q.sentAt, dot: "#2F6FB3" },
    { label: "Viewed", at: q.viewedAt, dot: "#7D5CEF" },
    { label: "Accepted", at: q.acceptedAt, dot: "#1F8A5B" },
    { label: "Declined", at: q.rejectedAt, dot: "#C2304F" },
    { label: "Booked", at: q.convertedAt, dot: "#126B66" },
  ].filter(t => t.at);
  const qDays = q.eventDays ?? [];
  const event = [
    q.eventType && { label: "Program", value: q.eventType },
    ...(qDays.length ? [] : [
      q.eventDate && { label: "Date", value: fmtDate(q.eventDate) },
      q.venue && { label: "Venue", value: q.venue },
    ]),
    q.validUntil && { label: "Valid until", value: fmtDate(q.validUntil) },
  ].filter(Boolean) as { label: string; value: string }[];
  const dayNames = new Map(qDays.map((d, i) => [d.id, d.eventType || `Day ${i + 1}`]));

  return (
    <DocDrawer onClose={onClose} icon={FileText} color="violet" title={q.quoteNumber} label={`Quote ${q.quoteNumber}`}
      badge={<StatusChip label={sc.label} bg={chip.bg} text={chip.text} />}
      sub={[`${q.client.firstName} ${q.client.lastName ?? ""}`.trim(), `Version ${q.version}`, `${q.viewCount} view${q.viewCount === 1 ? "" : "s"}`].join(" · ")}>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" aria-label="Loading" /></div>
      ) : (
        <>
          {/* Money at a glance */}
          <DocCard>
            <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">Quoted total</p>
            <p className="text-[30px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums leading-tight mt-0.5">{money(q.grandTotal)}</p>
            {Number(q.advanceRequired) > 0 && (
              <p className="mt-2 text-[13px] text-[#6B6680]">Advance to book: <span className="font-bold text-[#9A5B00] tabular-nums">{money(q.advanceRequired)}</span></p>
            )}
          </DocCard>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {q.status === "accepted" && !q.convertedBookingId && (
              <PillButton tone="green" icon={CheckCircle2} onClick={() => setConverting(true)}>Confirm booking</PillButton>
            )}
            {q.status === "draft" && <PillButton tone="primary" icon={sending ? Loader2 : Send} onClick={sendQuote} disabled={sending}>Send</PillButton>}
            {["draft","rejected"].includes(q.status) && <PillButton icon={Edit2} onClick={onEdit}>Edit</PillButton>}
            {q.status !== "draft" && <PillButton icon={MessageCircle} onClick={shareWA}>WhatsApp</PillButton>}
            {q.convertedBookingId && <PillButton tone="primary" icon={ArrowRight} href={`/programs?view=${q.convertedBookingId}`}>Open program</PillButton>}
            <PillButton icon={Eye} href={publicUrl} external>Preview</PillButton>
          </div>

          {/* Status notes */}
          {q.status === "accepted" && (
            <div className="rounded-[18px] bg-[#E9F5EF] px-4 py-3.5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#1F8A5B] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#14613F]">The client accepted</p>
                <p className="text-[12.5px] text-[#1F8A5B] mt-0.5">{fmtDateTime(q.acceptedAt)}</p>
                <p className="text-[12.5px] text-[#14613F] mt-1.5">{q.convertedBookingId ? "It's now a program." : "Tap Confirm booking to make it a program and record the advance."}</p>
              </div>
            </div>
          )}
          {q.status === "rejected" && (
            <div className="rounded-[18px] bg-[#FDECEF] px-4 py-3.5 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-[#C2304F] flex-shrink-0 mt-0.5" />
              <div><p className="text-[14px] font-bold text-[#9C2340]">The client declined</p><p className="text-[12.5px] text-[#C2304F] mt-0.5">{fmtDateTime(q.rejectedAt)}</p></div>
            </div>
          )}

          {/* Client link */}
          {q.status !== "draft" && (
            <DocCard title="Client link" flush>
              <div className="flex items-center gap-3 px-4 py-3">
                <Link2 className="w-4 h-4 text-[#8A8599] flex-shrink-0" />
                <p className="text-[13px] text-[#4A4658] truncate flex-1 min-w-0">{publicUrl}</p>
                <button type="button" onClick={copyLink} className="h-8 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1 flex-shrink-0">
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedLink ? "Copied" : "Copy"}
                </button>
              </div>
            </DocCard>
          )}

          {/* Seen by the client */}
          {q.viewedAt && (
            <DocCard title="Seen by the client" flush>
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><Eye className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#17151F]">Last opened {fmtDateTime(q.lastViewedAt ?? q.viewedAt)}</p>
                  <p className="text-[12.5px] text-[#6B6680]">{q.viewCount} view{q.viewCount === 1 ? "" : "s"} in total</p>
                </div>
              </div>
              {views.map(log => {
                const D = DeviceIcon(log.deviceType);
                return (
                  <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 text-[12.5px] text-[#6B6680]">
                    <D className="w-4 h-4 flex-shrink-0 text-[#8A8599]" />
                    <span className="truncate">{fmtDateTime(log.viewedAt)} · {log.browser ?? "Browser"}</span>
                  </div>
                );
              })}
            </DocCard>
          )}

          {/* Event */}
          {event.length > 0 && (
            <DocCard title="Event" flush>
              {event.map(e => (
                <div key={e.label} className="px-4 py-3 flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="text-[#6B6680]">{e.label}</span>
                  <span className="font-semibold text-[#17151F] text-right min-w-0">{e.value}</span>
                </div>
              ))}
            </DocCard>
          )}

          {/* Days */}
          {qDays.length > 0 && (
            <DocCard title="Days" flush>
              {qDays.map((d, i) => (
                <div key={d.id} className="px-4 py-3 flex items-center gap-3 text-[14px]">
                  <span className="w-7 h-7 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#17151F] truncate">{d.eventType || `Day ${i + 1}`}</p>
                    {d.location && <p className="text-[12.5px] text-[#6B6680] truncate">{d.location}</p>}
                  </div>
                  <span className={cn("font-semibold tabular-nums flex-shrink-0", d.date ? "text-[#17151F]" : "text-[#A29DB3]")}>{d.date ? fmtDate(d.date) : "Date not set"}</span>
                </div>
              ))}
            </DocCard>
          )}

          {/* Items */}
          <DocCard title="Items" flush>
            {q.items.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#17151F]">{item.name}
                    {(item.kind === "package" || item.isPackageBase) && <span className="ml-1.5 align-middle text-[11px] font-bold text-[#5B3FD0] bg-[#EEE8FD] px-1.5 py-0.5 rounded-full">Package</span>}
                    {item.kind === "extra" && <span className="ml-1.5 align-middle text-[11px] font-bold text-[#126B66] bg-[#E3F2F1] px-1.5 py-0.5 rounded-full">Extra</span>}
                  </p>
                  {item.description && <p className="text-[12.5px] text-[#6B6680] mt-0.5">{item.description}</p>}
                  {!!item.days?.length && <p className="text-[12.5px] text-[#5B3FD0] mt-0.5">{item.days.map(id => dayNames.get(id)).filter(Boolean).join(" · ")}</p>}
                  <p className="text-[12.5px] text-[#8A8599] mt-0.5 tabular-nums">{item.qty} × {money(item.unitPrice)}</p>
                </div>
                <p className="text-[14px] font-bold text-[#17151F] tabular-nums flex-shrink-0">{money(item.total)}</p>
              </div>
            ))}
            <div className="px-4 py-3.5 space-y-1.5 bg-[#FAF9FC]">
              <DocLine label="Subtotal" value={money(q.subtotal)} />
              {Number(q.discountAmount) > 0 && <DocLine label="Discount" value={`−${money(q.discountAmount)}`} tone="green" />}
              {Number(q.taxAmount) > 0 && <DocLine label="Tax" value={`+${money(q.taxAmount)}`} />}
              <DocLine label="Total" value={money(q.grandTotal)} strong className="pt-1.5 border-t border-[#EEEBF4]" />
              {Number(q.advanceRequired) > 0 && <DocLine label="Advance to book" value={money(q.advanceRequired)} tone="amber" className="font-semibold" />}
            </div>
          </DocCard>

          {/* Timeline */}
          {timeline.length > 0 && (
            <DocCard title="Timeline">
              <ol className="space-y-2.5">
                {timeline.map(t => (
                  <li key={t.label} className="flex items-center gap-3 text-[13.5px]">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.dot }} />
                    <span className="text-[#6B6680] w-[72px] flex-shrink-0">{t.label}</span>
                    <span className="font-semibold text-[#17151F] tabular-nums">{fmtDateTime(t.at)}</span>
                  </li>
                ))}
              </ol>
            </DocCard>
          )}

          {q.notes && <DocCard title="Notes"><p className="text-[13.5px] text-[#4A4658] leading-relaxed whitespace-pre-line">{q.notes}</p></DocCard>}
        </>
      )}
      {converting && <ConfirmBookingDrawer quote={q} onClose={() => setConverting(false)} onDone={onBooked} />}
    </DocDrawer>
  );
}

/** Accepted quote → program. Records the advance as a real payment when the client has paid it. */
function ConfirmBookingDrawer({ quote, onClose, onDone }: { quote: Quote; onClose: () => void; onDone: (bookingId: string) => void }) {
  const advance = Number(quote.advanceRequired) || 0;
  const [paid, setPaid] = useState(advance > 0);
  const [amount, setAmount] = useState(advance > 0 ? String(advance) : "");
  const [method, setMethod] = useState("cash");
  const [walletId, setWalletId] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = Number(quote.grandTotal);

  async function save() {
    const amt = Number(amount);
    if (paid) {
      if (!amt || amt <= 0) { setError("Enter the advance the client paid, or switch it off."); jumpToField("advance"); return; }
      if (amt > total) { setError(`That's more than the quote total (${formatCurrency(total, quote.currency)}).`); jumpToField("advance"); return; }
      if (!walletId) { setError("Pick the account the money went into."); jumpToField("wallet"); return; }
    }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/quotes/${quote.id}/convert`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paid ? { advanceAmount: amt, advanceMethod: method, advanceWalletId: walletId, advanceReference: ref.trim() || undefined } : {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't create the program."); return; }
      onDone(d.booking?.id);
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  return (
    <FormDrawer open onClose={onClose} onTop icon={CheckCircle2} color="green" title="Confirm booking" sub={`${quote.quoteNumber} · ${quote.client.firstName} ${quote.client.lastName ?? ""}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 h-11 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Create program
          </button>
        </>
      }>
      <div className="mb-4 rounded-[16px] bg-white px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-[#6B6680]">Quote total</p>
          <p className="text-[18px] font-extrabold text-[#17151F] tabular-nums">{formatCurrency(total, quote.currency)}</p>
        </div>
        {advance > 0 && <p className="text-[13px] text-[#6B6680] text-right">Advance asked<br /><span className="font-bold text-[#9A5B00] tabular-nums">{formatCurrency(advance, quote.currency)}</span></p>}
      </div>
      {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{error}</p>}

      <FormGroup note={paid ? "It's saved as the program's first payment, with a receipt." : "You can record payments later from the program."}>
        <SwitchRow label="The client has paid an advance" on={paid} onChange={setPaid} />
        {paid && (
          <>
            <Field label="Advance received" required name="advance">{id => (
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-[15px] font-semibold">{currencySymbol(quote.currency).trim()}</span>
                <input id={id} type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                  className={cn(inputCls, "pl-8 text-[17px] font-bold tabular-nums")} style={{ paddingLeft: currencyPad(quote.currency) }} />
              </div>
            )}</Field>
            <Field label="Method">{id => (
              <select id={id} value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
                {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}</Field>
            <div className="px-4 py-3.5"><AccountPicker value={walletId} onChange={setWalletId} method={method} /></div>
            <Field label="Reference / transaction ID">{id => <input id={id} value={ref} onChange={e => setRef(e.target.value)} placeholder="Optional" className={inputCls} />}</Field>
          </>
        )}
      </FormGroup>
    </FormDrawer>
  );
}

const PAY_METHODS = [
  { value: "cash", label: "Cash" }, { value: "mobile_banking", label: "Mobile wallet" }, { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit_card", label: "Card" }, { value: "cheque", label: "Cheque" }, { value: "other", label: "Other" },
];

// ─── Quote row (Apple style) ───────────────────────────────────────────────────
const STATUS_HEX: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#EEEDF2", text: "#4A4658" }, sent: { bg: "#E6F0FB", text: "#1F5C99" }, viewed: { bg: "#EEE8FD", text: "#5B3FD0" },
  accepted: { bg: "#E9F5EF", text: "#1F8A5B" }, rejected: { bg: "#FDECEF", text: "#C2304F" },
  expired: { bg: "#FBF2FA", text: "#9E3A8C" }, converted: { bg: "#E0F2F1", text: "#126B66" },
};
function QuoteRow({ q, onView, onEdit, onDuplicate, onDelete, onSend }: {
  q: Quote;
  onView: () => void; onEdit: () => void; onDuplicate: () => void;
  onDelete: () => void; onSend: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sc = STATUS[q.status] ?? STATUS.draft;
  const h = STATUS_HEX[q.status] ?? STATUS_HEX.draft;
  const sym = currSym(q.currency);
  const expired = q.validUntil && new Date(q.validUntil) < new Date() && !["converted", "accepted"].includes(q.status);

  useEffect(() => {
    if (!menuOpen) return;
    function h(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const item = "w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]";
  return (
    <div role="button" tabIndex={0} onClick={onView} onKeyDown={e => { if (e.key === "Enter") onView(); }}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <DateBox date={q.eventDate} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate">{q.client.firstName} {q.client.lastName ?? ""}</p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">
          <span className="font-mono">{q.quoteNumber}</span>{q.eventType ? ` · ${q.eventType}` : ""}{q.venue ? ` · ${q.venue}` : ""}
          {q.viewCount > 0 && <span className="text-[#5B3FD0]"> · <Eye className="inline w-3 h-3 -mt-0.5" /> {q.viewCount}</span>}
          {expired && <span className="text-[#C2304F] font-semibold"> · Expired</span>}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-[#17151F] tabular-nums">{sym}{Number(q.grandTotal).toLocaleString()}</p>
        {Number(q.advanceRequired) > 0 && <p className="text-xs text-[#6B6680] tabular-nums">Advance {sym}{Number(q.advanceRequired).toLocaleString()}</p>}
      </div>
      <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: h.bg, color: h.text }}>{sc.label}</span>
      <div className="relative flex-shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(o => !o)} aria-label={`More for ${q.quoteNumber}`} aria-expanded={menuOpen}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-10 w-48 bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1">
            <button role="menuitem" onClick={() => { onView(); setMenuOpen(false); }} className={item}><Eye className="w-4 h-4 text-[#6B6680]" />Open</button>
            {["draft", "rejected"].includes(q.status) && <button role="menuitem" onClick={() => { onEdit(); setMenuOpen(false); }} className={item}><Edit2 className="w-4 h-4 text-[#6B6680]" />Edit</button>}
            {q.status === "draft" && <button role="menuitem" onClick={() => { onSend(); setMenuOpen(false); }} className={item}><Send className="w-4 h-4 text-[#5B3FD0]" />Send quote</button>}
            <button role="menuitem" onClick={() => { onDuplicate(); setMenuOpen(false); }} className={item}><Copy className="w-4 h-4 text-[#6B6680]" />Duplicate</button>
            {["draft", "rejected", "expired"].includes(q.status) && <button role="menuitem" onClick={() => { onDelete(); setMenuOpen(false); }} className={cn(item, "text-[#C2304F] hover:bg-[#FDECEF]")}><Trash2 className="w-4 h-4" />Delete</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function QuotesPageInner() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, statusCounts: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Quote | null>(null);
  const [viewTarget, setViewTarget] = useState<Quote | null>(null);
  const [prefill, setPrefill] = useState<QuotePrefill | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  // Open one quote straight away (?view=quoteId) — used by the client profile
  useEffect(() => {
    const viewId = params.get("view");
    if (!viewId) return;
    router.replace("/quotes", { scroll: false });
    apiFetch(`${API}/quotes/${viewId}`).then(r => (r.ok ? r.json() : null)).then(q => { if (q) setViewTarget(q); }).catch(() => {});
  }, [params, router]);

  // "Make a quote" from a lead (?newFor=clientId&lead=leadId)
  useEffect(() => {
    const clientId = params.get("newFor");
    if (!clientId) return;
    const leadId = params.get("lead");
    router.replace("/quotes", { scroll: false });
    Promise.all([
      apiFetch(`${API}/clients/${clientId}`).then(r => (r.ok ? r.json() : null)),
      leadId ? apiFetch(`${API}/leads/${leadId}`).then(r => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
    ]).then(([client, lead]) => {
      if (!client) return;
      setPrefill({ client, eventType: lead?.eventType ?? undefined, eventDates: Array.isArray(lead?.eventDates) ? lead.eventDates : undefined, venue: lead?.venue ?? undefined });
      setShowCreate(true);
    }).catch(() => {});
  }, [params, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) p.set("search", search);
      if (statusFilter !== "all") p.set("status", statusFilter);
      const r = await apiFetch(`${API}/quotes?${p}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) { const d = await r.json(); setQuotes(d.data ?? []); setMeta(d.meta); }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function sendQuote(q: Quote) {
    await apiFetch(`${API}/quotes/${q.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" } });
    load();
  }

  async function duplicateQuote(q: Quote) {
    const r = await apiFetch(`${API}/quotes/${q.id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" } });
    if (r.ok) load();
  }

  async function deleteQuote(q: Quote) {
    if (!(await askConfirm({ message: `Delete ${q.quoteNumber}?`, danger: true }))) return;
    await apiFetch(`${API}/quotes/${q.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    load();
  }

  function onSaved(saved: { id: string }) {
    setShowCreate(false); setEditTarget(null); setPrefill(null);
    load();
    apiFetch(`${API}/quotes/${saved.id}`).then(r => (r.ok ? r.json() : null)).then(q => { if (q) setViewTarget(q); }).catch(() => {});
  }

  const sc = meta.statusCounts;
  const conversionRate = meta.total > 0 ? Math.round(((sc.converted ?? 0) / meta.total) * 100) : 0;
  const TABS = [
    { key: "all", label: "All" }, { key: "draft", label: "Draft" }, { key: "sent", label: "Sent" },
    { key: "viewed", label: "Viewed" }, { key: "accepted", label: "Accepted" },
    { key: "converted", label: "Converted" }, { key: "rejected", label: "Rejected" },
  ];

  return (
    <div>
      <PageHeader icon={FileText} color="deep" title="Quotes"
        sub={meta.total ? `${meta.total} quote${meta.total === 1 ? "" : "s"} · ${conversionRate}% became programs` : "Price offers you send to clients"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search client or event" />
        <MainButton icon={Plus} onClick={() => setShowCreate(true)}>New quote</MainButton>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <StatCard icon={Send} color="blue" label="Sent" value={String((sc.sent ?? 0) + (sc.viewed ?? 0))} sub="Waiting for an answer" />
        <StatCard icon={CheckCircle2} color="green" label="Accepted" value={String(sc.accepted ?? 0)} />
        <StatCard icon={RefreshCw} color="teal" label="Became programs" value={String(sc.converted ?? 0)} sub={`${conversionRate}% of all quotes`} />
        <StatCard icon={XCircle} color="red" label="Rejected" value={String(sc.rejected ?? 0)} />
      </div>

      <Chips label="Filter by status" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
        options={TABS.map(t => ({ value: t.key, label: t.label, count: t.key === "all" ? meta.total : sc[t.key] || undefined, dot: STATUS_HEX[t.key]?.text }))} />

      {loading ? (
        <RowsSkeleton n={6} />
      ) : quotes.length === 0 ? (
        search || statusFilter !== "all" ? (
          <EmptyState icon={Search} title={search ? `No quotes match "${search}"` : "No quotes here"} text="Try another word or filter." />
        ) : (
          <EmptyState icon={FileText} title="No quotes yet" text="Create a price offer to share with a client."
            action={<MainButton icon={Plus} onClick={() => setShowCreate(true)}>New quote</MainButton>} />
        )
      ) : (
        <Group>
          {quotes.map(q => (
            <QuoteRow key={q.id} q={q}
              onView={() => setViewTarget(q)}
              onEdit={() => { setViewTarget(null); setEditTarget(q); }}
              onDuplicate={() => duplicateQuote(q)}
              onDelete={() => deleteQuote(q)}
              onSend={() => sendQuote(q)}
            />
          ))}
        </Group>
      )}

      <Pager page={page} pages={meta.totalPages} onChange={setPage} />

      {(showCreate || editTarget) && (
        <QuoteForm quote={editTarget as QuoteForForm | null} prefill={editTarget ? null : prefill} onClose={() => { setShowCreate(false); setEditTarget(null); setPrefill(null); }} onSaved={onSaved} />
      )}
      <ViewDrawer quote={viewTarget} onClose={() => setViewTarget(null)} onEdit={() => { setEditTarget(viewTarget); setViewTarget(null); }} onRefresh={load} />
    </div>
  );
}

export default function QuotesPage() {
  return <Suspense><QuotesPageInner /></Suspense>;
}
