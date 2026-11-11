"use client";

import { useState, useEffect, use } from "react";
import {
  Camera, Calendar, FileText, CreditCard, Receipt,
  Phone, Mail, MapPin, CheckCircle, XCircle, Clock, ExternalLink, ChevronRight, Wallet,
  Package, Image as ImageIcon, Lock, Download, Link2, MessageCircle,
  FileImage, FileVideo, FileArchive, File, ChevronDown, ChevronUp, FolderOpen, Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PortalChat } from "./_components/portal-chat";
import { CARD_SHADOW, Chips, DateBox, EmptyState, StatCard, Tile } from "@/components/ui/apple";
import { PublicLoading, PublicMessage, PublicShell } from "@/components/public/public-shell";
import { BRAND } from "@/lib/brand";
import { PortalMusic } from "./_components/portal-music";
import { PortalPhotos } from "./_components/portal-photos";
import type { ClientGalleryCard } from "@/lib/photos";
import type { ClientMusic } from "@/lib/music";
import { portalHeaders, withPortalSession, clearPortalSession, waLink } from "@/lib/portal-session";
import { PortalLock, type PortalMeta } from "./_components/portal-lock";
import { PortalFiles, type PortalDriveFile } from "./_components/portal-files";
import { setStudioCountry } from "@/lib/phone";

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
  if (['completed', 'delivered'].includes(s)) return 'delivered';
  if (s === 'ready_for_delivery' || hasD) return 'ready';
  if (s === 'editing') return 'editing';
  if (s === 'in_progress') return 'shooting';
  if (['confirmed', 'advance_received'].includes(s)) return 'booked';
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
  not_started: { label: "Not started",  color: "bg-[#F2EFF8] text-[#6B6680]", icon: Clock },
  booked:      { label: "Booked",       color: "bg-[#EEE8FD] text-[#5B3FD0]", icon: Calendar },
  shooting:    { label: "Shooting",     color: "bg-[#EEE8FD] text-[#5B3FD0]", icon: Camera },
  in_progress: { label: "In progress",  color: "bg-[#EEE8FD] text-[#5B3FD0]", icon: Clock },
  editing:     { label: "Editing",      color: "bg-[#EEE8FD] text-[#5B3FD0]", icon: Clock },
  ready:       { label: "Files ready",  color: "bg-[#7D5CEF] text-white",     icon: Package },
  delivered:   { label: "Delivered",    color: "bg-[#E6F4EC] text-[#1F8A5B]", icon: CheckCircle },
  cancelled:   { label: "Cancelled",    color: "bg-[#FDECEF] text-[#C2304F]", icon: XCircle },
};

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "bg-[#F1EFF6] text-[#4A4658]" },
  sent:     { label: "Sent",     color: "bg-[#E8F0FA] text-[#1F5C99]" },
  viewed:   { label: "Viewed",   color: "bg-[#F7E9F4] text-[#9E3A8C]" },
  accepted: { label: "Accepted", color: "bg-[#E7F5EE] text-[#1F8A5B]" },
  rejected: { label: "Rejected", color: "bg-[#FDECEF] text-[#C2304F]" },
  expired:  { label: "Expired",  color: "bg-[#FFF3E0] text-[#9A5B00]" },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft:          { label: "Draft",          color: "bg-[#F1EFF6] text-[#4A4658]" },
  sent:           { label: "Sent",           color: "bg-[#E8F0FA] text-[#1F5C99]" },
  viewed:         { label: "Viewed",         color: "bg-[#F7E9F4] text-[#9E3A8C]" },
  paid:           { label: "Paid",           color: "bg-[#E7F5EE] text-[#1F8A5B]" },
  partially_paid: { label: "Partly paid", color: "bg-[#FFF3E0] text-[#9A5B00]" },
  overdue:        { label: "Overdue",        color: "bg-[#FDECEF] text-[#C2304F]" },
  void:           { label: "Void",           color: "bg-[#F1EFF6] text-[#8A8599]" },
};

interface R2File {
  id: string; fileName: string; mimeType: string;
  fileSize: number; viewUrl: string | null; downloadUrl: string | null; folderName?: string | null;
}
interface ManualLink { id: string; title: string; url: string | null }
type DriveFile = PortalDriveFile;
interface BookingDelivery {
  fullyPaid: boolean; dueAmount: number;
  r2Files: R2File[]; driveFiles?: DriveFile[];
  links: ManualLink[]; driveFolderUrl: string | null; driveFolderLocked?: boolean; note: string | null;
  /** Locked (money due): what is waiting, by top folder. */
  preview?: { name: string; count: number; bytes: number; videos: number; photos: number }[];
}
type Studio = { name: string; phone?: string; bkashNumber?: string | null; nagadNumber?: string | null };
interface PortalData {
  client: { firstName: string; lastName?: string; email?: string; phone?: string; avatarUrl?: string };
  company: {
    name: string; email?: string; phone?: string; address?: string;
    city?: string; logoUrl?: string; primaryColor?: string; currency: string;
    portalWelcomeMessage?: string; bkashNumber?: string | null; nagadNumber?: string | null;
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
function DeliverySection({ delivery, dueAmount, currency, brand, token, bookingId, studio, programName }: {
  delivery: BookingDelivery; dueAmount: number; currency: string; brand: string;
  token: string; bookingId: string; studio: Studio; programName: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const cs = sym(currency);
  const driveFiles: DriveFile[] = delivery.driveFiles ?? [];
  const hasContent = delivery.r2Files.length > 0 || delivery.links.length > 0 || driveFiles.length > 0 || !!delivery.driveFolderUrl || !!delivery.driveFolderLocked;

  function isFolderExpanded(key: string) { return expandedFolders[key] ?? false; }
  function toggleFolder(key: string) { setExpandedFolders(prev => ({ ...prev, [key]: !isFolderExpanded(key) })); }
  function downloadZipUrl(folderName?: string) {
    const base = `${API}/public/portal/${token}/download-zip?bookingId=${bookingId}`;
    return withPortalSession(token, folderName ? `${base}&folderName=${encodeURIComponent(folderName)}` : base);
  }

  if (!hasContent) return null;

  if (!delivery.fullyPaid) {
    const preview = delivery.preview ?? [];
    const kind = (g: { count: number; videos: number; photos: number }) =>
      g.videos === g.count ? `${g.count} video${g.count > 1 ? "s" : ""}` : g.photos === g.count ? `${g.count} photo${g.count > 1 ? "s" : ""}` : `${g.count} file${g.count > 1 ? "s" : ""}`;
    const paid = waLink(studio.phone, `Hi ${studio.name}, I've paid ${cs}${num(dueAmount)} for ${programName}. Please unlock my files.`);
    const ways = [studio.bkashNumber && { label: "bKash", n: studio.bkashNumber }, studio.nagadNumber && { label: "Nagad", n: studio.nagadNumber }].filter(Boolean) as { label: string; n: string }[];
    return (
      <div className="mt-3 rounded-2xl border border-[#E4DCFB] bg-[#F7F5FB] overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#EEE8FD] flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-[#5B3FD0]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#17151F]">Your files are ready!</p>
            <p className="text-xs text-[#4A4658] mt-0.5">
              Pay the remaining <span className="font-bold">{cs}{num(dueAmount)}</span> and they unlock here to view and download.
            </p>
          </div>
        </div>
        {preview.length > 0 && (
          <div className="mx-3 mb-3 rounded-xl bg-white border border-[#EEEBF4] divide-y divide-[#F2EFF8]">
            {preview.map(g => (
              <div key={g.name} className="px-3 py-2.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${brand}1A` }}>
                  <Folder className="w-4 h-4" style={{ color: brand }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#17151F] truncate">{g.name}</span>
                  <span className="block text-[11px] text-[#6B6680]">{kind(g)}</span>
                </span>
                <Lock className="w-3.5 h-3.5 text-[#A29DB3]" />
              </div>
            ))}
          </div>
        )}
        {preview.length === 0 && delivery.links.length > 0 && (
          <p className="px-4 pb-3 text-xs text-[#5B3FD0]">{delivery.links.length} link{delivery.links.length > 1 ? "s" : ""} waiting</p>
        )}
        {(ways.length > 0 || paid) && (
          <div className="px-4 pb-4 space-y-2">
            {ways.length > 0 && (
              <p className="text-xs text-[#4A4658]">
                Pay by {ways.map((w, i) => <span key={w.label}>{i > 0 && " or "}<b>{w.label}</b> {w.n}</span>)}
              </p>
            )}
            {paid && (
              <a href={paid} target="_blank" rel="noopener noreferrer"
                className="h-10 rounded-full text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90" style={{ backgroundColor: brand }}>
                <MessageCircle className="w-4 h-4" />I&apos;ve paid — tell {studio.name}
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  const totalItems = delivery.r2Files.length + driveFiles.length + delivery.links.length + (delivery.driveFolderUrl && driveFiles.length === 0 ? 1 : 0);

  return (
    <div className="mt-3 rounded-2xl border border-[#E4DCFB] bg-[#F7F5FB] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: brand }}>
            <Package className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-[#17151F]">Your files</p>
            <p className="text-xs text-[#6B6680]">{totalItems} item{totalItems > 1 ? "s" : ""} available</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#8A8599]" /> : <ChevronDown className="w-4 h-4 text-[#8A8599]" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#E4DCFB] pt-3">
          {delivery.note && (
            <p className="text-xs text-[#4A4658] italic bg-[#EEE8FD] px-3 py-2 rounded-lg">{delivery.note}</p>
          )}

          {delivery.links.length > 0 && (
            <div className="space-y-2">
              {delivery.links.filter(l => !!l.url).map(l => (
                <a key={l.id} href={l.url ?? undefined} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#EEEBF4] hover:border-[#CFC8DD] transition-colors group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brand + "20" }}>
                    <Link2 className="w-4 h-4" style={{ color: brand }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#17151F]">{l.title || "Delivery Link"}</p>
                    <p className="text-xs text-[#8A8599] truncate">{l.url}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#B5B0C4] group-hover:text-[#8A8599] flex-shrink-0 transition-colors" />
                </a>
              ))}
            </div>
          )}

          {driveFiles.length > 0 && (
            <PortalFiles files={driveFiles} brand={brand} driveUrl={delivery.driveFolderUrl}
              zipUrl={folder => withPortalSession(token, `${API}/public/portal/${token}/drive-zip?bookingId=${bookingId}${folder ? `&folderName=${encodeURIComponent(folder)}` : ""}`)} />
          )}

          {delivery.driveFolderUrl && driveFiles.length === 0 && !delivery.links.some(l => l.url === delivery.driveFolderUrl) && (
            <a href={delivery.driveFolderUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#EEEBF4] hover:border-[#CFC8DD] transition-colors group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#EEE8FD]">
                <ImageIcon className="w-4 h-4 text-[#5B3FD0]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#17151F]">Google Drive Folder</p>
                <p className="text-xs text-[#8A8599] truncate">{delivery.driveFolderUrl}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#B5B0C4] group-hover:text-[#5B3FD0] flex-shrink-0 transition-colors" />
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
                  <p className="text-xs font-semibold text-[#6B6680] uppercase tracking-wide">
                    Files ({delivery.r2Files.length}) · {groupEntries.length} folder{groupEntries.length > 1 ? "s" : ""}
                  </p>
                  <a href={downloadZipUrl()}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: brand }}>
                    <Download className="w-3 h-3" />Download All
                  </a>
                </div>
                {groupEntries.map(([folderKey, files]) => {
                  const isOpen = isFolderExpanded(folderKey);
                  return (
                    <div key={folderKey} className="border border-[#EEEBF4] rounded-xl overflow-hidden bg-white">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button onClick={() => toggleFolder(folderKey)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <FolderOpen className="w-3.5 h-3.5 text-[#5B3FD0] flex-shrink-0" />
                          <span className="text-sm font-semibold text-[#17151F] truncate">{folderKey}</span>
                          <span className="text-xs text-[#8A8599] flex-shrink-0">({files.length})</span>
                        </button>
                        <a href={downloadZipUrl(folderKey)} title="Download folder as ZIP"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B6680] hover:bg-[#F7F5FB] transition-colors flex-shrink-0"
                          onClick={e => e.stopPropagation()}>
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => toggleFolder(folderKey)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F7F5FB] text-[#8A8599] flex-shrink-0">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                      <div style={{ maxHeight: isOpen ? `${files.length * 76 + 24}px` : "0", transition: "max-height 0.35s ease" }} className="overflow-hidden">
                        <div className="px-3 pb-3 border-t border-[#F2EFF8] pt-2 space-y-2">
                          {files.map(f => {
                            const Icon = fileIcon(f.mimeType);
                            return (
                              <div key={f.id} className="flex items-center gap-3 p-3 bg-[#F7F5FB] rounded-xl border border-[#EEEBF4]">
                                <a href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-lg bg-white border border-[#EEEBF4] flex items-center justify-center flex-shrink-0 hover:border-[#CFC8DD] transition-colors">
                                  <Icon className="w-4 h-4 text-[#8A8599]" />
                                </a>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-[#17151F] truncate">{f.fileName}</p>
                                  <p className="text-xs text-[#8A8599]">{fmtBytes(f.fileSize)}</p>
                                </div>
                                {f.downloadUrl ? (
                                  <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 flex-shrink-0"
                                    style={{ backgroundColor: brand }}>
                                    <Download className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs text-[#8A8599] px-2.5 py-1.5">
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

// ─── Delivery Status Badge ────────────────────────────────────────────────────
function DeliveryStatusBadge({ status }: { status: string }) {
  const ds = DELIVERY_STATUS[status] ?? DELIVERY_STATUS.not_started;
  const Icon = ds.icon;
  return (
    <span className={cn("h-7 inline-flex items-center gap-1 text-[12px] font-bold px-2.5 rounded-full flex-shrink-0", ds.color)}>
      <Icon className="w-3.5 h-3.5" />{ds.label}
    </span>
  );
}

// ─── Payment Progress Bar ─────────────────────────────────────────────────────
function PaymentBar({ grandTotal, paidAmount, currency }: { grandTotal: number; paidAmount: number; currency: string }) {
  const cs = sym(currency);
  const gt = Number(grandTotal);
  const paid = Number(paidAmount);
  const bal = Math.max(0, gt - paid);
  const pct = gt > 0 ? Math.min(100, (paid / gt) * 100) : 0;
  const fullyPaid = bal <= 0 && gt > 0;
  if (gt === 0) return null;
  return (
    <div className="mt-3.5">
      <div className="h-2 bg-[#F1EFF6] rounded-full overflow-hidden" role="progressbar" aria-label="Paid so far" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: fullyPaid ? "#1F8A5B" : "linear-gradient(90deg,#8E72F2,#5B3FD0)" }} />
      </div>
      <div className="flex items-center justify-between gap-3 mt-2 text-[13px]">
        <span className="text-[#6B6680]">
          <span className="font-semibold text-[#17151F] tabular-nums">{cs}{num(gt)}</span> total
          {paid > 0 && <> · <span className="text-[#1F8A5B] font-semibold tabular-nums">{cs}{num(paid)}</span> paid</>}
        </span>
        {fullyPaid
          ? <span className="inline-flex items-center gap-1 font-bold text-[#1F8A5B]"><CheckCircle className="w-3.5 h-3.5" />Fully paid</span>
          : <span className="font-bold text-[#C2304F] tabular-nums">{cs}{num(bal)} due</span>}
      </div>
    </div>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────
function BookingCard({ b, brand, token, studio, music, onMusicChanged, photos }: { b: PortalData["bookings"][0]; brand: string; token: string; studio: Studio; music?: ClientMusic; onMusicChanged: () => void; photos: ClientGalleryCard[] }) {
  // Files waiting? Show them straight away.
  const [expanded, setExpanded] = useState(!!b.delivery);
  const bal = Math.max(0, Number(b.grandTotal) - Number(b.paidAmount));
  const ds = getDeliveryStatus(b);
  const hasExpandable = !!b.delivery || !!b.deliveryLink;

  return (
    <article className={cn("bg-white rounded-[22px] overflow-hidden", CARD_SHADOW)}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <DateBox date={b.eventDate} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h3 className="flex-1 min-w-0 text-[16px] font-extrabold tracking-[-0.01em] text-[#17151F] leading-snug">{b.eventName || "Program"}</h3>
              <DeliveryStatusBadge status={ds} />
            </div>
            <p className="mt-0.5 text-[12.5px] text-[#6B6680] tabular-nums">
              {[b.bookingNumber, b.eventDate ? fmtDate(b.eventDate) : null].filter(Boolean).join(" · ")}
            </p>
            {b.eventLocation && <p className="mt-0.5 text-[12.5px] text-[#6B6680] inline-flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{b.eventLocation}</p>}
          </div>
        </div>

        <PaymentBar grandTotal={b.grandTotal} paidAmount={b.paidAmount} currency={b.currency} />

        {hasExpandable && (
          <button type="button" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
            className="mt-3.5 w-full h-10 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold text-[#17151F] inline-flex items-center justify-center gap-1.5 transition-colors">
            {expanded ? <><ChevronUp className="w-4 h-4" />Hide files</> : <><Package className="w-4 h-4" />{b.delivery?.fullyPaid === false ? "See what's ready" : "View your files"}</>}
          </button>
        )}
      </div>

      {photos.length > 0 && <PortalPhotos token={token} galleries={photos} brand={brand} onChanged={onMusicChanged} />}
      {music && <PortalMusic token={token} music={music} brand={brand} onChanged={onMusicChanged} />}

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 -mt-2">
          {b.delivery ? (
            <DeliverySection delivery={b.delivery} dueAmount={bal} currency={b.currency} brand={brand} token={token} bookingId={b.id}
              studio={studio} programName={b.eventName || b.bookingNumber} />
          ) : b.deliveryLink ? (
            <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer"
              className="mt-3 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold flex items-center justify-center gap-2">
              <ImageIcon className="w-4 h-4" />Open your photos & videos
            </a>
          ) : null}
        </div>
      )}
    </article>
  );
}

/** A tappable row in a list card (quotes, invoices, payments). */
function DocRow({ href, icon, color, title, sub, amount, amountSub, chip }: {
  href?: string; icon: React.ElementType; color: "deep" | "orchid" | "green"; title: string; sub: React.ReactNode;
  amount: string; amountSub?: React.ReactNode; chip?: { label: string; color: string };
}) {
  const inner = (
    <>
      <Tile icon={icon} color={color} size={40} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-[#17151F] truncate">{title}</span>
        <span className="block text-[12.5px] text-[#6B6680] truncate">{sub}</span>
      </span>
      <span className="text-right flex-shrink-0">
        <span className="block text-[15px] font-extrabold text-[#17151F] tabular-nums">{amount}</span>
        {amountSub && <span className="block text-[12px] tabular-nums">{amountSub}</span>}
      </span>
      {chip && <span className={cn("hidden sm:inline-flex h-6 px-2.5 rounded-full text-[12px] font-bold items-center flex-shrink-0", chip.color)}>{chip.label}</span>}
      {href && <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />}
    </>
  );
  const cls = "flex items-center gap-3 px-4 sm:px-5 py-3.5 min-h-[68px]";
  return href
    ? <li><a href={href} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:bg-[#F7F5FB] transition-colors")}>{inner}</a></li>
    : <li className={cls}>{inner}</li>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gate, setGate] = useState<null | { kind: "locked" | "retired"; meta: PortalMeta | null }>(null);
  const [tab, setTab] = useState<Tab>("programs");
  const [music, setMusic] = useState<ClientMusic[]>([]);
  const [photos, setPhotos] = useState<ClientGalleryCard[]>([]);

  async function loadMusic() {
    try {
      const [r, p] = await Promise.all([
        fetch(`${API}/public/portal/${token}/music`, { headers: portalHeaders(token) }),
        fetch(`${API}/public/portal/${token}/photos`, { headers: portalHeaders(token) }),
      ]);
      if (r.ok) setMusic(await r.json());
      if (p.ok) setPhotos(await p.json());
    } catch { /* music and photos are extras — the portal works without them */ }
  }
  useEffect(() => { if (data) loadMusic(); }, [!!data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPortal() {
    try {
      const r = await fetch(`${API}/public/portal/${token}`, { headers: portalHeaders(token) });
      if (r.status === 401 || r.status === 410) {
        if (r.status === 401) clearPortalSession(token);
        const meta = await fetch(`${API}/public/portal/${token}/meta`).then(m => (m.ok ? m.json() : null)).catch(() => null);
        setStudioCountry(meta?.studio?.country);
        setGate({ kind: r.status === 410 ? "retired" : "locked", meta });
        return;
      }
      if (!r.ok) throw new Error();
      const d = await r.json();
      setStudioCountry(d?.company?.country);
      setData(d);
      setGate(null);
    } catch {
      setError("This portal link is invalid or has been turned off.");
    } finally {
      setLoading(false);
    }
  }

  // Load once per link; loadPortal only sets state after the fetch resolves.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { loadPortal(); }, [token]);

  if (loading) return <PublicLoading />;
  if (gate) return <PortalLock token={token} kind={gate.kind} meta={gate.meta} onUnlocked={() => { setLoading(true); setGate(null); loadPortal(); }} />;
  if (error || !data) return <PublicMessage icon={XCircle} tone="red" title="This link isn't working" text={error || "Please ask your studio for a new link."} />;

  const brand = BRAND;
  const c = sym(data.company.currency);
  const totalPrograms = data.bookings.length;
  const completedPrograms = data.bookings.filter(b => ["completed", "delivered"].includes(b.status)).length;
  const readyDeliveries = data.bookings.filter(b => b.delivery !== null && b.delivery !== undefined).length;
  const totalDue = data.bookings.reduce((s, b) => s + Math.max(0, Number(b.grandTotal) - Number(b.paidAmount)), 0);
  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount), 0);

  const allTabs: { id: Tab; label: string; count?: number; enabled: boolean }[] = [
    { id: "programs", label: "Programs", count: totalPrograms, enabled: true },
    { id: "quotes", label: "Quotes", count: data.quotes.length, enabled: data.company.portalShowQuotes !== false },
    { id: "invoices", label: "Invoices", count: data.invoices.length, enabled: data.company.portalShowInvoices !== false },
    { id: "payments", label: "Payments", count: data.payments.length, enabled: data.company.portalShowPayments !== false },
    { id: "messages", label: "Messages", enabled: data.company.portalShowMessages !== false },
  ];
  const tabs = allTabs.filter(t => t.enabled);
  const wa = data.company.phone ? waLink(data.company.phone, `Hi ${data.company.name}, `) : null;

  return (
    <PublicShell studio={data.company} sub="Client portal"
      right={
        <>
          {data.company.phone && (
            <a href={`tel:${data.company.phone}`} aria-label={`Call ${data.company.name}`} title="Call"
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#17151F] flex items-center justify-center shadow-[0_1px_2px_rgba(22,18,40,.08)]"><Phone className="w-4 h-4" /></a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${data.company.name}`}
              className="h-10 px-3.5 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /><span className="hidden sm:inline">WhatsApp</span></a>
          )}
        </>
      }>
      {/* Hello */}
      <section className="mb-5">
        <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">Welcome back, {data.client.firstName}</h1>
        <p className="mt-1 text-[13.5px] text-[#6B6680] flex flex-wrap gap-x-3 gap-y-0.5">
          {data.client.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{data.client.phone}</span>}
          {data.client.email && <span className="inline-flex items-center gap-1 min-w-0"><Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{data.client.email}</span></span>}
        </p>
        {data.company.portalWelcomeMessage && (
          <p className={cn("mt-4 bg-white rounded-[20px] px-4 py-3.5 text-[14px] text-[#33303F] leading-relaxed", CARD_SHADOW)}>{data.company.portalWelcomeMessage}</p>
        )}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Camera} color="deep" label="Programs" value={totalPrograms} />
        <StatCard icon={CheckCircle} color="green" label="Completed" value={completedPrograms} />
        <StatCard icon={Package} color="teal" label="Files ready" value={readyDeliveries} />
        <StatCard icon={CreditCard} color={totalDue > 0 ? "red" : "green"} label="Still to pay" value={`${c}${num(totalDue)}`} />
      </div>

      {tabs.length > 1 && (
        <Chips<Tab> label="Show" value={tab} onChange={setTab} options={tabs.map(t => ({ value: t.id, label: t.label, count: t.count }))} />
      )}

      {tab === "programs" && (
        <div className="space-y-6">
          {data.bookings.length === 0 && <EmptyState icon={Camera} title="No programs yet" text="Your programs with the studio will show here." />}
          {groupByMonth(data.bookings).map(([month, bkgs]) => (
            <section key={month}>
              <h2 className="px-1 mb-2.5 text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">{month} <span className="text-[#B5B0C4]">· {bkgs.length}</span></h2>
              <div className="space-y-3">
                {bkgs.map(b => (
                  <BookingCard key={b.id} b={b} brand={brand} token={token}
                    music={music.find(m => m.bookingId === b.id)} onMusicChanged={loadMusic} photos={photos.filter(x => x.bookingId === b.id)}
                    studio={{ name: data.company.name, phone: data.company.phone, bkashNumber: data.company.bkashNumber, nagadNumber: data.company.nagadNumber }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "quotes" && (data.quotes.length === 0
        ? <EmptyState icon={FileText} title="No quotes yet" text="Quotes from the studio will show here." />
        : (
          <ul className={cn("bg-white rounded-[22px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
            {data.quotes.map(q => {
              const st = QUOTE_STATUS[q.status] ?? { label: q.status, color: "bg-[#F1EFF6] text-[#4A4658]" };
              const expired = q.validUntil && new Date(q.validUntil) < new Date() && !["accepted", "rejected"].includes(q.status);
              return (
                <DocRow key={q.id} href={q.publicToken ? `/q/${q.publicToken}` : undefined} icon={FileText} color="deep" title={q.quoteNumber}
                  sub={<>{fmtDate(q.createdAt)}{q.validUntil ? <span className={expired ? "text-[#C2304F]" : ""}> · {expired ? "Expired" : `Valid until ${fmtDate(q.validUntil)}`}</span> : null}</>}
                  amount={`${sym(q.currency)}${num(q.grandTotal)}`} chip={st} />
              );
            })}
          </ul>
        ))}

      {tab === "invoices" && (data.invoices.length === 0
        ? <EmptyState icon={Receipt} title="No invoices yet" text="Invoices from the studio will show here." />
        : (
          <ul className={cn("bg-white rounded-[22px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
            {data.invoices.map(inv => {
              const st = INV_STATUS[inv.status] ?? { label: inv.status, color: "bg-[#F1EFF6] text-[#4A4658]" };
              const cs = sym(inv.currency);
              return (
                <DocRow key={inv.id} href={`/inv/${inv.publicToken}`} icon={Receipt} color="orchid" title={inv.invoiceNumber}
                  sub={<>{fmtDate(inv.issueDate)}{inv.dueDate && ` · pay by ${fmtDate(inv.dueDate)}`}</>}
                  amount={`${cs}${num(inv.grandTotal)}`}
                  amountSub={Number(inv.balanceDue) > 0 ? <span className="text-[#C2304F] font-semibold">{cs}{num(inv.balanceDue)} due</span> : <span className="text-[#1F8A5B] font-semibold">Paid</span>}
                  chip={st} />
              );
            })}
          </ul>
        ))}

      {tab === "payments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Wallet} color="green" label="You've paid" value={`${c}${num(totalPaid)}`} />
            <StatCard icon={CreditCard} color={totalDue > 0 ? "red" : "green"} label="Still to pay" value={`${c}${num(totalDue)}`} />
          </div>
          {data.payments.length === 0
            ? <EmptyState icon={CreditCard} title="No payments yet" text="Every payment the studio records shows here." />
            : (
              <ul className={cn("bg-white rounded-[22px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
                {data.payments.map(p => (
                  <DocRow key={p.id} icon={CheckCircle} color="green" title={`${sym(p.currency)}${num(p.amount)}`}
                    sub={<>{fmtDate(p.paymentDate)}{p.paymentMethod ? <span className="capitalize"> · {p.paymentMethod.replace(/_/g, " ")}</span> : null}{p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}{p.notes ? ` · ${p.notes}` : ""}</>}
                    amount="" amountSub={<span className="text-[#1F8A5B] font-semibold">Received</span>} />
                ))}
              </ul>
            )}
        </div>
      )}

      {tab === "messages" && <PortalChat token={token} brand={brand} companyName={data.company.name} />}
    </PublicShell>
  );
}
