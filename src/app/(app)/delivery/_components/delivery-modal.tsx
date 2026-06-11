"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Loader2, Link2, Check, ExternalLink, Copy,
  CheckCircle2, UploadCloud, Trash2, Download, FileArchive,
  Plus, HardDrive, Globe, FolderOpen,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { uploadStore } from "@/lib/upload-store";
import { fmtDate, fmtBytes, fileIcon, DELIVERY_STATUSES } from "./constants";
import type { Booking, R2File, DriveFile, UploadItem, DeliveryLink } from "./types";

export function DeliveryModal({ booking, onClose, onSaved }: {
  booking: Booking | null;
  onClose: () => void;
  onSaved: (updated: Booking) => void;
}) {
  const [tab, setTab] = useState<"files" | "link" | "drive">("drive");

  const [links, setLinks] = useState<DeliveryLink[]>([]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState("");

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

  const [r2Files, setR2Files] = useState<R2File[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [zipDownloading, setZipDownloading] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [newFolderInput, setNewFolderInput] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inProgress = driveUploads.some(u => !u.done && !u.error) ||
                       uploads.some(u => !u.done && !u.error);
    if (!inProgress) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [driveUploads, uploads]);

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
        if (d.deliveryLinks?.length) setLinks(d.deliveryLinks);
      }
    } finally { setFilesLoading(false); }
  }

  if (!booking) return null;

  function isFolderExpanded(key: string) { return expandedFolders[key] ?? false; }
  function toggleFolder(key: string) { setExpandedFolders(prev => ({ ...prev, [key]: !isFolderExpanded(key) })); }

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
      document.body.appendChild(a); a.click(); a.remove();
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
      if (r.ok) { const d = await r.json(); setDriveFiles(d.driveFiles ?? []); }
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
  function toggleDriveFolder(key: string) { setDriveExpandedFolders(prev => ({ ...prev, [key]: !isDriveFolderExpanded(key) })); }

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
      document.body.appendChild(a); a.click(); a.remove();
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

  async function deleteDriveFileItem(fileId: string) {
    try {
      await apiFetch(`${API}/google-drive/file/${booking!.id}/${fileId}`, { method: "DELETE" });
      setDriveFiles(prev => prev.filter(f => f.id !== fileId));
    } catch { /* ignore */ }
  }

  async function uploadDriveFile(file: File) {
    const uid = crypto.randomUUID();
    const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const folderName = webkitPath ? webkitPath.split("/")[0] : (driveTargetFolder || undefined);

    const localItem: UploadItem = { file, progress: 0, done: false };
    setDriveUploads(prev => [localItem, ...prev]);
    const updateLocal = (patch: Partial<UploadItem>) =>
      setDriveUploads(prev => prev.map(u => u.file === file ? { ...u, ...patch } : u));

    uploadStore.add({
      id: uid, fileName: file.name, progress: 0, done: false,
      type: "drive", bookingId: booking!.id,
      bookingName: booking!.eventName ?? booking!.bookingNumber,
      folderName,
    });

    try {
      const token = localStorage.getItem("access_token") ?? "";
      const formData = new FormData();
      formData.append("file", file);
      const qs = folderName ? `?folderName=${encodeURIComponent(folderName)}` : "";

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadStore.registerXhr(uid, xhr);
        xhr.open("POST", `${API}/google-drive/upload/${booking!.id}${qs}`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 90);
            updateLocal({ progress: pct });
            uploadStore.update(uid, { progress: pct });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data: DriveFile = JSON.parse(xhr.responseText);
              setDriveFiles(prev => [...prev, data]);
              updateLocal({ progress: 100, done: true });
              uploadStore.update(uid, { progress: 100, done: true });
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
        xhr.onabort = () => reject(new Error("Cancelled"));
        xhr.send(formData);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      updateLocal({ error: msg });
      uploadStore.update(uid, { error: msg });
    }
  }

  async function handleDriveFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    const groups = new Map<string, File[]>();
    for (const file of arr) {
      const wp = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      const key = wp ? wp.split("/")[0] : (driveTargetFolder || "__root__");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(file);
    }
    await Promise.all(
      Array.from(groups.values()).map(async (groupFiles) => {
        for (const file of groupFiles) await uploadDriveFile(file);
      })
    );
  }

  function addLink() { setLinks(prev => [...prev, { id: crypto.randomUUID(), title: "", url: "" }]); }
  function updateLink(id: string, field: "title" | "url", val: string) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  }
  function removeLink(id: string) { setLinks(prev => prev.filter(l => l.id !== id)); }

  async function saveLinks() {
    setLinkError(""); setLinkSaving(true);
    const validLinks = links.filter(l => l.url.trim());
    try {
      const r = await apiFetch(`${API}/bookings/${booking!.id}/delivery`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryLinks: validLinks, deliveryNote: note || undefined, deliveryDate: date || undefined, status }),
      });
      const d = await r.json();
      if (!r.ok) { setLinkError(d.message || "Failed to save."); return; }
      onSaved({ ...d, deliveryLinks: validLinks });
      onClose();
    } catch { setLinkError("Something went wrong."); }
    finally { setLinkSaving(false); }
  }

  async function uploadFile(file: File) {
    const uid = crypto.randomUUID();
    const item: UploadItem = { file, progress: 0, done: false };
    setUploads(prev => [item, ...prev]);
    const updateItem = (patch: Partial<UploadItem>) =>
      setUploads(prev => prev.map(u => u.file === file ? { ...u, ...patch } : u));

    const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const folderName = webkitPath ? webkitPath.split('/')[0] : (targetFolder || undefined);

    uploadStore.add({
      id: uid, fileName: file.name, progress: 0, done: false,
      type: "r2", bookingId: booking!.id,
      bookingName: booking!.eventName ?? booking!.bookingNumber,
      folderName,
    });

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
        uploadStore.update(uid, { error: e.message || "Failed to get upload URL" });
        return;
      }
      const { uploadUrl, fileKey } = await urlRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadStore.registerXhr(uid, xhr);
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 90);
            updateItem({ progress: pct });
            uploadStore.update(uid, { progress: pct });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error — check R2 CORS settings"));
        xhr.onabort = () => reject(new Error("Cancelled"));
        xhr.send(file);
      });

      updateItem({ progress: 95 });
      uploadStore.update(uid, { progress: 95 });

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
        uploadStore.update(uid, { error: e.message || "Failed to confirm upload" });
        return;
      }

      updateItem({ progress: 100, done: true });
      uploadStore.update(uid, { progress: 100, done: true });
      await loadFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      updateItem({ error: msg });
      uploadStore.update(uid, { error: msg });
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

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-bold text-slate-900">Delivery Details</h3>
              <p className="text-xs text-slate-400 mt-0.5">{booking.eventName ?? booking.bookingNumber} · {booking.client.firstName} {booking.client.lastName ?? ""}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="flex border-b border-slate-200 flex-shrink-0">
            {([
              ["drive", "Drive Auto"],
              ["link", "Manual Links"],
              ["files", "R2 Storage"],
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

          <div className="flex-1 overflow-y-auto">

            {/* ── FILES TAB ── */}
            {tab === "files" && (
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                  <HardDrive className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-700">Cloudflare R2 Cloud Storage</p>
                    <p className="text-[11px] text-blue-500 mt-0.5">Files are stored securely. Client can download after full payment is made.</p>
                  </div>
                </div>

                {(() => {
                  const existingFolders = [...new Set(r2Files.map(f => f.folderName).filter(Boolean))] as string[];
                  return (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Upload to folder</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => { setTargetFolder(""); setShowNewFolder(false); }}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                            targetFolder === "" && !showNewFolder
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600")}>
                          <FolderOpen className="w-3 h-3" />Other Files
                        </button>
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
                        <button
                          onClick={() => { setShowNewFolder(true); setTargetFolder(""); }}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                            showNewFolder
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500")}>
                          + New Folder
                        </button>
                      </div>
                      {showNewFolder && (
                        <div className="flex gap-2">
                          <input
                            type="text" value={newFolderInput}
                            onChange={e => setNewFolderInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && newFolderInput.trim()) {
                                setTargetFolder(newFolderInput.trim()); setShowNewFolder(false); setNewFolderInput("");
                              }
                              if (e.key === "Escape") { setShowNewFolder(false); setNewFolderInput(""); }
                            }}
                            placeholder="Folder name (e.g. Holud Photos)"
                            autoFocus
                            className="flex-1 h-8 text-xs px-3 rounded-lg border border-indigo-300 bg-indigo-50 text-slate-700 outline-none focus:border-indigo-500" />
                          <button
                            onClick={() => {
                              if (newFolderInput.trim()) {
                                setTargetFolder(newFolderInput.trim()); setShowNewFolder(false); setNewFolderInput("");
                              }
                            }}
                            className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                            Create
                          </button>
                        </div>
                      )}
                      {(targetFolder || !showNewFolder) && (
                        <p className="text-[10px] text-slate-400">
                          Files will upload to: <span className="font-semibold text-indigo-600">{targetFolder || "Other Files"}</span>
                        </p>
                      )}
                    </div>
                  );
                })()}

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

                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <FolderOpen className="w-4 h-4" />
                  Upload Entire Folder (auto-detect folder name)
                </button>
                <input
                  ref={folderInputRef} type="file" multiple className="hidden"
                  // @ts-ignore — webkitdirectory is non-standard
                  webkitdirectory=""
                  onChange={e => handleFiles(e.target.files)}
                />

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
                            <div className="flex items-center gap-2 px-3 py-2">
                              <button onClick={() => toggleFolder(folderKey)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="text-xs font-semibold text-slate-700 truncate">{folderKey}</span>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">({files.length})</span>
                              </button>
                              <button onClick={() => downloadZip(folderKey)} disabled={zipDownloading === folderKey} title="Download folder as ZIP"
                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-amber-200 text-amber-600 disabled:opacity-50 transition-colors flex-shrink-0">
                                {zipDownloading === folderKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              </button>
                              <button onClick={() => setDeletingFolder(folderKey)} title="Delete entire folder"
                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => toggleFolder(folderKey)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-amber-200 text-amber-500 flex-shrink-0">
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
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
                    {driveLoading ? <Loader2 className="w-8 h-8 animate-spin text-green-500" /> : <HardDrive className="w-8 h-8 text-slate-300" />}
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-600">{driveLoading ? "Creating folder…" : "Create Drive Folder"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Creates a shared folder in your Google Drive for this booking</p>
                    </div>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-semibold text-emerald-700 hover:underline truncate">Drive Folder Active</a>
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
                                    setDriveTargetFolder(driveNewFolderInput.trim()); setDriveShowNewFolder(false); setDriveNewFolderInput("");
                                  }
                                  if (e.key === "Escape") { setDriveShowNewFolder(false); setDriveNewFolderInput(""); }
                                }}
                                placeholder="Folder name (e.g. Holud Photos)"
                                autoFocus
                                className="flex-1 h-8 text-xs px-3 rounded-lg border border-green-300 bg-green-50 text-slate-700 outline-none focus:border-green-500" />
                              <button
                                onClick={() => {
                                  if (driveNewFolderInput.trim()) {
                                    setDriveTargetFolder(driveNewFolderInput.trim()); setDriveShowNewFolder(false); setDriveNewFolderInput("");
                                  }
                                }}
                                className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">Create</button>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400">
                            Files will upload to: <span className="font-semibold text-green-600">{driveTargetFolder || "Other Files"}</span>
                          </p>
                        </div>
                      );
                    })()}

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
                                  <button onClick={() => downloadDriveZip(folderKey)} disabled={driveZipDownloading === folderKey} title="Download folder as ZIP"
                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-green-200 text-green-600 disabled:opacity-50 transition-colors flex-shrink-0">
                                    {driveZipDownloading === folderKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                  </button>
                                  <button onClick={() => setDriveDeletingFolder(folderKey)} title="Delete entire folder"
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
                                          <button onClick={() => deleteDriveFileItem(f.id)}
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

                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <Globe className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">External Link Delivery</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Add Google Drive, Dropbox, WeTransfer or any URL. Client can access these from their portal after full payment.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Delivery Status</Label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 text-slate-700">
                    {DELIVERY_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

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

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Delivered On</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
                </div>

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
