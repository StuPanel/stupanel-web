"use client";

import { useState, useEffect } from "react";
import {
  X, Edit3, DollarSign, MessageCircle, FileText,
  Loader2, MapPin, TrendingUp, HardDrive, Link2, Cloud,
  ExternalLink, Calendar, Monitor, FolderOpen, Users, Check,
  Clapperboard, Palette, Camera, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { useRouter } from "next/navigation";
import { STATUS_CFG, fmtDate } from "./constants";
import { formatCurrency } from "@/lib/format";
import { StatusPipeline } from "./program-card";
import { PaymentModal } from "./payment-modal";
import { TeamPaySection } from "./team-pay-section";
import { WhatsAppModal } from "./whatsapp-modal";
import { DeliveryModal } from "../../delivery/_components/delivery-modal";
import { EditableSelect } from "@/components/ui/editable-select";
import type { Booking, ShiftAssignment } from "./types";
import { ProfileShell, IdentityCard, ActionButton, MiniStat } from "@/components/ui/profile-kit";
import { CARD_SHADOW, Group, Tile } from "@/components/ui/apple";

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
          <span className="text-xs text-slate-400">
            {method === "r2" ? "Files" : method === "drive_auto" ? "Folder" : "Links"}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-base font-bold text-slate-800">{linksCount}</span>
          <span className="text-xs text-slate-400">Links</span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5 px-1">
          <span className="text-xs font-semibold text-slate-700 text-center leading-tight">
            {booking.deliveryDate ? fmtDate(booking.deliveryDate) : "—"}
          </span>
          <span className="text-xs text-slate-400">Date</span>
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
          {hasInfo && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{STORAGE_TYPES.find(t => t.value === st)?.label ?? st}</span>}
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-indigo-600 hover:text-indigo-700">{editing ? "Cancel" : "Edit"}</button>
      </div>

      {editing ? (
        <div className="p-4 space-y-3 bg-white">
          <div>
            <p className="text-xs text-slate-500 mb-1">Storage Type</p>
            <EditableSelect value={form.storageType} onChange={v => setForm(f => ({ ...f, storageType: v }))}
              options={STORAGE_TYPES} className="rounded-lg" />
          </div>
          {[
            { key: "folderName", label: "Folder Name", placeholder: "Saiful_Wedding_RAW" },
            { key: "folderPath", label: "Folder Path / Location", placeholder: "Drive > Wedding > June 2026 > Saiful" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          {(form.storageType === "google_drive" || form.storageType === "onedrive") && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Drive Link</p>
              <input value={form.driveLink} onChange={e => setForm(f => ({ ...f, driveLink: e.target.value }))}
                placeholder="https://drive.google.com/..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          {form.storageType === "dropbox" && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Dropbox Link</p>
              <input value={form.dropboxLink} onChange={e => setForm(f => ({ ...f, dropboxLink: e.target.value }))}
                placeholder="https://www.dropbox.com/..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          {form.storageType === "nas" && (
            <div>
              <p className="text-xs text-slate-500 mb-1">NAS Location</p>
              <input value={form.nasLocation} onChange={e => setForm(f => ({ ...f, nasLocation: e.target.value }))}
                placeholder="//NAS-01/Photos/2026" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          {form.storageType === "external_hdd" && (
            <div>
              <p className="text-xs text-slate-500 mb-1">HDD Info</p>
              <input value={form.hddInfo} onChange={e => setForm(f => ({ ...f, hddInfo: e.target.value }))}
                placeholder="WD 2TB Black, Serial: WX12345" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">File Count</p>
              <input type="number" value={form.fileCount} onChange={e => setForm(f => ({ ...f, fileCount: e.target.value }))}
                placeholder="1200" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Size (GB)</p>
              <input type="number" value={form.fileSizeGb} onChange={e => setForm(f => ({ ...f, fileSizeGb: e.target.value }))}
                placeholder="48.5" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Notes</p>
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
          {hasInfo && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Set</span>}
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
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <div>
            <p className="text-xs text-slate-500 mb-1">Special Instructions</p>
            <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
              placeholder="Highlight the first dance, include all family moments..." rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Editing Deadline</p>
              <input type="date" value={form.editingDeadline} onChange={e => setForm(f => ({ ...f, editingDeadline: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Delivery Deadline</p>
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
          {!loading && assignments.length > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">{assignments.length}</span>}
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
                          <p className="text-xs text-slate-400 mb-0.5">Editing Deadline</p>
                          <input type="date" value={e.editingDeadline ?? ""}
                            onChange={ev => updateDraftField(m.id, e.role, "editingDeadline", ev.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Delivery Deadline</p>
                          <input type="date" value={e.deliveryDeadline ?? ""}
                            onChange={ev => updateDraftField(m.id, e.role, "deliveryDeadline", ev.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Studio Note</p>
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === "photo_editor" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                    {a.role === "photo_editor" ? "Photo Editor" : "Video Editor"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.cls}`}>{statusCfg.label}</span>
                  {a.editingDeadline && <span className="text-xs text-slate-400">✏️ {a.editingDeadline}</span>}
                  {a.deliveryDeadline && <span className="text-xs text-slate-400">📦 {a.deliveryDeadline}</span>}
                </div>
                {lastSub && (
                  <div className="text-xs text-slate-400">
                    Last submission: <span className={`font-medium ${lastSub.reviewStatus === "approved" ? "text-emerald-600" : lastSub.reviewStatus === "revision_requested" ? "text-red-500" : "text-amber-600"}`}>{lastSub.reviewStatus}</span>
                    {" · "}{lastSub.deliverableType.replace(/_/g, " ")}
                  </div>
                )}
                {a.studioNote && <p className="text-xs text-slate-500 bg-amber-50 rounded px-2 py-1">{a.studioNote}</p>}
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

const ROLE_LABEL: Record<string, string> = {
  photographer: "Photographer", cinematographer: "Cinematographer", drone_pilot: "Drone", assistant: "Assistant",
  photo_editor: "Photo editor", video_editor: "Video editor",
};
const SETUP_LABEL: Record<string, string> = { own: "Own setup", other: "Others' gear", rented: "Rented gear" };

function Row({ l, v, strong, tone, sub }: { l: React.ReactNode; v: React.ReactNode; strong?: boolean; tone?: "red" | "green"; sub?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <span className={cn("text-[15px]", strong ? "font-semibold text-[#17151F]" : "text-[#4A4658]")}>{l}{sub && <span className="block text-xs text-[#6B6680]">{sub}</span>}</span>
      <span className={cn("tabular-nums", strong ? "text-[17px] font-extrabold" : "text-[15px] font-semibold text-[#17151F]", tone === "red" && "text-[#C2304F]", tone === "green" && "text-[#1F8A5B]")}>{v}</span>
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
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => { setLocalBooking(booking); }, [booking]);
  useEffect(() => {
    if (!booking) return;
    apiFetch(`${API}/companies/settings`).then(r => r.ok ? r.json() : null)
      .then(d => d && setTypeNames(Object.fromEntries((d.workTypes ?? []).map((w: { id: string; name: string }) => [w.id, w.name]))))
      .catch(() => {});
  }, [booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshBooking() {
    if (!localBooking) return;
    try {
      const r = await apiFetch(`${API}/bookings/${localBooking.id}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) setLocalBooking(await r.json());
    } catch { /* silent */ }
    onRefresh();
  }

  async function makeInvoice() {
    if (!b) return;
    setGenInvoicing(true);
    try {
      const r = await apiFetch(`${API}/studio-invoices/generate/${b.id}`, { method: "POST" });
      const d = await r.json();
      if (r.ok || d.message?.includes("already exists")) router.push("/invoices");
    } catch { /* silent */ } finally { setGenInvoicing(false); }
  }

  const b = localBooking;
  if (!b) return null;
  const sc = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
  const net = Number(b.grandTotal);
  const paid = Number(b.paidAmount);
  const due = net - paid;
  const profit = Number(b.profitAmount);
  const teamCost = (b.costEntries ?? []).reduce((s, e) => s + Number(e.totalBill || 0), 0);
  const costs: [string, number][] = ([["Team pay", teamCost], ["Equipment rent", Number(b.equipCost)], ["Transport", Number(b.transportCost)], ["Album / print", Number(b.albumCost)], ["Other", Number(b.otherCost)]] as [string, number][]).filter(([, v]) => v > 0);
  const days = [...(b.eventDays ?? [])].sort((x, y) => (x.date || "").localeCompare(y.date || ""));
  const typeId = days.find(d => d.programType)?.programType;
  const typeName = typeId ? typeNames[typeId] ?? typeId.replace(/-/g, " ") : "";
  const who = (id: string, fallback?: string) => {
    const m = teamMembers?.find(t => t.id === id);
    return m ? `${m.firstName} ${m.lastName ?? ""}`.trim() : fallback ?? "Someone";
  };
  const clientName = `${b.client.firstName} ${b.client.lastName ?? ""}`.trim();
  const dateText = days.length
    ? days[0].date ? `${fmtDate(days[0].date)}${days.length > 1 && days[days.length - 1].date !== days[0].date ? ` – ${fmtDate(days[days.length - 1].date)}` : ""}` : "No date"
    : b.eventDate ? fmtDate(b.eventDate) : "No date";

  return (
    <>
      <ProfileShell open label="Program" onClose={onClose}>
        <IdentityCard
          avatar={<Tile icon={Camera} color="deep" size={64} className="rounded-[20px]" />}
          name={b.eventName ?? b.bookingNumber}
          sub={<>{clientName}{b.client.phone ? ` · ${b.client.phone}` : ""}</>}
          chips={<>
            <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.badge)}>{sc.label}</span>
            {typeName && <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#F5F3FA] text-[#4A4658]">{typeName}</span>}
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#F5F3FA] text-[#4A4658] inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{dateText}</span>
            <span className="text-xs px-2 py-1 rounded-full font-mono text-[#6B6680]">{b.bookingNumber}</span>
          </>}
          actions={<>
            <ActionButton icon={DollarSign} label="Payment" tone="green" onClick={() => setPaymentOpen(true)} disabled={due <= 0} />
            <ActionButton icon={MessageCircle} label="WhatsApp" tone="green" onClick={() => setWaOpen(true)} disabled={!b.client?.phone} />
            <ActionButton icon={genInvoicing ? Loader2 : FileText} label="Invoice" tone="blue" onClick={makeInvoice} disabled={genInvoicing} />
            <ActionButton icon={Edit3} label="Edit" tone="violet" onClick={onEdit} />
          </>}
        />

        <div className="grid grid-cols-2 gap-3 mb-6">
          <MiniStat icon={Wallet} color="blue" label="Contract" value={formatCurrency(net, b.currency)} sub={Number(b.discountAmount) > 0 ? `after ${formatCurrency(Number(b.discountAmount), b.currency)} discount` : undefined} />
          <MiniStat icon={Check} color="green" label="Client paid" value={formatCurrency(paid, b.currency)} />
          <MiniStat icon={DollarSign} color="red" label="Client owes" value={formatCurrency(Math.max(0, due), b.currency)} tone={due > 0 ? "red" : "green"} />
          <MiniStat icon={TrendingUp} color="violet" label="Profit" value={formatCurrency(profit, b.currency)} tone={profit >= 0 ? "green" : "red"} sub={net > 0 ? `${Math.round((profit / net) * 100)}% of contract` : undefined} />
        </div>

        <section className="mb-6">
          <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Status</h2>
          <div className={cn("bg-white rounded-[20px] p-3", CARD_SHADOW)}>
            <StatusPipeline current={b.status} bookingId={b.id} onChanged={refreshBooking} hideTitle />
          </div>
        </section>

        <Group title="Days & team" action={<button type="button" onClick={onEdit} className="text-[13px] font-semibold text-[#5B3FD0]">Change</button>}>
          {days.length === 0 && <p className="px-4 py-4 text-sm text-[#A29DB3]">No days added yet.</p>}
          {days.map((day, i) => {
            const people = day.shifts.flatMap(s => (s.assignments ?? (s as unknown as { memberIds?: ShiftAssignment[] }).memberIds ?? []).map(a => ({ a, shift: s.label })));
            return (
              <div key={day.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#17151F]">{day.eventType || `Day ${i + 1}`}</p>
                    <p className="text-xs text-[#6B6680] flex flex-wrap items-center gap-x-2">
                      <span>{day.date ? fmtDate(day.date) : "No date"}</span>
                      {day.location && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{day.location}</span>}
                    </p>
                    {people.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {people.map(({ a, shift }, k) => (
                          <span key={`${a.id}-${a.role}-${k}`} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#F5F3FA] text-[12px] text-[#17151F]">
                            <Users className="w-3 h-3 text-[#6B6680]" />
                            <span className="font-semibold">{who(a.id, a.name)}</span>
                            <span className="text-[#6B6680]">· {ROLE_LABEL[a.role] ?? a.role.replace(/_/g, " ")}{day.shifts.length > 1 ? ` · ${shift}` : ""}{a.setup ? ` · ${SETUP_LABEL[a.setup] ?? a.setup}` : ""}</span>
                          </span>
                        ))}
                      </div>
                    ) : <p className="mt-1.5 text-xs text-[#A29DB3]">Nobody on this day yet.</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </Group>

        <Group title="Money">
          <Row l="Contract" v={formatCurrency(Number(b.totalAmount), b.currency)} />
          {Number(b.discountAmount) > 0 && <Row l="Discount" v={`− ${formatCurrency(Number(b.discountAmount), b.currency)}`} />}
          <Row l="Client paid" v={formatCurrency(paid, b.currency)} tone="green" />
          <Row l="Client still owes" v={formatCurrency(Math.max(0, due), b.currency)} strong tone={due > 0 ? "red" : "green"} />
          {costs.map(([l, v]) => <Row key={l} l={l} v={`− ${formatCurrency(v, b.currency)}`} />)}
          <Row l="Profit" v={formatCurrency(profit, b.currency)} strong tone={profit >= 0 ? "green" : "red"} />
        </Group>

        <div className="mb-7"><TeamPaySection booking={b} onSaved={refreshBooking} /></div>

        <section className="mb-7 space-y-3">
          <h2 className="px-1 text-[13px] font-bold text-[#4A4658]">Editing & files</h2>
          <div className={cn("bg-white rounded-[20px] p-3 space-y-3", CARD_SHADOW)}>
            <EditorsSection booking={b} teamMembers={teamMembers ?? []} onSaved={refreshBooking} />
            <RawFilesSection booking={b} onSaved={refreshBooking} />
            <CreativeBriefSection booking={b} onSaved={refreshBooking} />
          </div>
        </section>

        <section className="mb-7">
          <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Delivery</h2>
          <div className={cn("bg-white rounded-[20px] p-3 space-y-3", CARD_SHADOW)}>
            <DeliveryOverview booking={b} />
            <button type="button" onClick={() => setDeliveryOpen(true)}
              className="w-full h-11 rounded-full bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0] text-sm font-semibold">Manage delivery</button>
          </div>
        </section>

        {b.internalNotes && (
          <Group title="Private notes">
            <p className="px-4 py-3.5 text-sm text-[#17151F] whitespace-pre-wrap">{b.internalNotes}</p>
          </Group>
        )}
      </ProfileShell>

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
        onSaved={() => { refreshBooking(); setDeliveryOpen(false); }}
      />
    </>
  );
}
