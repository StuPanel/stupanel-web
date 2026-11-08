"use client";

/**
 * The client's delivery files as folders: Teaser, Full video, Photos…
 * Open a folder, go back with the path at the top, download one file or a whole folder as ZIP.
 */
import { useMemo, useState } from "react";
import { ChevronRight, Download, ExternalLink, File, FileArchive, FileImage, FileVideo, Folder, Home } from "lucide-react";

export type PortalDriveFile = {
  id: string; fileName: string; mimeType: string; fileSize: number;
  folderName: string | null; path?: string; viewUrl: string | null; downloadUrl: string | null;
};

function fmtBytes(b: number) {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}
const iconOf = (m: string) => (m?.startsWith("image/") ? FileImage : m?.startsWith("video/") ? FileVideo : m?.includes("zip") ? FileArchive : File);
const split = (p: string) => (p ? p.split("/").filter(Boolean) : []);
/** Older deliveries only know the top folder. */
const pathOf = (f: PortalDriveFile) => f.path ?? f.folderName ?? "";

export function PortalFiles({ files, brand, zipUrl, driveUrl }: {
  files: PortalDriveFile[];
  brand: string;
  /** ZIP link for a folder ("" = everything). */
  zipUrl: (folder: string) => string;
  driveUrl?: string | null;
}) {
  const [path, setPath] = useState("");
  const here = useMemo(() => split(path), [path]);

  const { folders, list, total } = useMemo(() => {
    const map = new Map<string, { name: string; count: number; bytes: number; video: number; image: number }>();
    const list: PortalDriveFile[] = [];
    let total = { count: 0, bytes: 0 };
    for (const f of files) {
      const segs = split(pathOf(f));
      if (segs.length < here.length || here.some((s, i) => segs[i] !== s)) continue;
      total = { count: total.count + 1, bytes: total.bytes + f.fileSize };
      if (segs.length === here.length) { list.push(f); continue; }
      const name = segs[here.length];
      const g = map.get(name) ?? { name, count: 0, bytes: 0, video: 0, image: 0 };
      g.count++; g.bytes += f.fileSize;
      if (f.mimeType?.startsWith("video/")) g.video++; else if (f.mimeType?.startsWith("image/")) g.image++;
      map.set(name, g);
    }
    return {
      folders: [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      list: list.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true })),
      total,
    };
  }, [files, here]);

  const kindText = (g: { count: number; video: number; image: number }) =>
    g.video === g.count ? `${g.count} video${g.count > 1 ? "s" : ""}` : g.image === g.count ? `${g.count} photo${g.count > 1 ? "s" : ""}` : `${g.count} file${g.count > 1 ? "s" : ""}`;

  return (
    <div className="rounded-2xl border border-[#EEEBF4] bg-white overflow-hidden">
      {/* Where am I + download this folder */}
      <div className="px-3 py-2.5 bg-[#F7F5FB] flex items-center gap-2">
        <div className="flex items-center gap-1 flex-wrap text-[12px] min-w-0 flex-1">
          <button type="button" onClick={() => setPath("")}
            className={`inline-flex items-center gap-1 font-semibold ${here.length ? "hover:underline" : "text-[#17151F]"}`} style={here.length ? { color: brand } : undefined}>
            <Home className="w-3.5 h-3.5" />All files
          </button>
          {here.map((seg, i) => (
            <span key={i} className="inline-flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3 h-3 text-[#A29DB3]" />
              <button type="button" onClick={() => setPath(here.slice(0, i + 1).join("/"))}
                className={`font-semibold truncate max-w-[140px] ${i === here.length - 1 ? "text-[#17151F]" : "hover:underline"}`}
                style={i === here.length - 1 ? undefined : { color: brand }}>{seg}</button>
            </span>
          ))}
        </div>
        <a href={zipUrl(path)}
          className="h-8 px-3 rounded-full text-white text-[12px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0 hover:opacity-90"
          style={{ backgroundColor: brand }}>
          <Download className="w-3.5 h-3.5" />{here.length ? "Download folder" : "Download all"}
        </a>
      </div>
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-[#6B6680] border-b border-[#F2EFF8]">
        <span>{total.count} file{total.count === 1 ? "" : "s"} · {fmtBytes(total.bytes)}</span>
        {driveUrl && !here.length && (
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: brand }}>
            <ExternalLink className="w-3 h-3" />Open in Google Drive
          </a>
        )}
      </div>

      <div className="max-h-[460px] overflow-y-auto divide-y divide-[#F2EFF8]">
        {folders.map(g => (
          <button key={g.name} type="button" onClick={() => setPath([...here, g.name].join("/"))}
            className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[#FBFAFD] transition-colors">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${brand}1A` }}>
              <Folder className="w-5 h-5" style={{ color: brand }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[#17151F] truncate">{g.name}</span>
              <span className="block text-[12px] text-[#6B6680]">{kindText(g)} · {fmtBytes(g.bytes)}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#A29DB3]" />
          </button>
        ))}
        {list.slice(0, 500).map(f => {
          const Icon = iconOf(f.mimeType);
          return (
            <div key={f.id} className="flex items-center gap-3 px-3 py-2">
              <a href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#F7F5FB] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#8A8599]" />
              </a>
              <a href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-[#17151F] truncate">{f.fileName}</span>
                <span className="block text-[11px] text-[#8A8599]">{fmtBytes(f.fileSize)}</span>
              </a>
              {f.downloadUrl && (
                <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer" title="Download"
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#F2EFF8]" style={{ color: brand }}>
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          );
        })}
        {list.length > 500 && <p className="px-3 py-2 text-[11px] text-[#8A8599]">+{list.length - 500} more — download the folder to get them all.</p>}
        {!folders.length && !list.length && <p className="px-3 py-6 text-center text-[12px] text-[#8A8599]">This folder is empty.</p>}
      </div>
    </div>
  );
}
