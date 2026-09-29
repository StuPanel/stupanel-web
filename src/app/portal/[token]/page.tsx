"use client";

import { useState, useEffect, use } from "react";
import {
  Loader2, Camera, Calendar, FileText, CreditCard, Receipt,
  Phone, Mail, MapPin, CheckCircle, XCircle, Clock, ExternalLink,
  Package, Image as ImageIcon, Lock, Download, Link2, MessageCircle,
  FileImage, FileVideo, FileArchive, File, ChevronDown, ChevronUp, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PortalChat } from "./_components/portal-chat";

function sym(cur = "BDT") { const S: Record<string,string> = { BDT:"৳", USD:"$", EUR:"€", GBP:"£", INR:"₹" }; return S[cur] ?? cur; }
function num(n: number | string | null | undefined) { return Number(n || 0).toLocaleString(); }
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

// Fallback if backend hasn't sent deliveryStatus yet
function getDeliveryStatus(b: { status: string; delivery?: any; deliveryStatus?: string }): string {
  if (b.deliveryStatus) return b.deliveryStatus;
  const s = b.status;
  const hasD = !!b.delivery;
  if (['cancelled', 'refunded'].includes(s)) return 'cancelled';
  if (['completed', 'delivered'].includes(s) || hasD) return 'delivered';
  if (s === 'ready_for_delivery') return 'ready';
  if (['in_progress', 'editing'].includes(s)) return 'in_progress';
  return 'not_started';
}

function groupByMonth(bookings: PortalData["bookings"]): [string, PortalData["bookings"]][] {
  const sorted = [...bookings].sort((a, b) => {
    if (!a.eventDate && !b.eventDate) return 0;
    if (!a.eventDate) return 1;
    if (!b.eventDate) return -1;
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  });
  const map = new Map<string, typeof sorted>();
  for (const b of sorted) {
    const key = b.eventDate
      ? new Date(b.eventDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "No Date";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return [...map.entries()];
}

const DELIVERY_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  not_started: { label: "Not Started",  color: "bg-slate-100 text-slate-500",    icon: Clock },
  in_progress: { label: "In Progress",  color: "bg-blue-100 text-blue-700",      icon: Loader2 },
  ready:       { label: "Ready",        color: "bg-amber-100 text-amber-700",    icon: Package },
  delivered:   { label: "Delivered",    color: "bg-emerald-100 text-emerald-700",icon: CheckCircle },
  cancelled:   { label: "Cancelled",    color: "bg-red-100 text-red-500",        icon: XCircle },
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
  fileSize: number; viewUrl: string | null; downloadUrl: string | null; folderName?: string | null;
}
interface ManualLink { id: string; title: string; url: string }
interface DriveFile {
  id: string; fileName: string; mimeType: string; fileSize: number;
  folderName: string | null; viewUrl: string | null; downloadUrl: string | null;
}
interface BookingDelivery {
  fullyPaid: boolean; dueAmount: number;
  r2Files: R2File[]; driveFiles?: DriveFile[];
  links: ManualLink[]; driveFolderUrl: string | null; note: string | null;
}
interface PortalData {
  client: { firstName: string; lastName?: string; email?: string; phone?: string; avatarUrl?: string };
  company: {
    name: string; email?: string; phone?: string; address?: string;
    city?: string; logoUrl?: string; primaryColor?: string; currency: string;
    portalWelcomeMessage?: string;
    portalShowQuotes?: boolean; portalShowInvoices?: boolean;
    portalShowPayments?: boolean; portalShowMessages?: boolean;
  };
  bookings: {
    id: string; bookingNumber: string; eventName?: string;
    eventDate?: string; status: string; deliveryStatus?: string;
    grandTotal: number; paidAmount: number; currency: string;
    eventLocation?: string; deliveryLink?: string;
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
    currency: string; issueDate: string; dueDate?: string; publicToken: string;
  }[];
  payments: {
    id: string; amount: number; currency: string;
    paymentMethod?: string; paymentDate: string;
    referenceNumber?: string; notes?: string;
  }[];
}

type Tab = "programs" | "quotes" | "invoices" | "payments" | "messages";

// ─── Delivery Section (unchanged logic) ──────────────────────────────────────
function DeliverySection({ delivery, dueAmount, currency, brand, token, bookingId }: {
  delivery: BookingDelivery; dueAmount: number; currency: string; brand: string;
  token: string; bookingId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const cs = sym(currency);
  const driveFiles: DriveFile[] = delivery.driveFiles ?? [];
  const hasContent = delivery.r2Files.length > 0 || delivery.links.length > 0 || driveFiles.length > 0 || !!delivery.driveFolderUrl;

  function isFolderExpanded(key: string) { return expandedFolders[key] ?? false; }
  function toggleFolder(key: string) { setExpandedFolders(prev => ({ ...prev, [key]: !isFolderExpanded(key) })); }
  function downloadZipUrl(folderName?: string) {
    const base = `${API}/public/portal/${token}/download-zip?bookingId=${bookingId}`;
    return folderName ? `${base}&folderName=${encodeURIComponent(folderName)}` : base;
  }

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
            {driveFiles.length > 0 && (
              <span className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-lg">
                <FileImage className="w-3 h-3" />{driveFiles.length} Drive file{driveFiles.length > 1 ? "s" : ""}
              </span>
            )}
            {delivery.links.length > 0 && (
              <span className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-lg">
                <Link2 className="w-3 h-3" />{delivery.links.length} link{delivery.links.length > 1 ? "s" : ""}
              </span>
            )}
            {delivery.driveFolderUrl && driveFiles.length === 0 && (
              <span className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-lg">
                <Link2 className="w-3 h-3" />Drive folder
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const totalItems = delivery.r2Files.length + driveFiles.length + delivery.links.length + (delivery.driveFolderUrl && driveFiles.length === 0 ? 1 : 0);

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

          {driveFiles.length > 0 && (() => {
            const groups: Record<string, DriveFile[]> = {};
            for (const f of driveFiles) {
              const key = f.folderName || "Other Files";
              if (!groups[key]) groups[key] = [];
              groups[key].push(f);
            }
            const groupEntries = Object.entries(groups);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">
                    Drive Files ({driveFiles.length}) · {groupEntries.length} folder{groupEntries.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    {delivery.driveFolderUrl && (
                      <a href={delivery.driveFolderUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-green-600 transition-colors">
                        <ExternalLink className="w-3 h-3" />Open Drive
                      </a>
                    )}
                    <a href={`${API}/public/portal/${token}/drive-zip?bookingId=${bookingId}`}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brand }}>
                      <Download className="w-3 h-3" />Download All
                    </a>
                  </div>
                </div>
                {groupEntries.map(([folderKey, files]) => {
                  const isOpen = isFolderExpanded(`drive-${folderKey}`);
                  return (
                    <div key={folderKey} className="border border-green-100 rounded-xl overflow-hidden bg-white">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button onClick={() => toggleFolder(`drive-${folderKey}`)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <FolderOpen className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 truncate">{folderKey}</span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">({files.length})</span>
                        </button>
                        <a href={`${API}/public/portal/${token}/drive-zip?bookingId=${bookingId}&folderName=${encodeURIComponent(folderKey)}`}
                          title="Download folder as ZIP"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors flex-shrink-0"
                          onClick={e => e.stopPropagation()}>
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => toggleFolder(`drive-${folderKey}`)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-green-500 flex-shrink-0">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                      <div style={{ maxHeight: isOpen ? `${files.length * 76 + 24}px` : "0", transition: "max-height 0.35s ease" }} className="overflow-hidden">
                        <div className="px-3 pb-3 border-t border-green-50 pt-2 space-y-2">
                          {files.map(f => {
                            const Icon = fileIcon(f.mimeType);
                            return (
                              <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-green-100">
                                <a href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 hover:border-green-300 transition-colors">
                                  <Icon className="w-4 h-4 text-slate-400" />
                                </a>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-800 truncate">{f.fileName}</p>
                                  <p className="text-[10px] text-slate-400">{fmtBytes(f.fileSize)}</p>
                                </div>
                                {f.downloadUrl && (
                                  <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 flex-shrink-0"
                                    style={{ backgroundColor: brand }}>
                                    <Download className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {delivery.driveFolderUrl && driveFiles.length === 0 && !delivery.links.some(l => l.url === delivery.driveFolderUrl) && (
            <a href={delivery.driveFolderUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-teal-100 hover:border-teal-300 transition-colors group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-50">
                <ImageIcon className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">Google Drive Folder</p>
                <p className="text-[10px] text-slate-400 truncate">{delivery.driveFolderUrl}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-green-500 flex-shrink-0 transition-colors" />
            </a>
          )}

          {delivery.r2Files.length > 0 && (() => {
            const groups: Record<string, R2File[]> = {};
            for (const f of delivery.r2Files) {
              const key = f.folderName || "Other Files";
              if (!groups[key]) groups[key] = [];
              groups[key].push(f);
            }
            const groupEntries = Object.entries(groups);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">
                    Files ({delivery.r2Files.length}) · {groupEntries.length} folder{groupEntries.length > 1 ? "s" : ""}
                  </p>
                  <a href={downloadZipUrl()}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: brand }}>
                    <Download className="w-3 h-3" />Download All
                  </a>
                </div>
                {groupEntries.map(([folderKey, files]) => {
                  const isOpen = isFolderExpanded(folderKey);
                  return (
                    <div key={folderKey} className="border border-teal-100 rounded-xl overflow-hidden bg-white">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button onClick={() => toggleFolder(folderKey)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 truncate">{folderKey}</span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">({files.length})</span>
                        </button>
                        <a href={downloadZipUrl(folderKey)} title="Download folder as ZIP"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-teal-600 hover:bg-teal-50 transition-colors flex-shrink-0"
                          onClick={e => e.stopPropagation()}>
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => toggleFolder(folderKey)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-teal-50 text-teal-500 flex-shrink-0">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                      <div style={{ maxHeight: isOpen ? `${files.length * 76 + 24}px` : "0", transition: "max-height 0.35s ease" }} className="overflow-hidden">
                        <div className="px-3 pb-3 border-t border-teal-50 pt-2 space-y-2">
                          {files.map(f => {
                            const Icon = fileIcon(f.mimeType);
                            return (
                              <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-teal-100">
                                <a href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 hover:border-teal-300 transition-colors">
                                  <Icon className="w-4 h-4 text-slate-400" />
                                </a>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-800 truncate">{f.fileName}</p>
                                  <p className="text-[10px] text-slate-400">{fmtBytes(f.fileSize)}</p>
                                </div>
                                {f.downloadUrl ? (
                                  <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 flex-shrink-0"
                                    style={{ backgroundColor: brand }}>
                                    <Download className="w-3 h-3" />
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
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-white/15 rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-white/75" />
        <p className="text-[11px] font-medium text-white/70 leading-none">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-white leading-none">{value}</p>
    </div>
  );
}

// ─── Delivery Status Badge ────────────────────────────────────────────────────
function DeliveryStatusBadge({ status }: { status: string }) {
  const ds = DELIVERY_STATUS[status] ?? DELIVERY_STATUS.not_started;
  const Icon = ds.icon;
  return (
    <span className={cn("flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0", ds.color)}>
      <Icon className={cn("w-3 h-3", status === "in_progress" && "animate-spin")} />
      {ds.label}
    </span>
  );
}

// ─── Payment Progress Bar ─────────────────────────────────────────────────────
function PaymentBar({ grandTotal, paidAmount, currency, brand }: {
  grandTotal: number; paidAmount: number; currency: string; brand: string;
}) {
  const cs = sym(currency);
  const gt = Number(grandTotal);
  const paid = Number(paidAmount);
  const bal = Math.max(0, gt - paid);
  const pct = gt > 0 ? Math.min(100, (paid / gt) * 100) : 0;
  const fullyPaid = bal <= 0 && gt > 0;

  if (gt === 0) return null;

  return (
    <div className="mt-2.5">
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: fullyPaid ? "#10b981" : brand }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {cs}{num(gt)} total
          {paid > 0 && <span className="text-emerald-600 ml-1.5">· {cs}{num(paid)} paid</span>}
        </span>
        {fullyPaid ? (
          <span className="flex items-center gap-1 font-bold text-emerald-600">
            <CheckCircle className="w-3 h-3" />Fully Paid
          </span>
        ) : (
          <span className="font-bold text-red-600">{cs}{num(bal)} due</span>
        )}
      </div>
    </div>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────
function BookingCard({ b, brand, token }: { b: PortalData["bookings"][0]; brand: string; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const bal = Math.max(0, Number(b.grandTotal) - Number(b.paidAmount));
  const ds = getDeliveryStatus(b);
  const hasExpandable = !!b.delivery || !!b.deliveryLink;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div
        className={cn("p-4", hasExpandable && "cursor-pointer select-none")}
        onClick={hasExpandable ? () => setExpanded(e => !e) : undefined}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 truncate text-[15px]">{b.eventName || "Program"}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-400 font-mono">{b.bookingNumber}</span>
              {b.eventLocation && (
                <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />{b.eventLocation}
                </span>
              )}
            </div>
          </div>
          <DeliveryStatusBadge status={ds} />
        </div>

        {/* Date */}
        {b.eventDate && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />{fmtDate(b.eventDate)}
          </div>
        )}

        {/* Payment bar */}
        <PaymentBar grandTotal={b.grandTotal} paidAmount={b.paidAmount} currency={b.currency} brand={brand} />

        {/* Expand hint */}
        {hasExpandable && (
          <div className="flex justify-end mt-2 pt-2 border-t border-slate-50">
            <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              {expanded
                ? <><ChevronUp className="w-3.5 h-3.5" />Hide delivery</>
                : <><ChevronDown className="w-3.5 h-3.5" />View delivery</>
              }
            </span>
          </div>
        )}
      </div>

      {/* Expanded delivery */}
      {expanded && (
        <div className="px-4 pb-4 -mt-1">
          {b.delivery ? (
            <DeliverySection
              delivery={b.delivery}
              dueAmount={bal}
              currency={b.currency}
              brand={brand}
              token={token}
              bookingId={b.id}
            />
          ) : b.deliveryLink ? (
            <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white w-full transition-opacity hover:opacity-90"
              style={{ backgroundColor: brand }}>
              <ImageIcon className="w-4 h-4" />View Delivery
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("programs");

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

  // Stats computed from bookings
  const totalPrograms = data.bookings.length;
  const completedPrograms = data.bookings.filter(b => ["completed", "delivered"].includes(b.status)).length;
  const readyDeliveries = data.bookings.filter(b => b.delivery !== null && b.delivery !== undefined).length;
  const totalDue = data.bookings.reduce((s, b) => s + Math.max(0, Number(b.grandTotal) - Number(b.paidAmount)), 0);
  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount), 0);

  const allTabs: { id: Tab; label: string; icon: React.ElementType; count: number; enabled: boolean }[] = [
    { id: "programs",  label: "Programs",  icon: Camera,        count: totalPrograms,         enabled: true },
    { id: "quotes",    label: "Quotes",    icon: FileText,      count: data.quotes.length,    enabled: data.company.portalShowQuotes   !== false },
    { id: "invoices",  label: "Invoices",  icon: Receipt,       count: data.invoices.length,  enabled: data.company.portalShowInvoices !== false },
    { id: "payments",  label: "Payments",  icon: CreditCard,    count: data.payments.length,  enabled: data.company.portalShowPayments !== false },
    { id: "messages",  label: "Messages",  icon: MessageCircle, count: 0,                     enabled: data.company.portalShowMessages !== false },
  ];
  const tabs = allTabs.filter(t => t.enabled);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: brand }}>
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-5">

          {/* Company row */}
          <div className="flex items-center gap-3 mb-5">
            {data.company.logoUrl ? (
              <div className="w-10 h-10 rounded-xl bg-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                <img src={data.company.logoUrl} alt="" className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className="font-bold text-white text-base leading-none">{data.company.name}</p>
              <p className="text-xs text-white/60 mt-0.5">Client Portal</p>
            </div>
          </div>

          {/* Welcome greeting */}
          <div className="mb-5">
            <h1 className="text-2xl font-extrabold text-white leading-tight">
              Welcome back, {data.client.firstName}!
            </h1>
            <div className="flex flex-wrap gap-3 mt-1.5">
              {data.client.phone && (
                <span className="text-xs text-white/60 flex items-center gap-1">
                  <Phone className="w-3 h-3" />{data.client.phone}
                </span>
              )}
              {data.client.email && (
                <span className="text-xs text-white/60 flex items-center gap-1">
                  <Mail className="w-3 h-3" />{data.client.email}
                </span>
              )}
            </div>
          </div>

          {/* 4 stat cards — 2×2 on mobile, 4-col on md+ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatCard label="Total Programs"  value={totalPrograms}       icon={Camera} />
            <StatCard label="Completed"       value={completedPrograms}   icon={CheckCircle} />
            <StatCard label="Deliveries"      value={readyDeliveries}     icon={Package} />
            <StatCard label="Balance Due"     value={`${c}${num(totalDue)}`} icon={CreditCard} />
          </div>

          {/* Custom welcome message */}
          {data.company.portalWelcomeMessage && (
            <div className="mt-4 px-4 py-3 bg-white/15 rounded-xl">
              <p className="text-sm text-white/85 leading-relaxed">{data.company.portalWelcomeMessage}</p>
            </div>
          )}
        </div>

        {/* Tab bar — overlaps into white */}
        <div className="max-w-3xl mx-auto px-4 pb-0">
          <div className="flex gap-1 bg-white rounded-t-2xl shadow-sm border-x border-t border-slate-200 p-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all",
                  tab === t.id ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
                style={tab === t.id ? { backgroundColor: brand } : {}}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                {t.count > 0 && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    tab === t.id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                  )}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-12">

        {/* PROGRAMS TAB */}
        {tab === "programs" && (
          <div className="space-y-6">
            {data.bookings.length === 0 && <EmptyState icon={Camera} text="No programs yet" />}
            {groupByMonth(data.bookings).map(([month, bkgs]) => (
              <div key={month}>
                {/* Month header */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {month}
                  </p>
                  <span className="text-[11px] bg-slate-200 text-slate-500 rounded-full px-2 py-0.5 font-bold flex-shrink-0">
                    {bkgs.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="space-y-3">
                  {bkgs.map(b => (
                    <BookingCard key={b.id} b={b} brand={brand} token={token} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* QUOTES TAB */}
        {tab === "quotes" && (
          <div className="space-y-3">
            {data.quotes.length === 0 && <EmptyState icon={FileText} text="No quotes yet" />}
            {data.quotes.map(q => {
              const st = QUOTE_STATUS[q.status] ?? { label: q.status, color: "bg-slate-100 text-slate-600" };
              const cs = sym(q.currency);
              const expired = q.validUntil && new Date(q.validUntil) < new Date();
              return (
                <div key={q.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{q.quoteNumber}</p>
                      <p className="text-xs text-slate-400">{fmtDate(q.createdAt)}</p>
                    </div>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", st.color)}>{st.label}</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-xl text-slate-900">{cs}{num(q.grandTotal)}</p>
                    {q.validUntil && (
                      <p className={cn("text-xs flex items-center gap-1", expired ? "text-red-500" : "text-slate-400")}>
                        <Clock className="w-3 h-3" />
                        {expired ? "Expired" : `Valid until ${fmtDate(q.validUntil)}`}
                      </p>
                    )}
                  </div>
                  {q.publicToken && (
                    <a href={`/q/${q.publicToken}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-slate-50"
                      style={{ borderColor: brand, color: brand }}>
                      <ExternalLink className="w-4 h-4" />View Quote
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* INVOICES TAB */}
        {tab === "invoices" && (
          <div className="space-y-3">
            {data.invoices.length === 0 && <EmptyState icon={Receipt} text="No invoices yet" />}
            {data.invoices.map(inv => {
              const st = INV_STATUS[inv.status] ?? { label: inv.status, color: "bg-slate-100 text-slate-600" };
              const cs = sym(inv.currency);
              return (
                <div key={inv.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">Issued: {fmtDate(inv.issueDate)}{inv.dueDate && ` · Due: ${fmtDate(inv.dueDate)}`}</p>
                    </div>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", st.color)}>{st.label}</span>
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
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                        Due {cs}{num(inv.balanceDue)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" />Paid
                      </span>
                    )}
                  </div>
                  <a href={`/inv/${inv.publicToken}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-slate-50"
                    style={{ borderColor: brand, color: brand }}>
                    <ExternalLink className="w-4 h-4" />View Invoice
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === "payments" && (
          <div className="space-y-3">
            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Total Paid</p>
                <p className="text-2xl font-extrabold" style={{ color: brand }}>{c}{num(totalPaid)}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: brand + "15" }}>
                <CheckCircle className="w-6 h-6" style={{ color: brand }} />
              </div>
            </div>
            {data.payments.length === 0 && <EmptyState icon={CreditCard} text="No payment records yet" />}
            {data.payments.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 text-base">{sym(p.currency)}{num(p.amount)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtDate(p.paymentDate)}
                      {p.paymentMethod && (
                        <span className="ml-2 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-medium capitalize">
                          {p.paymentMethod.replace(/_/g, " ")}
                        </span>
                      )}
                    </p>
                    {p.referenceNumber && <p className="text-xs text-slate-400 mt-0.5">Ref: {p.referenceNumber}</p>}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
                {p.notes && <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-50 pt-2">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* MESSAGES TAB */}
        {tab === "messages" && (
          <PortalChat token={token} brand={brand} companyName={data.company.name} />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white py-4 px-4 text-center">
        <p className="text-xs text-slate-400">
          Powered by <span className="font-semibold text-slate-600">StuPanel</span>
          {data.company.phone && (
            <span className="ml-3">
              · <a href={`tel:${data.company.phone}`} className="hover:text-slate-800">{data.company.phone}</a>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="text-center py-14">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}
