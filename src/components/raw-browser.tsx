"use client";

/**
 * Folder browser for a program's raw files (studio and team member).
 * Shows folders with how many files / how much is inside (all levels), opens them,
 * lists the files, and lets you upload more straight into the folder you are in.
 */
import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink, FileUp, Folder, FolderInput, FolderUp, Home, LayoutGrid, List, Pencil, Search, Trash2, X } from "lucide-react";
import { askText } from "@/components/feedback";
import { FileThumb, isMedia, useViewMode } from "@/components/file-thumb";
import { cn } from "@/lib/utils";

export type BrowserFile = { id: string; name: string; size: number; path: string; viewUrl: string; conn?: string; thumb?: string | null; mimeType?: string };

export function fmtBytes(b: number) {
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TB`;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

const split = (p: string) => (p ? p.split("/").filter(Boolean) : []);

export function RawBrowser({
  files, path, onPath, rootLabel = "All raw files", canDelete = false, canUploadHere = true,
  onUploadHere, onDeleteFile, onDeleteFolder, onRename, onMove, busy,
}: {
  files: BrowserFile[];
  /** Current folder ("" = top). */
  path: string;
  onPath: (p: string) => void;
  rootLabel?: string;
  canDelete?: boolean;
  /** Whether the current folder accepts uploads (e.g. not the very top for a team member). */
  canUploadHere?: boolean;
  onUploadHere?: (path: string, fromFolder: boolean) => void;
  onDeleteFile?: (f: BrowserFile) => void;
  onDeleteFolder?: (path: string) => void;
  /** Rename a file, or a folder (given by its path). Resolve true when it worked. */
  onRename?: (target: { file?: BrowserFile; folder?: string }, name: string) => Promise<boolean>;
  /** Move a file into another folder ("" = top). */
  onMove?: (file: BrowserFile, toPath: string) => Promise<boolean>;
  busy?: boolean;
}) {
  const here = useMemo(() => split(path), [path]);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  // Searching looks through every folder.
  const found = useMemo(() => (q ? files.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)).slice(0, 300) : []), [files, q]);
  const allFolders = useMemo(() => {
    const set = new Set<string>([""]);
    for (const f of files) { const segs = split(f.path); for (let i = 1; i <= segs.length; i++) set.add(segs.slice(0, i).join("/")); }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [files]);

  async function rename(target: { file?: BrowserFile; folder?: string }) {
    if (!onRename) return;
    const cur = target.file ? target.file.name : split(target.folder ?? "").pop() ?? "";
    const name = await askText({ title: target.file ? "Rename file" : "Rename folder", value: cur, confirmLabel: "Rename" });
    if (name == null || !name.trim() || name.trim() === cur) return;
    await onRename(target, name.trim());
  }
  async function move(f: BrowserFile) {
    if (!onMove) return;
    const to = await askText({
      title: `Move "${f.name}"`, message: "Pick a folder, or type a new one (use / for a folder inside a folder).",
      value: f.path, placeholder: "e.g. Holud/Camera A", suggestions: allFolders, confirmLabel: "Move",
    });
    if (to == null) return;
    const clean = split(to.replace(/\\/g, "/")).join("/");
    if (clean === f.path) return;
    await onMove(f, clean);
  }
  const fileActions = (f: BrowserFile, overlay = false) => (onRename || onMove || (canDelete && onDeleteFile)) ? (
    <span className={cn("flex items-center gap-0.5", overlay && "absolute top-1.5 right-1.5 rounded-full bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity")}>
      {onRename && <button type="button" onClick={() => rename({ file: f })} title="Rename" className="w-7 h-7 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#F2EFF8] hover:text-[#17151F]"><Pencil className="w-3.5 h-3.5" /></button>}
      {onMove && <button type="button" onClick={() => move(f)} title="Move to folder" className="w-7 h-7 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#F2EFF8] hover:text-[#17151F]"><FolderInput className="w-3.5 h-3.5" /></button>}
      {canDelete && onDeleteFile && <button type="button" onClick={() => onDeleteFile(f)} title="Delete" className="w-7 h-7 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]"><Trash2 className="w-3.5 h-3.5" /></button>}
    </span>
  ) : null;

  // Sub-folders of the current folder, with totals of everything inside them.
  const { folders, list, total } = useMemo(() => {
    const map = new Map<string, { name: string; count: number; bytes: number; sub: Set<string> }>();
    const list: BrowserFile[] = [];
    let total = { count: 0, bytes: 0 };
    for (const f of files) {
      const segs = split(f.path);
      if (segs.length < here.length || here.some((s, i) => segs[i] !== s)) continue;
      total = { count: total.count + 1, bytes: total.bytes + f.size };
      if (segs.length === here.length) { list.push(f); continue; }
      const name = segs[here.length];
      const g = map.get(name) ?? { name, count: 0, bytes: 0, sub: new Set<string>() };
      g.count++; g.bytes += f.size;
      if (segs.length > here.length + 1) g.sub.add(segs[here.length + 1]);
      map.set(name, g);
    }
    return {
      folders: [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      list: list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      total,
    };
  }, [files, here]);

  const go = (i: number) => onPath(here.slice(0, i).join("/"));
  // Photos / videos in this folder can be shown as pictures.
  const nMedia = list.filter(f => isMedia(f.mimeType)).length;
  const [view, setView] = useViewMode("files", "grid");
  const grid = view === "grid" && nMedia > 0;

  return (
    <div className="rounded-2xl border border-[#EEEBF4] overflow-hidden">
      {/* Where am I */}
      <div className="px-3 py-2 bg-[#F7F5FB] flex items-center gap-1 flex-wrap text-[12px]">
        <button type="button" onClick={() => go(0)} className={cn("inline-flex items-center gap-1 font-semibold", here.length ? "text-[#5B3FD0] hover:underline" : "text-[#17151F]")}>
          <Home className="w-3.5 h-3.5" />{rootLabel}
        </button>
        {here.map((seg, i) => (
          <span key={i} className="inline-flex items-center gap-1 min-w-0">
            <ChevronRight className="w-3 h-3 text-[#A29DB3]" />
            <button type="button" onClick={() => go(i + 1)}
              className={cn("font-semibold truncate max-w-[160px]", i === here.length - 1 ? "text-[#17151F]" : "text-[#5B3FD0] hover:underline")}>{seg}</button>
          </span>
        ))}
        <span className="ml-auto text-[#6B6680]">{total.count} files · {fmtBytes(total.bytes)}</span>
        {nMedia > 0 && (
          <span className="inline-flex rounded-full bg-white border border-[#E6E2EE] p-0.5 ml-1">
            {(["grid", "list"] as const).map(m => {
              const I = m === "grid" ? LayoutGrid : List;
              return (
                <button key={m} type="button" onClick={() => setView(m)} title={m === "grid" ? "Pictures" : "List"}
                  className={cn("w-6 h-6 rounded-full flex items-center justify-center", view === m ? "bg-[#17151F] text-white" : "text-[#8A8599] hover:text-[#17151F]")}>
                  <I className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </span>
        )}
      </div>

      {/* Search every folder */}
      {files.length > 8 && (
        <div className="px-3 py-2 border-b border-[#EEEBF4] flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-[#A29DB3] flex-shrink-0" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search files"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[#17151F] outline-none placeholder:text-[#A29DB3]" />
          {query && <button type="button" onClick={() => setQuery("")} title="Clear" className="w-6 h-6 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#F2EFF8]"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}

      {q ? (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-[#F2EFF8]">
          {found.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
              <a href={f.viewUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:text-[#5B3FD0]">
                <span className="block text-[12px] text-[#17151F] truncate">{f.name}</span>
                <span className="block text-[11px] text-[#8A8599] truncate">{f.path ? f.path.split("/").join(" › ") : rootLabel}</span>
              </a>
              <button type="button" onClick={() => { setQuery(""); onPath(f.path); }} className="h-7 px-2.5 rounded-full text-[11px] font-semibold text-[#5B3FD0] hover:bg-[#EEE8FD]">Open folder</button>
              {fileActions(f)}
            </div>
          ))}
          {!found.length && <p className="px-3 py-6 text-center text-[12px] text-[#8A8599]">No file matches &quot;{query.trim()}&quot;.</p>}
        </div>
      ) : (<>
      {/* Upload into this folder */}
      {onUploadHere && canUploadHere && (
        <div className="px-3 py-2 border-b border-[#EEEBF4] flex items-center gap-2">
          <span className="text-[12px] text-[#6B6680] flex-1 min-w-0 truncate">{here.length ? <>Add to <b className="text-[#17151F]">{here[here.length - 1]}</b></> : "Add here"}</span>
          <button type="button" disabled={busy} onClick={() => onUploadHere(path, true)}
            className="h-8 px-3 rounded-full bg-[#17151F] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
            <FolderUp className="w-3.5 h-3.5" />Folder
          </button>
          <button type="button" disabled={busy} onClick={() => onUploadHere(path, false)}
            className="h-8 px-3 rounded-full bg-white border border-[#E6E2EE] text-[#17151F] text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
            <FileUp className="w-3.5 h-3.5" />Files
          </button>
        </div>
      )}

      <div className="max-h-[420px] overflow-y-auto divide-y divide-[#F2EFF8]">
        {folders.map(f => {
          const p = [...here, f.name].join("/");
          return (
            <div key={f.name} className="flex items-center gap-2 px-3 py-2.5 hover:bg-[#FBFAFD]">
              <button type="button" onClick={() => onPath(p)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
                <span className="w-8 h-8 rounded-[10px] bg-[#EEE8FD] flex items-center justify-center flex-shrink-0">
                  <Folder className="w-4 h-4 text-[#5B3FD0]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#17151F] truncate">{f.name}</span>
                  <span className="block text-[11px] text-[#6B6680]">
                    {f.count} files · {fmtBytes(f.bytes)}{f.sub.size ? ` · ${f.sub.size} folder${f.sub.size > 1 ? "s" : ""}` : ""}
                  </span>
                </span>
              </button>
              {onRename && (
                <button type="button" onClick={() => rename({ folder: p })} title="Rename folder"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#F2EFF8] hover:text-[#17151F]">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {canDelete && onDeleteFolder && (
                <button type="button" onClick={() => onDeleteFolder(p)} title="Delete folder"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <ChevronRight className="w-4 h-4 text-[#A29DB3]" />
            </div>
          );
        })}
        {grid && (
          <div className="p-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {list.slice(0, 300).map(f => (
              <div key={f.id} className="group relative">
                <a href={f.viewUrl} target="_blank" rel="noopener noreferrer" title={f.name} className="block rounded-xl overflow-hidden">
                  <FileThumb thumb={f.thumb} mime={f.mimeType} className="aspect-square rounded-xl transition-transform duration-300 group-hover:scale-[1.03]" />
                </a>
                <p className="mt-1 text-[11px] text-[#4A4658] truncate">{f.name}</p>
                {fileActions(f, true)}
              </div>
            ))}
            {list.length > 300 && <p className="col-span-full px-1 py-1 text-[11px] text-[#8A8599]">+{list.length - 300} more — switch to the list or open in Drive.</p>}
          </div>
        )}
        {!grid && list.slice(0, 500).map(f => (
          <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
            <a href={f.viewUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-[12px] text-[#17151F] truncate hover:text-[#5B3FD0] inline-flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3 text-[#A29DB3] flex-shrink-0" /><span className="truncate">{f.name}</span>
            </a>
            <span className="text-[11px] text-[#8A8599] tabular-nums">{fmtBytes(f.size)}</span>
            {fileActions(f)}
          </div>
        ))}
        {!grid && list.length > 500 && <p className="px-3 py-2 text-[11px] text-[#8A8599]">+{list.length - 500} more — open in Drive to see all.</p>}
        {!folders.length && !list.length && <p className="px-3 py-6 text-center text-[12px] text-[#8A8599]">This folder is empty.</p>}
      </div>
      </>)}
    </div>
  );
}
