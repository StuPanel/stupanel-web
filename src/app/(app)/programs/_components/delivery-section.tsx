"use client";

import { useState, useRef } from "react";
import { Loader2, HardDrive, Link2, ExternalLink, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "./constants";
import type { Booking } from "./types";

export function DeliverySection({ booking, r2Enabled, onRefresh }: {
  booking: Booking;
  r2Enabled: boolean;
  onRefresh: () => void;
}) {
  const [mode, setMode] = useState<"drive_link" | "r2" | null>(
    booking.deliveryMethod === "drive_link" ? "drive_link" :
    booking.deliveryMethod === "r2" ? "r2" : null
  );
  const [editing, setEditing] = useState(!booking.deliveryMethod);
  const [link, setLink] = useState(booking.deliveryLink ?? "");
  const [note, setNote] = useState(booking.deliveryNote ?? "");
  const [date, setDate] = useState(
    booking.deliveryDate ? new Date(booking.deliveryDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [error, setError] = useState("");
  const [r2Files, setR2Files] = useState<{ name: string; status: "uploading" | "done" | "error" }[]>([]);
  const [r2Uploading, setR2Uploading] = useState(false);
  const r2InputRef = useRef<HTMLInputElement>(null);

  async function saveLink() {
    if (!link.trim()) { setError("Drive link is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/bookings/${booking.id}/delivery`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMethod: "drive_link", deliveryLink: link.trim(), deliveryNote: note.trim() || undefined, deliveryDate: date || undefined, status: "delivered" }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.message || "Failed."); return; }
      setEditing(false);
      onRefresh();
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  async function createDriveFolder() {
    setAutoLoading(true); setError("");
    try {
      const r = await apiFetch(`${API}/google-drive/deliver/${booking.id}`, { method: "POST" });
      if (!r.ok) { const d = await r.json(); setError(d.message || "Failed to create Drive folder."); return; }
      onRefresh();
    } catch { setError("Something went wrong."); }
    finally { setAutoLoading(false); }
  }

  async function handleR2Upload(files: FileList) {
    if (!files.length) return;
    const fileArr = Array.from(files);
    setR2Uploading(true); setError("");
    setR2Files(fileArr.map(f => ({ name: f.name, status: "uploading" })));
    let successCount = 0;
    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      try {
        const urlRes = await apiFetch(`${API}/deliveries/upload-url`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking.id, fileName: file.name, mimeType: file.type || "application/octet-stream", fileSize: file.size }),
        });
        if (!urlRes.ok) throw new Error("URL error");
        const { uploadUrl, fileKey } = await urlRes.json();
        const up = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
        if (!up.ok) throw new Error("Upload error");
        const confRes = await apiFetch(`${API}/deliveries/confirm`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking.id, fileKey, fileName: file.name, mimeType: file.type || "application/octet-stream", fileSize: file.size }),
        });
        if (!confRes.ok) throw new Error("Confirm error");
        setR2Files(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
        successCount++;
      } catch {
        setR2Files(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error" } : f));
      }
    }
    if (successCount > 0) {
      await apiFetch(`${API}/bookings/${booking.id}/delivery`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMethod: "r2", status: "delivered" }),
      });
      onRefresh();
    }
    setR2Uploading(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[#8A8599] uppercase tracking-wider">Delivery</p>

      {error && <p className="text-xs text-[#C2304F] bg-[#FEF5F7] px-3 py-2 rounded-lg">{error}</p>}

      {booking.deliveryMethod === "drive_auto" && (
        <div className="bg-[#F0FAF4] border border-[#CDEBDB] rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#1F8A5B]" />
            <span className="text-sm font-semibold text-[#1F8A5B]">Drive Folder Created</span>
          </div>
          {booking.driveDeliveredAt && <p className="text-xs text-[#1F8A5B]">{fmtDate(booking.driveDeliveredAt)}</p>}
          {booking.driveFolderUrl && (
            <a href={booking.driveFolderUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#7D5CEF] hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Open Drive Folder
            </a>
          )}
          <button onClick={createDriveFolder} disabled={autoLoading}
            className="flex items-center gap-1.5 text-xs text-[#8A8599] hover:text-[#7D5CEF] underline">
            {autoLoading && <Loader2 className="w-3 h-3 animate-spin" />} Create New Folder
          </button>
        </div>
      )}

      {booking.deliveryMethod === "drive_link" && !editing && (
        <div className="bg-[#F0FAF4] border border-[#CDEBDB] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#1F8A5B]" />
              <span className="text-sm font-semibold text-[#1F8A5B]">Drive Link</span>
            </div>
            <button onClick={() => setEditing(true)} className="text-xs text-[#8A8599] hover:text-[#7D5CEF]">Edit</button>
          </div>
          {booking.deliveryDate && <p className="text-xs text-[#1F8A5B]">{fmtDate(booking.deliveryDate)}</p>}
          {booking.deliveryLink && (
            <a href={booking.deliveryLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#7D5CEF] hover:underline break-all">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {booking.deliveryLink.length > 40 ? booking.deliveryLink.slice(0, 40) + "…" : booking.deliveryLink}
            </a>
          )}
          {booking.deliveryNote && <p className="text-xs text-[#6B6680]">{booking.deliveryNote}</p>}
        </div>
      )}

      {booking.deliveryMethod === "r2" && !editing && (
        <div className="bg-[#F0FAF4] border border-[#CDEBDB] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[#1F8A5B]" />
              <span className="text-sm font-semibold text-[#1F8A5B]">R2 Cloud Upload</span>
            </div>
            <button onClick={() => { setEditing(true); setMode("r2"); }} className="text-xs text-[#8A8599] hover:text-[#7D5CEF]">Add More</button>
          </div>
          {r2Files.length > 0 && (
            <div className="space-y-1">
              {r2Files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {f.status === "done" ? <Check className="w-3 h-3 text-[#1F8A5B]" /> : f.status === "error" ? <X className="w-3 h-3 text-[#C2304F]" /> : <Loader2 className="w-3 h-3 animate-spin text-[#7D5CEF]" />}
                  <span className="text-[#4A4658] truncate">{f.name}</span>
                </div>
              ))}
            </div>
          )}
          <a href="/delivery" className="flex items-center gap-1.5 text-xs text-[#7D5CEF] hover:underline">
            <ExternalLink className="w-3 h-3" /> Manage files in Delivery page
          </a>
        </div>
      )}

      {(!booking.deliveryMethod || ((booking.deliveryMethod === "drive_link" || booking.deliveryMethod === "r2") && editing)) && (
        <>
          {mode === null && (
            <div className="space-y-2">
              <div className={`grid gap-2 ${r2Enabled ? "grid-cols-3" : "grid-cols-2"}`}>
                <button onClick={() => setMode("drive_link")}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 border-dashed border-[#E4E0EC] hover:border-indigo-300 hover:bg-[#F7F4FE] transition-all text-left">
                  <Link2 className="w-4 h-4 text-[#7D5CEF]" />
                  <div>
                    <p className="text-xs font-bold text-[#33303F]">Manual Link</p>
                    <p className="text-xs text-[#8A8599] leading-relaxed mt-0.5">Paste Google Drive, Dropbox or WeTransfer link. Saved in DB. All companies.</p>
                  </div>
                </button>
                <button onClick={createDriveFolder} disabled={autoLoading}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 border-dashed border-[#E4E0EC] hover:border-indigo-300 hover:bg-[#F7F4FE] transition-all text-left">
                  {autoLoading ? <Loader2 className="w-4 h-4 animate-spin text-[#7D5CEF]" /> : <HardDrive className="w-4 h-4 text-[#1F8A5B]" />}
                  <div>
                    <p className="text-xs font-bold text-[#33303F]">Drive Auto</p>
                    <p className="text-xs text-[#8A8599] leading-relaxed mt-0.5">Auto-creates a folder in your Google Drive. Requires connected Drive account. All companies.</p>
                  </div>
                </button>
                {r2Enabled && (
                  <button onClick={() => setMode("r2")}
                    className="flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 border-dashed border-[#E4E0EC] hover:border-indigo-300 hover:bg-[#F7F4FE] transition-all text-left">
                    <ArrowRight className="w-4 h-4 text-[#2F6FB3]" />
                    <div>
                      <p className="text-xs font-bold text-[#33303F]">R2 Upload</p>
                      <p className="text-xs text-[#8A8599] leading-relaxed mt-0.5">Upload files to Cloudflare R2 cloud. Secure storage. Super Admin permission required.</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "drive_link" && (
            <div className="space-y-2.5 bg-[#F7F5FB] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#4A4658]">Manual Link Delivery</p>
                  <p className="text-xs text-[#8A8599] mt-0.5">Paste your Google Drive, Dropbox, or WeTransfer link</p>
                </div>
                {!booking.deliveryMethod && (
                  <button onClick={() => setMode(null)} className="text-xs text-[#8A8599] hover:text-[#4A4658]">← Back</button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#6B6680]">Delivery Link *</Label>
                <Input value={link} onChange={e => setLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="h-10 text-sm border-[#E4E0EC]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#6B6680]">Delivery Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 text-sm border-[#E4E0EC]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#6B6680]">Note</Label>
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="200 photos, 2 reels…" className="h-10 text-sm border-[#E4E0EC]" />
                </div>
              </div>
              <Button onClick={saveLink} disabled={saving} className="w-full h-10 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Delivery"}
              </Button>
            </div>
          )}

          {mode === "r2" && (
            <div className="space-y-2.5 bg-[#F7F5FB] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#4A4658]">R2 Cloud Upload</p>
                  <p className="text-xs text-[#8A8599] mt-0.5">Files stored securely on Cloudflare R2. Client downloads after full payment.</p>
                </div>
                <button onClick={() => { setMode(null); setEditing(!booking.deliveryMethod); setR2Files([]); }} className="text-xs text-[#8A8599] hover:text-[#4A4658]">← Back</button>
              </div>
              <input ref={r2InputRef} type="file" multiple className="hidden"
                onChange={e => e.target.files && handleR2Upload(e.target.files)} />
              <button onClick={() => r2InputRef.current?.click()} disabled={r2Uploading}
                className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-[#B5B0C4] hover:border-indigo-400 hover:bg-[#F7F4FE] transition-all">
                {r2Uploading ? <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /> : <ArrowRight className="w-6 h-6 text-[#8A8599]" />}
                <span className="text-xs text-[#6B6680]">{r2Uploading ? "Uploading…" : "Click to select files"}</span>
                <span className="text-xs text-[#8A8599]">Photos, Videos, ZIP — max 500 MB each</span>
              </button>
              {r2Files.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {r2Files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2">
                      {f.status === "done" ? <Check className="w-3.5 h-3.5 text-[#1F8A5B] shrink-0" /> : f.status === "error" ? <X className="w-3.5 h-3.5 text-[#C2304F] shrink-0" /> : <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7D5CEF] shrink-0" />}
                      <span className={`truncate ${f.status === "error" ? "text-[#C2304F]" : "text-[#33303F]"}`}>{f.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
