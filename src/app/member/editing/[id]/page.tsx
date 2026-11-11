"use client";

/**
 * Member panel: one piece of editing work, laid out like the studio's program page —
 * what it is and where it stands on the left, tabs for the rest on the right.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, FolderOpen, HardDrive, Image as ImageIcon, Link2, Loader2,
  MessageCircle, Palette, Play, Send, Upload, Video, VideoOff,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { Tile } from "@/components/ui/apple";
import { CHIP, Chip, Empty, List, ProfileSkeleton, QuickAction, Row, Section, TabBar, card, linkBtn, softBtn, revealPanel, useTab } from "@/components/ui/profile-page";
import { daysUntil } from "../../_components/kit";
import { EditorRawAccess } from "../../_components/raw-upload";
import { EditorMusic } from "./editor-music";
import { MyCosts } from "../../_components/costs";
import { SubmitWorkDrawer } from "./submit-drawer";

type Workspace = {
  progress?: { plan: string[]; approved: string[]; missing: string[]; total: number; done: number; canComplete: boolean };
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

type Tone = keyof typeof CHIP;
const STATUS: Record<string, { label: string; tone: Tone; hint: string; next?: string; nextLabel?: string }> = {
  assigned:           { label: "Assigned",      tone: "grey",   hint: "Press Start editing when you begin, so the studio knows.", next: "in_progress", nextLabel: "Start editing" },
  in_progress:        { label: "In progress",   tone: "blue",   hint: "Send your work when it is ready for the studio to check." },
  submitted:          { label: "Submitted",     tone: "orchid", hint: "The studio is checking your work." },
  under_review:       { label: "Under review",  tone: "orchid", hint: "The studio is checking your work." },
  revision_requested: { label: "Changes asked", tone: "red",    hint: "The studio asked for changes. Fix them and send a new version.", next: "in_progress", nextLabel: "Start the changes" },
  resubmitted:        { label: "Sent again",    tone: "orchid", hint: "The studio is checking your new version." },
  approved:           { label: "Approved",      tone: "green",  hint: "The studio approved your work.", next: "delivered", nextLabel: "Mark as delivered" },
  delivered:          { label: "Delivered",     tone: "green",  hint: "All done — thank you." },
};

const SUB_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending:            { label: "Waiting for review", tone: "violet" },
  approved:           { label: "Approved",           tone: "green" },
  revision_requested: { label: "Changes asked",      tone: "red" },
  replaced:           { label: "Replaced",           tone: "grey" },
};

const DELIVERABLE: Record<string, string> = {
  highlight_video: "Highlight Video", full_video: "Full Video", teaser: "Teaser", reel: "Reel",
  photo_delivery: "Photo Delivery", album: "Album", other: "Other",
};
const typeLabel = (t: string) => DELIVERABLE[t] ?? t.replace(/_/g, " ");

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

const TABS = ["work", "brief", "raw", "notes"] as const;
type Tab = (typeof TABS)[number];
const LABEL = "text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]";

export default function EditorWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const [tab, setTab] = useTab<Tab>(`/member/editing/${id}`, TABS, sp.get("tab"));
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [hasMusic, setHasMusic] = useState<boolean | null>(null);
  const [rawShown, setRawShown] = useState<boolean | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const panels = useRef<HTMLDivElement>(null);
  // From a button in the summary: switch the tab and bring it into view (phones).
  const go = (t: Tab) => { setTab(t); revealPanel(panels.current); };

  function reload() {
    apiFetch(`${API}/member/editing/${id}/workspace`)
      .then(r => r.ok ? r.json() : r.json().catch(() => ({})).then((e: any) => Promise.reject(e?.message || "Editing work not found")))
      .then(d => { setWs(d); setError(""); })
      .catch(e => setError(String(e)));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [id]);

  // Keep the newest note in view (also when the Notes tab is opened — hidden boxes can't scroll).
  useEffect(() => {
    if (tab === "notes" && chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [ws?.chat, tab]);

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    try {
      const r = await apiFetch(`${API}/member/editing/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); notify(d?.message || "Couldn't change the status", { error: true }); return; }
      reload();
    } catch { notify("Couldn't change the status", { error: true }); }
    finally { setUpdatingStatus(false); }
  }

  async function complete() {
    setCompleting(true);
    try {
      const r = await apiFetch(`${API}/member/editing/${id}/complete`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || "Couldn't mark complete", { error: true }); return; }
      notify("Marked complete — thank you!");
      reload();
    } catch { notify("Couldn't mark complete", { error: true }); }
    finally { setCompleting(false); }
  }

  async function sendChat() {
    if (!chatMsg.trim() || !ws || sendingChat) return;
    setSendingChat(true);
    try {
      const r = await apiFetch(`${API}/member/chat/${ws.assignment.booking.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chatMsg.trim() }),
      });
      if (!r.ok) { notify("Couldn't send the note", { error: true }); return; }
      setChatMsg("");
      reload();
    } catch { notify("Couldn't send the note", { error: true }); }
    finally { setSendingChat(false); }
  }

  if (error && !ws) return (
    <div className="max-w-md mx-auto pt-16">
      <Empty icon={VideoOff} title="Editing work not found" text="It may have been removed, or it isn't yours.">
        <Link href="/member/editing" className={softBtn}><ArrowLeft className="w-4 h-4" />All editing</Link>
      </Empty>
    </div>
  );
  if (!ws) return <ProfileSkeleton label="Loading editing work" />;

  const { assignment, submissions, chat } = ws;
  const booking = assignment.booking;
  const st = STATUS[assignment.status] ?? { label: assignment.status.replace(/_/g, " "), tone: "grey" as Tone, hint: "" };
  const isPhoto = assignment.role === "photo_editor";
  const brief = booking.creativeBrief ?? {};
  const rawFiles = booking.rawFilesInfo ?? {};
  const briefRows = [
    ["Video style", brief.videoStyle], ["Photo style", brief.photoStyle], ["Color grade", brief.colorStyle], ["Music", brief.musicInfo],
    ["Editing by", brief.editingDeadline], ["Delivery by", brief.deliveryDeadline],
  ].filter(r => r[1]) as [string, string][];
  const hasBrief = briefRows.length > 0 || !!brief.specialInstructions;
  const hasRawInfo = !!(rawFiles.folderName || rawFiles.folderPath || (rawFiles.driveLink && !rawFiles.drive) || rawFiles.dropboxLink || rawFiles.nasLocation || rawFiles.notes);
  const firstDay = [...(booking.eventDays ?? [])].filter(d => d.date).sort((a, b) => a.date!.localeCompare(b.date!))[0];

  // Several things can be sent for one program (teaser, full video, reel…), each reviewed on its own.
  const done = assignment.status === "delivered";
  const byType = new Map<string, typeof submissions>();
  for (const s of submissions) if (s.reviewStatus !== "replaced") byType.set(s.deliverableType, [...(byType.get(s.deliverableType) ?? []), s]);
  const groups = [...byType.entries()].map(([type, list]) => {
    const sorted = [...list].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { type, latest: sorted[0], versions: sorted };
  }).sort((a, b) => b.latest.submittedAt.localeCompare(a.latest.submittedAt));
  const toFix = groups.filter(g => g.latest.reviewStatus === "revision_requested");
  const isRevision = toFix.length > 0;
  const sendLabel = isRevision ? "Send the changes" : submissions.length ? "Send more work" : "Submit work";
  const prog = ws.progress;
  const showProg = !!prog && (prog.plan.length > 0 || prog.done > 0);
  const canComplete = !done && !!prog?.canComplete;
  const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  const deadlines = [
    { label: "Editing by", date: assignment.editingDeadline },
    { label: "Delivery by", date: assignment.deliveryDeadline },
  ].filter(d => d.date) as { label: string; date: string }[];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "work", label: "My work", count: groups.length },
    { id: "brief", label: "Brief" },
    { id: "raw", label: "Raw files" },
    { id: "notes", label: "Notes", count: chat.length },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/member/editing" className="h-9 pl-2.5 pr-3.5 rounded-full bg-white hover:bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <ArrowLeft className="w-4 h-4" />Editing
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        {/* ── Left: what it is + where it stands ─────────────────────────── */}
        <aside className="lg:sticky lg:top-6 space-y-4 mb-4 lg:mb-0">
          <div className={cn(card, "p-5")}>
            <div className="flex items-center gap-4 lg:flex-col lg:text-center lg:gap-3">
              <Tile icon={isPhoto ? ImageIcon : Video} color={isPhoto ? "deep" : "orchid"} size={64} className="rounded-[20px]" />
              <div className="flex-1 min-w-0 lg:flex-none lg:w-full">
                <h1 className="text-[21px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight break-words">{booking.eventName || booking.bookingNumber}</h1>
                <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">
                  {isPhoto ? "Photo editing" : "Video editing"}{firstDay ? ` · ${fmtDate(firstDay.date)}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2 lg:justify-center">
                  <Chip tone={st.tone}>{st.label}</Chip>
                  <span className="h-6 px-2 rounded-full text-[12px] font-mono text-[#6B6680] inline-flex items-center">{booking.bookingNumber}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-5">
              <QuickAction icon={Upload} label="Send work" tone="bg-[#EEE8FD] text-[#5B3FD0]" onClick={() => setShowSubmitForm(true)} disabled={done} />
              <QuickAction icon={HardDrive} label="Raw files" tone="bg-[#E7F5EE] text-[#1F8A5B]" onClick={() => go("raw")} />
              <QuickAction icon={MessageCircle} label="Notes" tone="bg-[#F1EFF6] text-[#17151F]" onClick={() => go("notes")} />
            </div>
          </div>

          {/* Status */}
          <div className={cn(card, "p-5")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className={LABEL}>Status</p>
              {showProg && prog!.total > 0 && <p className="text-[12.5px] text-[#6B6680]">{prog!.done} of {prog!.total} approved</p>}
            </div>
            <p className={cn("text-[22px] font-extrabold tracking-[-0.02em] leading-tight mt-0.5", st.tone === "red" ? "text-[#C2304F]" : "text-[#17151F]")}>{st.label}</p>
            {st.hint && <p className="text-[13px] text-[#6B6680] mt-1">{st.hint}</p>}
            {showProg && prog!.total > 0 && (
              <div className="mt-3 h-2 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-label="Approved so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[#1F8A5B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
            {showProg && prog!.plan.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {prog!.plan.map(t => {
                  const ok = prog!.approved.includes(t);
                  return (
                    <span key={t} className={cn("h-6 px-2.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1", ok ? "bg-[#E7F5EE] text-[#14613F]" : "bg-[#F1EFF6] text-[#4A4658]")}>
                      {ok && <CheckCircle2 className="w-3 h-3" />}{typeLabel(t)}
                    </span>
                  );
                })}
              </div>
            )}
            {(canComplete || st.next || !done) && (
              <div className="mt-4 space-y-2">
                {canComplete ? (
                  <button type="button" disabled={completing} onClick={complete}
                    className="w-full h-11 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Editing complete
                  </button>
                ) : st.next && (
                  <button type="button" disabled={updatingStatus} onClick={() => updateStatus(st.next!)}
                    className="w-full h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                    {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : st.next === "delivered" ? <CheckCircle2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}{st.nextLabel}
                  </button>
                )}
                {!done && (
                  <button type="button" onClick={() => setShowSubmitForm(true)}
                    className="w-full h-11 rounded-full bg-[#17151F] hover:bg-black text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />{sendLabel}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Deadlines */}
          {deadlines.length > 0 && (
            <div className={cn(card, "p-5")}>
              <p className={LABEL}>Deadlines</p>
              <div className="mt-2 divide-y divide-[#EEEBF4]">
                {deadlines.map(d => {
                  const n = daysUntil(d.date);
                  const hint = done || n === null ? null
                    : n < 0 ? { text: `${-n} day${n === -1 ? "" : "s"} late`, tone: "red" as Tone }
                    : n === 0 ? { text: "Today", tone: "amber" as Tone }
                    : { text: `${n} day${n === 1 ? "" : "s"} left`, tone: (n <= 3 ? "amber" : "grey") as Tone };
                  return (
                    <div key={d.label} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-[#6B6680]">{d.label}</p>
                        <p className="text-[15px] font-bold text-[#17151F]">{fmtDate(d.date)}</p>
                      </div>
                      {hint && <Chip tone={hint.tone}>{hint.text}</Chip>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* ── Right: tabs ────────────────────────────────────────────────── */}
        <div ref={panels} className="min-w-0 scroll-mt-20">
          <TabBar tabs={tabs} value={tab} onChange={setTab} label="Editing work sections" />

          {/* Panels stay mounted so switching is instant and nothing typed is lost. */}
          <div role="tabpanel" hidden={tab !== "work"}>
            {toFix.length > 0 && (
              <Section title="Changes the studio asked for">
                <div className={cn(card, "p-4 space-y-2")}>
                  {toFix.map(g => (
                    <div key={g.type} className="rounded-[14px] bg-[#FDECEF] px-4 py-3" role="status">
                      <p className="text-[13.5px] font-bold text-[#9C2340]">{typeLabel(g.type)}</p>
                      <p className="text-[13px] text-[#9C2340] mt-0.5 whitespace-pre-wrap break-words">{g.latest.reviewFeedback || "The studio asked for changes."}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {assignment.studioNote && (
              <Section title="Note from the studio">
                <div className={cn(card, "p-4 text-[14px] text-[#17151F] whitespace-pre-wrap break-words")}>{assignment.studioNote}</div>
              </Section>
            )}

            <Section title="Work I've sent"
              action={!done && groups.length > 0 ? <button type="button" onClick={() => setShowSubmitForm(true)} className={linkBtn}><Upload className="w-3.5 h-3.5" />{sendLabel}</button> : undefined}>
              {groups.length === 0 ? (
                <Empty icon={Upload} title="Nothing sent yet" text="When your edit is ready, send it here for the studio to check.">
                  {!done && <button type="button" onClick={() => setShowSubmitForm(true)} className={softBtn}><Upload className="w-4 h-4" />Submit work</button>}
                </Empty>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start [&>*]:min-w-0">
                  {groups.map(g => {
                    const ss = SUB_STATUS[g.latest.reviewStatus] ?? SUB_STATUS.pending;
                    return (
                      <div key={g.type} className={cn(card, "p-4 space-y-2")}>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-bold text-[#17151F] flex-1 truncate">{typeLabel(g.type)}</span>
                          <Chip tone={ss.tone}>{ss.label}</Chip>
                        </div>
                        {g.versions.map((s, i) => {
                          const v = g.versions.length - i;
                          const links = [
                            s.driveLink && { href: s.driveLink, text: /folders\//.test(s.driveLink) ? "Files" : "Drive" },
                            s.deliveryLink && { href: s.deliveryLink, text: "Link" },
                            s.dropboxLink && { href: s.dropboxLink, text: "Dropbox" },
                            s.wetransferLink && { href: s.wetransferLink, text: "WeTransfer" },
                          ].filter(Boolean) as { href: string; text: string }[];
                          return (
                            <div key={s.id} className={cn("rounded-[14px] px-3.5 py-2.5", i === 0 ? "bg-[#F7F5FB]" : "border border-[#EEEBF4]")}>
                              <div className="flex items-center gap-2 text-[12.5px]">
                                <b className="text-[#17151F]">Version {v}</b>
                                <span className="text-[#6B6680]">{fmtTime(s.submittedAt)}</span>
                                {i > 0 && <span className="ml-auto text-[12px] text-[#8A8599]">{(SUB_STATUS[s.reviewStatus] ?? SUB_STATUS.pending).label}</span>}
                              </div>
                              {links.length > 0 && (
                                <div className="flex gap-3 flex-wrap mt-1.5">
                                  {links.map(l => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={linkBtn}><Link2 className="w-3.5 h-3.5" />{l.text}</a>)}
                                </div>
                              )}
                              {s.reviewFeedback && <p className="text-[12.5px] text-[#9C2340] mt-1.5 break-words">Studio: {s.reviewFeedback}</p>}
                              {(s.revisionNotes || s.notes) && <p className="text-[12.5px] text-[#6B6680] mt-1.5 break-words">{[s.revisionNotes, s.notes].filter(Boolean).join(" · ")}</p>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
            <MyCosts bookingId={booking.id} title="Costs I paid for this program" />
          </div>

          <div role="tabpanel" hidden={tab !== "brief"}>
            {hasBrief && (
              <Section title="Creative brief">
                <div className={cn(card, "overflow-hidden")}>
                  {briefRows.length > 0 && (
                    <dl className="divide-y divide-[#EEEBF4]">
                      {briefRows.map(([k, v]) => (
                        <div key={k} className="flex gap-3 px-4 py-3 text-[14px]">
                          <dt className="text-[#6B6680] w-28 flex-shrink-0">{k}</dt>
                          <dd className="text-[#17151F] font-medium min-w-0 break-words">{/^\d{4}-\d{2}-\d{2}/.test(String(v)) ? fmtDate(String(v)) : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {brief.specialInstructions && (
                    <div className={cn("p-4", briefRows.length > 0 && "border-t border-[#EEEBF4]")}>
                      <p className="text-[12.5px] font-semibold text-[#4A4658] mb-1.5">Special instructions</p>
                      <p className="rounded-[14px] bg-[#F7E9F4] text-[#5E2052] px-3.5 py-2.5 text-[14px] whitespace-pre-wrap break-words">{brief.specialInstructions}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}
            <EditorMusic assignmentId={id} onLoaded={setHasMusic} />
            {!hasBrief && hasMusic === false && (
              <Empty icon={Palette} title="No brief yet" text="The studio hasn't written a brief and the client hasn't picked songs. Ask in Notes if you need direction.">
                <button type="button" onClick={() => go("notes")} className={softBtn}><MessageCircle className="w-4 h-4" />Open notes</button>
              </Empty>
            )}
          </div>

          <div role="tabpanel" hidden={tab !== "raw"}>
            <EditorRawAccess bookingId={booking.id} onShown={setRawShown} />
            {hasRawInfo && (
              <Section title="Where the raw files are kept">
                <List>
                  {(rawFiles.folderName || rawFiles.folderPath) && (
                    <Row icon={FolderOpen} color="deep" title={rawFiles.folderName || "Folder"} sub={rawFiles.folderPath || undefined} />
                  )}
                  {rawFiles.driveLink && !rawFiles.drive && <Row href={rawFiles.driveLink} external icon={Link2} color="green" title="Open Google Drive" sub={rawFiles.driveLink} />}
                  {rawFiles.dropboxLink && <Row href={rawFiles.dropboxLink} external icon={Link2} color="blue" title="Open Dropbox" sub={rawFiles.dropboxLink} />}
                  {rawFiles.nasLocation && <Row icon={HardDrive} color="ink" title="Studio storage" sub={rawFiles.nasLocation} />}
                </List>
                {(rawFiles.fileCount || rawFiles.fileSizeGb || rawFiles.notes) && (
                  <p className="text-[12.5px] text-[#6B6680] px-1 mt-2 break-words">
                    {[rawFiles.fileCount ? `${Number(rawFiles.fileCount).toLocaleString()} files` : "", rawFiles.fileSizeGb ? `${rawFiles.fileSizeGb} GB` : "", rawFiles.notes || ""].filter(Boolean).join(" · ")}
                  </p>
                )}
              </Section>
            )}
            {rawShown === false && !hasRawInfo && (
              <Empty icon={HardDrive} title="No raw files yet" text="The studio hasn't added raw files for this program yet." />
            )}
          </div>

          <div role="tabpanel" hidden={tab !== "notes"}>
            <Section title="Notes with the studio">
              <div className={cn(card, "overflow-hidden")}>
                <div ref={chatRef} className="max-h-[52vh] min-h-[180px] overflow-y-auto p-4 space-y-3">
                  {chat.length === 0 && (
                    <div className="text-center py-8">
                      <span className="w-12 h-12 rounded-full bg-[#F1EFF6] text-[#6B6680] flex items-center justify-center mx-auto"><MessageCircle className="w-5 h-5" /></span>
                      <p className="mt-3 text-[15px] font-bold text-[#17151F]">No notes yet</p>
                      <p className="mt-1 text-[13px] text-[#6B6680]">Ask the studio anything about this edit.</p>
                    </div>
                  )}
                  {chat.map(msg => (
                    <div key={msg.id} className={cn("flex flex-col gap-0.5", msg.isStudio ? "items-start" : "items-end")}>
                      <div className={cn("max-w-[80%] rounded-[18px] px-3.5 py-2 text-[14.5px] leading-relaxed break-words whitespace-pre-wrap",
                        msg.isStudio ? "bg-[#F1EFF6] text-[#17151F] rounded-bl-md" : "bg-[#7D5CEF] text-white rounded-br-md")}>
                        {msg.content}
                      </div>
                      <span className="text-[12px] text-[#8A8599]">{msg.senderName ? `${msg.senderName} · ` : ""}{fmtTime(msg.createdAt)}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-3 border-t border-[#EEEBF4] flex items-center gap-2">
                  <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} aria-label="Note to the studio"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder="Write a note to the studio…"
                    className="flex-1 min-w-0 h-11 px-4 rounded-full bg-[#F5F3FA] text-[14.5px] focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/40" />
                  <button type="button" onClick={sendChat} disabled={sendingChat || !chatMsg.trim()} aria-label="Send note"
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] text-white disabled:opacity-40 flex-shrink-0">
                    {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>

      {showSubmitForm && (
        <SubmitWorkDrawer assignmentId={id} role={assignment.role} isRevision={isRevision}
          toFix={toFix.map(g => ({ type: g.type, feedback: g.latest.reviewFeedback ?? null }))}
          sent={groups.map(g => ({ type: g.type, status: g.latest.reviewStatus, version: g.versions.length }))}
          title={booking.eventName ?? booking.bookingNumber}
          onClose={() => setShowSubmitForm(false)}
          onDone={() => { setShowSubmitForm(false); reload(); }} />
      )}
    </div>
  );
}
