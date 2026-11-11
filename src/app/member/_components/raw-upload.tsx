"use client";

/**
 * Member panel: upload my raw (camera) files for this program to the studio's Google Drive.
 * They land in "<part>/<my name · camera>" inside the program's private raw folder.
 * I only see my own files and can't delete — the studio manages the rest.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileUp, FolderOpen, FolderUp, HardDrive, Link2, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { fmtSize } from "@/app/(app)/programs/_components/raw-drive-section";
import { RawBrowser } from "@/components/raw-browser";
import { Empty, List, Row, Section, card } from "@/components/ui/profile-page";

type Mine = {
  connected: boolean; name: string; parts: string[];
  folders: { path: string; count: number; bytes: number }[];
  files: { id: string; name: string; size: number; path: string; viewUrl: string; thumb?: string | null; mimeType?: string }[];
  totals: { count: number; bytes: number };
  freeBytes: number | null;
};
const clean = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
const chip = (on: boolean) => cn(
  "h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors",
  on ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE]",
);

/** `onShown` tells the page whether this block has anything to show (Drive connected). */
export function MemberRawUpload({ bookingId, bookingNumber, onShown }: { bookingId: string; bookingNumber: string; onShown?: (shown: boolean) => void }) {
  const [data, setData] = useState<Mine | null>(null);
  const [failed, setFailed] = useState(false);
  const [part, setPart] = useState("");
  const [camera, setCamera] = useState("");
  const [busy, setBusy] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const uploadInto = useRef<string | null>(null);
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
  const shownRef = useRef(onShown);
  useEffect(() => { shownRef.current = onShown; });
  const shown = failed ? false : data ? data.connected : null;
  useEffect(() => { if (shown !== null) shownRef.current?.(shown); }, [shown]);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      load();
      // The editor card on the same page checks again (the raw folder may exist only now).
      window.dispatchEvent(new CustomEvent("sp-raw-changed", { detail: bookingId }));
    }, 3000);
  }, [load, bookingId]);

  if (failed || (data && !data.connected)) return null; // studio hasn't connected Drive (or no access)
  if (!data) return <div className={cn(card, "h-40 animate-pulse mb-6")} aria-busy="true" aria-label="Loading raw files" />;

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
      const sub = fromFolder && rel.includes("/") ? rel.split("/").slice(0, -1).map(clean).filter(Boolean) : [];
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

  const btn = "h-11 px-4 sm:px-5 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 flex-1 sm:flex-none";
  const field = "text-[12.5px] font-semibold text-[#4A4658]";
  return (
    <Section title="Upload my raw files"
      action={<span className="text-[12.5px] text-[#6B6680]">{data.totals.count ? `${data.totals.count} files · ${fmtSize(data.totals.bytes)}` : "Nothing uploaded yet"}</span>}>
      <input ref={filesRef} type="file" multiple hidden onChange={e => start(e.target.files, false)} />
      <input ref={folderRef} type="file" multiple hidden onChange={e => start(e.target.files, true)}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
      <div className={cn(card, "p-4 sm:p-5 space-y-4")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 [&>*]:min-w-0">
          {data.parts.length > 0 && (
            <div className="space-y-1.5">
              <p className={field}>1 · Which part?</p>
              <div className="flex flex-wrap gap-1.5">
                {data.parts.map(p => <button key={p} type="button" aria-pressed={activePart === p} className={chip(activePart === p)} onClick={() => setPart(p)}>{p}</button>)}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="raw-camera" className={cn(field, "block")}>{data.parts.length > 0 ? "2 · " : ""}Camera <span className="font-normal text-[#8A8599]">(optional)</span></label>
            <input id="raw-camera" value={camera} onChange={e => setCamera(e.target.value)} placeholder="e.g. Camera A, Drone, Video"
              className="w-full h-11 px-3.5 rounded-[14px] bg-[#F5F3FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/40" />
          </div>
        </div>
        <p className="text-[12.5px] text-[#6B6680] break-words rounded-[14px] bg-[#F7F5FB] px-3.5 py-2.5">
          Your files go to <span className="font-semibold text-[#17151F]">{[activePart, [data.name, cam].filter(Boolean).join(" · ")].filter(Boolean).join(" / ")}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => folderRef.current?.click()} className={cn(btn, "bg-[#17151F] hover:bg-black text-white")}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4 flex-shrink-0" />}<span className="whitespace-nowrap">Upload a folder</span>
          </button>
          <button type="button" disabled={busy} onClick={() => filesRef.current?.click()} className={cn(btn, "bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F]")}>
            <FileUp className="w-4 h-4 flex-shrink-0" /><span className="whitespace-nowrap">Upload files</span>
          </button>
        </div>
        <p className="text-[12px] text-[#8A8599]">Files already there are skipped. Only the studio can delete uploaded files.</p>
      </div>

      {data.files.length > 0 && (
        <div className={cn(card, "p-4 sm:p-5 mt-3")}>
          <RawBrowser files={data.files} path={browsePath} onPath={setBrowsePath} rootLabel="My raw files" busy={busy}
            canUploadHere={browsePath !== ""}
            onUploadHere={(p, fromFolder) => { uploadInto.current = p; (fromFolder ? folderRef : filesRef).current?.click(); }} />
        </div>
      )}
    </Section>
  );
}

/** Ask Drive to open the link with this Google account (if the browser is signed in to it). */
function withAccount(url: string, email?: string | null) {
  if (!email) return url;
  try { const u = new URL(url); u.searchParams.set("authuser", email); return u.toString(); } catch { return url; }
}

type EditorStatus = { isEditor: boolean; hasFolder?: boolean; links?: { id: string; url: string; label: string; folder?: boolean }[]; folderUrl?: string | null; folders?: { url: string; email: string; label?: string }[]; sharedEmail?: string | null; defaultEmail?: string | null };

/**
 * For an editor on this program: open the program's raw folder on Google Drive (view + download).
 * Access goes to their Google email; the studio can take it back.
 */
export function EditorRawAccess({ bookingId, onShown }: { bookingId: string; onShown?: (shown: boolean) => void }) {
  const [st, setSt] = useState<EditorStatus | null>(null);
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownRef = useRef(onShown);
  useEffect(() => { shownRef.current = onShown; });

  useEffect(() => {
    let alive = true;
    const fetchIt = () => apiFetch(`${API}/member/programs/${bookingId}/raw/editor`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: EditorStatus | null) => {
        if (!alive) return;
        if (d) { setSt(d); setEmail(e => e || d.sharedEmail || d.defaultEmail || ""); }
        shownRef.current?.(!!d?.isEditor);
      })
      .catch(() => { if (alive) shownRef.current?.(false); });
    fetchIt();
    const onChange = (e: Event) => { if ((e as CustomEvent).detail === bookingId) fetchIt(); };
    window.addEventListener("sp-raw-changed", onChange);
    return () => { alive = false; window.removeEventListener("sp-raw-changed", onChange); };
  }, [bookingId]);

  if (!st?.isEditor) return null;

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

  const links = st.links ?? [];
  const dark = "h-11 px-5 rounded-full bg-[#17151F] hover:bg-black text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 w-full sm:w-auto";
  return (
    <Section title="Raw files for editing">
      {links.length > 0 && (
        <List>
          {links.map(l => (
            <Row key={l.id} href={l.url} external icon={l.folder ? FolderOpen : Link2} color={l.folder ? "green" : "deep"}
              title={l.label || "Raw files link"} sub={l.folder ? "Folder on the studio's Google Drive" : l.url} />
          ))}
        </List>
      )}
      {links.some(l => l.folder) && (
        <p className="text-[12.5px] text-[#6B6680] px-1 mt-2">
          If Drive says &quot;You need access&quot;, ask the studio to share that folder with <b className="text-[#17151F] break-all">{st.sharedEmail || st.defaultEmail || "your Google email"}</b>.
        </p>
      )}
      {!st.hasFolder ? (
        links.length === 0 && <Empty icon={HardDrive} title="No raw files yet" text="The studio hasn't added raw files for this program yet." />
      ) : (
        <div className={cn(card, "p-4 sm:p-5 space-y-3", links.length > 0 && "mt-3")}>
          {st.folderUrl && !editing ? (
            <>
              <a href={withAccount(st.folderUrl, st.sharedEmail)} target="_blank" rel="noopener noreferrer" className={dark}>
                <ExternalLink className="w-4 h-4" />Open raw files in Drive
              </a>
              {(st.folders?.length ?? 0) > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[12.5px] text-[#6B6680]">More raw files:</p>
                  {st.folders!.slice(1).map(f => (
                    <a key={f.url} href={withAccount(f.url, st.sharedEmail)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B3FD0] hover:text-[#4630A8]">
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /><span className="break-all">{f.label ? f.label : `More raw files (${f.email})`}</span>
                    </a>
                  ))}
                </div>
              )}
              <p className="text-[12.5px] text-[#6B6680]">
                Access is given to <b className="text-[#17151F] break-all">{st.sharedEmail}</b>. Sign in to Google with this account in your browser
                (Drive shows &quot;You need access&quot; on any other account).{" "}
                <button type="button" onClick={() => setEditing(true)} className="font-semibold text-[#5B3FD0] hover:text-[#4630A8]">Use another email</button>
              </p>
            </>
          ) : (
            <>
              <label htmlFor="raw-access-email" className="block text-sm text-[#4A4658]">The Google account you use for Drive on this computer — it gets view and download access to the raw folder.</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input id="raw-access-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com"
                  className="w-full sm:flex-1 min-w-0 h-11 flex-shrink-0 px-3.5 rounded-[14px] bg-[#F5F3FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/40" />
                <button type="button" disabled={busy || !email.trim()} onClick={getAccess} className={dark}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}Get access
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Section>
  );
}
