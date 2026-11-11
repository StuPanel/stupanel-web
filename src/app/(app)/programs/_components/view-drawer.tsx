"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Edit3, DollarSign, MessageCircle, FileText,
  Loader2, MapPin, TrendingUp, HardDrive, Link2, Cloud,
  ExternalLink, Calendar, Users, Check,
  Clapperboard, Palette, Camera, Wallet,
} from "lucide-react";
import { askConfirm, notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { useRouter } from "next/navigation";
import { STATUS_CFG, fmtDate } from "./constants";
import { formatCurrency } from "@/lib/format";
import { StatusPipeline } from "./program-card";
import { PaymentModal } from "./payment-modal";
import { TeamPaySection } from "./team-pay-section";
import { InvoiceCard } from "./invoice-card";
import { WhatsAppModal } from "./whatsapp-modal";
import { DeliveryModal } from "../../delivery/_components/delivery-modal";
import { RawDriveSection } from "./raw-drive-section";
import { MusicSection } from "./music-section";
import { ContractCard } from "./contract-card";
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
      <div className="rounded-xl border border-dashed border-[#E4E0EC] px-4 py-3 text-center">
        <p className="text-xs text-[#8A8599]">No delivery set yet</p>
      </div>
    );
  }

  const methodMeta = {
    drive_auto: { icon: <HardDrive className="w-4 h-4 text-[#1F8A5B]" />, label: "Drive Auto", color: "text-[#1F8A5B]" },
    drive_link: { icon: <Link2 className="w-4 h-4 text-[#7D5CEF]" />, label: "Drive Link", color: "text-[#5B3FD0]" },
    r2: { icon: <Cloud className="w-4 h-4 text-[#1F5C99]" />, label: "R2 Cloud", color: "text-[#1F5C99]" },
  }[method] ?? { icon: <HardDrive className="w-4 h-4 text-[#6B6680]" />, label: method, color: "text-[#4A4658]" };

  return (
    <div className="rounded-xl border border-[#E4E0EC] bg-[#F7F5FB] overflow-hidden">
      {/* Method header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E4E0EC] bg-white">
        <div className="flex items-center gap-2">
          {methodMeta.icon}
          <span className={`text-xs font-semibold ${methodMeta.color}`}>{methodMeta.label}</span>
        </div>
        {method === "drive_auto" && booking.driveFolderUrl && (
          <a href={booking.driveFolderUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#7D5CEF] hover:text-[#5B3FD0]">
            <ExternalLink className="w-3 h-3" /> Open Folder
          </a>
        )}
        {method === "drive_link" && (booking.deliveryLink || linksCount > 0) && (
          <a href={booking.deliveryLink ?? "#"} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#7D5CEF] hover:text-[#5B3FD0]">
            <ExternalLink className="w-3 h-3" /> Open
          </a>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-[#E4E0EC]">
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-base font-bold text-[#17151F]">
            {method === "r2" ? (r2FileCount ?? "—") : (method === "drive_auto" ? "✓" : linksCount)}
          </span>
          <span className="text-xs text-[#8A8599]">
            {method === "r2" ? "Files" : method === "drive_auto" ? "Folder" : "Links"}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-base font-bold text-[#17151F]">{linksCount}</span>
          <span className="text-xs text-[#8A8599]">Links</span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5 px-1">
          <span className="text-xs font-semibold text-[#33303F] text-center leading-tight">
            {booking.deliveryDate ? fmtDate(booking.deliveryDate) : "—"}
          </span>
          <span className="text-xs text-[#8A8599]">Date</span>
        </div>
      </div>
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
    <div className="rounded-xl border border-[#E4E0EC] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#F7F5FB] border-b border-[#E4E0EC]">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-[#6B6680]" />
          <span className="text-xs font-semibold text-[#4A4658]">Creative Brief</span>
          {hasInfo && <span className="text-xs bg-[#EEE8FD] text-[#5B3FD0] px-1.5 py-0.5 rounded-full font-medium">Set</span>}
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-[#7D5CEF] hover:text-[#5B3FD0]">{editing ? "Cancel" : "Edit"}</button>
      </div>

      {editing ? (
        <div className="p-4 space-y-3 bg-white">
          {[
            { key: "videoStyle", label: "Video Style", placeholder: "Cinematic, emotional storytelling..." },
            { key: "photoStyle", label: "Photo Style", placeholder: "Light & airy, natural tones..." },
            { key: "colorStyle", label: "Color Grade", placeholder: "Warm tones, filmic look..." },
            { key: "musicInfo", label: "Music", placeholder: "e.g. Soft instrumental, upbeat for the reel" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-xs text-[#6B6680] mb-1">{label}</p>
              <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className="w-full text-sm border border-[#E4E0EC] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]" />
            </div>
          ))}
          <div>
            <p className="text-xs text-[#6B6680] mb-1">Special Instructions</p>
            <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
              placeholder="Highlight the first dance, include all family moments..." rows={3}
              className="w-full text-sm border border-[#E4E0EC] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7D5CEF] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#6B6680] mb-1">Editing Deadline</p>
              <input type="date" value={form.editingDeadline} onChange={e => setForm(f => ({ ...f, editingDeadline: e.target.value }))}
                className="w-full text-sm border border-[#E4E0EC] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]" />
            </div>
            <div>
              <p className="text-xs text-[#6B6680] mb-1">Delivery Deadline</p>
              <input type="date" value={form.deliveryDeadline} onChange={e => setForm(f => ({ ...f, deliveryDeadline: e.target.value }))}
                className="w-full text-sm border border-[#E4E0EC] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]" />
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full py-2 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Creative Brief
          </button>
        </div>
      ) : hasInfo ? (
        <div className="p-4 space-y-2 bg-white">
          {brief.videoStyle && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Video Style</span><span className="text-[#17151F]">{brief.videoStyle}</span></div>}
          {brief.photoStyle && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Photo Style</span><span className="text-[#17151F]">{brief.photoStyle}</span></div>}
          {brief.colorStyle && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Color Grade</span><span className="text-[#17151F]">{brief.colorStyle}</span></div>}
          {brief.musicInfo && <div className="flex gap-2 text-sm"><span className="text-[#8A8599] shrink-0 w-24">Music</span><span className="text-[#17151F]">{brief.musicInfo}</span></div>}
          {brief.specialInstructions && <p className="text-xs text-[#4A4658] bg-[#F7F4FE] rounded-lg px-3 py-2 mt-1">{brief.specialInstructions}</p>}
          {(brief.editingDeadline || brief.deliveryDeadline) && (
            <div className="flex gap-4 text-xs text-[#6B6680] pt-1">
              {brief.editingDeadline && <span>✏️ Editing by {brief.editingDeadline}</span>}
              {brief.deliveryDeadline && <span>📦 Delivery by {brief.deliveryDeadline}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 text-center bg-white">
          <p className="text-xs text-[#8A8599]">No creative brief yet — click Edit to add</p>
        </div>
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

function EditorsSection({ booking, teamMembers, onSaved }: { booking: Booking; teamMembers: { id: string; memberId: string; firstName: string; lastName?: string; memberRoles: string[] }[]; onSaved: () => void }) {
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
    <div className="rounded-xl border border-[#E4E0EC] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#F7F5FB] border-b border-[#E4E0EC]">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-3.5 h-3.5 text-[#6B6680]" />
          <span className="text-xs font-semibold text-[#4A4658]">Editor Assignments</span>
          {!loading && assignments.length > 0 && <span className="text-xs bg-[#EEE8FD] text-[#5B3FD0] px-1.5 py-0.5 rounded-full font-medium">{assignments.length}</span>}
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-[#7D5CEF] hover:text-[#5B3FD0]">{editing ? "Cancel" : "Assign"}</button>
      </div>

      {editing ? (
        <div className="p-4 space-y-4 bg-white">
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
                            className="w-full text-xs border border-[#E4E0EC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]" />
                        </div>
                        <div>
                          <p className="text-xs text-[#8A8599] mb-0.5">Delivery Deadline</p>
                          <input type="date" value={e.deliveryDeadline ?? ""}
                            onChange={ev => updateDraftField(m.id, e.role, "deliveryDeadline", ev.target.value)}
                            className="w-full text-xs border border-[#E4E0EC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]" />
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
                          className="w-full text-xs border border-[#E4E0EC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <button onClick={save} disabled={saving}
            className="w-full py-2 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Assignments
          </button>
        </div>
      ) : loading ? (
        <div className="py-4 flex justify-center bg-white"><Loader2 className="w-4 h-4 animate-spin text-[#8A8599]" /></div>
      ) : assignments.length > 0 ? (
        <div className="divide-y divide-[#F1EFF6] bg-white">
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
                  {a.editingDeadline && <span className="text-xs text-[#8A8599]">✏️ {fmtDate(a.editingDeadline)}</span>}
                  {a.deliveryDeadline && <span className="text-xs text-[#8A8599]">📦 {fmtDate(a.deliveryDeadline)}</span>}
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
  const [musicOn, setMusicOn] = useState(false);
  const router = useRouter();

  useEffect(() => { setLocalBooking(booking); }, [booking]);
  useEffect(() => {
    if (!booking) return;
    apiFetch(`${API}/companies/settings`).then(r => r.ok ? r.json() : null)
      .then(d => { if (!d) return; setMusicOn(!!d.features?.musicSelection); setTypeNames(Object.fromEntries((d.workTypes ?? []).map((w: { id: string; name: string }) => [w.id, w.name]))); })
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
      if (r.ok && d.publicToken) window.open(`/inv/${d.publicToken}`, "_blank");
      else if (!r.ok) router.push("/invoices");
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

        <InvoiceCard bookingId={b.id} version={`${b.status}|${b.paidAmount}|${b.grandTotal}|${(b.eventDays ?? []).map(d => d.date).join(",")}`} />

        <ContractCard key={b.id} bookingId={b.id} />

        <div className="mb-7"><TeamPaySection booking={b} onSaved={refreshBooking} /></div>

        <section className="mb-7 space-y-3">
          <h2 className="px-1 text-[13px] font-bold text-[#4A4658]">Editing & files</h2>
          <div className={cn("bg-white rounded-[20px] p-3 space-y-3", CARD_SHADOW)}>
            <EditorsSection booking={b} teamMembers={teamMembers ?? []} onSaved={refreshBooking} />
            <RawDriveSection booking={b} teamMembers={teamMembers ?? []} />
            {musicOn && <MusicSection booking={b} />}
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
