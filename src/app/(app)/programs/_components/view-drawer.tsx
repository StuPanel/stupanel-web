"use client";

import { useState, useEffect } from "react";
import {
  X, Edit3, DollarSign, MessageCircle, FileText,
  Loader2, MapPin, TrendingUp, HardDrive, Link2, Cloud,
  ExternalLink, Calendar, Monitor, FolderOpen, Users, Check,
  Clapperboard, Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { useRouter } from "next/navigation";
import { STATUS_CFG, fmtDate } from "./constants";
import { formatCurrency } from "@/lib/format";
import { StatusPipeline } from "./program-card";
import { PaymentModal } from "./payment-modal";
import { WhatsAppModal } from "./whatsapp-modal";
import { DeliveryModal } from "../../delivery/_components/delivery-modal";
import { EditableSelect } from "@/components/ui/editable-select";
import type { Booking } from "./types";

function DeliveryOverview({ booking }: { booking: Booking }) {
  const [r2FileCount, setR2FileCount] = useState<number | null>(null);

  useEffect(() => {
    if (booking.deliveryMethod !== "r2") return;
    apiFetch(`${API}/deliveries/${booking.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) setR2FileCount(data.length); })
      .catch(() => {});
  }, [booking.id, booking.deliveryMethod]);

  const method = booking.deliveryMethod;
  const linksCount = (booking.deliveryLinks as any[])?.length ?? 0;

  if (!method) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center">
        <p className="text-xs text-slate-400">No delivery set yet</p>
      </div>
    );
  }

  const methodMeta = {
    drive_auto: { icon: <HardDrive className="w-4 h-4 text-emerald-600" />, label: "Drive Auto", color: "text-emerald-700" },
    drive_link: { icon: <Link2 className="w-4 h-4 text-indigo-600" />, label: "Drive Link", color: "text-indigo-700" },
    r2: { icon: <Cloud className="w-4 h-4 text-blue-600" />, label: "R2 Cloud", color: "text-blue-700" },
  }[method] ?? { icon: <HardDrive className="w-4 h-4 text-slate-500" />, label: method, color: "text-slate-600" };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Method header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          {methodMeta.icon}
          <span className={`text-xs font-semibold ${methodMeta.color}`}>{methodMeta.label}</span>
        </div>
        {method === "drive_auto" && booking.driveFolderUrl && (
          <a href={booking.driveFolderUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
            <ExternalLink className="w-3 h-3" /> Open Folder
          </a>
        )}
        {method === "drive_link" && (booking.deliveryLink || linksCount > 0) && (
          <a href={booking.deliveryLink ?? "#"} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
            <ExternalLink className="w-3 h-3" /> Open
          </a>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-slate-200">
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-base font-bold text-slate-800">
            {method === "r2" ? (r2FileCount ?? "—") : (method === "drive_auto" ? "✓" : linksCount)}
          </span>
          <span className="text-[10px] text-slate-400">
            {method === "r2" ? "Files" : method === "drive_auto" ? "Folder" : "Links"}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-base font-bold text-slate-800">{linksCount}</span>
          <span className="text-[10px] text-slate-400">Links</span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5 px-1">
          <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
            {booking.deliveryDate ? fmtDate(booking.deliveryDate) : "—"}
          </span>
          <span className="text-[10px] text-slate-400">Date</span>
        </div>
      </div>
    </div>
  );
}

const STORAGE_TYPES = [
  { value: "google_drive", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
  { value: "onedrive", label: "OneDrive" },
  { value: "nas", label: "NAS Server" },
  { value: "external_hdd", label: "External HDD" },
  { value: "pc_local", label: "PC Local" },
  { value: "other", label: "Other" },
];

function RawFilesSection({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const info = (booking.rawFilesInfo ?? {}) as any;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    storageType: info.storageType ?? "google_drive",
    folderName: info.folderName ?? "",
    folderPath: info.folderPath ?? info.pcName ?? "",
    driveLink: info.driveLink ?? "",
    dropboxLink: info.dropboxLink ?? "",
    nasLocation: info.nasLocation ?? "",
    hddInfo: info.hddInfo ?? "",
    fileCount: info.fileCount ?? "",
    fileSizeGb: info.fileSizeGb ?? "",
    notes: info.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`${API}/bookings/${booking.id}/raw-files`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fileCount: form.fileCount ? Number(form.fileCount) : null, fileSizeGb: form.fileSizeGb ? Number(form.fileSizeGb) : null }),
      });
      setEditing(false); onSaved();
    } finally { setSaving(false); }
  }

  const hasInfo = info.folderName || info.folderPath || info.pcName || info.driveLink || info.dropboxLink || info.nasLocation || info.hddInfo || info.notes;
  const st = info.storageType ?? "google_drive";

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">Raw Files Info</span>
          {hasInfo && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{STORAGE_TYPES.find(t => t.value === st)?.label ?? st}</span>}
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-indigo-600 hover:text-indigo-700">{editing ? "Cancel" : "Edit"}</button>
      </div>

      {editing ? (
        <div className="p-4 space-y-3 bg-white">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Storage Type</p>
            <EditableSelect value={form.storageType} onChange={v => setForm(f => ({ ...f, storageType: v }))}
              options={STORAGE_TYPES} className="rounded-lg" />
          </div>
          {[
            { key: "folderName", label: "Folder Name", placeholder: "Saiful_Wedding_RAW" },
            { key: "folderPath", label: "Folder Path / Location", placeholder: "Drive > Wedding > June 2026 > Saiful" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-[10px] text-slate-500 mb-1">{label}</p>
              <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          {(form.storageType === "google_drive" || form.storageType === "onedrive") && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Drive Link</p>
              <input value={form.driveLink} onChange={e => setForm(f => ({ ...f, driveLink: e.target.value }))}
                placeholder="https://drive.google.com/..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          {form.storageType === "dropbox" && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Dropbox Link</p>
              <input value={form.dropboxLink} onChange={e => setForm(f => ({ ...f, dropboxLink: e.target.value }))}
                placeholder="https://www.dropbox.com/..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          {form.storageType === "nas" && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">NAS Location</p>
              <input value={form.nasLocation} onChange={e => setForm(f => ({ ...f, nasLocation: e.target.value }))}
                placeholder="//NAS-01/Photos/2026" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          {form.storageType === "external_hdd" && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">HDD Info</p>
              <input value={form.hddInfo} onChange={e => setForm(f => ({ ...f, hddInfo: e.target.value }))}
                placeholder="WD 2TB Black, Serial: WX12345" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">File Count</p>
              <input type="number" value={form.fileCount} onChange={e => setForm(f => ({ ...f, fileCount: e.target.value }))}
                placeholder="1200" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Size (GB)</p>
              <input type="number" value={form.fileSizeGb} onChange={e => setForm(f => ({ ...f, fileSizeGb: e.target.value }))}
                placeholder="48.5" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Notes</p>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Event footage is in a separate sub-folder..." rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <button onClick={save} disabled={saving}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Raw Files Info
          </button>
        </div>
      ) : hasInfo ? (
        <div className="p-4 space-y-2 bg-white">
          {info.folderName && <div className="flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" /><span className="text-sm font-semibold text-slate-800">{info.folderName}</span></div>}
          {info.folderPath && <div className="flex items-start gap-2"><Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /><span className="text-sm text-slate-600 font-mono break-all">{info.folderPath}</span></div>}
          {info.driveLink && <a href={info.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"><Link2 className="w-3.5 h-3.5 shrink-0" />Open Drive Folder <ExternalLink className="w-3 h-3" /></a>}
          {info.dropboxLink && <a href={info.dropboxLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"><Link2 className="w-3.5 h-3.5 shrink-0" />Open Dropbox <ExternalLink className="w-3 h-3" /></a>}
          {info.nasLocation && <div className="flex items-start gap-2"><HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /><span className="text-sm text-slate-600 font-mono">{info.nasLocation}</span></div>}
          {info.hddInfo && <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">{info.hddInfo}</div>}
          {(info.fileCount || info.fileSizeGb) && (
            <div className="text-xs text-slate-500">{info.fileCount ? `${info.fileCount.toLocaleString()} files` : ""}{info.fileCount && info.fileSizeGb ? " · " : ""}{info.fileSizeGb ? `${info.fileSizeGb} GB` : ""}</div>
          )}
          {info.notes && <p className="text-xs text-slate-500 bg-amber-50 rounded-lg px-3 py-2">{info.notes}</p>}
        </div>
      ) : (
        <div className="px-4 py-3 text-center bg-white">
          <p className="text-xs text-slate-400">No raw files info yet — click Edit to add</p>
        </div>
      )}
    </div>
  );
}

function CreativeBriefSection({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const brief = ((booking as any).creativeBrief ?? {}) as any;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    videoStyle: brief.videoStyle ?? "",
    photoStyle: brief.photoStyle ?? "",
    colorStyle: brief.colorStyle ?? "",
    musicInfo: brief.musicInfo ?? "",
    specialInstructions: brief.specialInstructions ?? "",
    editingDeadline: brief.editingDeadline ?? "",
    deliveryDeadline: brief.deliveryDeadline ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`${API}/bookings/${booking.id}/creative-brief`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setEditing(false); onSaved();
    } finally { setSaving(false); }
  }

  const hasInfo = brief.videoStyle || brief.photoStyle || brief.colorStyle || brief.musicInfo || brief.specialInstructions;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">Creative Brief</span>
          {hasInfo && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Set</span>}
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-indigo-600 hover:text-indigo-700">{editing ? "Cancel" : "Edit"}</button>
      </div>

      {editing ? (
        <div className="p-4 space-y-3 bg-white">
          {[
            { key: "videoStyle", label: "Video Style", placeholder: "Cinematic, emotional storytelling..." },
            { key: "photoStyle", label: "Photo Style", placeholder: "Light & airy, natural tones..." },
            { key: "colorStyle", label: "Color Grade", placeholder: "Warm tones, filmic look..." },
            { key: "musicInfo", label: "Music", placeholder: "Bengali folk + soft instrumental" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-[10px] text-slate-500 mb-1">{label}</p>
              <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Special Instructions</p>
            <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
              placeholder="Highlight the first dance, include all family moments..." rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Editing Deadline</p>
              <input type="date" value={form.editingDeadline} onChange={e => setForm(f => ({ ...f, editingDeadline: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Delivery Deadline</p>
              <input type="date" value={form.deliveryDeadline} onChange={e => setForm(f => ({ ...f, deliveryDeadline: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Creative Brief
          </button>
        </div>
      ) : hasInfo ? (
        <div className="p-4 space-y-2 bg-white">
          {brief.videoStyle && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-24">Video Style</span><span className="text-slate-800">{brief.videoStyle}</span></div>}
          {brief.photoStyle && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-24">Photo Style</span><span className="text-slate-800">{brief.photoStyle}</span></div>}
          {brief.colorStyle && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-24">Color Grade</span><span className="text-slate-800">{brief.colorStyle}</span></div>}
          {brief.musicInfo && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-24">Music</span><span className="text-slate-800">{brief.musicInfo}</span></div>}
          {brief.specialInstructions && <p className="text-xs text-slate-600 bg-purple-50 rounded-lg px-3 py-2 mt-1">{brief.specialInstructions}</p>}
          {(brief.editingDeadline || brief.deliveryDeadline) && (
            <div className="flex gap-4 text-xs text-slate-500 pt-1">
              {brief.editingDeadline && <span>✏️ Editing by {brief.editingDeadline}</span>}
              {brief.deliveryDeadline && <span>📦 Delivery by {brief.deliveryDeadline}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 text-center bg-white">
          <p className="text-xs text-slate-400">No creative brief yet — click Edit to add</p>
        </div>
      )}
    </div>
  );
}

const ASSIGNMENT_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  assigned:           { label: "Assigned",          cls: "bg-slate-100 text-slate-600" },
  in_progress:        { label: "In Progress",        cls: "bg-blue-100 text-blue-700" },
  submitted:          { label: "Submitted",          cls: "bg-amber-100 text-amber-700" },
  under_review:       { label: "Under Review",       cls: "bg-yellow-100 text-yellow-700" },
  revision_requested: { label: "Revision Needed",    cls: "bg-red-100 text-red-700" },
  resubmitted:        { label: "Resubmitted",        cls: "bg-orange-100 text-orange-700" },
  approved:           { label: "Approved",           cls: "bg-emerald-100 text-emerald-700" },
  delivered:          { label: "Delivered",          cls: "bg-green-100 text-green-700" },
};

type EditorAssignment = {
  id: string; userId: string; role: string; status: string;
  editingDeadline?: string; deliveryDeadline?: string; studioNote?: string;
  user?: { firstName: string; lastName?: string };
  submissions?: { reviewStatus: string; deliverableType: string; submittedAt: string }[];
};

function EditorsSection({ booking, teamMembers, onSaved }: { booking: Booking; teamMembers: { id: string; memberId: string; firstName: string; lastName?: string; memberRoles: string[] }[]; onSaved: () => void }) {
  const [assignments, setAssignments] = useState<EditorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ userId: string; role: "photo_editor" | "video_editor"; editingDeadline?: string; deliveryDeadline?: string; studioNote?: string }[]>([]);

  function reload() {
    setLoading(true);
    apiFetch(`${API}/bookings/${booking.id}/editors`)
      .then(r => r.ok ? r.json() : [])
      .then((data: EditorAssignment[]) => {
        setAssignments(data);
        setDraft(data.map(a => ({
          userId: a.userId,
          role: a.role as "photo_editor" | "video_editor",
          editingDeadline: a.editingDeadline ?? "",
          deliveryDeadline: a.deliveryDeadline ?? "",
          studioNote: a.studioNote ?? "",
        })));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [booking.id]);

  const editorMembers = teamMembers.filter(m => m.memberRoles.includes("photo_editor") || m.memberRoles.includes("video_editor"));

  function toggleEditor(userId: string, role: "photo_editor" | "video_editor") {
    setDraft(prev => {
      const exists = prev.find(e => e.userId === userId && e.role === role);
      return exists ? prev.filter(e => !(e.userId === userId && e.role === role)) : [...prev, { userId, role, editingDeadline: "", deliveryDeadline: "", studioNote: "" }];
    });
  }

  function updateDraftField(userId: string, role: string, field: string, value: string) {
    setDraft(prev => prev.map(e => (e.userId === userId && e.role === role) ? { ...e, [field]: value } : e));
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`${API}/bookings/${booking.id}/editors`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editors: draft.map(e => ({ ...e, editingDeadline: e.editingDeadline || undefined, deliveryDeadline: e.deliveryDeadline || undefined, studioNote: e.studioNote || undefined })) }),
      });
      setEditing(false);
      reload();
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">Editor Assignments</span>
          {!loading && assignments.length > 0 && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">{assignments.length}</span>}
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-indigo-600 hover:text-indigo-700">{editing ? "Cancel" : "Assign"}</button>
      </div>

      {editing ? (
        <div className="p-4 space-y-4 bg-white">
          {editorMembers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center">No members with editor roles found</p>
          ) : (
            <div className="space-y-4">
              {editorMembers.map(m => (
                <div key={m.id} className="rounded-xl border border-slate-100 p-3 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">{m.firstName} {m.lastName ?? ""}</p>
                  <div className="flex gap-2 flex-wrap">
                    {m.memberRoles.includes("photo_editor") && (
                      <button onClick={() => toggleEditor(m.id, "photo_editor")}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${draft.find(e => e.userId === m.id && e.role === "photo_editor") ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                        Photo Editor
                      </button>
                    )}
                    {m.memberRoles.includes("video_editor") && (
                      <button onClick={() => toggleEditor(m.id, "video_editor")}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${draft.find(e => e.userId === m.id && e.role === "video_editor") ? "bg-purple-600 text-white border-purple-600" : "border-slate-200 text-slate-600 hover:border-purple-300"}`}>
                        Video Editor
                      </button>
                    )}
                  </div>
                  {draft.filter(e => e.userId === m.id).map(e => (
                    <div key={e.role} className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Editing Deadline</p>
                          <input type="date" value={e.editingDeadline ?? ""}
                            onChange={ev => updateDraftField(m.id, e.role, "editingDeadline", ev.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Delivery Deadline</p>
                          <input type="date" value={e.deliveryDeadline ?? ""}
                            onChange={ev => updateDraftField(m.id, e.role, "deliveryDeadline", ev.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 mb-0.5">Studio Note</p>
                        <input value={e.studioNote ?? ""} onChange={ev => updateDraftField(m.id, e.role, "studioNote", ev.target.value)}
                          placeholder="Instructions for this editor..."
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <button onClick={save} disabled={saving}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Assignments
          </button>
        </div>
      ) : loading ? (
        <div className="py-4 flex justify-center bg-white"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : assignments.length > 0 ? (
        <div className="divide-y divide-slate-100 bg-white">
          {assignments.map(a => {
            const name = `${a.user?.firstName ?? ""} ${a.user?.lastName ?? ""}`.trim();
            const statusCfg = ASSIGNMENT_STATUS_CFG[a.status] ?? { label: a.status, cls: "bg-slate-100 text-slate-600" };
            const lastSub = a.submissions?.[0];
            return (
              <div key={a.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.role === "photo_editor" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                    {a.role === "photo_editor" ? "Photo Editor" : "Video Editor"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.cls}`}>{statusCfg.label}</span>
                  {a.editingDeadline && <span className="text-[10px] text-slate-400">✏️ {a.editingDeadline}</span>}
                  {a.deliveryDeadline && <span className="text-[10px] text-slate-400">📦 {a.deliveryDeadline}</span>}
                </div>
                {lastSub && (
                  <div className="text-[10px] text-slate-400">
                    Last submission: <span className={`font-medium ${lastSub.reviewStatus === "approved" ? "text-emerald-600" : lastSub.reviewStatus === "revision_requested" ? "text-red-500" : "text-amber-600"}`}>{lastSub.reviewStatus}</span>
                    {" · "}{lastSub.deliverableType.replace(/_/g, " ")}
                  </div>
                )}
                {a.studioNote && <p className="text-[10px] text-slate-500 bg-amber-50 rounded px-2 py-1">{a.studioNote}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-3 text-center bg-white">
          <p className="text-xs text-slate-400">No editors assigned — click Assign</p>
        </div>
      )}
    </div>
  );
}

export function ViewDrawer({ booking, onClose, onEdit, onRefresh, r2Enabled, teamMembers }: {
  booking: Booking | null;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  r2Enabled: boolean;
  teamMembers?: { id: string; memberId: string; firstName: string; lastName?: string; memberRoles: string[] }[];
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [genInvoicing, setGenInvoicing] = useState(false);
  const [localBooking, setLocalBooking] = useState<Booking | null>(null);
  const router = useRouter();

  useEffect(() => { setLocalBooking(booking); }, [booking]);

  async function refreshBooking() {
    if (!localBooking) return;
    try {
      const r = await apiFetch(`${API}/bookings/${localBooking.id}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) setLocalBooking(await r.json());
    } catch { /* silent */ }
    onRefresh();
  }

  const b = localBooking;
  if (!b) return null;
  const sc = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
  const due = Number(b.grandTotal) - Number(b.paidAmount);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{b.eventName ?? b.bookingNumber}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 font-mono">{b.bookingNumber}</span>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sc.badge)}>{sc.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {due > 0 && (
              <button onClick={() => setPaymentOpen(true)}
                className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />Pay
              </button>
            )}
            <button
              disabled={genInvoicing}
              onClick={async () => {
                setGenInvoicing(true);
                try {
                  const r = await apiFetch(`${API}/studio-invoices/generate/${b.id}`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` } });
                  const d = await r.json();
                  if (r.ok || d.message?.includes("already exists")) {
                    router.push("/invoices");
                  }
                } catch { /* silent */ } finally { setGenInvoicing(false); }
              }}
              className="h-8 px-3 rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 disabled:opacity-50">
              {genInvoicing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}Invoice
            </button>
            {b.client?.phone && (
              <button onClick={() => setWaOpen(true)}
                className="h-8 px-3 rounded-lg border border-green-300 bg-green-50 text-xs font-semibold text-green-700 hover:bg-green-100 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />WA
              </button>
            )}
            <button onClick={onEdit} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />Edit
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <StatusPipeline current={b.status} bookingId={b.id} onChanged={refreshBooking} />

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Client</p>
            <p className="font-bold text-slate-900">{b.client.firstName} {b.client.lastName ?? ""}</p>
            {b.client.phone && <p className="text-sm text-slate-500">{b.client.phone}</p>}
          </div>

          {b.eventDays?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Days</p>
              {b.eventDays.map((day, i) => (
                <div key={day.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="font-semibold text-sm text-slate-800">{day.eventType}</span>
                    {day.date && <span className="text-xs text-slate-400">{fmtDate(day.date)}</span>}
                  </div>
                  {day.location && <p className="text-xs text-slate-400 ml-7 flex items-center gap-1"><MapPin className="w-3 h-3" />{day.location}</p>}
                  {day.shifts.map(s => (
                    <div key={s.id} className="ml-7 mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{s.label}</span>
                      <span className="text-[10px] text-slate-400">{s.assignments.length} members</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Financials</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Contract</span><span className="font-semibold">{formatCurrency(Number(b.totalAmount), b.currency)}</span></div>
              {Number(b.discountAmount) > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-red-500">− {formatCurrency(Number(b.discountAmount), b.currency)}</span></div>}
              <div className="flex justify-between font-bold"><span>Net</span><span>{formatCurrency(Number(b.grandTotal), b.currency)}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="text-slate-500">Paid</span>
                <span className="text-emerald-600 font-semibold">{formatCurrency(Number(b.paidAmount), b.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due</span>
                <span className={cn("font-bold", due > 0 ? "text-red-600" : "text-emerald-600")}>{formatCurrency(due, b.currency)}</span>
              </div>
            </div>
            {due > 0 && (
              <button onClick={() => setPaymentOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                <DollarSign className="w-4 h-4" />Record Payment
              </button>
            )}
          </div>

          {b.costEntries?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Team Costs</p>
              {b.costEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{e.memberName}</p>
                    {e.note && <p className="text-xs text-slate-400">{e.note}</p>}
                  </div>
                  <span className="font-bold text-slate-800">{formatCurrency(Number(e.totalBill), b.currency)}</span>
                </div>
              ))}
            </div>
          )}

          {Number(b.profitAmount) !== 0 && (
            <div className={cn("rounded-xl p-4 flex items-center justify-between", Number(b.profitAmount) >= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")}>
              <div className="flex items-center gap-2">
                <TrendingUp className={cn("w-5 h-5", Number(b.profitAmount) >= 0 ? "text-emerald-600" : "text-red-500")} />
                <span className="font-semibold text-sm text-slate-800">Net Profit</span>
              </div>
              <span className={cn("font-extrabold text-lg", Number(b.profitAmount) >= 0 ? "text-emerald-700" : "text-red-600")}>
                {formatCurrency(Number(b.profitAmount), b.currency)}
              </span>
            </div>
          )}

          <RawFilesSection booking={b} onSaved={refreshBooking} />
          <CreativeBriefSection booking={b} onSaved={refreshBooking} />
          <EditorsSection booking={b} teamMembers={teamMembers ?? []} onSaved={refreshBooking} />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery</p>
            <DeliveryOverview booking={b} />
            <button
              onClick={() => setDeliveryOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors"
            >
              Manage Delivery →
            </button>
          </div>

          {b.internalNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-600 mb-1 uppercase tracking-wider">Internal Notes</p>
              <p className="text-sm text-amber-900">{b.internalNotes}</p>
            </div>
          )}
        </div>
      </div>

      <PaymentModal
        booking={paymentOpen ? b : null}
        onClose={() => setPaymentOpen(false)}
        onSaved={refreshBooking}
      />
      <WhatsAppModal
        booking={waOpen ? b : null}
        onClose={() => setWaOpen(false)}
      />
      <DeliveryModal
        booking={deliveryOpen ? (b as any) : null}
        onClose={() => setDeliveryOpen(false)}
        onSaved={(updated) => { refreshBooking(); setDeliveryOpen(false); }}
      />
    </>
  );
}
