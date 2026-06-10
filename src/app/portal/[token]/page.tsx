"use client";

import { useState, useEffect, use } from "react";
import {
  Loader2, Camera, Calendar, FileText, CreditCard, Receipt,
  Phone, Mail, MapPin, CheckCircle, XCircle, Clock, ExternalLink,
  Package, Image as ImageIcon, Lock, Download, Link2,
  FileImage, FileVideo, FileArchive, File, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}
function sym(cur = "BDT") { return cur === "BDT" ? "৳" : "$"; }
function num(n: number | string | null | undefined) {
  return Number(n || 0).toLocaleString();
}
function fmtBytes(n: number): string {
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}
function fileIcon(mimeType: string) {
  if (mimeType?.startsWith("image/")) return FileImage;
  if (mimeType?.startsWith("video/")) return FileVideo;
  if (mimeType?.includes("zip")) return FileArchive;
  return File;
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  inquiry:    { label: "Inquiry",    color: "bg-slate-100 text-slate-600" },
  confirmed:  { label: "Confirmed",  color: "bg-blue-100 text-blue-700" },
  in_progress:{ label: "In Progress",color: "bg-amber-100 text-amber-700" },
  completed:  { label: "Completed",  color: "bg-emerald-100 text-emerald-700" },
  cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-600" },
  on_hold:    { label: "On Hold",    color: "bg-orange-100 text-orange-700" },
};

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "bg-slate-100 text-slate-600" },
  sent:     { label: "Sent",     color: "bg-blue-100 text-blue-700" },
  viewed:   { label: "Viewed",   color: "bg-violet-100 text-violet-700" },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600" },
  expired:  { label: "Expired",  color: "bg-orange-100 text-orange-700" },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft:          { label: "Draft",          color: "bg-slate-100 text-slate-600" },
  sent:           { label: "Sent",           color: "bg-blue-100 text-blue-700" },
  viewed:         { label: "Viewed",         color: "bg-violet-100 text-violet-700" },
  paid:           { label: "Paid",           color: "bg-emerald-100 text-emerald-700" },
  partially_paid: { label: "Partially Paid", color: "bg-amber-100 text-amber-700" },
  overdue:        { label: "Overdue",        color: "bg-red-100 text-red-700" },
  void:           { label: "Void",           color: "bg-slate-100 text-slate-400" },
};

interface R2File {
  id: string; fileName: string; mimeType: string;
  fileSize: number; downloadUrl: string | null;
}

interface ManualLink { id: string; title: string; url: string }

interface BookingDelivery {
  fullyPaid: boolean;
  dueAmount: number;
  r2Files: R2File[];
  links: ManualLink[];
  driveLink: string | null;
  note: string | null;
}

interface PortalData {
  client: {
    firstName: string; lastName?: string;
    email?: string; phone?: string; avatarUrl?: string;
  };
  company: {
    name: string; email?: string; phone?: string; address?: string;
    city?: string; logoUrl?: string; primaryColor?: string; currency: string;
  };
  bookings: {
    id: string; bookingNumber: string; eventName?: string;
    eventDate?: string; status: string; grandTotal: number;
    paidAmount: number; currency: string; eventLocation?: string;
    deliveryLink?: string;
    delivery?: BookingDelivery | null;
  }[];
  quotes: {
    id: string; quoteNumber: string; status: string;
    grandTotal: number; currency: string; validUntil?: string;
    publicToken: string; createdAt: string;
  }[];
  invoices: {
    id: string; invoiceNumber: string; status: string;
    grandTotal: number; paidAmount: number; balanceDue: number;
    currency: string; issueDate: string; dueDate?: string;
    publicToken: string;
  }[];
  payments: {
    id: string; amount: number; currency: string;
    paymentMethod?: string; paymentDate: string;
    referenceNumber?: string; notes?: string;
  }[];
}

type Tab = "bookings" | "quotes" | "invoices" | "payments";

// ─── Delivery Section per Booking ────────────────────────────────────────────
function DeliverySection({ delivery, dueAmount, currency, brand }: {
  delivery: BookingDelivery; dueAmount: number; currency: string; brand: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const cs = sym(currency);
  const hasContent = delivery.r2Files.length > 0 || delivery.links.length > 0 || !!delivery.driveLink;

  if (!hasContent) return null;

  if (!delivery.fullyPaid) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-800">Your files are ready!</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Complete your outstanding payment of{" "}
              <span className="font-bold">{cs}{num(dueAmount)}</span> to unlock download access.
            </p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            {delivery.r2Files.length > 0 && (
              <span className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-lg">
                <FileImage className="w-3 h-3" />{delivery.r2Files.length} file{delivery.r2Files.length > 1 ? "s" : ""}
              </span>
            )}
            {delivery.links.length > 0 && (
              <span className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-lg">
                <Link2 className="w-3 h-3" />{delivery.links.length} link{delivery.links.length > 1 ? "s" : ""}
              </span>
            )}
            {delivery.driveLink && (
              <span className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-lg">
                <Link2 className="w-3 h-3" />Drive folder
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const totalItems = delivery.r2Files.length + delivery.links.length + (delivery.driveLink ? 1 : 0);

  return (
    <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: brand }}>
            <Package className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-teal-800">Delivery Ready</p>
            <p className="text-xs text-teal-600">{totalItems} item{totalItems > 1 ? "s" : ""} available</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-teal-500" /> : <ChevronDown className="w-4 h-4 text-teal-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-teal-200 pt-3">
          {delivery.note && (
            <p className="text-xs text-teal-700 italic bg-teal-100 px-3 py-2 rounded-lg">{delivery.note}</p>
          )}

          {/* Manual Links */}
          {delivery.links.length > 0 && (
            <div className="space-y-2">
              {delivery.links.map(l => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-teal-100 hover:border-teal-300 transition-colors group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brand + "20" }}>
                    <Link2 className="w-4 h-4" style={{ color: brand }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{l.title || "Delivery Link"}</p>
                    <p className="text-[10px] text-slate-400 truncate">{l.url}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 flex-shrink-0 transition-colors" />
                </a>
              ))}
            </div>
          )}

          {/* Drive Folder link (legacy or auto) */}
          {delivery.driveLink && !delivery.links.some(l => l.url === delivery.driveLink) && (
            <a href={delivery.driveLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-teal-100 hover:border-teal-300 transition-colors group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-50">
                <ImageIcon className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">Google Drive Folder</p>
                <p className="text-[10px] text-slate-400 truncate">{delivery.driveLink}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 flex-shrink-0 transition-colors" />
            </a>
          )}

          {/* R2 Files */}
          {delivery.r2Files.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">Files ({delivery.r2Files.length})</p>
              {delivery.r2Files.map(f => {
                const Icon = fileIcon(f.mimeType);
                return (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-teal-100">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{f.fileName}</p>
                      <p className="text-[10px] text-slate-400">{fmtBytes(f.fileSize)}</p>
                    </div>
                    {f.downloadUrl ? (
                      <a href={f.downloadUrl} download={f.fileName} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: brand }}>
                        <Download className="w-3 h-3" />Download
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-400 px-2.5 py-1.5">
                        <Lock className="w-3 h-3" />Locked
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("bookings");

  useEffect(() => {
    fetch(`${API}/public/portal/${token}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError("This portal link is invalid or has been deactivated."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Link Invalid</h2>
        <p className="text-slate-500 text-sm">{error || "Portal not found"}</p>
      </div>
    </div>
  );

  const brand = data.company.primaryColor || "#4F46E5";
  const c = sym(data.company.currency);

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: "bookings",  label: "Bookings",  icon: Calendar,  count: data.bookings.length },
    { id: "quotes",    label: "Quotes",    icon: FileText,  count: data.quotes.length },
    { id: "invoices",  label: "Invoices",  icon: Receipt,   count: data.invoices.length },
    { id: "payments",  label: "Payments",  icon: CreditCard,count: data.payments.length },
  ];

  const totalDue = data.invoices.reduce((s, i) => s + Number(i.balanceDue), 0);
  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="text-white" style={{ backgroundColor: brand }}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            {data.company.logoUrl ? (
              <img src={data.company.logoUrl} alt="" className="w-10 h-10 rounded-xl object-contain bg-white/20 p-1" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className="font-bold text-base leading-none">{data.company.name}</p>
              <p className="text-xs text-white/70 mt-0.5">Client Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {data.client.firstName[0]}
            </div>
            <div>
              <p className="font-semibold text-base">
                {data.client.firstName} {data.client.lastName ?? ""}
              </p>
              <div className="flex flex-wrap gap-3 mt-0.5">
                {data.client.phone && (
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <Phone className="w-3 h-3" />{data.client.phone}
                  </span>
                )}
                {data.client.email && (
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <Mail className="w-3 h-3" />{data.client.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="max-w-3xl mx-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-xs text-white/70">Total Bookings</p>
              <p className="text-2xl font-bold">{data.bookings.length}</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-xs text-white/70">Balance Due</p>
              <p className="text-2xl font-bold">{c}{num(totalDue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex gap-1 bg-white rounded-xl shadow-sm border border-slate-200 p-1 -mt-3 relative z-10">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                tab === t.id ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              style={tab === t.id ? { backgroundColor: brand } : {}}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-bold",
                  tab === t.id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                )}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4 pb-12">

        {/* BOOKINGS */}
        {tab === "bookings" && (
          <div className="space-y-3">
            {data.bookings.length === 0 && (
              <EmptyState icon={Calendar} text="No bookings yet" />
            )}
            {data.bookings.map(b => {
              const st = BOOKING_STATUS[b.status] ?? { label: b.status, color: "bg-slate-100 text-slate-600" };
              const bal = Number(b.grandTotal) - Number(b.paidAmount);
              const cs = sym(b.currency);
              return (
                <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{b.eventName || "Event"}</p>
                      <p className="text-xs text-slate-400 font-mono">{b.bookingNumber}</p>
                    </div>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0", st.color)}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-500 mb-3">
                    {b.eventDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />{fmtDate(b.eventDate)}
                      </span>
                    )}
                    {b.eventLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{b.eventLocation}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="text-sm">
                      <span className="text-slate-400">Total: </span>
                      <span className="font-semibold text-slate-800">{cs}{num(b.grandTotal)}</span>
                      {Number(b.paidAmount) > 0 && (
                        <span className="text-emerald-600 ml-2">· Paid {cs}{num(b.paidAmount)}</span>
                      )}
                    </div>
                    {bal > 0 && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                        Due {cs}{num(bal)}
                      </span>
                    )}
                    {bal <= 0 && Number(b.grandTotal) > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" />Fully Paid
                      </span>
                    )}
                  </div>

                  {/* Delivery Section */}
                  {b.delivery && (
                    <DeliverySection
                      delivery={b.delivery}
                      dueAmount={bal > 0 ? bal : 0}
                      currency={b.currency}
                      brand={brand}
                    />
                  )}

                  {/* Legacy single link (fallback) */}
                  {!b.delivery && b.deliveryLink && (
                    <a
                      href={b.deliveryLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-white w-full transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brand }}
                    >
                      <ImageIcon className="w-4 h-4" />View Delivery
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* QUOTES */}
        {tab === "quotes" && (
          <div className="space-y-3">
            {data.quotes.length === 0 && (
              <EmptyState icon={FileText} text="No quotes yet" />
            )}
            {data.quotes.map(q => {
              const st = QUOTE_STATUS[q.status] ?? { label: q.status, color: "bg-slate-100 text-slate-600" };
              const cs = sym(q.currency);
              const expired = q.validUntil && new Date(q.validUntil) < new Date();
              return (
                <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{q.quoteNumber}</p>
                      <p className="text-xs text-slate-400">{fmtDate(q.createdAt)}</p>
                    </div>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", st.color)}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-lg text-slate-900">{cs}{num(q.grandTotal)}</p>
                    {q.validUntil && (
                      <p className={cn("text-xs", expired ? "text-red-500" : "text-slate-400")}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {expired ? "Expired" : `Valid until ${fmtDate(q.validUntil)}`}
                      </p>
                    )}
                  </div>
                  {q.publicToken && (
                    <a
                      href={`/q/${q.publicToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-slate-50"
                      style={{ borderColor: brand, color: brand }}
                    >
                      <ExternalLink className="w-4 h-4" />View Quote
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* INVOICES */}
        {tab === "invoices" && (
          <div className="space-y-3">
            {data.invoices.length === 0 && (
              <EmptyState icon={Receipt} text="No invoices yet" />
            )}
            {data.invoices.map(inv => {
              const st = INV_STATUS[inv.status] ?? { label: inv.status, color: "bg-slate-100 text-slate-600" };
              const cs = sym(inv.currency);
              return (
                <div key={inv.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">Issued: {fmtDate(inv.issueDate)}</p>
                    </div>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", st.color)}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm">
                      <span className="text-slate-400">Total: </span>
                      <span className="font-bold text-slate-900">{cs}{num(inv.grandTotal)}</span>
                      {Number(inv.paidAmount) > 0 && (
                        <span className="text-emerald-600 ml-2">· Paid {cs}{num(inv.paidAmount)}</span>
                      )}
                    </div>
                    {Number(inv.balanceDue) > 0 ? (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                        Due {cs}{num(inv.balanceDue)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" />Paid
                      </span>
                    )}
                  </div>
                  <a
                    href={`/inv/${inv.publicToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-slate-50"
                    style={{ borderColor: brand, color: brand }}
                  >
                    <ExternalLink className="w-4 h-4" />View Invoice
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* PAYMENTS */}
        {tab === "payments" && (
          <div className="space-y-3">
            {data.payments.length === 0 && (
              <EmptyState icon={CreditCard} text="No payment records yet" />
            )}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Total Paid</p>
              <p className="text-2xl font-extrabold" style={{ color: brand }}>{c}{num(totalPaid)}</p>
            </div>
            {data.payments.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{sym(p.currency)}{num(p.amount)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtDate(p.paymentDate)}
                      {p.paymentMethod && <span className="ml-2 capitalize">{p.paymentMethod.replace(/_/g, " ")}</span>}
                    </p>
                    {p.referenceNumber && <p className="text-xs text-slate-400">Ref: {p.referenceNumber}</p>}
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                </div>
                {p.notes && <p className="text-xs text-slate-500 mt-2 italic">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white py-4 px-4 text-center">
        <p className="text-xs text-slate-400">
          Powered by <span className="font-semibold text-slate-600">StuPanel</span>
          {data.company.phone && (
            <span className="ml-3">· <a href={`tel:${data.company.phone}`} className="hover:text-slate-800">{data.company.phone}</a></span>
          )}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}
