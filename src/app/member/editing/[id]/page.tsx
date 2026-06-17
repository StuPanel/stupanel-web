"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, HardDrive, Link2, ExternalLink, FolderOpen,
  Loader2, Send, Play, CheckCircle2, Clock, AlertTriangle, RotateCcw,
  Palette, ChevronDown, ChevronUp, Upload,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";

type Workspace = {
  assignment: {
    id: string; role: string; status: string;
    editingDeadline?: string; deliveryDeadline?: string;
    studioNote?: string; editorNote?: string; revisionCount: number;
    booking: {
      id: string; bookingNumber: string; eventName?: string;
      eventDays: { id: string; eventType: string; date?: string; location?: string }[];
      rawFilesInfo?: Record<string, any>;
      creativeBrief?: Record<string, any>;
    };
  };
  submissions: {
    id: string; deliverableType: string; deliveryLink?: string; driveLink?: string;
    dropboxLink?: string; wetransferLink?: string; notes?: string;
    revisionNotes?: string; reviewStatus: string; reviewFeedback?: string;
    submittedAt: string;
  }[];
  chat: { id: string; senderName?: string; content: string; createdAt: string; isStudio?: boolean }[];
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode; next?: string; nextLabel?: string }> = {
  assigned:           { label: "Assigned",        color: "bg-slate-100 text-slate-700",      icon: <Clock className="w-4 h-4" />,         next: "in_progress",        nextLabel: "Start Editing" },
  in_progress:        { label: "In Progress",     color: "bg-blue-100 text-blue-700",        icon: <Play className="w-4 h-4" />,          next: undefined,            nextLabel: undefined },
  submitted:          { label: "Submitted",       color: "bg-amber-100 text-amber-700",      icon: <Upload className="w-4 h-4" />,        next: undefined,            nextLabel: undefined },
  under_review:       { label: "Under Review",    color: "bg-yellow-100 text-yellow-700",    icon: <Clock className="w-4 h-4" />,         next: undefined,            nextLabel: undefined },
  revision_requested: { label: "Revision Needed", color: "bg-red-100 text-red-700",          icon: <AlertTriangle className="w-4 h-4" />, next: "in_progress",        nextLabel: "Start Revision" },
  resubmitted:        { label: "Resubmitted",     color: "bg-orange-100 text-orange-700",    icon: <RotateCcw className="w-4 h-4" />,     next: undefined,            nextLabel: undefined },
  approved:           { label: "Approved",        color: "bg-emerald-100 text-emerald-700",  icon: <CheckCircle2 className="w-4 h-4" />,  next: "delivered",          nextLabel: "Mark as Delivered" },
  delivered:          { label: "Delivered",       color: "bg-green-100 text-green-700",      icon: <CheckCircle2 className="w-4 h-4" />,  next: undefined,            nextLabel: undefined },
};

const DELIVERABLE_TYPES = [
  { value: "highlight_video", label: "Highlight Video" },
  { value: "full_video", label: "Full Video" },
  { value: "teaser", label: "Teaser" },
  { value: "reel", label: "Reel" },
  { value: "photo_delivery", label: "Photo Delivery" },
  { value: "album", label: "Album" },
  { value: "other", label: "Other" },
];

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

export default function EditorWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [showBrief, setShowBrief] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);
  const [submitForm, setSubmitForm] = useState({
    deliverableType: "highlight_video",
    deliveryLink: "",
    driveLink: "",
    dropboxLink: "",
    wetransferLink: "",
    notes: "",
    revisionNotes: "",
  });

  function reload() {
    apiFetch(`${API}/member/editing/${id}/workspace`)
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.message)))
      .then(setWs)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [id]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [ws?.chat]);

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    try {
      await apiFetch(`${API}/member/editing/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      reload();
    } finally { setUpdatingStatus(false); }
  }

  async function submitWork() {
    setSubmitting(true);
    try {
      const hasLink = submitForm.deliveryLink || submitForm.driveLink || submitForm.dropboxLink || submitForm.wetransferLink;
      if (!hasLink) { alert("Please add at least one delivery link"); setSubmitting(false); return; }
      await apiFetch(`${API}/member/editing/${id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitForm),
      });
      setShowSubmitForm(false);
      setSubmitForm({ deliverableType: "highlight_video", deliveryLink: "", driveLink: "", dropboxLink: "", wetransferLink: "", notes: "", revisionNotes: "" });
      reload();
    } finally { setSubmitting(false); }
  }

  async function sendChat() {
    if (!chatMsg.trim() || !ws) return;
    setSendingChat(true);
    try {
      await apiFetch(`${API}/member/chat/${ws.assignment.booking.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chatMsg.trim() }),
      });
      setChatMsg("");
      reload();
    } finally { setSendingChat(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !ws) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{error || "Workspace not found"}</p>
          <button onClick={() => router.back()} className="text-indigo-600 text-sm">← Go back</button>
        </div>
      </div>
    );
  }

  const { assignment, submissions, chat } = ws;
  const booking = assignment.booking;
  const statusCfg = STATUS_CFG[assignment.status] ?? { label: assignment.status, color: "bg-slate-100 text-slate-600", icon: null };
  const brief = booking.creativeBrief ?? {};
  const rawFiles = booking.rawFilesInfo ?? {};
  const hasBrief = brief.videoStyle || brief.photoStyle || brief.colorStyle || brief.musicInfo || brief.specialInstructions;
  const hasRawFiles = rawFiles.folderName || rawFiles.folderPath || rawFiles.driveLink || rawFiles.dropboxLink || rawFiles.nasLocation;
  const canSubmit = ["in_progress", "revision_requested", "resubmitted"].includes(assignment.status);
  const isRevision = assignment.status === "revision_requested";

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-900 truncate">{booking.eventName ?? booking.bookingNumber}</h1>
          <p className="text-xs text-slate-400">{assignment.role === "photo_editor" ? "Photo Editor" : "Video Editor"}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${statusCfg.color}`}>
          {statusCfg.icon}{statusCfg.label}
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {/* Status Action */}
        {(statusCfg.next || canSubmit) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</p>
            {isRevision && assignment.revisionCount > 0 && (
              <div className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-3">
                Revision #{assignment.revisionCount} requested
                {submissions.find(s => s.reviewFeedback) && (
                  <p className="mt-1 text-red-700">{submissions.find(s => s.reviewFeedback)?.reviewFeedback}</p>
                )}
              </div>
            )}
            {assignment.studioNote && (
              <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-3">{assignment.studioNote}</div>
            )}
            <div className="flex gap-2 flex-wrap">
              {statusCfg.next && (
                <button onClick={() => updateStatus(statusCfg.next!)} disabled={updatingStatus}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : statusCfg.icon}
                  {statusCfg.nextLabel}
                </button>
              )}
              {canSubmit && (
                <button onClick={() => setShowSubmitForm(!showSubmitForm)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <Upload className="w-4 h-4" />
                  {isRevision ? "Submit Revision" : "Submit Work"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Deadlines */}
        {(assignment.editingDeadline || assignment.deliveryDeadline) && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-sm text-slate-800">Deadlines</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100 px-0">
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Editing</p>
                <p className="font-bold text-slate-800 text-sm">{fmtDate(assignment.editingDeadline)}</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Delivery</p>
                <p className="font-bold text-slate-800 text-sm">{fmtDate(assignment.deliveryDeadline)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Form */}
        {showSubmitForm && (
          <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50">
              <p className="font-semibold text-sm text-emerald-800">{isRevision ? "Submit Revision" : "Submit Work"}</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Deliverable Type</p>
                <select value={submitForm.deliverableType} onChange={e => setSubmitForm(f => ({ ...f, deliverableType: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {DELIVERABLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {[
                { key: "deliveryLink", label: "Delivery Link", placeholder: "https://..." },
                { key: "driveLink", label: "Google Drive", placeholder: "https://drive.google.com/..." },
                { key: "dropboxLink", label: "Dropbox", placeholder: "https://www.dropbox.com/..." },
                { key: "wetransferLink", label: "WeTransfer", placeholder: "https://we.tl/..." },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                  <input value={(submitForm as any)[key]} onChange={e => setSubmitForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              ))}
              {isRevision && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Revision Notes</p>
                  <textarea value={submitForm.revisionNotes} onChange={e => setSubmitForm(f => ({ ...f, revisionNotes: e.target.value }))}
                    placeholder="What was changed in this revision..." rows={2}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              )}
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Notes</p>
                <textarea value={submitForm.notes} onChange={e => setSubmitForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes for the studio..." rows={2}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSubmitForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={submitWork} disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Submission
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Creative Brief */}
        {hasBrief && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button onClick={() => setShowBrief(!showBrief)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-500" />
                <span className="font-semibold text-sm text-slate-800">Creative Brief</span>
              </div>
              {showBrief ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showBrief && (
              <div className="px-4 py-4 space-y-2">
                {brief.videoStyle && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-28">Video Style</span><span className="text-slate-800">{brief.videoStyle}</span></div>}
                {brief.photoStyle && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-28">Photo Style</span><span className="text-slate-800">{brief.photoStyle}</span></div>}
                {brief.colorStyle && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-28">Color Grade</span><span className="text-slate-800">{brief.colorStyle}</span></div>}
                {brief.musicInfo && <div className="flex gap-2 text-sm"><span className="text-slate-400 shrink-0 w-28">Music</span><span className="text-slate-800">{brief.musicInfo}</span></div>}
                {brief.specialInstructions && (
                  <div className="bg-purple-50 rounded-xl px-3 py-2.5 text-sm text-purple-900">{brief.specialInstructions}</div>
                )}
                {(brief.editingDeadline || brief.deliveryDeadline) && (
                  <div className="flex gap-4 text-xs text-slate-500 pt-1">
                    {brief.editingDeadline && <span>✏️ Editing by {brief.editingDeadline}</span>}
                    {brief.deliveryDeadline && <span>📦 Delivery by {brief.deliveryDeadline}</span>}
                  </div>
                )}
              </div>
            )}
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
              {rawFiles.folderPath && <p className="text-sm text-slate-500 font-mono break-all">{rawFiles.folderPath}</p>}
              {(rawFiles.fileCount || rawFiles.fileSizeGb) && (
                <p className="text-xs text-slate-400">
                  {rawFiles.fileCount ? `${Number(rawFiles.fileCount).toLocaleString()} files` : ""}
                  {rawFiles.fileCount && rawFiles.fileSizeGb ? " · " : ""}
                  {rawFiles.fileSizeGb ? `${rawFiles.fileSizeGb} GB` : ""}
                </p>
              )}
              {rawFiles.driveLink && <a href={rawFiles.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"><Link2 className="w-3.5 h-3.5" />Open Drive <ExternalLink className="w-3 h-3" /></a>}
              {rawFiles.dropboxLink && <a href={rawFiles.dropboxLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"><Link2 className="w-3.5 h-3.5" />Open Dropbox <ExternalLink className="w-3 h-3" /></a>}
              {rawFiles.nasLocation && <p className="text-sm text-slate-500 font-mono">{rawFiles.nasLocation}</p>}
              {rawFiles.notes && <p className="text-xs text-slate-500 bg-amber-50 rounded-lg px-3 py-2">{rawFiles.notes}</p>}
            </div>
          </div>
        )}

        {/* Submission History */}
        {submissions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-sm text-slate-800">Submissions</span>
              <span className="ml-auto text-xs text-slate-400">{submissions.length}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {submissions.map((s, i) => (
                <div key={s.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      #{submissions.length - i} — {DELIVERABLE_TYPES.find(t => t.value === s.deliverableType)?.label ?? s.deliverableType}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      s.reviewStatus === "approved" ? "bg-emerald-100 text-emerald-700" :
                      s.reviewStatus === "revision_requested" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {s.reviewStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">{fmtTime(s.submittedAt)}</p>
                  {(s.deliveryLink || s.driveLink || s.dropboxLink || s.wetransferLink) && (
                    <div className="flex gap-2 flex-wrap">
                      {s.deliveryLink && <a href={s.deliveryLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Link2 className="w-3 h-3" />Link</a>}
                      {s.driveLink && <a href={s.driveLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Link2 className="w-3 h-3" />Drive</a>}
                      {s.dropboxLink && <a href={s.dropboxLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Link2 className="w-3 h-3" />Dropbox</a>}
                      {s.wetransferLink && <a href={s.wetransferLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Link2 className="w-3 h-3" />WeTransfer</a>}
                    </div>
                  )}
                  {s.reviewFeedback && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{s.reviewFeedback}</p>}
                  {s.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{s.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat / Notes */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-sm text-slate-800">Notes with Studio</span>
          </div>
          <div ref={chatRef} className="max-h-64 overflow-y-auto p-4 space-y-3">
            {chat.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No messages yet</p>}
            {chat.map(msg => (
              <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.isStudio ? "items-start" : "items-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${msg.isStudio ? "bg-slate-100 text-slate-800 rounded-tl-sm" : "bg-indigo-600 text-white rounded-tr-sm"}`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-400">{msg.senderName ? `${msg.senderName} · ` : ""}{fmtTime(msg.createdAt)}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
              placeholder="Write a note to studio..."
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={sendChat} disabled={sendingChat || !chatMsg.trim()}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors">
              {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
