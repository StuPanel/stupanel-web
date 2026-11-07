"use client";

/**
 * Folder browser for a program's raw files (studio and team member).
 * Shows folders with how many files / how much is inside (all levels), opens them,
 * lists the files, and lets you upload more straight into the folder you are in.
 */
import { useMemo } from "react";
import { ChevronRight, ExternalLink, FileUp, Folder, FolderUp, Home, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type BrowserFile = { id: string; name: string; size: number; path: string; viewUrl: string; conn?: string };

export function fmtBytes(b: number) {
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TB`;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

const split = (p: string) => (p ? p.split("/").filter(Boolean) : []);

export function RawBrowser({
  files, path, onPath, rootLabel = "All raw files", canDelete = false, canUploadHere = true,
  onUploadHere, onDeleteFile, onDeleteFolder, busy,
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
  busy?: boolean;
}) {
  const here = useMemo(() => split(path), [path]);

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
      </div>

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
        {list.slice(0, 500).map(f => (
          <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
            <a href={f.viewUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-[12px] text-[#17151F] truncate hover:text-[#5B3FD0] inline-flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3 text-[#A29DB3] flex-shrink-0" /><span className="truncate">{f.name}</span>
            </a>
            <span className="text-[11px] text-[#8A8599] tabular-nums">{fmtBytes(f.size)}</span>
            {canDelete && onDeleteFile && (
              <button type="button" onClick={() => onDeleteFile(f)} title="Delete"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {list.length > 500 && <p className="px-3 py-2 text-[11px] text-[#8A8599]">+{list.length - 500} more — open in Drive to see all.</p>}
        {!folders.length && !list.length && <p className="px-3 py-6 text-center text-[12px] text-[#8A8599]">This folder is empty.</p>}
      </div>
    </div>
  );
}
