"use client";

/**
 * Editor → "Submit work" side panel.
 * 1. What you're sending (Highlight video, Full video, Reel, Photos…)
 * 2. Upload the files (or a whole folder) — they go to the studio's private
 *    "StuPanel Edited / <program> / <type> / v<N>" folder on Google Drive
 * 3. (Optional) a link instead, notes → Send for review
 * The studio reviews; when it approves, the files are copied to the client's delivery folder.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileUp, FolderUp, Link2, Loader2, Send, Trash2, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { uploadStore, type UploadEntry } from "@/lib/upload-store";
import { fmtSize } from "@/app/(app)/programs/_components/raw-drive-section";

const VIDEO_TYPES = [
  { value: "highlight_video", label: "Highlight video" },
  { value: "full_video", label: "Full video" },
  { value: "teaser", label: "Teaser" },
  { value: "reel", label: "Reel" },
  { value: "other", label: "Other" },
];
const PHOTO_TYPES = [
  { value: "photo_delivery", label: "Photos" },
  { value: "album", label: "Album" },
  { value: "other", label: "Other" },
];

type Pending = {
  connected: boolean; version: number; label: string; folderUrl: string | null;
  files: { id: string; name: string; size: number; path: string; viewUrl: string }[];
  totals: { count: number; bytes: number }; freeBytes: number | null;
};

const clean = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
const chip = (on: boolean) => cn(
  "h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors",
  on ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE] hover:border-[#CFC8DD]",
);
const input = "w-full h-10 px-3 rounded-xl bg-[#F5F3FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40";

export function SubmitWorkDrawer({ assignmentId, role, title, onClose, onDone, toFix = [], sent = [] }: {
  assignmentId: string; role: string; isRevision?: boolean; title: string;
  onClose: () => void; onDone: () => void;
  /** Things the studio asked to change (picked first). */
  toFix?: { type: string; feedback: string | null }[];
  /** What was already sent: latest status + how many versions. */
  sent?: { type: string; status: string; version: number }[];
}) {
  const types = role === "photo_editor" ? PHOTO_TYPES : VIDEO_TYPES;
  const [type, setType] = useState(toFix[0]?.type && types.some(t => t.value === toFix[0].type) ? toFix[0].type : types[0].value);
  const fix = toFix.find(f => f.type === type);
  const isRevision = !!fix;
  const SENT_TAG: Record<string, string> = { pending: "waiting", approved: "approved", revision_requested: "fix", replaced: "" };
  const [data, setData] = useState<Pending | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [links, setLinks] = useState({ deliveryLink: "", driveLink: "", dropboxLink: "", wetransferLink: "" });
  const [notes, setNotes] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uploads still running for this assignment (so "Send" waits for them).
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  useEffect(() => uploadStore.subscribe(setUploads), []);
  const running = uploads.filter(u => u.bookingId === assignmentId && !u.done && !u.error && !u.cancelled).length;

  const load = useCallback((t: string) => {
    setLoadErr("");
    apiFetch(`${API}/member/editing/${assignmentId}/files?type=${encodeURIComponent(t)}`)
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.message || "Couldn't load"); return d; })
      .then((d: Pending) => setData(d))
      .catch((e: Error) => setLoadErr(e.message));
  }, [assignmentId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setData(null); load(type); }, [type, load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(type), 2500);
  }, [load, type]);

  async function start(list: FileList | null, fromFolder: boolean) {
    if (!list?.length || busy) return;
    const files = Array.from(list);
    const folderFor = (f: File) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      const sub = fromFolder && rel.includes("/") ? rel.split("/").slice(1, -1).map(clean).filter(Boolean) : [];
      return [type, ...sub].join("/");
    };
    const total = files.reduce((s, f) => s + f.size, 0);
    if (data?.freeBytes != null && total > data.freeBytes) {
      const ok = await askConfirm({ title: "Studio Drive is almost full", message: `These files are ${fmtSize(total)} but only ${fmtSize(data.freeBytes)} is free. Tell the studio, or upload anyway.`, confirmLabel: "Upload anyway", danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const check = await checkDuplicates({ kind: "edited", files, bookingId: assignmentId, folderFor });
      const { files: toSend, plans } = applyDuplicateChoice(check, "skip");
      const skipped = files.length - toSend.length;
      if (!toSend.length) { notify(`All ${files.length} files are already uploaded`); return; }
      uploadToDrive({ kind: "edited", files: toSend, plans, folderFor, bookingId: assignmentId, bookingName: title, onDone: refreshSoon });
      notify(`Uploading ${toSend.length} files${skipped ? ` · ${skipped} already there` : ""}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't start the upload", { error: true });
    } finally {
      setBusy(false);
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  async function removeFile(f: Pending["files"][number]) {
    const ok = await askConfirm({ title: `Remove "${f.name}"?`, message: "It is taken out of this version (moved to Drive trash).", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    const r = await apiFetch(`${API}/member/editing/${assignmentId}/files/${f.id}?type=${encodeURIComponent(type)}`, { method: "DELETE" });
    if (!r.ok) { notify("Couldn't remove", { error: true }); return; }
    load(type);
  }

  const hasLink = Object.values(links).some(v => v.trim());
  const hasFiles = (data?.totals.count ?? 0) > 0;
  const canSend = (hasFiles || hasLink) && running === 0 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      const r = await apiFetch(`${API}/member/editing/${assignmentId}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableType: type, ...links, notes: notes.trim() || undefined, revisionNotes: revisionNotes.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || "Couldn't send", { error: true }); return; }
      notify("Sent to the studio for review");
      onDone();
    } finally { setSending(false); }
  }

  const grouped = (data?.files ?? []).reduce<Record<string, Pending["files"]>>((m, f) => { (m[f.path] ??= []).push(f); return m; }, {});

  return createPortal(
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <div className="sp-drawer pointer-events-auto sm:max-w-md flex flex-col">
          <div className="px-5 py-4 border-b border-[#EEEBF4] flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#17151F]">{isRevision ? "Send the revision" : "Submit your work"}</h3>
              <p className="text-xs text-[#6B6680] truncate">{title}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F2EFF8]">
              <X className="w-4 h-4 text-[#6B6680]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 1. What */}
            <section className="space-y-2">
              <p className="text-[13px] font-bold text-[#4A4658]">1 · What are you sending?</p>
              <div className="flex flex-wrap gap-1.5">
                {types.map(t => {
                  const done = sent.find(x => x.type === t.value);
                  return (
                    <button key={t.value} type="button" className={chip(type === t.value)} onClick={() => setType(t.value)}>
                      {t.label}
                      {done && SENT_TAG[done.status] && (
                        <span className={cn("ml-1.5 text-[11px] font-semibold", type === t.value ? "text-white/70" : done.status === "revision_requested" ? "text-[#C2304F]" : done.status === "approved" ? "text-[#1F8A5B]" : "text-[#5B3FD0]")}>
                          · {SENT_TAG[done.status]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {fix && (
                <p className="text-[12px] text-[#C2304F] bg-[#FDECEF] rounded-xl px-3 py-2">Studio asked for changes{fix.feedback ? `: ${fix.feedback}` : "."} This will be the next version.</p>
              )}
              {!fix && sent.find(x => x.type === type && x.status === "pending") && (
                <p className="text-[12px] text-[#4A4658] bg-[#F7F5FB] rounded-xl px-3 py-2">You already sent this and it&apos;s waiting for review. Sending again replaces it with a new version.</p>
              )}
            </section>

            {/* 2. Files */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#4A4658]">2 · Upload the files</p>
                {data && <span className="text-[12px] font-semibold text-[#5B3FD0] bg-[#EEE8FD] rounded-full px-2.5 py-0.5">Version {data.version}</span>}
              </div>
              {loadErr ? (
                <p className="text-sm text-[#C2304F]">{loadErr}</p>
              ) : !data ? (
                <div className="h-24 rounded-2xl bg-[#F5F3FA] animate-pulse" />
              ) : !data.connected ? (
                <p className="text-sm text-[#6B6680] rounded-2xl bg-[#F7F5FB] p-3">The studio hasn&apos;t connected Google Drive, so send a link below instead.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => folderRef.current?.click()}
                      className="h-11 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4" />}Folder
                    </button>
                    <button type="button" disabled={busy} onClick={() => filesRef.current?.click()}
                      className="h-11 rounded-full bg-white border border-[#E6E2EE] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                      <FileUp className="w-4 h-4" />Files
                    </button>
                  </div>
                  <p className="text-[12px] text-[#6B6680]">Goes to the studio&apos;s private folder: <b className="text-[#17151F]">{data.label} / v{data.version}</b>. The client sees it only after the studio approves.</p>
                  {running > 0 && <p className="text-[12px] font-semibold text-[#5B3FD0]">Uploading {running} file{running > 1 ? "s" : ""}… keep this page open.</p>}
                  {hasFiles && (
                    <div className="rounded-2xl border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
                      <div className="px-3 py-2 bg-[#F7F5FB] flex justify-between text-[12px] text-[#4A4658]">
                        <span className="font-semibold">Uploaded for this version</span>
                        <span>{data.totals.count} files · {fmtSize(data.totals.bytes)}</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {Object.entries(grouped).map(([path, list]) => (
                          <div key={path || "root"}>
                            {path && <p className="px-3 pt-2 text-[11px] font-semibold text-[#6B6680] uppercase tracking-wide">{path}</p>}
                            {list.map(f => (
                              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                                <a href={f.viewUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-[13px] text-[#17151F] truncate hover:text-[#5B3FD0]">{f.name}</a>
                                <span className="text-[11px] text-[#8A8599] tabular-nums">{fmtSize(f.size)}</span>
                                <button type="button" onClick={() => removeFile(f)} title="Remove"
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <input ref={filesRef} type="file" multiple hidden onChange={e => start(e.target.files, false)} />
              <input ref={folderRef} type="file" multiple hidden onChange={e => start(e.target.files, true)}
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
            </section>

            {/* Link instead */}
            <section>
              <button type="button" onClick={() => setShowLinks(v => !v)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B3FD0]">
                <Link2 className="w-4 h-4" />Or share a link instead
                <ChevronDown className={cn("w-4 h-4 transition-transform", showLinks && "rotate-180")} />
              </button>
              {showLinks && (
                <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {([
                    ["driveLink", "Google Drive link"], ["deliveryLink", "Other link (YouTube, Vimeo…)"],
                    ["dropboxLink", "Dropbox"], ["wetransferLink", "WeTransfer"],
                  ] as const).map(([k, label]) => (
                    <input key={k} value={links[k]} onChange={e => setLinks(l => ({ ...l, [k]: e.target.value }))} placeholder={label} className={input} />
                  ))}
                </div>
              )}
            </section>

            {/* 3. Notes */}
            <section className="space-y-2">
              <p className="text-[13px] font-bold text-[#4A4658]">3 · Notes <span className="font-normal text-[#8A8599]">(optional)</span></p>
              {isRevision && (
                <textarea value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} rows={2} placeholder="What did you change in this version?"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F5F3FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
              )}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything the studio should know…"
                className="w-full px-3 py-2.5 rounded-xl bg-[#F5F3FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
            </section>
          </div>

          <div className="px-5 py-4 border-t border-[#EEEBF4] flex gap-2">
            <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-sm font-semibold">Cancel</button>
            <button type="button" onClick={send} disabled={!canSend}
              className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {running > 0 ? "Wait for uploads…" : "Send for review"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
