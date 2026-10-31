"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, MapPin, Phone, Mail, User, Users,
  HardDrive, Link2, ExternalLink, FolderOpen, Monitor, Loader2,
  CheckCircle2, Clock, AlertCircle, Wallet,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge, Spinner } from "../../_components/kit";

type ProgramHub = {
  id: string;
  bookingNumber: string;
  eventName?: string;
  status: string;
  eventDays: {
    id: string; eventType: string; date?: string; location?: string;
    shifts?: { id: string; label: string; people: { id: string; isMe: boolean; role: string; name: string; phone?: string | null; setup?: string | null; gear: string[] }[] }[];
  }[];
  currency?: string;
  myPay?: {
    role: string; bill: number; paid: number; due: number; note?: string;
    lines: { label: string; amount: number; kind: string; note?: string }[];
    payments: { id: string; amount: number; method: string; date: string }[];
  } | null;
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
  inquiry:    { label: "Inquiry",    color: "text-[#4A4658] bg-[#EEEDF2]",    icon: <AlertCircle className="w-4 h-4" /> },
  confirmed:  { label: "Confirmed",  color: "text-blue-700 bg-blue-100",      icon: <CheckCircle2 className="w-4 h-4" /> },
  in_progress:{ label: "In Progress",color: "text-amber-700 bg-amber-100",    icon: <Clock className="w-4 h-4" /> },
  completed:  { label: "Completed",  color: "text-emerald-700 bg-emerald-100",icon: <CheckCircle2 className="w-4 h-4" /> },
  cancelled:  { label: "Cancelled",  color: "text-red-700 bg-red-100",        icon: <AlertCircle className="w-4 h-4" /> },
};

const SETUP_LABEL: Record<string, string> = { own: "own setup", other: "others' gear", rented: "rented gear" };
const METHOD_LABEL: Record<string, string> = { cash: "Cash", mobile_banking: "bKash / Nagad", bank_transfer: "Bank", other: "Other" };
const ROLE_CFG: Record<string, string> = {
  photographer: "Photographer", videographer: "Videographer", cinematographer: "Cinematographer", drone_pilot: "Drone", assistant: "Assistant",
  drone_operator: "Drone", photo_editor: "Photo Editor", video_editor: "Video Editor",
  album_designer: "Album Design", coordinator: "Coordinator",
};

const ASSIGNMENT_STATUS: Record<string, { label: string; cls: string }> = {
  assigned:           { label: "Assigned",       cls: "bg-[#EEEDF2] text-[#4A4658]" },
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
      <Spinner />
    );
  }

  if (error || !hub) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#6B6680] mb-4">{error || "Program not found"}</p>
          <button onClick={() => router.back()} className="text-[#5B3FD0] text-sm">← Go back</button>
        </div>
      </div>
    );
  }

  const rawFiles = hub.rawFilesInfo ?? {};
  const hasRawFiles = rawFiles.folderName || rawFiles.folderPath || rawFiles.driveLink || rawFiles.dropboxLink || rawFiles.nasLocation;
  const deliveryLinks = (hub.deliveryLinks as any[]) ?? (hub.deliveryLink ? [{ id: "1", title: "Delivery Link", url: hub.deliveryLink }] : []);

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] px-4 py-4 flex items-center gap-3 mb-5 max-w-3xl">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4]">
          <ArrowLeft className="w-4 h-4 text-[#4A4658]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[#17151F] truncate">{hub.eventName ?? hub.bookingNumber}</h1>
          <p className="text-xs text-[#6B6680] font-mono">{hub.bookingNumber}</p>
        </div>
        <StatusBadge status={hub.status} />
      </div>

      <div className="max-w-3xl space-y-5">
        {/* Event Days */}
        {hub.eventDays?.length > 0 && (
          <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5B3FD0]" />
              <span className="font-bold text-[13px] text-[#4A4658]">Event Days</span>
              <span className="ml-auto text-xs text-[#6B6680]">{hub.eventDays.length} day{hub.eventDays.length > 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-[#EEEBF4]">
              {hub.eventDays.map((day, i) => (
                <div key={day.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-[#EEE8FD] flex items-center justify-center text-[#5B3FD0] font-bold text-sm shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-bold text-[13px] text-[#4A4658]">{day.eventType}</p>
                    {day.date && <p className="text-xs text-[#6B6680] mt-0.5">{fmtDate(day.date)}</p>}
                    {day.location && <p className="text-xs text-[#6B6680] flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{day.location}</p>}
                    {(day.shifts ?? []).filter(sh => sh.people.length).map(sh => (
                      <div key={sh.id} className="mt-2">
                        {(day.shifts ?? []).length > 1 && <p className="text-[11px] font-semibold text-[#6B6680] mb-1">{sh.label}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {sh.people.map((pp, k) => (
                            <span key={`${pp.id}-${k}`} className={cn("inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px]", pp.isMe ? "bg-violet-600 text-white" : "bg-[#EEEDF2] text-[#4A4658]")}>
                              <span className="font-semibold">{pp.isMe ? "You" : pp.name}</span>
                              <span className={pp.isMe ? "text-violet-100" : "text-[#6B6680]"}>· {ROLE_CFG[pp.role] ?? pp.role.replace(/_/g, " ")}{pp.setup ? ` · ${SETUP_LABEL[pp.setup] ?? pp.setup}` : ""}{pp.gear.length ? ` (${pp.gear.join(", ")})` : ""}</span>
                              {!pp.isMe && pp.phone && <a href={wa(pp.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${pp.name}`} className="ml-0.5 text-emerald-600"><Phone className="w-3 h-3" /></a>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My pay on this program */}
        {hub.myPay && (
          <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-[13px] text-[#4A4658]">My pay</span>
              <span className={cn("ml-auto text-xs font-semibold px-2 py-0.5 rounded-full", hub.myPay.due > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                {hub.myPay.due > 0 ? `Due ${formatCurrency(hub.myPay.due)}` : "Paid in full"}
              </span>
            </div>
            <div className="divide-y divide-[#EEEBF4]">
              {hub.myPay.lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-[#4A4658]">{l.label}{l.note ? <span className="text-xs text-[#6B6680]"> · {l.note}</span> : null}</span>
                  <span className={cn("font-semibold tabular-nums", l.kind === "deduction" ? "text-red-600" : "text-[#17151F]")}>{l.kind === "deduction" ? "− " : ""}{formatCurrency(l.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 text-sm font-bold"><span>Total</span><span className="tabular-nums">{formatCurrency(hub.myPay.bill)}</span></div>
              {hub.myPay.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2 text-xs text-[#6B6680]">
                  <span>Paid {fmtDate(p.date)} · {METHOD_LABEL[p.method] ?? p.method}</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client */}
        <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-[13px] text-[#4A4658]">Client</span>
          </div>
          <div className="px-4 py-4 space-y-2">
            <p className="font-bold text-[#17151F] text-lg">{hub.client.firstName} {hub.client.lastName ?? ""}</p>
            {hub.client.phone && (
              <a href={wa(hub.client.phone)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-emerald-600 hover:underline">
                <Phone className="w-3.5 h-3.5" />{hub.client.phone}
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">WhatsApp</span>
              </a>
            )}
            {hub.client.email && (
              <div className="flex items-center gap-2 text-sm text-[#6B6680]">
                <Mail className="w-3.5 h-3.5" />{hub.client.email}
              </div>
            )}
            {hub.client.address && (
              <div className="flex items-start gap-2 text-sm text-[#6B6680]">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />{hub.client.address}
              </div>
            )}
          </div>
        </div>

        {/* Team */}
        {hub.team?.length > 0 && (
          <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              <span className="font-bold text-[13px] text-[#4A4658]">Team</span>
              <span className="ml-auto text-xs text-[#6B6680]">{hub.team.length} members</span>
            </div>
            <div className="divide-y divide-[#EEEBF4]">
              {hub.team.map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#17151F]">{m.user.firstName} {m.user.lastName ?? ""}</p>
                    <p className="text-xs text-[#6B6680]">{ROLE_CFG[m.roleInBooking] ?? m.roleInBooking}</p>
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
          <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#5B3FD0]" />
              <span className="font-bold text-[13px] text-[#4A4658]">Editing Assignments</span>
            </div>
            <div className="divide-y divide-[#EEEBF4]">
              {hub.editorAssignments.map(a => {
                const asc = ASSIGNMENT_STATUS[a.status] ?? { label: a.status, cls: "bg-[#EEEDF2] text-[#4A4658]" };
                const lastSub = a.submissions?.[0];
                return (
                  <div key={a.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#17151F]">{a.user.firstName} {a.user.lastName ?? ""}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === "photo_editor" ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-[#FBF2FA] text-[#9E3A8C]"}`}>
                        {a.role === "photo_editor" ? "Photo Editor" : "Video Editor"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${asc.cls}`}>{asc.label}</span>
                      {a.editingDeadline && <span className="text-xs text-[#6B6680]">✏️ {fmtDate(a.editingDeadline)}</span>}
                      {a.deliveryDeadline && <span className="text-xs text-[#6B6680]">📦 {fmtDate(a.deliveryDeadline)}</span>}
                    </div>
                    {lastSub?.deliveryLink && (
                      <a href={lastSub.deliveryLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-[#5B3FD0] hover:underline">
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
          <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-[13px] text-[#4A4658]">Raw Files</span>
            </div>
            <div className="px-4 py-4 space-y-2">
              {rawFiles.folderName && <p className="font-semibold text-[#17151F]"><FolderOpen className="w-3.5 h-3.5 text-amber-500 inline mr-1" />{rawFiles.folderName}</p>}
              {rawFiles.folderPath && <p className="text-sm text-[#6B6680] font-mono">{rawFiles.folderPath}</p>}
              {(rawFiles.fileCount || rawFiles.fileSizeGb) && (
                <p className="text-xs text-[#6B6680]">
                  {rawFiles.fileCount ? `${rawFiles.fileCount.toLocaleString()} files` : ""}
                  {rawFiles.fileCount && rawFiles.fileSizeGb ? " · " : ""}
                  {rawFiles.fileSizeGb ? `${rawFiles.fileSizeGb} GB` : ""}
                </p>
              )}
              {rawFiles.driveLink && (
                <a href={rawFiles.driveLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#5B3FD0] hover:underline">
                  <Link2 className="w-3.5 h-3.5" />Open Drive <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {rawFiles.dropboxLink && (
                <a href={rawFiles.dropboxLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#5B3FD0] hover:underline">
                  <Link2 className="w-3.5 h-3.5" />Open Dropbox <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {rawFiles.nasLocation && <p className="text-sm text-[#6B6680] font-mono">{rawFiles.nasLocation}</p>}
              {rawFiles.notes && <p className="text-xs text-[#6B6680] bg-amber-50 rounded-lg px-3 py-2">{rawFiles.notes}</p>}
            </div>
          </div>
        )}

        {/* Delivery Links */}
        {deliveryLinks.length > 0 && (
          <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-[13px] text-[#4A4658]">Delivery</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {deliveryLinks.map((l: any) => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-[14px] bg-emerald-50 hover:bg-emerald-100 transition-colors">
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
