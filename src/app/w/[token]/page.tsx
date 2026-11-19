"use client";

/**
 * An editor's page for one piece of editing work, opened from a private link — no login.
 * See what to deliver, start, hand in a link, read the studio's answer, open the raw files and the songs.
 */
import { use, useCallback, useEffect, useState } from "react";
import {
  CalendarDays, Check, CheckCircle2, Clock, ExternalLink, FolderOpen, Link2, Loader2, MessageCircle,
  Music2, PenLine, Phone, Play, Scissors, Send, StickyNote,
} from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { waLink } from "@/lib/portal-session";
import { PublicLoading, PublicMessage, PublicShell } from "@/components/public/public-shell";
import { CARD_SHADOW } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";
import { SubmitWorkDrawer } from "@/app/member/editing/[id]/submit-drawer";

type Sub = { id: string; deliverableType: string; link: string | null; notes?: string | null; reviewStatus: string; reviewFeedback?: string | null; submittedAt: string };
type Song = { youtubeId: string; url: string; title: string; thumb?: string; note?: string; instrumental?: boolean };
type View = {
  studio: { name: string; logoUrl: string | null; phone: string | null };
  editor: { name: string };
  work: { role: string; status: string; editingDeadline?: string | null; deliveryDeadline?: string | null; studioNote?: string | null; revisionCount: number };
  program: { number?: string; name?: string; kind?: string | null; date?: string | null; days: { name: string | null; date: string | null }[]; client: string };
  progress: { plan: string[]; approved: string[]; missing: string[]; total: number; done: number; canComplete: boolean };
  submissions: Sub[];
  raw: { hasFolder: boolean; links: { id: string; url: string; label?: string }[]; folders: { url: string }[]; sharedEmail: string | null } | null;
  music: { status: string; clientNote: string | null; parts: { key: string; label: string; songs: Song[] }[] } | null;
};

const LABEL: Record<string, string> = {
  highlight_video: "Highlight video", full_video: "Full video", teaser: "Teaser", reel: "Reel",
  photo_delivery: "Photos", album: "Album", other: "Other",
};
const card = cn("bg-white rounded-[22px]", CARD_SHADOW);
const primary = "h-12 px-6 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50";
const soft = "h-11 px-4 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[14px] font-semibold text-[#17151F] inline-flex items-center justify-center gap-2 disabled:opacity-50";

const errOf = (d: { message?: string | string[] }, fallback: string) => (Array.isArray(d.message) ? d.message[0] : d.message) || fallback;

/** Where each thing stands, from its newest version. */
function stateOf(type: string, subs: Sub[]) {
  const s = subs.find(x => x.deliverableType === type && x.reviewStatus !== "replaced");
  if (!s) return { key: "todo", label: "Not sent yet", cls: "bg-[#F1EFF6] text-[#4A4658]", sub: null as Sub | null };
  if (s.reviewStatus === "approved") return { key: "ok", label: "Approved", cls: "bg-[#E7F5EE] text-[#14613F]", sub: s };
  if (s.reviewStatus === "revision_requested") return { key: "fix", label: "Changes asked", cls: "bg-[#FDECEF] text-[#9C2340]", sub: s };
  return { key: "wait", label: "Studio is checking", cls: "bg-[#FFF3E0] text-[#7A4800]", sub: s };
}

export default function EditorWorkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sendFor, setSendFor] = useState<string | null>(null);

  const load = useCallback(() => fetch(`${API}/public/work/${token}`)
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(errOf(d, "This link does not work any more.")); return d as View; })
    .then(d => { setV(d); document.title = `${d.program.name ?? d.program.number ?? "Editing work"} — ${d.studio.name}`; })
    .catch(e => setError(e.message)), [token]);
  useEffect(() => { load(); }, [load]);

  async function post(path: string, body?: unknown) {
    const r = await fetch(`${API}/public/work/${token}/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(errOf(d, "Something went wrong. Please try again."));
    return d;
  }
  async function act(key: string, path: string, done: string) {
    setBusy(key);
    try { await post(path); notify(done); await load(); }
    catch (e) { notify((e as Error).message, { error: true }); }
    finally { setBusy(""); }
  }

  if (error) return <PublicMessage icon={Link2} title="This link is not working" text={`${error} Ask the studio for a new link.`} />;
  if (!v) return <PublicLoading />;

  const { work, program, progress, submissions } = v;
  const plan = progress.plan.length ? progress.plan : [...new Set(submissions.filter(s => s.reviewStatus !== "replaced").map(s => s.deliverableType))];
  const states = plan.map(t => ({ type: t, ...stateOf(t, submissions) }));
  const finished = work.status === "delivered";
  const toFix = states.filter(s => s.key === "fix");
  const todo = states.filter(s => s.key === "todo");
  const waiting = states.filter(s => s.key === "wait");
  const first = v.editor.name.split(" ")[0];
  const wa = waLink(v.studio.phone, `Hi, about the editing of ${program.name ?? program.number ?? "the program"}.`);
  const deadline = work.editingDeadline || work.deliveryDeadline;

  const next = finished ? { title: "All done — thank you", text: "The studio has everything from you for this program.", tone: "green" as const }
    : work.status === "assigned" ? { title: "Start when you begin", text: "Press Start editing so the studio knows you are on it.", tone: "violet" as const }
    : toFix.length ? { title: `The studio asked for changes to ${toFix.map(s => LABEL[s.type] ?? s.type).join(", ")}`, text: "Read the note below, fix it and send a new version.", tone: "red" as const }
    : progress.canComplete ? { title: "Everything is approved", text: "Mark the work complete to finish.", tone: "green" as const }
    : todo.length || !plan.length ? { title: "Hand in your work when it is ready", text: "Upload the files here, or paste a link to them.", tone: "violet" as const }
    : { title: "The studio is checking your work", text: waiting.length ? "You will see the answer here. Open this page again later." : "Nothing more to do right now.", tone: "amber" as const };
  const toneCls = { green: "bg-[#E7F5EE] text-[#14613F]", violet: "bg-[#EEE8FD] text-[#5B3FD0]", red: "bg-[#FDECEF] text-[#9C2340]", amber: "bg-[#FFF3E0] text-[#7A4800]" }[next.tone];
  const NextIcon = finished || progress.canComplete ? CheckCircle2 : toFix.length ? PenLine : next.tone === "amber" ? Clock : Scissors;

  return (
    <PublicShell studio={v.studio} sub="Editing work" width="max-w-[760px]"
      right={<>
        {v.studio.phone && <a href={`tel:${v.studio.phone}`} aria-label="Call the studio" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.08)]"><Phone className="w-4 h-4" /></a>}
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="h-10 px-4 rounded-full bg-[#1F8A5B] hover:bg-[#19754D] text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /><span className="hidden sm:inline">WhatsApp</span></a>}
      </>}>
      <p className="text-[13.5px] text-[#6B6680]">Hi {first || "there"}</p>
      <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight [overflow-wrap:anywhere]">{program.name ?? program.number}</h1>
      <p className="mt-1 text-[14px] text-[#4A4658] flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{work.role === "photo_editor" ? "Photo editing" : "Video editing"}</span>
        {program.number && <><span aria-hidden>·</span><span>{program.number}</span></>}
        {program.date && <><span aria-hidden>·</span><span className="whitespace-nowrap">{fmtDate(program.date)}</span></>}
      </p>

      {/* Next step */}
      <section className={cn(card, "mt-5 p-5")}>
        <div className="flex items-start gap-3.5">
          <span className={cn("w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0", toneCls)}><NextIcon className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold text-[#17151F] leading-snug">{next.title}</h2>
            <p className="text-[14px] text-[#6B6680] mt-0.5 leading-relaxed">{next.text}</p>
            {deadline && !finished && (
              <p className="mt-2 text-[13.5px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Finish by {fmtDate(deadline)}</p>
            )}
          </div>
        </div>
        {!finished && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {work.status === "assigned" && (
              <button type="button" className={primary} disabled={!!busy} onClick={() => act("start", "start", "Started — the studio can see it")}>
                {busy === "start" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Start editing
              </button>
            )}
            {progress.canComplete ? (
              <button type="button" className={primary} disabled={!!busy} onClick={() => act("complete", "complete", "Marked complete — thank you")}>
                {busy === "complete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Mark complete
              </button>
            ) : (
              <button type="button" className={work.status === "assigned" || next.tone === "amber" ? soft : primary} onClick={() => setSendFor(toFix[0]?.type ?? todo[0]?.type ?? "")}>
                <Send className="w-4 h-4" />{next.tone === "amber" ? "Hand in something else" : "Hand in work"}
              </button>
            )}
          </div>
        )}
      </section>

      {/* What to deliver */}
      {states.length > 0 && (
        <section className="mt-6">
          <div className="px-1 mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#17151F]">What to deliver</h2>
            <span className="text-[13px] text-[#6B6680] tabular-nums">{progress.done} of {progress.total} approved</span>
          </div>
          <div className={cn(card, "divide-y divide-[#EEEBF4]")}>
            {states.map(s => (
              <div key={s.type} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[#17151F]">{LABEL[s.type] ?? s.type}</p>
                    <span className={cn("mt-1 h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center", s.cls)}>{s.label}</span>
                  </div>
                  {s.sub?.link && <a href={s.sub.link} target="_blank" rel="noreferrer" aria-label={`Open what you sent for ${LABEL[s.type] ?? s.type}`} className="w-11 h-11 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] flex items-center justify-center text-[#4A4658] flex-shrink-0"><ExternalLink className="w-4 h-4" /></a>}
                  {!finished && s.key !== "ok" && (
                    <button type="button" className={cn(soft, "flex-shrink-0")} onClick={() => setSendFor(s.type)}>{s.key === "todo" ? "Hand in" : "Send new"}</button>
                  )}
                </div>
                {s.key === "fix" && s.sub?.reviewFeedback && (
                  <p className="mt-3 text-[14px] text-[#17151F] bg-[#FEF5F7] rounded-[14px] px-3.5 py-3 leading-relaxed"><b>Studio:</b> {s.sub.reviewFeedback}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {work.studioNote && (
        <section className="mt-6">
          <h2 className="px-1 mb-2 text-[15px] font-bold text-[#17151F]">Note from the studio</h2>
          <div className={cn(card, "p-4 flex gap-3")}>
            <StickyNote className="w-5 h-5 text-[#7D5CEF] flex-shrink-0 mt-0.5" />
            <p className="text-[15px] text-[#17151F] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{work.studioNote}</p>
          </div>
        </section>
      )}

      {v.raw && <RawFiles raw={v.raw} onShare={email => post("raw", { email })} reload={load} />}

      {v.music && v.music.parts.length > 0 && (
        <section className="mt-6">
          <h2 className="px-1 mb-2 text-[15px] font-bold text-[#17151F] flex items-center gap-2"><Music2 className="w-4 h-4" />Client&apos;s songs</h2>
          <div className={cn(card, "p-4 space-y-4")}>
            {v.music.parts.map(p => (
              <div key={p.key}>
                <p className="text-[13px] font-bold text-[#4A4658] mb-1.5">{p.label}</p>
                <ol className="space-y-1.5">
                  {p.songs.map((s, i) => (
                    <li key={s.youtubeId}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] p-2 min-h-[52px]">
                        <span className="w-5 text-[12px] font-bold text-[#5B3FD0] tabular-nums text-center">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-[#17151F] line-clamp-2 [overflow-wrap:anywhere]">{s.title}</span>
                          {s.note && <span className="block text-[12.5px] text-[#823072] truncate">“{s.note}”</span>}
                        </span>
                        <ExternalLink className="w-4 h-4 text-[#6B6680] flex-shrink-0" />
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {v.music.clientNote && <p className="text-[14px] text-[#4A4658]"><b className="text-[#17151F]">Client&apos;s note:</b> {v.music.clientNote}</p>}
          </div>
        </section>
      )}

      {sendFor !== null && (
        <SubmitWorkDrawer token={token} assignmentId={token} role={work.role} title={program.name ?? program.number ?? "Editing work"}
          toFix={[...toFix].sort((a, b) => Number(b.type === sendFor) - Number(a.type === sendFor)).map(s => ({ type: s.type, feedback: s.sub?.reviewFeedback ?? null }))}
          sent={states.filter(s => s.sub).map(s => ({ type: s.type, status: s.sub!.reviewStatus, version: submissions.filter(x => x.deliverableType === s.type).length }))}
          first={sendFor || undefined}
          onClose={() => setSendFor(null)}
          onDone={async () => { setSendFor(null); await load(); }} />
      )}
    </PublicShell>
  );
}

function RawFiles({ raw, onShare, reload }: { raw: NonNullable<View["raw"]>; onShare: (email: string) => Promise<unknown>; reload: () => Promise<unknown> }) {
  const [email, setEmail] = useState(raw.sharedEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const open = [...raw.folders.map((f, i) => ({ url: f.url, label: raw.folders.length > 1 ? `Raw files ${i + 1}` : "Raw files" })), ...raw.links.map(l => ({ url: l.url, label: l.label || "Raw files link" }))];
  if (!raw.hasFolder && !open.length) return null;
  async function share() {
    setErr("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr("Write your Google email, e.g. name@gmail.com"); return; }
    setBusy(true);
    try { await onShare(email.trim()); notify("Raw files opened for your email"); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <section className="mt-6">
      <h2 className="px-1 mb-2 text-[15px] font-bold text-[#17151F]">Raw files</h2>
      <div className={cn(card, "divide-y divide-[#EEEBF4]")}>
        {open.map(o => (
          <a key={o.url} href={o.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 min-h-[60px] hover:bg-[#FAF9FC] first:rounded-t-[22px] last:rounded-b-[22px]">
            <FolderOpen className="w-5 h-5 text-[#7D5CEF] flex-shrink-0" />
            <span className="flex-1 min-w-0 text-[15px] font-semibold text-[#17151F] truncate">{o.label}</span>
            <ExternalLink className="w-4 h-4 text-[#6B6680] flex-shrink-0" />
          </a>
        ))}
        {raw.hasFolder && (
          <div className="p-4">
            <label htmlFor="raw-email" className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">
              {raw.sharedEmail ? "Opened for this Google email" : "Your Google email, to open the raw files"}
            </label>
            <div className="flex gap-2">
              <input id="raw-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@gmail.com" className={cn(inputCls, "flex-1 min-w-0")} aria-describedby={err ? "raw-err" : undefined} />
              <button type="button" onClick={share} disabled={busy || email.trim() === (raw.sharedEmail ?? "")} className={cn(soft, "flex-shrink-0")}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}{raw.sharedEmail ? "Change" : "Open"}
              </button>
            </div>
            {err && <p id="raw-err" role="alert" className="mt-1.5 text-[13px] font-semibold text-[#C2304F]">{err}</p>}
            {!raw.sharedEmail && <p className="mt-1.5 text-xs text-[#6B6680]">The folder is shared with this email only. Then open it with the same Google account.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
