"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, HardDrive, Link2, Cloud, ExternalLink, Check, Clapperboard, Palette } from "lucide-react";
import { askConfirm, notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "./constants";
import type { Booking, ShiftAssignment } from "./types";
import { Group, Tile } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";

export function DeliveryOverview({ booking }: { booking: Booking }) {
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

  const label = { drive_auto: "Google Drive folder", drive_link: "Drive link", r2: "StuPanel cloud" }[method ?? ""] ?? (method ? method : "");
  const openUrl = method === "drive_auto" ? booking.driveFolderUrl : method === "drive_link" ? booking.deliveryLink : null;
  const facts = !method ? ["Nothing set yet"] : [
    method === "r2" ? `${r2FileCount ?? "—"} file${r2FileCount === 1 ? "" : "s"}` : method === "drive_auto" ? "Folder ready" : null,
    `${linksCount} link${linksCount === 1 ? "" : "s"}`,
    booking.deliveryDate ? `Delivered ${fmtDate(booking.deliveryDate)}` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-[#E6E2EE] p-3 flex items-center gap-3">
      <Tile icon={method === "r2" ? Cloud : method === "drive_link" ? Link2 : HardDrive} color={method ? "teal" : "ink"} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#17151F]">{method ? label : "Delivery"}</p>
        <p className="text-[12.5px] text-[#6B6680] truncate">{facts.join(" · ")}</p>
      </div>
      {openUrl && (
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="h-9 px-3.5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 flex-shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />Open
        </a>
      )}
    </div>
  );
}

export function CreativeBriefSection({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
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
    <div className="rounded-2xl border border-[#E6E2EE] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Tile icon={Palette} color="orchid" size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#17151F]">Creative brief</p>
          <p className="text-[12.5px] text-[#6B6680] truncate">{hasInfo ? "Style, colour and notes for the editors" : "Not written yet"}</p>
        </div>
        <button type="button" onClick={() => setEditing(!editing)} className="h-9 px-3.5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[13px] font-semibold text-[#17151F] flex-shrink-0">{editing ? "Cancel" : hasInfo ? "Edit" : "Write"}</button>
      </div>

      {editing ? (
        <div className="p-3 pt-0 space-y-3">
          {[
            { key: "videoStyle", label: "Video Style", placeholder: "Cinematic, emotional storytelling..." },
            { key: "photoStyle", label: "Photo Style", placeholder: "Light & airy, natural tones..." },
            { key: "colorStyle", label: "Color Grade", placeholder: "Warm tones, filmic look..." },
            { key: "musicInfo", label: "Music", placeholder: "e.g. Soft instrumental, upbeat for the reel" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-[12.5px] font-semibold text-[#4A4658] mb-1">{label}</p>
              <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className="w-full h-10 px-3 rounded-[10px] bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#A29DB3] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF]" />
            </div>
          ))}
          <div>
            <p className="text-[12.5px] font-semibold text-[#4A4658] mb-1">Special Instructions</p>
            <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
              placeholder="Highlight the first dance, include all family moments..." rows={3}
              className="w-full px-3 py-2.5 rounded-[10px] bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#A29DB3] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12.5px] font-semibold text-[#4A4658] mb-1">Editing Deadline</p>
              <input type="date" value={form.editingDeadline} onChange={e => setForm(f => ({ ...f, editingDeadline: e.target.value }))}
                className="w-full h-10 px-3 rounded-[10px] bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#A29DB3] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF]" />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-[#4A4658] mb-1">Delivery Deadline</p>
              <input type="date" value={form.deliveryDeadline} onChange={e => setForm(f => ({ ...f, deliveryDeadline: e.target.value }))}
                className="w-full h-10 px-3 rounded-[10px] bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#A29DB3] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF]" />
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full h-11 bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold rounded-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save brief
          </button>
        </div>
      ) : hasInfo ? (
        <div className="px-3 pb-3 pt-2.5 space-y-2 border-t border-[#EEEBF4]">
          {brief.videoStyle && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Video Style</span><span className="text-[#17151F]">{brief.videoStyle}</span></div>}
          {brief.photoStyle && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Photo Style</span><span className="text-[#17151F]">{brief.photoStyle}</span></div>}
          {brief.colorStyle && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Color Grade</span><span className="text-[#17151F]">{brief.colorStyle}</span></div>}
          {brief.musicInfo && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Music</span><span className="text-[#17151F]">{brief.musicInfo}</span></div>}
          {brief.specialInstructions && <p className="text-xs text-[#4A4658] bg-[#F7F4FE] rounded-lg px-3 py-2 mt-1">{brief.specialInstructions}</p>}
          {(brief.editingDeadline || brief.deliveryDeadline) && (
            <div className="flex gap-4 text-xs text-[#6B6680] pt-1">
              {brief.editingDeadline && <span>Edit by {brief.editingDeadline}</span>}
              {brief.deliveryDeadline && <span>Deliver by {brief.deliveryDeadline}</span>}
            </div>
          )}
        </div>
      ) : (
        null
      )}
    </div>
  );
}

const ASSIGNMENT_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  assigned:           { label: "Assigned",          cls: "bg-[#F1EFF6] text-[#4A4658]" },
  in_progress:        { label: "In Progress",        cls: "bg-[#E8F0FA] text-[#1F5C99]" },
  submitted:          { label: "Submitted",          cls: "bg-[#FFF3E0] text-[#9A5B00]" },
  under_review:       { label: "Under Review",       cls: "bg-[#FFF3E0] text-[#9A5B00]" },
  revision_requested: { label: "Revision Needed",    cls: "bg-[#FDECEF] text-[#C2304F]" },
  resubmitted:        { label: "Resubmitted",        cls: "bg-[#FFF3E0] text-[#9A5B00]" },
  approved:           { label: "Approved",           cls: "bg-[#E7F5EE] text-[#1F8A5B]" },
  delivered:          { label: "Delivered",          cls: "bg-[#E7F5EE] text-[#1F8A5B]" },
};

type EditorAssignment = {
  id: string; userId: string; role: string; status: string;
  editingDeadline?: string; deliveryDeadline?: string; studioNote?: string;
  user?: { firstName: string; lastName?: string };
  submissions?: Submission[];
  /** The studio's list of what to deliver and how far the editor is. */
  progress?: { plan: string[]; approved: string[]; missing: string[]; total: number; done: number; canComplete: boolean };
};
const PLAN_TYPES: Record<"photo_editor" | "video_editor", string[]> = {
  video_editor: ["teaser", "highlight_video", "full_video", "reel", "other"],
  photo_editor: ["photo_delivery", "album", "other"],
};
type Submission = {
  id: string; reviewStatus: string; deliverableType: string; submittedAt: string;
  deliveryLink?: string | null; driveLink?: string | null; dropboxLink?: string | null; wetransferLink?: string | null;
  notes?: string | null; revisionNotes?: string | null; reviewFeedback?: string | null;
  /** Copy of an approved version into the client's delivery folder. */
  copy?: { status: "copying" | "done" | "failed" | "skipped"; done?: number; total?: number; error?: string; at: string } | null;
};
const DELIVERABLE: Record<string, string> = {
  highlight_video: "Highlight video", full_video: "Full video", teaser: "Teaser", reel: "Reel",
  photo_delivery: "Photos", album: "Album", other: "Other",
};

/** What an editor sent, newest first — open the files, approve, or ask for changes. */
function Submissions({ bookingId, a, onChanged, onDelivered }: { bookingId: string; a: EditorAssignment; onChanged: () => void; onDelivered?: () => void }) {
  const subs = a.submissions ?? [];
  // When a copy to the delivery folder finishes, the program's Delivery card should show it too.
  const doneKey = subs.filter(x => x.copy?.status === "done").map(x => x.id).join(",");
  const firstDone = useRef(doneKey);
  useEffect(() => {
    if (doneKey !== firstDone.current) { firstDone.current = doneKey; onDelivered?.(); }
  }, [doneKey, onDelivered]);
  const [fbFor, setFbFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // While files are being copied to delivery, check again every few seconds.
  const copying = subs.some(x => x.copy?.status === "copying" && Date.now() - new Date(x.copy.at).getTime() < 10 * 60_000);
  useEffect(() => {
    if (!copying) return;
    const t = setInterval(onChanged, 4000);
    return () => clearInterval(t);
  }, [copying, onChanged]);
  if (!subs.length) return null;

  async function retryCopy(s: Submission) {
    setBusy(s.id);
    try {
      const r = await apiFetch(`${API}/bookings/${bookingId}/editor-assignments/${a.id}/submissions/${s.id}/copy`, { method: "POST" });
      if (!r.ok) { notify("Couldn't start the copy", { error: true }); return; }
      notify("Copying to the delivery folder again");
      onChanged();
    } finally { setBusy(null); }
  }

  async function review(s: Submission, status: "approved" | "revision_requested") {
    if (status === "approved") {
      const own = !!s.driveLink && /drive\.google\.com\/drive(\/u\/\d+)?\/folders\//.test(s.driveLink);
      const ok = await askConfirm({
        title: `Approve ${DELIVERABLE[s.deliverableType] ?? "this"}?`,
        message: own ? "The files will be copied to the client's delivery folder." : "Mark this work as approved.",
        confirmLabel: "Approve",
      });
      if (!ok) return;
    }
    setBusy(s.id);
    try {
      const r = await apiFetch(`${API}/bookings/${bookingId}/editor-assignments/${a.id}/submissions/${s.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, feedback: status === "revision_requested" ? feedback.trim() || undefined : undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || "Couldn't save", { error: true }); return; }
      notify(status === "approved" ? (d.copying ? "Approved — copying the files to the delivery folder" : "Approved") : "Changes asked — the editor will see your note");
      setFbFor(null); setFeedback("");
      onChanged();
    } finally { setBusy(null); }
  }

  // One card per thing the editor sent (teaser, full video…); the newest version is the one to review.
  const byType = new Map<string, Submission[]>();
  for (const x of subs) if (x.reviewStatus !== "replaced") byType.set(x.deliverableType, [...(byType.get(x.deliverableType) ?? []), x]);
  const groups = [...byType.entries()].map(([type, l]) => {
    const versions = [...l].sort((p, q) => q.submittedAt.localeCompare(p.submittedAt));
    return { type, versions, latest: versions[0] };
  }).sort((p, q) => (p.latest.reviewStatus === "pending" ? 0 : 1) - (q.latest.reviewStatus === "pending" ? 0 : 1) || q.latest.submittedAt.localeCompare(p.latest.submittedAt));
  const tone = (st: string) => st === "approved" ? "bg-[#E9F5EF] text-[#1F8A5B]" : st === "revision_requested" ? "bg-[#FDECEF] text-[#C2304F]" : "bg-[#EEE8FD] text-[#5B3FD0]";
  const label = (st: string) => st === "approved" ? "Approved" : st === "revision_requested" ? "Changes asked" : "To review";
  const linksOf = (x: Submission) => [
    x.driveLink && { href: x.driveLink, text: /folders\//.test(x.driveLink) ? "Open files" : "Drive" },
    x.deliveryLink && { href: x.deliveryLink, text: "Link" },
    x.dropboxLink && { href: x.dropboxLink, text: "Dropbox" },
    x.wetransferLink && { href: x.wetransferLink, text: "WeTransfer" },
  ].filter(Boolean) as { href: string; text: string }[];
  return (
    <div className="space-y-2 pt-1">
      {groups.map(g => {
        const s = g.latest;
        const older = g.versions.slice(1);
        return (
          <div key={g.type} className="rounded-xl bg-[#F7F5FB] px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#17151F] flex-1 min-w-0 truncate">
                {DELIVERABLE[g.type] ?? g.type} · v{g.versions.length}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone(s.reviewStatus)}`}>{label(s.reviewStatus)}</span>
            </div>
            <p className="text-[11px] text-[#6B6680]">Sent {new Date(s.submittedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            {(s.revisionNotes || s.notes) && <p className="text-[12px] text-[#4A4658] whitespace-pre-line">{[s.revisionNotes, s.notes].filter(Boolean).join("\n")}</p>}
            {s.reviewFeedback && <p className="text-[12px] text-[#C2304F]">Your note: {s.reviewFeedback}</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              {linksOf(s).map(l => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="h-8 px-3 rounded-full bg-white text-[12px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
                  <ExternalLink className="w-3 h-3" />{l.text}
                </a>
              ))}
              {s.reviewStatus === "pending" && (
                <>
                  <span className="flex-1" />
                  <button type="button" disabled={busy === s.id} onClick={() => { setFbFor(fbFor === s.id ? null : s.id); setFeedback(""); }}
                    className="h-8 px-3 rounded-full text-[12px] font-semibold text-[#C2304F] hover:bg-[#FDECEF]">Ask for changes</button>
                  <button type="button" disabled={busy === s.id} onClick={() => review(s, "approved")}
                    className="h-8 px-3.5 rounded-full bg-[#17151F] text-white text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-60">
                    {busy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}Approve
                  </button>
                </>
              )}
            </div>
            {s.reviewStatus === "approved" && s.copy && s.copy.status !== "skipped" && (() => {
              const c = s.copy;
              const stale = c.status === "copying" && Date.now() - new Date(c.at).getTime() > 10 * 60_000;
              if (c.status === "done") return <p className="text-[12px] font-semibold text-[#1F8A5B]">✓ In the client&apos;s delivery folder ({c.total ?? 0} file{c.total === 1 ? "" : "s"})</p>;
              if (c.status === "copying" && !stale) return (
                <div className="space-y-1">
                  <p className="text-[12px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Copying to delivery… {c.done ?? 0}/{c.total || "?"}</p>
                  {!!c.total && <div className="h-1.5 rounded-full bg-[#E4DCFB] overflow-hidden"><div className="h-full bg-[#7D5CEF] rounded-full transition-all" style={{ width: `${Math.round(((c.done ?? 0) / c.total) * 100)}%` }} /></div>}
                </div>
              );
              return (
                <div className="flex items-center gap-2">
                  <p className="text-[12px] text-[#C2304F] flex-1">Couldn&apos;t copy to the delivery folder{c.error ? ` — ${c.error}` : ""}.</p>
                  <button type="button" disabled={busy === s.id} onClick={() => retryCopy(s)} className="h-8 px-3 rounded-full bg-white text-[12px] font-semibold text-[#5B3FD0] shadow-[0_1px_2px_rgba(22,18,40,.06)]">Try again</button>
                </div>
              );
            })()}
            {fbFor === s.id && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <textarea autoFocus value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
                  placeholder="What should the editor change?"
                  className="w-full px-3 py-2 rounded-xl bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setFbFor(null)} className="h-8 px-3 rounded-full text-[12px] font-semibold text-[#4A4658]">Cancel</button>
                  <button type="button" disabled={!feedback.trim() || busy === s.id} onClick={() => review(s, "revision_requested")}
                    className="h-8 px-3.5 rounded-full bg-[#C2304F] text-white text-[12px] font-semibold disabled:opacity-50">Send to editor</button>
                </div>
              </div>
            )}
            {older.length > 0 && (
              <div>
                <button type="button" onClick={() => setShowAll(v => !v)} className="text-[12px] font-semibold text-[#5B3FD0]">
                  {showAll ? "Hide earlier versions" : `Earlier versions (${older.length})`}
                </button>
                {showAll && older.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2 text-[12px] text-[#6B6680] mt-1">
                    <b className="text-[#4A4658]">v{older.length - i}</b>
                    <span>{label(o.reviewStatus)}</span>
                    {linksOf(o).map(l => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#5B3FD0]">{l.text}</a>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EditorsSection({ booking, teamMembers, onSaved }: { booking: Booking; teamMembers: { id: string; memberId: string; firstName: string; lastName?: string; memberRoles: string[] }[]; onSaved: () => void }) {
  const [assignments, setAssignments] = useState<EditorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ userId: string; role: "photo_editor" | "video_editor"; editingDeadline?: string; deliveryDeadline?: string; studioNote?: string; deliverables?: string[] }[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  function reload(silent = false) {
    if (!silent) setLoading(true);
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
          deliverables: a.progress?.plan ?? [],
        })));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [booking.id]);

  const editorMembers = teamMembers.filter(m => m.memberRoles.includes("photo_editor") || m.memberRoles.includes("video_editor"));

  const silentReload = useCallback(() => reload(true), [booking.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleEditor(userId: string, role: "photo_editor" | "video_editor") {
    setDraft(prev => {
      const exists = prev.find(e => e.userId === userId && e.role === role);
      return exists ? prev.filter(e => !(e.userId === userId && e.role === role))
        : [...prev, { userId, role, editingDeadline: "", deliveryDeadline: "", studioNote: "", deliverables: role === "video_editor" ? ["teaser", "highlight_video"] : ["photo_delivery"] }];
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
    <div className="rounded-2xl border border-[#E6E2EE] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Tile icon={Clapperboard} color="violet" size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#17151F]">Editors</p>
          <p className="text-[12.5px] text-[#6B6680] truncate">{loading ? "…" : assignments.length ? `${assignments.length} assigned` : "Nobody assigned yet"}</p>
        </div>
        <button type="button" onClick={() => setEditing(!editing)} className="h-9 px-3.5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[13px] font-semibold text-[#17151F] flex-shrink-0">{editing ? "Cancel" : "Assign"}</button>
      </div>

      {editing ? (
        <div className="p-3 pt-0 space-y-4">
          {editorMembers.length === 0 ? (
            <p className="text-xs text-[#8A8599] text-center">No members with editor roles found</p>
          ) : (
            <div className="space-y-4">
              {editorMembers.map(m => (
                <div key={m.id} className="rounded-xl border border-[#F1EFF6] p-3 space-y-2">
                  <p className="text-sm font-semibold text-[#33303F]">{m.firstName} {m.lastName ?? ""}</p>
                  <div className="flex gap-2 flex-wrap">
                    {m.memberRoles.includes("photo_editor") && (
                      <button onClick={() => toggleEditor(m.id, "photo_editor")}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${draft.find(e => e.userId === m.id && e.role === "photo_editor") ? "bg-[#7D5CEF] text-white border-[#7D5CEF]" : "border-[#E4E0EC] text-[#4A4658] hover:border-indigo-300"}`}>
                        Photo Editor
                      </button>
                    )}
                    {m.memberRoles.includes("video_editor") && (
                      <button onClick={() => toggleEditor(m.id, "video_editor")}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${draft.find(e => e.userId === m.id && e.role === "video_editor") ? "bg-[#7D5CEF] text-white border-[#7D5CEF]" : "border-[#E4E0EC] text-[#4A4658] hover:border-purple-300"}`}>
                        Video Editor
                      </button>
                    )}
                  </div>
                  {draft.filter(e => e.userId === m.id).map(e => (
                    <div key={e.role} className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-[#8A8599] mb-0.5">Editing Deadline</p>
                          <input type="date" value={e.editingDeadline ?? ""}
                            onChange={ev => updateDraftField(m.id, e.role, "editingDeadline", ev.target.value)}
                            className="w-full h-9 px-2.5 rounded-[10px] bg-[#F5F3FA] text-[13px] text-[#17151F] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF]" />
                        </div>
                        <div>
                          <p className="text-xs text-[#8A8599] mb-0.5">Delivery Deadline</p>
                          <input type="date" value={e.deliveryDeadline ?? ""}
                            onChange={ev => updateDraftField(m.id, e.role, "deliveryDeadline", ev.target.value)}
                            className="w-full h-9 px-2.5 rounded-[10px] bg-[#F5F3FA] text-[13px] text-[#17151F] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#8A8599] mb-1">What to deliver <span className="text-[#B5B0C4]">— the client hears once, when all of it is done</span></p>
                        <div className="flex flex-wrap gap-1.5">
                          {PLAN_TYPES[e.role].map(t => {
                            const on = (e.deliverables ?? []).includes(t);
                            return (
                              <button key={t} type="button"
                                onClick={() => setDraft(prev => prev.map(x => x.userId === m.id && x.role === e.role
                                  ? { ...x, deliverables: on ? (x.deliverables ?? []).filter(y => y !== t) : [...(x.deliverables ?? []), t] } : x))}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${on ? "bg-[#17151F] text-white border-[#17151F]" : "border-[#E6E2EE] text-[#4A4658] hover:border-[#CFC8DD]"}`}>
                                {on && "✓ "}{DELIVERABLE[t] ?? t}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#8A8599] mb-0.5">Studio Note</p>
                        <input value={e.studioNote ?? ""} onChange={ev => updateDraftField(m.id, e.role, "studioNote", ev.target.value)}
                          placeholder="Instructions for this editor..."
                          className="w-full h-9 px-2.5 rounded-[10px] bg-[#F5F3FA] text-[13px] text-[#17151F] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF]" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <button onClick={save} disabled={saving}
            className="w-full h-11 bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold rounded-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save editors
          </button>
        </div>
      ) : loading ? (
        <div className="py-4 flex justify-center border-t border-[#EEEBF4]"><Loader2 className="w-4 h-4 animate-spin text-[#8A8599]" /></div>
      ) : assignments.length > 0 ? (
        <div className="divide-y divide-[#F1EFF6] border-t border-[#EEEBF4]">
          {assignments.map(a => {
            const name = `${a.user?.firstName ?? ""} ${a.user?.lastName ?? ""}`.trim();
            const statusCfg = ASSIGNMENT_STATUS_CFG[a.status] ?? { label: a.status, cls: "bg-[#F1EFF6] text-[#4A4658]" };
            return (
              <div key={a.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#17151F]">{name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === "photo_editor" ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-[#EEE8FD] text-[#5B3FD0]"}`}>
                    {a.role === "photo_editor" ? "Photo Editor" : "Video Editor"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.cls}`}>{statusCfg.label}</span>
                  {a.editingDeadline && <span className="text-xs text-[#8A8599]">Edit by {fmtDate(a.editingDeadline)}</span>}
                  {a.deliveryDeadline && <span className="text-xs text-[#8A8599]">Deliver by {fmtDate(a.deliveryDeadline)}</span>}
                </div>
                {a.progress && (a.progress.plan.length > 0 || a.progress.done > 0) && (
                  <div className="rounded-xl bg-[#F7F5FB] px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[#17151F] flex-1">
                        {a.status === "delivered" ? "✓ Editing complete" : `${a.progress.done} of ${a.progress.total} done`}
                      </span>
                      {a.status !== "delivered" && a.progress.canComplete && (
                        <button type="button" disabled={completing === a.id}
                          onClick={async () => {
                            const ok = await askConfirm({
                              title: "Mark editing complete?",
                              message: "When every editor of this program is complete, the program becomes Ready and the client gets one email with everything that is ready.",
                              confirmLabel: "Mark complete",
                            });
                            if (!ok) return;
                            setCompleting(a.id);
                            try {
                              const r = await apiFetch(`${API}/bookings/${booking.id}/editor-assignments/${a.id}/complete`, { method: "POST" });
                              const d = await r.json().catch(() => ({}));
                              if (!r.ok) { notify(d?.message || "Couldn't mark complete", { error: true }); return; }
                              notify(d.programReady ? "Done — the program is Ready and the client was told" : `Done — waiting on ${d.waitingOn} more editor${d.waitingOn > 1 ? "s" : ""}`);
                              silentReload(); onSaved();
                            } finally { setCompleting(null); }
                          }}
                          className="h-8 px-3 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                          {completing === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Mark complete
                        </button>
                      )}
                    </div>
                    {a.progress.plan.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {a.progress.plan.map(t => {
                          const ok = a.progress!.approved.includes(t);
                          return (
                            <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${ok ? "bg-[#E6F4EC] text-[#1F8A5B]" : "bg-white text-[#6B6680] border border-[#E6E2EE]"}`}>
                              {ok ? "✓ " : ""}{DELIVERABLE[t] ?? t}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <Submissions bookingId={booking.id} a={a} onChanged={silentReload} onDelivered={onSaved} />
                {a.studioNote && <p className="text-xs text-[#4A4658] bg-[#F7F5FB] rounded-lg px-2 py-1">{a.studioNote}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-3 text-center bg-white">
          <p className="text-xs text-[#8A8599]">No editors assigned — click Assign</p>
        </div>
      )}
    </div>
  );
}

export const ROLE_LABEL: Record<string, string> = {
  photographer: "Photographer", cinematographer: "Cinematographer", drone_pilot: "Drone", assistant: "Assistant",
  photo_editor: "Photo editor", video_editor: "Video editor",
};
export const SETUP_LABEL: Record<string, string> = { own: "Own setup", other: "Others' gear", rented: "Rented gear" };

/** Team-only notes on a program. Saves a second after you stop typing (and when you leave the box). */
export function PrivateNotes({ booking, onSaved }: { booking: Booking; onSaved: (notes: string) => void }) {
  const [value, setValue] = useState(booking.internalNotes ?? "");
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const saved = useRef(booking.internalNotes ?? "");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Notes changed somewhere else (the edit form) while nothing is waiting to be saved here.
  useEffect(() => {
    const incoming = booking.internalNotes ?? "";
    if (pending.current === null && incoming !== saved.current) { saved.current = incoming; setValue(incoming); }
  }, [booking.internalNotes]);

  const id = booking.id;
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; });

  const save = useCallback(async (v: string) => {
    clearTimeout(timer.current);
    pending.current = null;
    if (v === saved.current) return;
    setState("saving");
    try {
      const r = await apiFetch(`${API}/bookings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ internalNotes: v }),
      });
      if (!r.ok) throw new Error();
      saved.current = v; onSavedRef.current(v); setState("saved");
    } catch { pending.current = v; setState("error"); }
  }, [id]);

  // Closing the drawer right after typing still saves.
  useEffect(() => () => { if (pending.current !== null) void save(pending.current); }, [save]);

  function change(v: string) {
    setValue(v); setState(""); pending.current = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 1000);
  }

  return (
    <Group title="Private notes" note="Only your team sees these — never the client."
      action={state === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B6680]" aria-label="Saving" />
        : state === "saved" ? <span className="text-xs font-semibold text-[#1F8A5B]">Saved</span>
        : state === "error" ? <button type="button" onClick={() => save(value)} className="text-xs font-semibold text-[#C2304F]">Not saved — try again</button>
        : undefined}>
      <div className="p-3">
        <textarea value={value} onChange={e => change(e.target.value)} onBlur={() => { if (pending.current !== null) void save(pending.current); }}
          rows={3} maxLength={5000} aria-label="Private notes"
          placeholder="Anything the team should remember — gate pass, parking, special requests…"
          className={cn(inputCls, "h-auto py-2.5 resize-y min-h-[84px] leading-relaxed")} />
      </div>
    </Group>
  );
}
