"use client";

/**
 * A program's files for the client: locked with what is waiting while money is due,
 * then links, Drive files and uploaded files (by folder) with view / download.
 */
import { useState } from "react";
import {
  ChevronDown, ChevronUp, Download, ExternalLink, File, FileArchive, FileImage, FileVideo, Folder, FolderOpen,
  Image as ImageIcon, Link2, Lock, MessageCircle, Package,
} from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { waLink, withPortalSession } from "@/lib/portal-session";
import { PortalFiles, type PortalDriveFile } from "./portal-files";
import { num, sym, type BookingDelivery, type R2File, type Studio } from "./portal-data";

type DriveFile = PortalDriveFile;

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

export function DeliverySection({ delivery, dueAmount, currency, brand, token, bookingId, studio, programName, hidePay }: {
  delivery: BookingDelivery; dueAmount: number; currency: string; brand: string;
  token: string; bookingId: string; studio: Studio; programName: string;
  /** The payment card on the same page already shows how to pay. */
  hidePay?: boolean;
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
      <div className="rounded-2xl border border-[#E4DCFB] bg-[#F7F5FB] overflow-hidden">
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
        {!hidePay && (ways.length > 0 || paid) && (
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
    <div className="rounded-2xl border border-[#E4DCFB] bg-[#F7F5FB] overflow-hidden">
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
