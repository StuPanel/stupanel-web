"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, MapPin, Phone, Mail, User, Users,
  HardDrive, Link2, ExternalLink, FolderOpen, Monitor, Loader2,
  CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";

type ProgramHub = {
  id: string;
  bookingNumber: string;
  eventName?: string;
  status: string;
  eventDays: { id: string; eventType: string; date?: string; location?: string }[];
  client: { firstName: string; lastName?: string; phone?: string; email?: string; address?: string };
  team: { id: string; userId: string; roleInBooking: string; user: { firstName: string; lastName?: string; phone?: string } }[];
  editorAssignments: {
    id: string; userId: string; role: string; status: string;
    editingDeadline?: string; deliveryDeadline?: string;
    user: { firstName: string; lastName?: string };
    submissions?: { reviewStatus: string; deliverableType: string; deliveryLink?: string }[];
  }[];
  rawFilesInfo?: Record<string, any>;
  creativeBrief?: Record<string, any>;
  deliveryLink?: string;
  deliveryLinks?: { id: string; title: string; url: string }[];
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  inquiry:    { label: "Inquiry",    color: "text-slate-600 bg-slate-100",    icon: <AlertCircle className="w-4 h-4" /> },
  confirmed:  { label: "Confirmed",  color: "text-blue-700 bg-blue-100",      icon: <CheckCircle2 className="w-4 h-4" /> },
  in_progress:{ label: "In Progress",color: "text-amber-700 bg-amber-100",    icon: <Clock className="w-4 h-4" /> },
  completed:  { label: "Completed",  color: "text-emerald-700 bg-emerald-100",icon: <CheckCircle2 className="w-4 h-4" /> },
  cancelled:  { label: "Cancelled",  color: "text-red-700 bg-red-100",        icon: <AlertCircle className="w-4 h-4" /> },
};

const ROLE_CFG: Record<string, string> = {
  photographer: "Photographer", videographer: "Videographer", assistant: "Assistant",
  drone_operator: "Drone", photo_editor: "Photo Editor", video_editor: "Video Editor",
  album_designer: "Album Design", coordinator: "Coordinator",
};

const ASSIGNMENT_STATUS: Record<string, { label: string; cls: string }> = {
  assigned:           { label: "Assigned",       cls: "bg-slate-100 text-slate-600" },
  in_progress:        { label: "In Progress",    cls: "bg-blue-100 text-blue-700" },
  submitted:          { label: "Submitted",      cls: "bg-amber-100 text-amber-700" },
  under_review:       { label: "Under Review",   cls: "bg-yellow-100 text-yellow-700" },
  revision_requested: { label: "Revision",       cls: "bg-red-100 text-red-700" },
  approved:           { label: "Approved",       cls: "bg-emerald-100 text-emerald-700" },
  delivered:          { label: "Delivered",      cls: "bg-green-100 text-green-700" },
};


function wa(phone: string) {
  const clean = phone.replace(/\D/g, "");
  const num = clean.startsWith("0") ? "88" + clean : clean.startsWith("88") ? clean : clean;
  return `https://wa.me/${num}`;
}

export default function ProgramHubPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [hub, setHub] = useState<ProgramHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`${API}/member/programs/${id}/hub`)
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.message)))
      .then(setHub)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{error || "Program not found"}</p>
          <button onClick={() => router.back()} className="text-indigo-600 text-sm">← Go back</button>
        </div>
      </div>
    );
  }

  const sc = STATUS_CFG[hub.status] ?? STATUS_CFG.inquiry;
  const rawFiles = hub.rawFilesInfo ?? {};
  const hasRawFiles = rawFiles.folderName || rawFiles.folderPath || rawFiles.driveLink || rawFiles.dropboxLink || rawFiles.nasLocation;
  const deliveryLinks = (hub.deliveryLinks as any[]) ?? (hub.deliveryLink ? [{ id: "1", title: "Delivery Link", url: hub.deliveryLink }] : []);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-900 truncate">{hub.eventName ?? hub.bookingNumber}</h1>
          <p className="text-xs text-slate-400 font-mono">{hub.bookingNumber}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${sc.color}`}>
          {sc.icon}{sc.label}
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {/* Event Days */}
        {hub.eventDays?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-sm text-slate-800">Event Days</span>
              <span className="ml-auto text-xs text-slate-400">{hub.eventDays.length} day{hub.eventDays.length > 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {hub.eventDays.map((day, i) => (
                <div key={day.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-800">{day.eventType}</p>
                    {day.date && <p className="text-xs text-slate-400 mt-0.5">{fmtDate(day.date)}</p>}
                    {day.location && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{day.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-sm text-slate-800">Client</span>
          </div>
          <div className="px-4 py-4 space-y-2">
            <p className="font-bold text-slate-900 text-lg">{hub.client.firstName} {hub.client.lastName ?? ""}</p>
            {hub.client.phone && (
              <a href={wa(hub.client.phone)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-emerald-600 hover:underline">
                <Phone className="w-3.5 h-3.5" />{hub.client.phone}
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">WhatsApp</span>
              </a>
            )}
            {hub.client.email && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Mail className="w-3.5 h-3.5" />{hub.client.email}
              </div>
            )}
            {hub.client.address && (
              <div className="flex items-start gap-2 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />{hub.client.address}
              </div>
            )}
          </div>
        </div>

        {/* Team */}
        {hub.team?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              <span className="font-semibold text-sm text-slate-800">Team</span>
              <span className="ml-auto text-xs text-slate-400">{hub.team.length} members</span>
            </div>
            <div className="divide-y divide-slate-50">
              {hub.team.map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{m.user.firstName} {m.user.lastName ?? ""}</p>
                    <p className="text-xs text-slate-400">{ROLE_CFG[m.roleInBooking] ?? m.roleInBooking}</p>
                  </div>
                  {m.user.phone && (
                    <a href={wa(m.user.phone)} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Assignment (Editor Assignments) */}
        {hub.editorAssignments?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-sm text-slate-800">Editing Assignments</span>
            </div>
            <div className="divide-y divide-slate-50">
              {hub.editorAssignments.map(a => {
                const asc = ASSIGNMENT_STATUS[a.status] ?? { label: a.status, cls: "bg-slate-100 text-slate-600" };
                const lastSub = a.submissions?.[0];
                return (
                  <div key={a.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{a.user.firstName} {a.user.lastName ?? ""}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.role === "photo_editor" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                        {a.role === "photo_editor" ? "Photo Editor" : "Video Editor"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${asc.cls}`}>{asc.label}</span>
                      {a.editingDeadline && <span className="text-[10px] text-slate-400">✏️ {fmtDate(a.editingDeadline)}</span>}
                      {a.deliveryDeadline && <span className="text-[10px] text-slate-400">📦 {fmtDate(a.deliveryDeadline)}</span>}
                    </div>
                    {lastSub?.deliveryLink && (
                      <a href={lastSub.deliveryLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline">
                        <Link2 className="w-3 h-3" />View Delivery <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Raw Files */}
        {hasRawFiles && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-sm text-slate-800">Raw Files</span>
            </div>
            <div className="px-4 py-4 space-y-2">
              {rawFiles.folderName && <p className="font-semibold text-slate-800"><FolderOpen className="w-3.5 h-3.5 text-amber-500 inline mr-1" />{rawFiles.folderName}</p>}
              {rawFiles.folderPath && <p className="text-sm text-slate-500 font-mono">{rawFiles.folderPath}</p>}
              {(rawFiles.fileCount || rawFiles.fileSizeGb) && (
                <p className="text-xs text-slate-400">
                  {rawFiles.fileCount ? `${rawFiles.fileCount.toLocaleString()} files` : ""}
                  {rawFiles.fileCount && rawFiles.fileSizeGb ? " · " : ""}
                  {rawFiles.fileSizeGb ? `${rawFiles.fileSizeGb} GB` : ""}
                </p>
              )}
              {rawFiles.driveLink && (
                <a href={rawFiles.driveLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                  <Link2 className="w-3.5 h-3.5" />Open Drive <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {rawFiles.dropboxLink && (
                <a href={rawFiles.dropboxLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                  <Link2 className="w-3.5 h-3.5" />Open Dropbox <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {rawFiles.nasLocation && <p className="text-sm text-slate-500 font-mono">{rawFiles.nasLocation}</p>}
              {rawFiles.notes && <p className="text-xs text-slate-500 bg-amber-50 rounded-lg px-3 py-2">{rawFiles.notes}</p>}
            </div>
          </div>
        )}

        {/* Delivery Links */}
        {deliveryLinks.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-sm text-slate-800">Delivery</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {deliveryLinks.map((l: any) => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors">
                  <span className="text-sm font-medium text-emerald-800">{l.title || "Delivery Link"}</span>
                  <ExternalLink className="w-4 h-4 text-emerald-600" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
