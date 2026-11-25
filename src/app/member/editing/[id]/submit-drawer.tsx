"use client";

/**
 * Editor → "Send your work" side panel (Faisal 25-NOV-2026: one video at a time).
 * 1. What kind (Full video, Teaser, Photos…)
 * 2. Each video / photo set is its own row: the days the studio listed ("Holud — Full video"), what was sent
 *    before, and any extra one the editor adds. Several files can be chosen at once — each becomes its own row.
 *    Every row has its own upload (or link) and its own note, and goes to its own private Drive folder
 *    "StuPanel Edited / <program> / <Kind> / <day or name> / v<N>".
 * 3. A note for all → Send. The studio approves or asks for changes on each one separately, so a change to one
 *    film means sending only that film again.
 * With `token` the same panel works on an editor's private work link (no login).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, FileUp, FolderUp, Link2, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { uploadStore, type UploadEntry } from "@/lib/upload-store";
import { fmtSize } from "@/app/(app)/programs/_components/raw-drive-section";
import { PHOTO_KINDS, VIDEO_KINDS, WORK_LABEL, makeKey, nameFromFile, slotOf, titleOf, typeOf } from "@/lib/work-items";

type Pending = {
  connected: boolean; version: number; label: string; folderUrl: string | null;
  files: { id: string; name: string; size: number; path: string; viewUrl: string }[];
  totals: { count: number; bytes: number }; freeBytes: number | null;
};
/** The latest version of one video, as sent before. */
export type SentItem = { key: string; title: string; status: string; version: number; feedback?: string | null; byClient?: boolean };
type Row = { key: string; title: string; planned: boolean; sent?: SentItem };

const cleanPart = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
const chip = (on: boolean) => cn(
  "h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors",
  on ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE] hover:border-[#CFC8DD]",
);
const area = "w-full px-3 py-2.5 rounded-xl bg-[#F5F3FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40";
const isLink = (v: string) => /^https?:\/\/\S+\.\S+$/i.test(v.trim());

export function SubmitWorkDrawer({ assignmentId, token, first, role, title, plan = [], sent = [], days = [], onClose, onDone }: {
  assignmentId: string; role: string; title: string;
  /** An editor's private work link (no login): the public endpoints are used. */
  token?: string;
  /** The video (key) or kind to start on. */
  first?: string;
  /** What the studio asked for: keys ("full_video|Holud") or kinds ("teaser"). */
  plan?: string[];
  /** The latest version of each video sent before. */
  sent?: SentItem[];
  /** The program's days, to name a video in one tap. */
  days?: string[];
  onClose: () => void; onDone: () => void;
}) {
  const kinds = role === "photo_editor" ? PHOTO_KINDS : VIDEO_KINDS;
  const isPhoto = role === "photo_editor";
  const fixFirst = sent.find(s => s.status === "revision_requested");
  const openPlan = plan.find(k => !sent.some(s => s.key === k && s.status === "approved"));
  const [kind, setKind] = useState(() => {
    const t = [first, fixFirst?.key, openPlan, plan[0]].map(k => (k ? typeOf(k) : "")).find(t => kinds.includes(t));
    return t ?? kinds[0];
  });
  const base = token ? `${API}/public/work/${token}` : `${API}/member/editing/${assignmentId}`;
  const uploadId = token ?? assignmentId;
  const upKind = token ? "edited-link" as const : "edited" as const;

  // Rows of this kind: listed by the studio, sent before, or added now.
  const [added, setAdded] = useState<Row[]>([]);
  const rows = useMemo(() => {
    const out: Row[] = [];
    const push = (r: Row) => { if (!out.some(x => x.key === r.key)) out.push(r); };
    for (const k of plan) if (typeOf(k) === kind) push({ key: k, title: titleOf(k), planned: true, sent: sent.find(s => s.key === k) });
    for (const s of sent) if (typeOf(s.key) === kind) push({ key: s.key, title: s.title || titleOf(s.key), planned: false, sent: s });
    for (const r of added) if (typeOf(r.key) === kind) push(r);
    return out;
  }, [plan, sent, added, kind]);

  // Each row's files waiting to be sent (its next version).
  const [files, setFiles] = useState<Record<string, Pending | "err">>({});
  const [connected, setConnected] = useState<boolean | null>(null);
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const load = useCallback(async (key: string) => {
    try {
      const r = await apiFetch(`${base}/files?type=${encodeURIComponent(key)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "Couldn't load");
      setFiles(m => ({ ...m, [key]: d as Pending }));
      setConnected((d as Pending).connected);
      setFreeBytes((d as Pending).freeBytes);
    } catch { setFiles(m => ({ ...m, [key]: "err" })); }
  }, [base]);
  const keysToLoad = rows.map(r => r.key).join("\n");
  useEffect(() => {
    const todo = (keysToLoad ? keysToLoad.split("\n") : []).filter(k => !(k in files));
    const t = setTimeout(() => todo.forEach(k => void load(k)), 0);
    return () => clearTimeout(t);
  }, [keysToLoad]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nothing listed for this kind: ask once, so we know whether Drive is connected.
  useEffect(() => {
    if (connected !== null || rows.length) return;
    const t = setTimeout(() => void load(kind), 0);
    return () => clearTimeout(t);
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [linkOpen, setLinkOpen] = useState<Record<string, boolean>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [newVersion, setNewVersion] = useState<Record<string, boolean>>({});
  const [common, setCommon] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const pickFolder = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Uploads still running (so "Send" waits for them), and per row.
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  useEffect(() => uploadStore.subscribe(setUploads), []);
  const mine = uploads.filter(u => u.bookingId === uploadId && !u.cancelled);
  const running = mine.filter(u => !u.done && !u.error);
  const rowUploads = (key: string) => mine.filter(u => (u.folderName ?? "") === `Edited / ${key}` || (u.folderName ?? "").startsWith(`Edited / ${key}/`));
  const refreshSoon = (key: string) => {
    // Google Drive can take a few seconds to list a new file: look now-ish, and once more a little later.
    timers.current.push(setTimeout(() => void load(key), 2500), setTimeout(() => void load(key), 7500));
  };

  /** Upload files into one row. From a folder, the folder's inside stays as it is. */
  async function upload(key: string, list: File[], fromFolder: boolean) {
    if (!list.length) return;
    const folderFor = (f: File) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      const sub = fromFolder && rel.includes("/") ? rel.split("/").slice(1, -1).map(cleanPart).filter(Boolean) : [];
      return [key, ...sub].join("/");
    };
    const total = list.reduce((s, f) => s + f.size, 0);
    if (freeBytes != null && total > freeBytes) {
      const ok = await askConfirm({ title: "Studio Drive is almost full", message: `These files are ${fmtSize(total)} but only ${fmtSize(freeBytes)} is free. Tell the studio, or upload anyway.`, confirmLabel: "Upload anyway", danger: true });
      if (!ok) return;
    }
    const check = await checkDuplicates({ kind: upKind, files: list, bookingId: uploadId, folderFor });
    const { files: toSend, plans } = applyDuplicateChoice(check, "skip");
    if (!toSend.length) { notify("Already uploaded"); return; }
    uploadToDrive({ kind: upKind, files: toSend, plans, folderFor, bookingId: uploadId, bookingName: title, onDone: () => refreshSoon(key) });
  }

  /** Several files at once: each goes to its own row — a listed day whose name is in the file name, else a new row. */
  async function addMany(list: FileList | null, fromFolder: boolean) {
    const chosen = Array.from(list ?? []);
    if (pick.current) pick.current.value = "";
    if (pickFolder.current) pickFolder.current.value = "";
    if (!chosen.length || busy) return;
    const into = target.current;
    target.current = null;
    setBusy(true);
    try {
      if (into) { await upload(into, chosen, fromFolder); return; }
      // A folder (photos) is one set; loose files are one row each.
      const groups = new Map<string, File[]>();
      for (const f of chosen) {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
        const g = fromFolder && rel.includes("/") ? rel.split("/")[0] : f.name;
        groups.set(g, [...(groups.get(g) ?? []), f]);
      }
      const used = new Set<string>();
      // Rows waiting for files: not sent, to fix, or "send a new version" pressed.
      const free = rows.filter(r => !r.sent || r.sent.status === "revision_requested" || newVersion[r.key]).filter(r => !(files[r.key] && files[r.key] !== "err" && (files[r.key] as Pending).totals.count));
      const made: Row[] = [];
      for (const [name, fs] of groups) {
        const low = name.toLowerCase();
        const match = free.find(r => !used.has(r.key) && slotOf(r.key) && low.includes(slotOf(r.key).toLowerCase().split(" ")[0]));
        let key = match?.key;
        if (!key) {
          let slot = nameFromFile(name) || "Video";
          for (let n = 2; rows.some(r => r.key === makeKey(kind, slot)) || made.some(r => r.key === makeKey(kind, slot)); n++) slot = `${nameFromFile(name)} ${n}`;
          key = makeKey(kind, slot);
          made.push({ key, title: slot, planned: false });
        }
        used.add(key);
        await upload(key, fs, fromFolder);
      }
      if (made.length) setAdded(a => [...a, ...made]);
      notify(`Uploading ${chosen.length} file${chosen.length > 1 ? "s" : ""}${groups.size > 1 ? ` as ${groups.size} separate ${isPhoto ? "sets" : "videos"}` : ""}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't start the upload", { error: true });
    } finally { setBusy(false); }
  }

  async function removeFile(key: string, f: Pending["files"][number]) {
    const ok = await askConfirm({ title: `Remove "${f.name}"?`, message: "It is taken out of this version (moved to Drive trash).", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    const r = await apiFetch(`${base}/files/${f.id}?type=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!r.ok) { notify("Couldn't remove", { error: true }); return; }
    void load(key);
  }

  const pendingOf = (key: string) => { const p = files[key]; return p && p !== "err" ? p : null; };
  const ready = rows.filter(r => (pendingOf(r.key)?.totals.count ?? 0) > 0 || (linkOpen[r.key] && isLink(links[r.key] ?? "")));
  // Ready rows in other kinds too (the editor may switch kinds before sending).
  const allKeys = Object.keys(files).filter(k => (pendingOf(k)?.totals.count ?? 0) > 0);
  const readyKeys = [...new Set([...ready.map(r => r.key), ...allKeys, ...Object.keys(links).filter(k => linkOpen[k] && isLink(links[k]))])];
  const canSend = readyKeys.length > 0 && running.length === 0 && !sending;

  async function send() {
    if (!canSend) return;
    const bad = Object.entries(links).find(([k, v]) => linkOpen[k] && v.trim() && !isLink(v));
    if (bad) { setErr(`The link for "${titleOf(bad[0])}" must start with https://`); return; }
    setErr(""); setSending(true);
    try {
      const items = readyKeys.map(k => {
        const row = [...rows, ...added].find(r => r.key === k);
        const sentBefore = sent.find(s => s.key === k);
        const nm = (names[k] ?? "").trim();
        return {
          key: k,
          title: nm || (row && !row.planned && !sentBefore ? row.title : undefined) || sentBefore?.title || undefined,
          notes: (notes[k] ?? "").trim() || undefined,
          link: linkOpen[k] && isLink(links[k] ?? "") ? links[k].trim() : undefined,
        };
      });
      const r = await apiFetch(`${base}/submit-items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, notes: common.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr((Array.isArray(d?.message) ? d.message[0] : d?.message) || "Couldn't send"); return; }
      notify(items.length > 1 ? `${items.length} sent — the studio checks each one separately` : "Sent to the studio for review");
      onDone();
    } finally { setSending(false); }
  }

  const tag = (s?: SentItem) => !s ? null
    : s.status === "approved" ? { t: "Approved", c: "bg-[#E7F5EE] text-[#14613F]" }
    : s.status === "revision_requested" ? { t: s.byClient ? "Client asked a change" : "Changes asked", c: "bg-[#FDECEF] text-[#C2304F]" }
    : { t: "Waiting for review", c: "bg-[#EEE8FD] text-[#5B3FD0]" };
  const kindCount = (t: string) => sent.filter(s => typeOf(s.key) === t && s.status === "revision_requested").length;
  /** Listed by the studio for this kind and not sent yet. */
  const kindTodo = (t: string) => plan.filter(k => typeOf(k) === t && (k.includes("|") || !sent.some(s => typeOf(s.key) === t)) && !sent.some(s => s.key === k)).length;

  return createPortal(
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <div className="sp-drawer pointer-events-auto sm:max-w-lg flex flex-col">
          <div className="px-5 py-4 border-b border-[#EEEBF4] flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#17151F]">{fixFirst ? "Send your changes" : "Send your work"}</h3>
              <p className="text-xs text-[#6B6680] truncate">{title}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F2EFF8]">
              <X className="w-4 h-4 text-[#6B6680]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <section className="space-y-2">
              <p className="text-[13px] font-bold text-[#4A4658]">1 · What kind?</p>
              <div className="flex flex-wrap gap-1.5">
                {kinds.map(t => (
                  <button key={t} type="button" className={chip(kind === t)} onClick={() => setKind(t)}>
                    {WORK_LABEL[t] ?? t}
                    {kindCount(t) > 0 && <span className={cn("ml-1.5 text-[11px] font-bold", kind === t ? "text-white/75" : "text-[#C2304F]")}>· {kindCount(t)} to fix</span>}
                    {kindCount(t) === 0 && kindTodo(t) > 0 && <span className={cn("ml-1.5 text-[11px] font-bold", kind === t ? "text-white/75" : "text-[#5B3FD0]")}>· {kindTodo(t)} to send</span>}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-[#4A4658]">2 · {isPhoto ? "Each set on its own" : "Each video on its own"}</p>
                <p className="text-[12px] text-[#6B6680]">The studio checks each one separately</p>
              </div>
              {connected === false && (
                <p className="text-sm text-[#6B6680] rounded-2xl bg-[#F7F5FB] p-3">The studio hasn&apos;t connected Google Drive, so files can&apos;t be uploaded here. Use <b className="text-[#17151F]">Paste a link</b> on each one.</p>
              )}

              {rows.map(r => {
                const p = pendingOf(r.key);
                const ups = rowUploads(r.key).filter(u => !u.done && !u.error);
                const failed = rowUploads(r.key).filter(u => u.error).length;
                const pct = ups.length ? Math.round(ups.reduce((s, u) => s + (u.progress || 0), 0) / ups.length) : 0;
                const t = tag(r.sent);
                const approved = r.sent?.status === "approved" && !newVersion[r.key];
                const waiting = r.sent?.status === "pending" && !newVersion[r.key] && !(p?.totals.count);
                const nextV = p?.version ?? ((r.sent?.version ?? 0) + 1);
                return (
                  <div key={r.key} className={cn("rounded-[18px] border p-3.5 space-y-2.5", r.sent?.status === "revision_requested" ? "border-[#F4C7D1] bg-[#FFF8FA]" : "border-[#EEEBF4] bg-white")}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {!r.planned && !r.sent ? (
                          <input aria-label="Name of this video" value={names[r.key] ?? r.title} maxLength={120}
                            onChange={e => setNames(m => ({ ...m, [r.key]: e.target.value }))}
                            className="w-full h-9 px-2.5 -ml-1 rounded-lg bg-[#F5F3FA] text-[14.5px] font-bold text-[#17151F] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
                        ) : (
                          <p className="text-[14.5px] font-bold text-[#17151F] break-words">{r.title}</p>
                        )}
                        <p className="text-[12px] text-[#6B6680] mt-0.5">
                          {r.planned && !r.sent ? "Asked by the studio · not sent yet" : r.sent ? `Version ${r.sent.version} sent` : "Added by you"}
                          {!approved && !waiting ? ` · this will be version ${nextV}` : ""}
                        </p>
                      </div>
                      {t && <span className={cn("text-[11.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", t.c)}>{t.t}</span>}
                      {!r.planned && !r.sent && !(p?.totals.count) && !ups.length && (
                        <button type="button" aria-label="Remove this row" onClick={() => setAdded(a => a.filter(x => x.key !== r.key))}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                    {r.sent?.status === "revision_requested" && (
                      <p className="text-[12.5px] text-[#9C2340] bg-[#FDECEF] rounded-xl px-3 py-2 whitespace-pre-wrap break-words">{r.sent.byClient ? "The client" : "Studio"}: {r.sent.feedback || "Please make changes."}</p>
                    )}

                    {approved || waiting ? (
                      <button type="button" onClick={() => setNewVersion(m => ({ ...m, [r.key]: true }))} className="text-[12.5px] font-semibold text-[#5B3FD0]">
                        {approved ? "Send a new version of this one" : "Replace it with a new version"}
                      </button>
                    ) : (
                      <>
                        {!linkOpen[r.key] && connected !== false && (
                          <div className="flex gap-2 flex-wrap">
                            <button type="button" disabled={busy} onClick={() => { target.current = r.key; (isPhoto ? pickFolder : pick).current?.click(); }}
                              className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                              {isPhoto ? <FolderUp className="w-4 h-4" /> : <FileUp className="w-4 h-4" />}{p?.totals.count ? "Add more" : isPhoto ? "Upload folder" : "Upload video"}
                            </button>
                            {isPhoto && (
                              <button type="button" disabled={busy} onClick={() => { target.current = r.key; pick.current?.click(); }}
                                className="h-10 px-4 rounded-full bg-white border border-[#E6E2EE] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 disabled:opacity-60"><FileUp className="w-4 h-4" />Files</button>
                            )}
                            <button type="button" onClick={() => setLinkOpen(m => ({ ...m, [r.key]: true }))} className="h-10 px-3 text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1"><Link2 className="w-4 h-4" />Paste a link</button>
                          </div>
                        )}
                        {(linkOpen[r.key] || connected === false) && (
                          <div className="flex gap-2 items-center">
                            <input type="url" inputMode="url" aria-label={`Link for ${r.title}`} value={links[r.key] ?? ""} placeholder="https://drive.google.com/…"
                              onChange={e => { setLinks(m => ({ ...m, [r.key]: e.target.value })); setLinkOpen(m => ({ ...m, [r.key]: true })); setErr(""); }}
                              className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#F5F3FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
                            {connected !== false && <button type="button" onClick={() => setLinkOpen(m => ({ ...m, [r.key]: false }))} className="text-[12.5px] font-semibold text-[#6B6680] px-1">Upload instead</button>}
                          </div>
                        )}
                        {ups.length > 0 && (
                          <div role="status" className="rounded-xl bg-[#F4F0FE] px-3 py-2">
                            <p className="text-[12.5px] font-semibold text-[#5B3FD0]">Uploading {ups.length} file{ups.length > 1 ? "s" : ""} · {pct}% — keep this page open</p>
                            <div className="mt-1.5 h-1.5 rounded-full bg-white overflow-hidden"><div className="h-full bg-[#7D5CEF] transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
                          </div>
                        )}
                        {failed > 0 && !ups.length && <p role="alert" className="text-[12.5px] font-semibold text-[#C2304F]">{failed} file{failed > 1 ? "s" : ""} did not upload. Choose {failed > 1 ? "them" : "it"} again.</p>}
                        {p && p.totals.count > 0 && (
                          <div className="rounded-xl border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
                            {p.files.slice(0, 40).map(f => (
                              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                                <Check className="w-3.5 h-3.5 text-[#1F8A5B] flex-shrink-0" />
                                <a href={f.viewUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-[13px] text-[#17151F] truncate hover:text-[#5B3FD0]">{f.path ? `${f.path}/` : ""}{f.name}</a>
                                <span className="text-[11px] text-[#8A8599] tabular-nums">{fmtSize(f.size)}</span>
                                <button type="button" onClick={() => removeFile(r.key, f)} aria-label={`Remove ${f.name}`}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                            {p.files.length > 40 && <p className="px-3 py-1.5 text-[12px] text-[#6B6680]">and {p.files.length - 40} more · {p.totals.count} files, {fmtSize(p.totals.bytes)}</p>}
                          </div>
                        )}
                        <textarea value={notes[r.key] ?? ""} onChange={e => setNotes(m => ({ ...m, [r.key]: e.target.value }))} rows={2} maxLength={2000}
                          aria-label={`Note for ${r.title}`}
                          placeholder={r.sent?.status === "revision_requested" ? "What did you change in this one?" : `A note about this ${isPhoto ? "set" : "video"} (optional)`}
                          className={area} />
                      </>
                    )}
                  </div>
                );
              })}

              {connected !== false && (
                <button type="button" disabled={busy} onClick={() => { target.current = null; (isPhoto ? pickFolder : pick).current?.click(); }}
                  className="w-full min-h-[52px] rounded-[18px] border-2 border-dashed border-[#D9D3E6] hover:border-[#7D5CEF] text-[#5B3FD0] text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 px-4 py-3 disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {rows.length ? `Add ${isPhoto ? "another set (folder)" : "more videos — choose several at once"}` : `Choose ${isPhoto ? "a folder" : "your videos — several at once is fine"}`}
                </button>
              )}
              {connected !== false && !isPhoto && days.length > 0 && rows.length === 0 && (
                <p className="text-[12px] text-[#6B6680]">Tip: a file named after a day (Holud, Wedding…) is put on that day by itself. You can rename each one.</p>
              )}
              <input ref={pick} type="file" multiple hidden onChange={e => addMany(e.target.files, false)} />
              <input ref={pickFolder} type="file" multiple hidden onChange={e => addMany(e.target.files, true)}
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
            </section>

            <section className="space-y-2">
              <p className="text-[13px] font-bold text-[#4A4658]">3 · A note for all <span className="font-normal text-[#8A8599]">(optional)</span></p>
              <textarea value={common} onChange={e => setCommon(e.target.value)} rows={2} maxLength={2000} placeholder="Anything the studio should know about all of them…" className={area} />
            </section>
          </div>

          <div className="px-5 py-4 border-t border-[#EEEBF4] space-y-2">
            {err && <p role="alert" className="text-[13px] font-semibold text-[#C2304F]">{err}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-sm font-semibold">Cancel</button>
              <button type="button" onClick={send} disabled={!canSend}
                className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {running.length > 0 ? "Wait for uploads…" : readyKeys.length > 1 ? `Send ${readyKeys.length} for review` : "Send for review"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
