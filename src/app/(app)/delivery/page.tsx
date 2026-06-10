"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, X, Loader2, Link2, Check, ExternalLink, Copy,
  CalendarDays, MapPin, CheckCircle2, Clock, Send, MoreVertical,
  UploadCloud, Trash2, Download, FileImage, FileVideo, FileArchive, File,
  Package, Video, Image, Plus, Info, HardDrive, Globe, FolderOpen,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}
function daysFromNow(d: string | Date): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DeliveryLink { id: string; title: string; url: string }

interface Booking {
  id: string; bookingNumber: string; eventName?: string; status: string;
  eventDate?: string; eventLocation?: string; currency: string;
  grandTotal: number; paidAmount: number;
  deliveryLink?: string; deliveryLinks?: DeliveryLink[];
  deliveryNote?: string; deliveryDate?: string;
  driveFolderUrl?: string; driveDeliveredAt?: string;
  client: { id: string; firstName: string; lastName?: string; phone?: string };
}

interface R2File {
  id: string; fileName: string; fileKey: string;
  mimeType: string; fileSize: number; uploadedAt: string;
  viewUrl?: string; downloadUrl: string; folderName?: string | null;
}

interface DriveFile {
  id: string; fileName: string;
  mimeType: string; fileSize: number;
  folderName: string | null;
  viewUrl: string | null; downloadUrl: string | null;
}

// ─── Delivery status config ────────────────────────────────────────────────
const DEL_STATUS: Record<string, { label: string; badge: string; dot: string; icon: typeof Clock }> = {
  confirmed:          { label: "Not Started",  badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-300",   icon: Clock },
  advance_received:   { label: "Not Started",  badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-300",   icon: Clock },
  in_progress:        { label: "Shooting",     badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-400",   icon: Clock },
  editing:            { label: "Editing",      badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400",  icon: Clock },
  ready_for_delivery: { label: "Ready",        badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500",  icon: Send  },
  delivered:          { label: "Delivered",    badge: "bg-teal-100 text-teal-700",     dot: "bg-teal-500",    icon: CheckCircle2 },
  completed:          { label: "Completed",    badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
};

const FILTER_TABS = [
  { key: "all",              label: "All" },
  { key: "editing",          label: "Editing" },
  { key: "ready_for_delivery", label: "Ready" },
  { key: "delivered",        label: "Delivered" },
  { key: "completed",        label: "Completed" },
];

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return FileArchive;
  return File;
}

// ─── Upload Progress Item ──────────────────────────────────────────────────
interface UploadItem { file: File; progress: number; done: boolean; error?: string }

// ─── Delivery Modal ────────────────────────────────────────────────────────────
function DeliveryModal({ booking, onClose, onSaved }: {
  booking: Booking | null; onClose: () => void; onSaved: (updated: Booking) => void;
}) {
  const [tab, setTab] = useState<"files" | "link" | "drive">("drive");

  // Link tab state — multiple links with titles
  const [links, setLinks] = useState<DeliveryLink[]>([]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Drive Auto tab state
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveFilesLoading, setDriveFilesLoading] = useState(false);
  const [driveUploads, setDriveUploads] = useState<UploadItem[]>([]);
  const [driveDragOver, setDriveDragOver] = useState(false);
  const [driveExpandedFolders, setDriveExpandedFolders] = useState<Record<string, boolean>>({});
  const [driveZipDownloading, setDriveZipDownloading] = useState<string | null>(null);
  const [driveDeletingFolder, setDriveDeletingFolder] = useState<string | null>(null);
  const [driveTargetFolder, setDriveTargetFolder] = useState<string>("");
  const [driveNewFolderInput, setDriveNewFolderInput] = useState("");
  const [driveShowNewFolder, setDriveShowNewFolder] = useState(false);
  const driveFileInputRef = useRef<HTMLInputElement>(null);
  const driveFolderInputRef = useRef<HTMLInputElement>(null);

  // Files tab state
  const [r2Files, setR2Files] = useState<R2File[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [zipDownloading, setZipDownloading] = useState<string | null>(null); // folderKey or "all"
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null); // folderKey being confirmed
  const [targetFolder, setTargetFolder] = useState<string>(""); // "" = Other Files
  const [newFolderInput, setNewFolderInput] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (booking) {
      const existing = booking.deliveryLinks?.length
        ? booking.deliveryLinks
        : booking.deliveryLink
          ? [{ id: crypto.randomUUID(), title: "Delivery Link", url: booking.deliveryLink }]
          : [];
      setLinks(existing);
      setNote(booking.deliveryNote ?? "");
      setDate(booking.deliveryDate ? booking.deliveryDate.slice(0, 10) : "");
      setStatus(booking.status);
      setDriveFolderUrl(booking.driveFolderUrl ?? "");
      setLinkError(""); setDriveError("");
      setUploads([]);
      loadFiles();
      if (booking.driveFolderUrl) loadDriveFiles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  async function loadFiles() {
    if (!booking) return;
    setFilesLoading(true);
    try {
      const r = await apiFetch(`${API}/deliveries/${booking.id}`);
      if (r.ok) {
        const d = await r.json();
        setR2Files(d.r2Files ?? []);
        // Sync links from server response
        if (d.deliveryLinks?.length) {
          setLinks(d.deliveryLinks);
        }
      }
    } finally { setFilesLoading(false); }
  }

  if (!booking) return null;

  function isFolderExpanded(key: string) {
    return expandedFolders[key] ?? false; // default collapsed
  }
  function toggleFolder(key: string) {
    setExpandedFolders(prev => ({ ...prev, [key]: !isFolderExpanded(key) }));
  }

  async function downloadZip(folderName?: string) {
    const key = folderName ?? "all";
    setZipDownloading(key);
    try {
      const qs = folderName ? `?folderName=${encodeURIComponent(folderName)}` : "";
      const res = await apiFetch(`${API}/deliveries/${booking!.id}/download-zip${qs}`);
      if (!res.ok) { alert("Download failed"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = folderName ? `${folderName}.zip` : `delivery.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch { alert("Download failed"); }
    finally { setZipDownloading(null); }
  }

  async function confirmDeleteFolder(folderName: string) {
    setDeletingFolder(null);
    try {
      const res = await apiFetch(`${API}/deliveries/${booking!.id}/folder/${encodeURIComponent(folderName)}`, { method: "DELETE" });
      if (!res.ok) { alert("Delete failed"); return; }
      setR2Files(prev => prev.filter(f => f.folderName !== folderName));
    } catch { alert("Delete failed"); }
  }

  async function loadDriveFiles() {
    if (!booking) return;
    setDriveFilesLoading(true);
    try {
      const r = await apiFetch(`${API}/google-drive/files/${booking.id}`);
      if (r.ok) {
        const d = await r.json();
        setDriveFiles(d.driveFiles ?? []);
      }
    } finally { setDriveFilesLoading(false); }
  }

  async function createDriveFolder() {
    setDriveLoading(true); setDriveError("");
    try {
      const r = await apiFetch(`${API}/google-drive/deliver/${booking!.id}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setDriveError(d.message || "Failed to create Drive folder."); return; }
      setDriveFolderUrl(d.driveFolderUrl ?? "");
      onSaved({ ...booking!, driveFolderUrl: d.driveFolderUrl, driveDeliveredAt: new Date().toISOString() });
      await loadDriveFiles();
    } catch { setDriveError("Something went wrong."); }
    finally { setDriveLoading(false); }
  }

  function isDriveFolderExpanded(key: string) { return driveExpandedFolders[key] ?? false; }
  function toggleDriveFolder(key: string) {
    setDriveExpandedFolders(prev => ({ ...prev, [key]: !isDriveFolderExpanded(key) }));
  }

  async function downloadDriveZip(folderName?: string) {
    const key = folderName ?? "all";
    setDriveZipDownloading(key);
    try {
      const qs = folderName ? `?folderName=${encodeURIComponent(folderName)}` : "";
      const res = await apiFetch(`${API}/google-drive/download-zip/${booking!.id}${qs}`);
      if (!res.ok) { alert("Download failed"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = folderName ? `${folderName}.zip` : `drive-delivery.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch { alert("Download failed"); }
    finally { setDriveZipDownloading(null); }
  }

  async function confirmDeleteDriveFolder(folderName: string) {
    setDriveDeletingFolder(null);
    try {
      const res = await apiFetch(`${API}/google-drive/folder/${booking!.id}/${encodeURIComponent(folderName)}`, { method: "DELETE" });
      if (!res.ok) { alert("Delete failed"); return; }
      if (folderName === "Other Files") {
        setDriveFiles(prev => prev.filter(f => f.folderName !== null));
      } else {
        setDriveFiles(prev => prev.filter(f => f.folderName !== folderName));
      }
    } catch { alert("Delete failed"); }
  }

  async function deleteDriveFileItem(fileId: string, folderName: string | null) {
    try {
      await apiFetch(`${API}/google-drive/file/${booking!.id}/${fileId}`, { method: "DELETE" });
      setDriveFiles(prev => prev.filter(f => f.id !== fileId));
    } catch { /* ignore */ }
  }

  async function uploadDriveFile(file: File) {
    const item: UploadItem = { file, progress: 0, done: false };
    setDriveUploads(prev => [item, ...prev]);
    const updateItem = (patch: Partial<UploadItem>) =>
      setDriveUploads(prev => prev.map(u => u.file === file ? { ...u, ...patch } : u));

    const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const folderName = webkitPath ? webkitPath.split("/")[0] : (driveTargetFolder || undefined);

    try {
      const token = localStorage.getItem("access_token") ?? "";
      const formData = new FormData();
      formData.append("file", file);
      const qs = folderName ? `?folderName=${encodeURIComponent(folderName)}` : "";

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API}/google-drive/upload/${booking!.id}${qs}`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) updateItem({ progress: Math.round((e.loaded / e.total) * 90) });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data: DriveFile = JSON.parse(xhr.responseText);
              setDriveFiles(prev => [...prev, data]);
              updateItem({ progress: 100, done: true });
              resolve();
            } catch { reject(new Error("Invalid response")); }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.message || "Upload failed"));
            } catch { reject(new Error(`Upload failed: ${xhr.status}`)); }
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });
    } catch (err: unknown) {
      updateItem({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  async function handleDriveFiles(files: FileList | null) {
    if (!files) return;
    for (let i = 0; i < files.length; i++) await uploadDriveFile(files[i]);
  }

  function addLink() {
    setLinks(prev => [...prev, { id: crypto.randomUUID(), title: "", url: "" }]);
  }

  function updateLink(id: string, field: "title" | "url", val: string) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  }

  function removeLink(id: string) {
    setLinks(prev => prev.filter(l => l.id !== id));
  }

  async function saveLinks() {
    setLinkError(""); setLinkSaving(true);
    // Filter out empty links
    const validLinks = links.filter(l => l.url.trim());
    try {
      const r = await apiFetch(`${API}/bookings/${booking!.id}/delivery`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryLinks: validLinks,
          deliveryNote: note || undefined,
          deliveryDate: date || undefined,
          status,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setLinkError(d.message || "Failed to save."); return; }
      onSaved({ ...d, deliveryLinks: validLinks });
      onClose();
    } catch { setLinkError("Something went wrong."); }
    finally { setLinkSaving(false); }
  }

  async function uploadFile(file: File) {
    const item: UploadItem = { file, progress: 0, done: false };
    setUploads(prev => [item, ...prev]);

    const updateItem = (patch: Partial<UploadItem>) =>
      setUploads(prev => prev.map(u => u.file === file ? { ...u, ...patch } : u));

    // Folder priority: webkitRelativePath (folder upload) > targetFolder state (manual selection)
    const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const folderName = webkitPath ? webkitPath.split('/')[0] : (targetFolder || undefined);

    try {
      const urlRes = await apiFetch(`${API}/deliveries/upload-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking!.id, fileName: file.name,
          mimeType: file.type || "application/octet-stream", fileSize: file.size,
          ...(folderName ? { folderName } : {}),
        }),
      });
      if (!urlRes.ok) {
        const e = await urlRes.json().catch(() => ({}));
        updateItem({ error: e.message || "Failed to get upload URL" });
        return;
      }
      const { uploadUrl, fileKey } = await urlRes.json();

      // Upload to R2 via XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) updateItem({ progress: Math.round((e.loaded / e.total) * 90) });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error — check R2 CORS settings"));
        xhr.send(file);
      });

      updateItem({ progress: 95 });

      const confirmRes = await apiFetch(`${API}/deliveries/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking!.id, fileKey, fileName: file.name,
          mimeType: file.type || "application/octet-stream", fileSize: file.size,
          ...(folderName ? { folderName } : {}),
        }),
      });
      if (!confirmRes.ok) {
        const e = await confirmRes.json().catch(() => ({}));
        updateItem({ error: e.message || "Failed to confirm upload" });
        return;
      }

      updateItem({ progress: 100, done: true });
      await loadFiles();
    } catch (err: unknown) {
      updateItem({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (let i = 0; i < files.length; i++) uploadFile(files[i]);
  }

  async function deleteFile(fileId: string) {
    try {
      await apiFetch(`${API}/deliveries/file/${fileId}`, { method: "DELETE" });
      setR2Files(prev => prev.filter(f => f.id !== fileId));
    } catch { /* ignore */ }
  }

  const DELIVERY_STATUSES = [
    { value: "editing", label: "Editing" },
    { value: "ready_for_delivery", label: "Ready for Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-bold text-slate-900">Delivery Details</h3>
              <p className="text-xs text-slate-400 mt-0.5">{booking.eventName ?? booking.bookingNumber} · {booking.client.firstName} {booking.client.lastName ?? ""}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 flex-shrink-0">
            {([
              ["drive", "Drive Auto"],
              ["link", "Manual Links"],
              ["files", "Upload Files"],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={cn("flex-1 py-2.5 text-xs font-medium transition-colors",
                  tab === key ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-400 hover:text-slate-600")}>
                {label}
                {key === "link" && links.filter(l => l.url).length > 0 && (
                  <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
                    {links.filter(l => l.url).length}
                  </span>
                )}
                {key === "drive" && driveFolderUrl && (
                  <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">✓</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── FILES TAB ── */}
            {tab === "files" && (
              <div className="p-5 space-y-4">
                {/* Info banner */}
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                  <HardDrive className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-700">Cloudflare R2 Cloud Storage</p>
                    <p className="text-[11px] text-blue-500 mt-0.5">Files are stored securely. Client can download after full payment is made.</p>
                  </div>
                </div>

                {/* Folder selector */}
                {(() => {
                  const existingFolders = [...new Set(r2Files.map(f => f.folderName).filter(Boolean))] as string[];
                  return (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Upload to folder</p>
                      <div className="flex flex-wrap gap-1.5">
                        {/* Other Files chip */}
                        <button
                          onClick={() => { setTargetFolder(""); setShowNewFolder(false); }}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                            targetFolder === "" && !showNewFolder
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600")}>
                          <FolderOpen className="w-3 h-3" />Other Files
                        </button>
                        {/* Existing folder chips */}
                        {existingFolders.map(f => (
                          <button key={f}
                            onClick={() => { setTargetFolder(f); setShowNewFolder(false); }}
                            className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                              targetFolder === f && !showNewFolder
                                ? "bg-amber-500 border-amber-400 text-white"
                                : "border-amber-200 text-amber-700 bg-amber-50 hover:border-amber-400")}>
                            <FolderOpen className="w-3 h-3" />{f}
                          </button>
                        ))}
                        {/* New folder button */}
                        <button
                          onClick={() => { setShowNewFolder(true); setTargetFolder(""); }}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                            showNewFolder
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500")}>
                          + New Folder
                        </button>
                      </div>
                      {/* New folder name input */}
                      {showNewFolder && (
                        <div className="flex gap-2">
                          <input
                            type="text" value={newFolderInput}
                            onChange={e => setNewFolderInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && newFolderInput.trim()) {
                                setTargetFolder(newFolderInput.trim());
                                setShowNewFolder(false);
                                setNewFolderInput("");
                              }
                              if (e.key === "Escape") { setShowNewFolder(false); setNewFolderInput(""); }
                            }}
                            placeholder="Folder name (e.g. Holud Photos)"
                            autoFocus
                            className="flex-1 h-8 text-xs px-3 rounded-lg border border-indigo-300 bg-indigo-50 text-slate-700 outline-none focus:border-indigo-500" />
                          <button
                            onClick={() => {
                              if (newFolderInput.trim()) {
                                setTargetFolder(newFolderInput.trim());
                                setShowNewFolder(false);
                                setNewFolderInput("");
                              }
                            }}
                            className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                            Create
                          </button>
                        </div>
                      )}
                      {/* Active folder indicator */}
                      {(targetFolder || !showNewFolder) && (
                        <p className="text-[10px] text-slate-400">
                          Files will upload to: <span className="font-semibold text-indigo-600">{targetFolder || "Other Files"}</span>
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Drop Zone */}
                <div
                  ref={dropRef}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                    dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                  )}>
                  <UploadCloud className={cn("w-8 h-8", dragOver ? "text-indigo-500" : "text-slate-300")} />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">Drop files or click to select</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Upload to: <span className="font-semibold text-indigo-500">{targetFolder || "Other Files"}</span>
                    </p>
                  </div>
                  <input
                    ref={fileInputRef} type="file" multiple className="hidden"
                    accept="image/*,video/*,application/pdf,application/zip,application/x-zip-compressed"
                    onChange={e => handleFiles(e.target.files)}
                  />
                </div>

                {/* Folder upload button */}
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <FolderOpen className="w-4 h-4" />
                  Upload Entire Folder (auto-detect folder name)
                </button>
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  // @ts-ignore — webkitdirectory is non-standard
                  webkitdirectory=""
                  onChange={e => handleFiles(e.target.files)}
                />

                {/* Upload Progress */}
                {uploads.filter(u => !u.done).length > 0 && (
                  <div className="space-y-2">
                    {uploads.filter(u => !u.done).map((u, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-medium text-slate-700 truncate flex-1">{u.file.name}</span>
                          {u.error
                            ? <span className="text-xs text-red-500 flex-shrink-0">{u.error}</span>
                            : <span className="text-xs text-slate-400 flex-shrink-0">{u.progress}%</span>
                          }
                        </div>
                        {!u.error && (
                          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Delete folder confirm modal */}
                {deletingFolder && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-700">Delete folder "{deletingFolder}"?</p>
                    </div>
                    <p className="text-xs text-red-600">All files in this folder will be permanently deleted from R2 cloud. This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeletingFolder(null)} className="flex-1 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50">Cancel</button>
                      <button onClick={() => confirmDeleteFolder(deletingFolder)} className="flex-1 h-8 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700">Delete All Files</button>
                    </div>
                  </div>
                )}

                {/* Uploaded Files — all in folders, collapsible */}
                {filesLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
                ) : r2Files.length > 0 ? (() => {
                  const groups: Record<string, R2File[]> = {};
                  for (const f of r2Files) {
                    const key = f.folderName || "Other Files";
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(f);
                  }
                  const groupEntries = Object.entries(groups);

                  return (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Files ({r2Files.length}) · {groupEntries.length} folder{groupEntries.length > 1 ? "s" : ""}
                        </p>
                        <button
                          onClick={() => downloadZip()}
                          disabled={zipDownloading === "all"}
                          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors">
                          {zipDownloading === "all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          Download All
                        </button>
                      </div>

                      {groupEntries.map(([folderKey, files]) => {
                        const expanded = isFolderExpanded(folderKey);
                        return (
                          <div key={folderKey} className="bg-amber-50/50 border border-amber-100 rounded-xl overflow-hidden">
                            {/* Folder header */}
                            <div className="flex items-center gap-2 px-3 py-2">
                              <button onClick={() => toggleFolder(folderKey)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="text-xs font-semibold text-slate-700 truncate">{folderKey}</span>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">({files.length})</span>
                              </button>
                              <button
                                onClick={() => downloadZip(folderKey)}
                                disabled={zipDownloading === folderKey}
                                title="Download folder as ZIP"
                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-amber-200 text-amber-600 disabled:opacity-50 transition-colors flex-shrink-0">
                                {zipDownloading === folderKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => setDeletingFolder(folderKey)}
                                title="Delete entire folder"
                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => toggleFolder(folderKey)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-amber-200 text-amber-500 flex-shrink-0">
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            {/* Smooth animated file list */}
                            <div
                              style={{ maxHeight: expanded ? `${files.length * 80 + 24}px` : '0', transition: 'max-height 0.35s ease' }}
                              className="overflow-hidden">
                              <div className="px-3 pb-3 space-y-1.5">
                                {files.map(f => {
                                  const Icon = fileIcon(f.mimeType);
                                  return (
                                    <div key={f.id} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100">
                                      <a href={f.viewUrl || f.downloadUrl} target="_blank" rel="noopener noreferrer"
                                        className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 hover:border-indigo-300 transition-colors" title="View">
                                        <Icon className="w-4 h-4 text-slate-400" />
                                      </a>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-800 truncate">{f.fileName}</p>
                                        <p className="text-[10px] text-slate-400">{fmtBytes(f.fileSize)} · {fmtDate(f.uploadedAt)}</p>
                                      </div>
                                      <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer"
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0" title="Download">
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                      <button onClick={() => deleteFile(f.id)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0" title="Delete">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
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
                })() : (
                  <p className="text-center text-xs text-slate-400 py-4">No files uploaded yet</p>
                )}
              </div>
            )}

            {/* ── DRIVE AUTO TAB ── */}
            {tab === "drive" && (
              <div className="p-5 space-y-4">
                {/* Info banner */}
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl">
                  <HardDrive className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-green-700">Google Drive Auto-Upload</p>
                    <p className="text-[11px] text-green-600 mt-0.5">Upload files directly to Google Drive. Client can access after full payment.</p>
                  </div>
                </div>

                {driveError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{driveError}</p>}

                {!driveFolderUrl ? (
                  <button
                    onClick={createDriveFolder}
                    disabled={driveLoading}
                    className="w-full flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-green-300 hover:bg-green-50 transition-all">
                    {driveLoading
                      ? <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                      : <HardDrive className="w-8 h-8 text-slate-300" />
                    }
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-600">
                        {driveLoading ? "Creating folder…" : "Create Drive Folder"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Creates a shared folder in your Google Drive for this booking</p>
                    </div>
                  </button>
                ) : (
                  <>
                    {/* Drive folder link */}
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-semibold text-emerald-700 hover:underline truncate">
                          Drive Folder Active
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-medium">
                          <ExternalLink className="w-3 h-3" />Open
                        </a>
                        <span className="text-slate-300">·</span>
                        <button onClick={createDriveFolder} disabled={driveLoading}
                          className="text-[11px] text-slate-400 hover:text-indigo-600 font-medium disabled:opacity-50">
                          {driveLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "New"}
                        </button>
                      </div>
                    </div>

                    {/* Folder selector */}
                    {(() => {
                      const driveFolders = [...new Set(driveFiles.filter(f => f.folderName).map(f => f.folderName as string))];
                      return (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Upload to folder</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => { setDriveTargetFolder(""); setDriveShowNewFolder(false); }}
                              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                                driveTargetFolder === "" && !driveShowNewFolder
                                  ? "bg-green-600 border-green-500 text-white"
                                  : "border-slate-200 text-slate-500 hover:border-green-300 hover:text-green-600")}>
                              <FolderOpen className="w-3 h-3" />Other Files
                            </button>
                            {driveFolders.map(f => (
                              <button key={f}
                                onClick={() => { setDriveTargetFolder(f); setDriveShowNewFolder(false); }}
                                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                                  driveTargetFolder === f && !driveShowNewFolder
                                    ? "bg-amber-500 border-amber-400 text-white"
                                    : "border-amber-200 text-amber-700 bg-amber-50 hover:border-amber-400")}>
                                <FolderOpen className="w-3 h-3" />{f}
                              </button>
                            ))}
                            <button
                              onClick={() => { setDriveShowNewFolder(true); setDriveTargetFolder(""); }}
                              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                                driveShowNewFolder
                                  ? "bg-green-600 border-green-500 text-white"
                                  : "border-dashed border-slate-300 text-slate-400 hover:border-green-300 hover:text-green-500")}>
                              + New Folder
                            </button>
                          </div>
                          {driveShowNewFolder && (
                            <div className="flex gap-2">
                              <input
                                type="text" value={driveNewFolderInput}
                                onChange={e => setDriveNewFolderInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && driveNewFolderInput.trim()) {
                                    setDriveTargetFolder(driveNewFolderInput.trim());
                                    setDriveShowNewFolder(false); setDriveNewFolderInput("");
                                  }
                                  if (e.key === "Escape") { setDriveShowNewFolder(false); setDriveNewFolderInput(""); }
                                }}
                                placeholder="Folder name (e.g. Holud Photos)"
                                autoFocus
                                className="flex-1 h-8 text-xs px-3 rounded-lg border border-green-300 bg-green-50 text-slate-700 outline-none focus:border-green-500" />
                              <button
                                onClick={() => {
                                  if (driveNewFolderInput.trim()) {
                                    setDriveTargetFolder(driveNewFolderInput.trim());
                                    setDriveShowNewFolder(false); setDriveNewFolderInput("");
                                  }
                                }}
                                className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                                Create
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400">
                            Files will upload to: <span className="font-semibold text-green-600">{driveTargetFolder || "Other Files"}</span>
                          </p>
                        </div>
                      );
                    })()}

                    {/* Drop Zone */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDriveDragOver(true); }}
                      onDragLeave={() => setDriveDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDriveDragOver(false); handleDriveFiles(e.dataTransfer.files); }}
                      onClick={() => driveFileInputRef.current?.click()}
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                        driveDragOver ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-green-300 hover:bg-slate-50"
                      )}>
                      <UploadCloud className={cn("w-8 h-8", driveDragOver ? "text-green-500" : "text-slate-300")} />
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-600">Drop files or click to select</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Upload to: <span className="font-semibold text-green-500">{driveTargetFolder || "Other Files"}</span>
                        </p>
                      </div>
                      <input
                        ref={driveFileInputRef} type="file" multiple className="hidden"
                        accept="image/*,video/*,application/pdf,application/zip"
                        onChange={e => handleDriveFiles(e.target.files)}
                      />
                    </div>

                    {/* Folder upload */}
                    <button
                      onClick={() => driveFolderInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors">
                      <FolderOpen className="w-4 h-4" />
                      Upload Entire Folder (auto-detect folder name)
                    </button>
                    <input
                      ref={driveFolderInputRef} type="file" multiple className="hidden"
                      // @ts-ignore
                      webkitdirectory=""
                      onChange={e => handleDriveFiles(e.target.files)}
                    />

                    {/* Upload progress */}
                    {driveUploads.filter(u => !u.done).length > 0 && (
                      <div className="space-y-2">
                        {driveUploads.filter(u => !u.done).map((u, i) => (
                          <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-medium text-slate-700 truncate flex-1">{u.file.name}</span>
                              {u.error
                                ? <span className="text-xs text-red-500 flex-shrink-0">{u.error}</span>
                                : <span className="text-xs text-slate-400 flex-shrink-0">{u.progress}%</span>
                              }
                            </div>
                            {!u.error && (
                              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Delete folder confirm */}
                    {driveDeletingFolder && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <p className="text-sm font-semibold text-red-700">Delete folder "{driveDeletingFolder}"?</p>
                        </div>
                        <p className="text-xs text-red-600">All files in this folder will be permanently deleted from Google Drive.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDriveDeletingFolder(null)} className="flex-1 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50">Cancel</button>
                          <button onClick={() => confirmDeleteDriveFolder(driveDeletingFolder)} className="flex-1 h-8 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700">Delete All Files</button>
                        </div>
                      </div>
                    )}

                    {/* Drive Files list — collapsible folders */}
                    {driveFilesLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-green-400" /></div>
                    ) : driveFiles.length > 0 ? (() => {
                      const groups: Record<string, DriveFile[]> = {};
                      for (const f of driveFiles) {
                        const key = f.folderName || "Other Files";
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(f);
                      }
                      const groupEntries = Object.entries(groups);
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              Files ({driveFiles.length}) · {groupEntries.length} folder{groupEntries.length > 1 ? "s" : ""}
                            </p>
                            <button
                              onClick={() => downloadDriveZip()}
                              disabled={driveZipDownloading === "all"}
                              className="flex items-center gap-1 text-[11px] font-semibold text-green-600 hover:text-green-700 disabled:opacity-50 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg transition-colors">
                              {driveZipDownloading === "all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              Download All
                            </button>
                          </div>
                          {groupEntries.map(([folderKey, files]) => {
                            const expanded = isDriveFolderExpanded(folderKey);
                            return (
                              <div key={folderKey} className="bg-green-50/50 border border-green-100 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2">
                                  <button onClick={() => toggleDriveFolder(folderKey)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                    <FolderOpen className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                    <span className="text-xs font-semibold text-slate-700 truncate">{folderKey}</span>
                                    <span className="text-[10px] text-slate-400 flex-shrink-0">({files.length})</span>
                                  </button>
                                  <button
                                    onClick={() => downloadDriveZip(folderKey)}
                                    disabled={driveZipDownloading === folderKey}
                                    title="Download folder as ZIP"
                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-green-200 text-green-600 disabled:opacity-50 transition-colors flex-shrink-0">
                                    {driveZipDownloading === folderKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => setDriveDeletingFolder(folderKey)}
                                    title="Delete entire folder"
                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => toggleDriveFolder(folderKey)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-green-200 text-green-500 flex-shrink-0">
                                    {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                <div
                                  style={{ maxHeight: expanded ? `${files.length * 80 + 24}px` : "0", transition: "max-height 0.35s ease" }}
                                  className="overflow-hidden">
                                  <div className="px-3 pb-3 space-y-1.5">
                                    {files.map(f => {
                                      const Icon = fileIcon(f.mimeType);
                                      return (
                                        <div key={f.id} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100">
                                          <a href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer"
                                            className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 hover:border-green-300 transition-colors" title="View in Drive">
                                            <Icon className="w-4 h-4 text-slate-400" />
                                          </a>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-800 truncate">{f.fileName}</p>
                                            <p className="text-[10px] text-slate-400">{fmtBytes(f.fileSize)}</p>
                                          </div>
                                          {f.downloadUrl && (
                                            <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer"
                                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-500 transition-colors flex-shrink-0" title="Download">
                                              <Download className="w-3.5 h-3.5" />
                                            </a>
                                          )}
                                          <button onClick={() => deleteDriveFileItem(f.id, f.folderName)}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
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
                    })() : (
                      <p className="text-center text-xs text-slate-400 py-4">No files uploaded yet</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── MANUAL LINKS TAB ── */}
            {tab === "link" && (
              <div className="p-5 space-y-4">
                {linkError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{linkError}</p>}

                {/* Info banner */}
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <Globe className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">External Link Delivery</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Add Google Drive, Dropbox, WeTransfer or any URL. Client can access these from their portal after full payment.</p>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Delivery Status</Label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 text-slate-700">
                    {DELIVERY_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                {/* Links list */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-slate-600">Delivery Links</Label>
                    <button onClick={addLink}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold">
                      <Plus className="w-3.5 h-3.5" />Add Link
                    </button>
                  </div>

                  {links.length === 0 ? (
                    <button onClick={addLink}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
                      <Plus className="w-4 h-4" />Add your first link
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {links.map((l) => (
                        <div key={l.id} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                          <div className="flex items-center gap-2">
                            <input
                              value={l.title}
                              onChange={e => updateLink(l.id, "title", e.target.value)}
                              placeholder="Title (e.g. Wedding Photos, Highlight Video)"
                              className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 placeholder:text-slate-400"
                            />
                            <button onClick={() => removeLink(l.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="relative">
                            <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              value={l.url}
                              onChange={e => updateLink(l.id, "url", e.target.value)}
                              placeholder="https://drive.google.com/..."
                              className="w-full h-9 pl-8 pr-16 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 placeholder:text-slate-400"
                            />
                            {l.url && (
                              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5">
                                <button onClick={() => { navigator.clipboard.writeText(l.url); }}
                                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-400">
                                  <Copy className="w-3 h-3" />
                                </button>
                                <a href={l.url} target="_blank" rel="noopener noreferrer"
                                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-400">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Delivered On</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Note for Client</Label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="e.g. 500 photos + highlight video, password: abc123..."
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
                  <Button onClick={saveLinks} disabled={linkSaving} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    {linkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Links
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Close button for files tab only */}
          {tab === "files" && (
            <div className="px-5 pb-5 flex-shrink-0 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={onClose} className="w-full h-10 border-slate-200">Close</Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Delivery Card ─────────────────────────────────────────────────────────────
function DeliveryCard({ b, onEdit }: { b: Booking; onEdit: () => void }) {
  const cfg = DEL_STATUS[b.status] ?? DEL_STATUS.confirmed;
  const StatusIcon = cfg.icon;
  const due = Number(b.grandTotal) - Number(b.paidAmount);
  const sym = b.currency === "BDT" ? "৳" : "$";
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const allLinks = b.deliveryLinks?.filter(l => l.url) ?? (b.deliveryLink ? [{ id: "legacy", title: "Delivery Link", url: b.deliveryLink }] : []);

  function copyFirstLink() {
    if (!allLinks[0]?.url) return;
    navigator.clipboard.writeText(allLinks[0].url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const daysLeft = b.eventDate ? daysFromNow(b.eventDate) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1", cfg.badge)}>
              <StatusIcon className="w-2.5 h-2.5" />{cfg.label}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{b.bookingNumber}</span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm truncate">{b.eventName ?? "—"}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{b.client.firstName} {b.client.lastName ?? ""}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <UploadCloud className="w-4 h-4 text-slate-400" />Manage Delivery
              </button>
              {allLinks[0] && (
                <>
                  <button onClick={() => { copyFirstLink(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <Copy className="w-4 h-4 text-slate-400" />Copy Link
                  </button>
                  <a href={allLinks[0].url} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <ExternalLink className="w-4 h-4 text-slate-400" />Open Link
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event info */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-3">
        {b.eventDate && (
          <span className={cn("flex items-center gap-1", daysLeft !== null && daysLeft < 0 ? "text-red-500" : daysLeft !== null && daysLeft <= 7 ? "text-amber-500" : "")}>
            <CalendarDays className="w-3 h-3" />{fmtDate(b.eventDate)}
            {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && <span className="font-semibold">· {daysLeft}d</span>}
          </span>
        )}
        {b.eventLocation && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.eventLocation}</span>}
      </div>

      {/* Delivery links or upload CTA */}
      {allLinks.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {allLinks.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
              <Link2 className="w-3 h-3 text-indigo-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {l.title && <p className="text-[10px] text-indigo-400 font-semibold truncate">{l.title}</p>}
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-700 truncate font-medium hover:underline block">
                  {l.url}
                </a>
              </div>
              {i === 0 && (
                <button onClick={copyFirstLink} className="flex-shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <button onClick={onEdit}
          className="w-full flex items-center justify-center gap-1.5 h-9 mb-3 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
          <UploadCloud className="w-3.5 h-3.5" />Upload files or add link
        </button>
      )}

      {/* Note */}
      {b.deliveryNote && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3 line-clamp-2">{b.deliveryNote}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {b.deliveryDate && (
            <span className="flex items-center gap-1 text-teal-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />Delivered {fmtDate(b.deliveryDate)}
            </span>
          )}
        </div>
        {due > 0 && (
          <span className="text-xs font-bold text-red-600">{sym}{due.toLocaleString()} due</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DeliveryPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (search) params.set("search", search);
      const targetStatus = statusFilter !== "all" ? statusFilter : undefined;
      if (targetStatus) params.set("status", targetStatus);
      const r = await apiFetch(`${API}/bookings?${params}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) {
        const d = await r.json();
        const items = (d.data ?? []).filter((b: Booking) =>
          !["inquiry", "quote_sent", "cancelled", "refunded"].includes(b.status)
        );
        setBookings(items);
        setMeta(d.meta);
      }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function onSaved(updated: Booking) {
    setBookings(bs => bs.map(b => b.id === updated.id ? { ...b, ...updated } : b));
  }

  // Stats
  const delivered    = bookings.filter(b => b.status === "delivered" || b.status === "completed").length;
  const withLink     = bookings.filter(b => (b.deliveryLinks?.length ?? 0) > 0 || !!b.deliveryLink).length;
  const readyCount   = bookings.filter(b => b.status === "ready_for_delivery").length;
  const editingCount = bookings.filter(b => b.status === "editing" || b.status === "in_progress").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Delivery</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track photo & video delivery for each program</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Editing",          value: editingCount,  icon: Video,         color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Ready to Deliver", value: readyCount,    icon: Package,       color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Links Added",      value: withLink,      icon: Link2,         color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Delivered",        value: delivered,     icon: CheckCircle2,  color: "text-emerald-600",bg: "bg-emerald-50"},
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{s.value}</p>
              </div>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-4 h-4", s.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search programs or clients..." className="pl-9 h-10 border-slate-200" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                statusFilter === tab.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No programs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map(b => (
            <DeliveryCard key={b.id} b={b} onEdit={() => setEditTarget(b)} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">← Prev</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.totalPages}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">Next →</button>
        </div>
      )}

      <DeliveryModal booking={editTarget} onClose={() => setEditTarget(null)} onSaved={onSaved} />
    </div>
  );
}
