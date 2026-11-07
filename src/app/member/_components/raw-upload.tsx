"use client";

/**
 * Member panel: upload my raw (camera) files for this program to the studio's Google Drive.
 * They land in "<part>/<my name · camera>" inside the program's private raw folder.
 * I only see my own files and can't delete — the studio manages the rest.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, FileUp, FolderUp, HardDrive, Link2, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { fmtSize } from "@/app/(app)/programs/_components/raw-drive-section";
import { RawBrowser } from "@/components/raw-browser";

type Mine = {
  connected: boolean; name: string; parts: string[];
  folders: { path: string; count: number; bytes: number }[];
  files: { id: string; name: string; size: number; path: string; viewUrl: string }[];
  totals: { count: number; bytes: number };
  freeBytes: number | null;
};
const clean = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
const chip = (on: boolean) => cn(
  "h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors",
  on ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE]",
);

export function MemberRawUpload({ bookingId, bookingNumber }: { bookingId: string; bookingNumber: string }) {
  const [data, setData] = useState<Mine | null>(null);
  const [failed, setFailed] = useState(false);
  const [part, setPart] = useState("");
  const [camera, setCamera] = useState("");
  const [busy, setBusy] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const uploadInto = useRef<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    apiFetch(`${API}/member/programs/${bookingId}/raw`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Mine) => { setData(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, [bookingId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 3000);
  }, [load]);

  if (failed || (data && !data.connected)) return null; // studio hasn't connected Drive (or no access)
  const card = "bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden";
  if (!data) return <div className={cn(card, "h-24 animate-pulse")} />;

  const activePart = part || data.parts[0] || "";
  const cam = clean(camera);

  async function start(list: FileList | null, fromFolder: boolean) {
    const into = uploadInto.current;
    uploadInto.current = null;
    if (!list?.length || busy || !data) return;
    if (!activePart && into == null) { notify("Choose the part first", { error: true }); return; }
    const files = Array.from(list);
    const folderFor = (f: File) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      const sub = fromFolder && rel.includes("/") ? rel.split("/").slice(1, -1).map(clean).filter(Boolean) : [];
      // "Add to this folder" in the browser → that folder (server keeps it inside my own folder).
      if (into != null) {
        const segs = into.split("/").filter(Boolean);
        return (segs.length === 1 ? [segs[0], cam || "_", ...sub] : [...segs, ...sub]).join("/");
      }
      return [activePart, cam || "_", ...sub].join("/");
    };
    const total = files.reduce((s, f) => s + f.size, 0);
    if (data.freeBytes != null && total > data.freeBytes) {
      const ok = await askConfirm({ title: "Studio Drive is almost full", message: `These files are ${fmtSize(total)} but only ${fmtSize(data.freeBytes)} is free. Tell the studio, or upload anyway.`, confirmLabel: "Upload anyway", danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const check = await checkDuplicates({ kind: "raw-member", files, bookingId, folderFor });
      const { files: toSend, plans } = applyDuplicateChoice(check, "skip");
      const skipped = files.length - toSend.length;
      if (!toSend.length) { notify(`All ${files.length} files are already uploaded`); return; }
      uploadToDrive({ kind: "raw-member", files: toSend, plans, folderFor, bookingId, bookingName: bookingNumber, onDone: refreshSoon });
      notify(`Uploading ${toSend.length} files${skipped ? ` · ${skipped} already there, skipped` : ""} — keep this page open`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't start the upload", { error: true });
    } finally {
      setBusy(false);
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  return (
    <div className={card}>
      <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
        className={cn("w-full px-4 py-3 flex items-center gap-2 text-left", expanded && "border-b border-[#EEEBF4]")}>
        <HardDrive className="w-4 h-4 text-[#1F8A5B]" />
        <span className="font-bold text-[13px] text-[#4A4658] flex-1">Upload my raw files</span>
        <span className="text-[12px] text-[#6B6680]">{data.totals.count ? `${data.totals.count} files · ${fmtSize(data.totals.bytes)}` : "None yet"}</span>
        <ChevronDown className={cn("w-4 h-4 text-[#8A8599] transition-transform", expanded && "rotate-180")} />
      </button>
      <input ref={filesRef} type="file" multiple hidden onChange={e => start(e.target.files, false)} />
      <input ref={folderRef} type="file" multiple hidden onChange={e => start(e.target.files, true)}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
      {expanded && <div className="px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
        {data.parts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-[#4A4658]">Part</p>
            <div className="flex flex-wrap gap-1.5">
              {data.parts.map(p => <button key={p} type="button" className={chip(activePart === p)} onClick={() => setPart(p)}>{p}</button>)}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-[#4A4658]">Camera <span className="font-normal text-[#8A8599]">(optional)</span></p>
          <input value={camera} onChange={e => setCamera(e.target.value)} placeholder="e.g. Camera A, Drone, Video"
            className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
        </div>
        <p className="text-[12px] text-[#6B6680] break-words">Goes to: <span className="font-semibold text-[#17151F]">{[activePart, [data.name, cam].filter(Boolean).join(" · ")].filter(Boolean).join(" / ")}</span></p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => folderRef.current?.click()}
            className="h-11 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4" />}Card / folder
          </button>
          <button type="button" disabled={busy} onClick={() => filesRef.current?.click()}
            className="h-11 rounded-full bg-white border border-[#E6E2EE] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
            <FileUp className="w-4 h-4" />Files
          </button>
        </div>

        {data.files.length > 0 && (
          <RawBrowser files={data.files} path={browsePath} onPath={setBrowsePath} rootLabel="My raw files" busy={busy}
            canUploadHere={browsePath !== ""}
            onUploadHere={(p, fromFolder) => { uploadInto.current = p; (fromFolder ? folderRef : filesRef).current?.click(); }} />
        )}
        <p className="text-[11px] text-[#8A8599]">Only the studio can delete uploaded files.</p>
      </div>}
    </div>
  );
}

/** Ask Drive to open the link with this Google account (if the browser is signed in to it). */
function withAccount(url: string, email?: string | null) {
  if (!email) return url;
  try { const u = new URL(url); u.searchParams.set("authuser", email); return u.toString(); } catch { return url; }
}

type EditorStatus = { isEditor: boolean; hasFolder?: boolean; links?: { id: string; url: string; label: string }[]; folderUrl?: string | null; folders?: { url: string; email: string }[]; sharedEmail?: string | null; defaultEmail?: string | null };

/**
 * For an editor on this program: open the program's raw folder on Google Drive (view + download).
 * Access goes to their Google email; the studio can take it back.
 */
export function EditorRawAccess({ bookingId }: { bookingId: string }) {
  const [st, setSt] = useState<EditorStatus | null>(null);
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch(`${API}/member/programs/${bookingId}/raw/editor`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: EditorStatus | null) => { if (alive && d) { setSt(d); setEmail(d.sharedEmail || d.defaultEmail || ""); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [bookingId]);

  if (!st?.isEditor) return null;
  const card = "bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden";

  async function getAccess() {
    if (busy) return;
    setBusy(true);
    // Open the tab now (still inside the click), so the browser doesn't block it as a pop-up.
    const tab = window.open("about:blank", "_blank");
    try {
      const r = await apiFetch(`${API}/member/programs/${bookingId}/raw/editor`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { tab?.close(); notify(d?.message || "Couldn't give access", { error: true }); return; }
      setSt(s => s ? { ...s, folderUrl: d.folderUrl, folders: d.folders, sharedEmail: d.email } : s);
      setEditing(false);
      notify("Access ready — opening Drive");
      const go = withAccount(d.folderUrl, d.email);
      if (tab) { tab.opener = null; tab.location.href = go; } else window.open(go, "_blank", "noopener");
    } catch { tab?.close(); notify("Couldn't give access", { error: true }); }
    finally { setBusy(false); }
  }

  return (
    <div className={card}>
      <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-[#1F8A5B]" />
        <span className="font-bold text-[13px] text-[#4A4658]">Raw files for editing</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        {!!st.links?.length && (
          <div className="space-y-1.5">
            {st.links.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-[#F7F5FB] px-3 py-2.5 hover:bg-[#EEE8FD]">
                <Link2 className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#17151F] truncate">{l.label || "Raw files link"}</span>
                  <span className="block text-[11px] text-[#6B6680] truncate">{l.url}</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-[#8A8599]" />
              </a>
            ))}
          </div>
        )}
        {!st.hasFolder ? (
          !st.links?.length && <p className="text-sm text-[#6B6680]">The studio hasn&apos;t added raw files for this program yet.</p>
        ) : st.folderUrl && !editing ? (
          <>
            <a href={withAccount(st.folderUrl, st.sharedEmail)} target="_blank" rel="noopener noreferrer"
              className="h-11 rounded-full bg-[#17151F] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5">
              <ExternalLink className="w-4 h-4" />Open raw files in Drive
            </a>
            {(st.folders?.length ?? 0) > 1 && (
              <div className="space-y-1">
                <p className="text-[12px] text-[#6B6680]">Some files are in another Drive:</p>
                {st.folders!.slice(1).map(f => (
                  <a key={f.url} href={withAccount(f.url, st.sharedEmail)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B3FD0]">
                    <ExternalLink className="w-3.5 h-3.5" />More raw files ({f.email})
                  </a>
                ))}
              </div>
            )}
            <p className="text-[12px] text-[#6B6680]">
              Access is given to <b className="text-[#17151F]">{st.sharedEmail}</b>. Sign in to Google with this account in your browser
              (Drive shows &quot;You need access&quot; on any other account).{" "}
              <button type="button" onClick={() => setEditing(true)} className="font-semibold text-[#5B3FD0]">Use another email</button>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[#4A4658]">The Google account you use for Drive on this computer — it gets view and download access to the raw folder.</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com"
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
            <button type="button" disabled={busy || !email.trim()} onClick={getAccess}
              className="w-full h-11 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Get access
            </button>
          </>
        )}
      </div>
    </div>
  );
}
