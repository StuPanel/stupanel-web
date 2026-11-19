"use client";

/**
 * A program's files, presented like a delivered album:
 *  • Paid → the cover, the program's name, Download all, films, then each folder as a picture tile;
 *    a folder opens as a photo grid (each photo opens / downloads from Google Drive).
 *  • Money due → the cover softened behind a lock, how much is left, how to pay, and what is waiting.
 * Deliveries without Drive files (links, older uploads) keep the simple list (DeliverySection).
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download, ExternalLink, Folder, Lock, MessageCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { API_URL as API } from "@/lib/api";
import { thumbAt } from "@/components/file-thumb";
import { waLink, withPortalSession } from "@/lib/portal-session";
import { notify } from "@/components/feedback";
import { Cover, CoverTitle } from "./portal-cover";
import { money, programName, type PortalBooking, type Studio } from "./portal-data";
import type { PortalDriveFile } from "./portal-files";

const isImg = (f: { mimeType?: string }) => !!f.mimeType?.startsWith("image/");
const isVid = (f: { mimeType?: string }) => !!f.mimeType?.startsWith("video/");
const segs = (f: PortalDriveFile) => (f.path ?? f.folderName ?? "").split("/").filter(Boolean);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const kindOf = (photos: number, videos: number, other: number) =>
  [photos && plural(photos, "photo"), videos && plural(videos, "film"), other && plural(other, "file")].filter(Boolean).join(" · ");
function bytes(n: number) {
  if (n < 1073741824) return `${Math.max(1, Math.round(n / 1048576))} MB`;
  return `${(n / 1073741824).toFixed(1)} GB`;
}
const dateLine = (b: PortalBooking) => {
  if (!b.eventDate) return "";
  const end = b.eventEndDate && b.eventEndDate.slice(0, 10) !== b.eventDate.slice(0, 10) ? b.eventEndDate : null;
  return end ? `${fmtDate(b.eventDate)} – ${fmtDate(end)}` : fmtDate(b.eventDate);
};

// ─── Paid: the album ─────────────────────────────────────────────────────────

export function Gallery({ b, files, token, studio }: { b: PortalBooking; files: PortalDriveFile[]; token: string; studio: Studio }) {
  const [path, setPath] = useState<string[]>([]);
  const zip = (folder = "") => withPortalSession(token, `${API}/public/portal/${token}/drive-zip?bookingId=${b.id}${folder ? `&folderName=${encodeURIComponent(folder)}` : ""}`);
  const total = useMemo(() => ({
    photos: files.filter(isImg).length, videos: files.filter(isVid).length,
    other: files.filter(f => !isImg(f) && !isVid(f)).length, size: files.reduce((s, f) => s + (f.fileSize || 0), 0),
  }), [files]);

  if (path.length) return <FolderView files={files} path={path} onPath={setPath} zip={zip} />;

  const films = files.filter(isVid).slice(0, 6);
  // A folder of only films is already shown under Films (when they all fit there).
  const allFilms = films.length === total.videos;
  const folders = foldersAt(files, []).filter(g => !(allFilms && g.photos === 0 && g.other === 0 && g.videos > 0));
  const loose = files.filter(f => segs(f).length === 0 && !isVid(f));

  // On a phone the words sit on the photo (it is tall); on a wider screen they sit under it,
  // so they never cover the faces the studio chose to keep in view.
  const title = (
    <>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70">{studio.name.toUpperCase()}</p>
      <CoverTitle className="mt-2 text-[38px] sm:text-[52px]">{programName(b)}</CoverTitle>
      {dateLine(b) && <p className="mt-2 text-[13px] text-white/80 tabular-nums">{dateLine(b)}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {folders.length > 0 && (
          <button type="button" onClick={() => setPath([folders[0].name])}
            className="h-11 px-5 rounded-full bg-white text-[#17151F] text-[14px] font-bold hover:bg-white/90">View photos</button>
        )}
        <a href={zip()} className="h-11 px-5 rounded-full border border-white/45 text-white text-[14px] font-semibold inline-flex items-center gap-2 hover:bg-white/10">
          <Download className="w-4 h-4" />Download all
        </a>
      </div>
    </>
  );
  return (
    <div className="rounded-[26px] overflow-hidden bg-[#0F0E12] text-white">
      <Cover cover={b.cover} studio={studio.name} dim={b.cover ? "bottom" : "none"} className="h-[min(62vh,460px)] sm:h-[420px] sm:[&>div:nth-child(2)]:opacity-40">
        <div className="absolute inset-x-0 bottom-0 p-5 text-center sm:hidden">{title}</div>
      </Cover>
      <div className="hidden sm:block px-8 pt-8 text-center">{title}</div>

      <div className="px-4 sm:px-8 pt-4 pb-6 sm:pb-8 space-y-7">
        <p className="text-center text-[12.5px] text-white/60 tabular-nums">{kindOf(total.photos, total.videos, total.other)} · {bytes(total.size)}</p>

        {films.length > 0 && (
          <section aria-labelledby="films" className="space-y-3">
            <h2 id="films" className="text-[15px] font-bold">Films</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {films.map((f, i) => (
                <a key={f.id} href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer"
                  className={cn("group relative rounded-2xl overflow-hidden bg-white/5 aspect-video", i === 0 && films.length % 2 === 1 && "col-span-2 lg:col-span-1")}>
                  {f.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbAt(f.thumb, 800)} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-11 h-11 rounded-full bg-white/90 text-[#17151F] flex items-center justify-center"><Play className="w-4 h-4 ml-0.5" fill="currentColor" /></span>
                  </span>
                  <span className="absolute left-3 right-3 bottom-2.5 text-[12.5px] font-semibold truncate">{f.fileName.replace(/\.[^.]+$/, "")}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {folders.length > 0 && (
          <section aria-labelledby="photos" className="space-y-3">
            <h2 id="photos" className="text-[15px] font-bold">Photos</h2>
            <FolderTiles folders={folders} onOpen={name => setPath([name])} dark />
          </section>
        )}

        {loose.length > 0 && <PhotoGrid files={loose} dark />}
      </div>
    </div>
  );
}

type FolderInfo = { name: string; photos: number; videos: number; other: number; cover: string | null };
function foldersAt(files: PortalDriveFile[], here: string[]): FolderInfo[] {
  const map = new Map<string, FolderInfo>();
  for (const f of files) {
    const s = segs(f);
    if (s.length <= here.length || here.some((x, i) => s[i] !== x)) continue;
    const name = s[here.length];
    const g = map.get(name) ?? { name, photos: 0, videos: 0, other: 0, cover: null };
    if (isImg(f)) { g.photos++; if (!g.cover && f.thumb) g.cover = f.thumb; } else if (isVid(f)) g.videos++; else g.other++;
    if (!g.cover && isVid(f) && f.thumb) g.cover = f.thumb;
    map.set(name, g);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function FolderTiles({ folders, onOpen, dark }: { folders: FolderInfo[]; onOpen: (name: string) => void; dark?: boolean }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-4">
      {folders.map(g => (
        <button key={g.name} type="button" onClick={() => onOpen(g.name)} className="group text-left">
          <span className={cn("block relative aspect-[4/3] rounded-2xl overflow-hidden", dark ? "bg-white/5" : "bg-[#ECEAF0]")}>
            {g.cover
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={thumbAt(g.cover, 700)} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              : <span className="absolute inset-0 flex items-center justify-center"><Folder className={cn("w-7 h-7", dark ? "text-white/40" : "text-[#A29DB3]")} /></span>}
          </span>
          <span className="mt-2 block text-[14px] font-bold truncate">{g.name}</span>
          <span className={cn("block text-[12.5px]", dark ? "text-white/60" : "text-[#6B6680]")}>{kindOf(g.photos, g.videos, g.other)}</span>
        </button>
      ))}
    </div>
  );
}

function PhotoGrid({ files, dark }: { files: PortalDriveFile[]; dark?: boolean }) {
  const list = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
  const shown = list.slice(0, 400);
  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1 sm:gap-1.5">
        {shown.map(f => (
          <div key={f.id} className={cn("group relative aspect-square overflow-hidden rounded-[6px]", dark ? "bg-white/5" : "bg-[#ECEAF0]")}>
            <a href={f.viewUrl || f.downloadUrl || "#"} target="_blank" rel="noopener noreferrer" title={f.fileName} className="absolute inset-0">
              {f.thumb
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={thumbAt(f.thumb, 500)} alt={f.fileName} referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                : <span className={cn("w-full h-full flex items-center justify-center p-2 text-[11px] text-center break-all", dark ? "text-white/60" : "text-[#6B6680]")}>{f.fileName}</span>}
              {isVid(f) && <span className="absolute inset-0 flex items-center justify-center"><span className="w-9 h-9 rounded-full bg-white/90 text-[#17151F] flex items-center justify-center"><Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" /></span></span>}
            </a>
            {f.downloadUrl && (
              <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer" aria-label={`Download ${f.fileName}`}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/45 text-white hidden sm:flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
      {list.length > shown.length && <p className={cn("mt-3 text-[12.5px]", dark ? "text-white/60" : "text-[#6B6680]")}>+{list.length - shown.length} more — download the folder to get them all.</p>}
    </div>
  );
}

/** One folder: back, its name, Download folder, sub-folders, then its photos. */
function FolderView({ files, path, onPath, zip }: { files: PortalDriveFile[]; path: string[]; onPath: (p: string[]) => void; zip: (folder?: string) => string }) {
  const sub = foldersAt(files, path);
  const here = files.filter(f => { const s = segs(f); return s.length === path.length && path.every((x, i) => s[i] === x); });
  const n = files.filter(f => { const s = segs(f); return s.length >= path.length && path.every((x, i) => s[i] === x); });
  return (
    <div className="rounded-[26px] bg-[#0F0E12] text-white px-3 sm:px-6 pt-3 sm:pt-5 pb-6">
      <div className="flex items-center gap-2 sm:gap-3 px-1">
        <button type="button" onClick={() => onPath(path.slice(0, -1))} aria-label="Back"
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center flex-shrink-0"><ArrowLeft className="w-[18px] h-[18px]" /></button>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold truncate">{path[path.length - 1]}</p>
          <p className="text-[12.5px] text-white/60">{kindOf(n.filter(isImg).length, n.filter(isVid).length, n.filter(f => !isImg(f) && !isVid(f)).length)}</p>
        </div>
        <a href={zip(path[0])} className="h-10 px-4 rounded-full bg-white text-[#17151F] text-[13px] font-bold inline-flex items-center gap-1.5 flex-shrink-0">
          <Download className="w-4 h-4" /><span className="hidden sm:inline">Download</span> folder
        </a>
      </div>
      <div className="mt-4 space-y-5">
        {sub.length > 0 && <FolderTiles folders={sub} onOpen={name => onPath([...path, name])} dark />}
        {here.length > 0 && <PhotoGrid files={here} dark />}
        {!sub.length && !here.length && <p className="py-10 text-center text-[13px] text-white/60">This folder is empty.</p>}
      </div>
    </div>
  );
}

// ─── Money due: the lock ─────────────────────────────────────────────────────

export function LockedFiles({ b, studio, due }: { b: PortalBooking; studio: Studio; due: number }) {
  const [copied, setCopied] = useState("");
  const preview = b.delivery?.preview ?? [];
  const photos = preview.reduce((s, g) => s + g.photos, 0);
  const videos = preview.reduce((s, g) => s + g.videos, 0);
  const other = preview.reduce((s, g) => s + g.count - g.photos - g.videos, 0);
  const links = b.delivery?.links.length ?? 0;
  const what = kindOf(photos, videos, other) || (links ? plural(links, "link") : "");
  const ways = [studio.bkashNumber && { label: "bKash", n: studio.bkashNumber }, studio.nagadNumber && { label: "Nagad", n: studio.nagadNumber }].filter(Boolean) as { label: string; n: string }[];
  const told = waLink(studio.phone, `Hi ${studio.name}, I've paid ${money(due, b.currency)} for ${programName(b)}. Please open my files.`);
  async function copy(n: string) {
    try { await navigator.clipboard.writeText(n.replace(/\s/g, "")); setCopied(n); setTimeout(() => setCopied(""), 1800); }
    catch { notify("Couldn't copy", { error: true }); }
  }
  return (
    <div>
      <Cover cover={b.cover} studio={studio.name} blur dim="all" className="h-[300px] sm:h-[320px] rounded-[26px]">
        <div className="absolute inset-x-0 bottom-0 px-5 pb-12 text-center text-white">
          <span className="mx-auto w-12 h-12 rounded-full bg-white/15 border border-white/35 flex items-center justify-center"><Lock className="w-5 h-5" /></span>
          <CoverTitle className="mt-3 text-[34px] sm:text-[40px]">Your photos are ready</CoverTitle>
          {what && <p className="mt-1.5 text-[13.5px] text-white/85">{what} waiting for you</p>}
        </div>
      </Cover>

      <div className="relative -mt-7 mx-2 sm:mx-auto sm:max-w-[520px] bg-white rounded-[22px] p-5 shadow-[0_1px_2px_rgba(22,18,40,.05),0_18px_40px_-24px_rgba(22,18,40,.45)]">
        <p className="text-[13px] font-semibold text-[#6B6680]">Pay the rest and they open here</p>
        <p className="mt-1 text-[32px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums">{money(due, b.currency)}</p>
        <p className="text-[13px] text-[#6B6680] tabular-nums">{money(b.paidAmount, b.currency)} of {money(b.grandTotal, b.currency)} paid</p>
        {ways.length > 0 && (
          <div className="mt-4 space-y-2">
            {ways.map(w => (
              <div key={w.label} className="flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-2xl border border-[#ECEAF0]">
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-semibold text-[#6B6680]">{w.label}</span>
                  <span className="block text-[16px] font-bold text-[#17151F] tabular-nums">{w.n}</span>
                </span>
                <button type="button" onClick={() => copy(w.n)} aria-label={`Copy the ${w.label} number`}
                  className="h-10 px-3.5 rounded-xl bg-[#F3F3F1] hover:bg-[#ECEAF0] text-[13px] font-bold text-[#17151F] inline-flex items-center gap-1.5">
                  {copied === w.n ? <><Check className="w-4 h-4 text-[#1F8A5B]" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                </button>
              </div>
            ))}
          </div>
        )}
        {told && (
          <a href={told} target="_blank" rel="noopener noreferrer"
            className="mt-4 h-12 rounded-2xl bg-[#17151F] hover:bg-[#2A2733] text-white text-[14.5px] font-bold flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" />I&apos;ve paid — tell {studio.name}
          </a>
        )}
        <p className="mt-2.5 text-center text-[12.5px] text-[#6B6680]">They check the payment and open your files.</p>
      </div>

      {preview.length > 0 && (
        <section aria-labelledby="waiting" className="mt-6 sm:max-w-[520px] sm:mx-auto">
          <h2 id="waiting" className="px-2 mb-2 text-[13px] font-bold text-[#6B6680]">What is waiting</h2>
          <ul className="bg-white rounded-[20px] px-4 divide-y divide-[#F0EEF3]">
            {preview.map(g => (
              <li key={g.name} className="min-h-[48px] flex items-center gap-3">
                <span className="flex-1 min-w-0 text-[14px] font-semibold text-[#17151F] truncate">{g.name}</span>
                <span className="text-[12.5px] text-[#6B6680] tabular-nums">{kindOf(g.photos, g.videos, g.count - g.photos - g.videos)}</span>
                <Lock className="w-3.5 h-3.5 text-[#A29DB3]" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Files are on their way (nothing delivered yet). */
export function FilesSoon({ b, studio }: { b: PortalBooking; studio: Studio }) {
  return (
    <Cover cover={b.cover} studio={studio.name} dim="all" className="h-[260px] rounded-[26px]">
      <div className="absolute inset-x-0 bottom-0 p-6 text-center text-white">
        <CoverTitle className="text-[30px] sm:text-[36px]">Your photos are on their way</CoverTitle>
        <p className="mt-2 text-[13.5px] text-white/85">{studio.name} is working on them. They open right here when they are ready.</p>
      </div>
    </Cover>
  );
}

/** Older deliveries: links the studio added. */
/** Where a link goes, in words a client knows ("Google Drive"), never the long address. */
function linkPlace(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.includes("drive.google") || h.includes("docs.google")) return "Google Drive";
    if (h.includes("photos.google") || h === "photos.app.goo.gl") return "Google Photos";
    if (h.includes("dropbox")) return "Dropbox";
    if (h.includes("youtu")) return "YouTube";
    if (h.includes("wetransfer") || h === "we.tl") return "WeTransfer";
    if (h.includes("onedrive") || h.includes("1drv")) return "OneDrive";
    return h;
  } catch { return "Link"; }
}

/**
 * Files the studio delivered as links. `main` = the links are the whole delivery (no photos shown here):
 * a clear "ready" card with one big button per link. Otherwise a quiet list under the gallery.
 */
export function LinkList({ links, main }: { links: { id: string; title: string; url: string | null }[]; main?: boolean }) {
  const open = links.filter(l => !!l.url);
  if (!open.length) return null;
  if (main) {
    return (
      <section aria-label="Your files" className="bg-white rounded-[22px] p-5 sm:p-7 shadow-[0_1px_2px_rgba(22,18,40,.05),0_10px_28px_-20px_rgba(22,18,40,.28)]">
        <p className="text-[12.5px] font-semibold text-[#1F8A5B]">Ready</p>
        <h2 className="mt-1 text-[22px] sm:text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">Your files are ready</h2>
        <p className="mt-1.5 text-[14px] text-[#6B6680]">{open.length === 1 ? "Tap the button to open them. Save your favourites to your phone or computer." : "Each button opens one set of files. Save your favourites to your phone or computer."}</p>
        <ul className="mt-5 space-y-2.5">
          {open.map((l, i) => (
            <li key={l.id}>
              <a href={l.url!} target="_blank" rel="noopener noreferrer"
                className={cn("min-h-[56px] px-5 rounded-2xl flex items-center gap-3 transition-colors",
                  i === 0 ? "bg-[#17151F] hover:bg-[#2A2733] text-white" : "bg-[#F3F3F1] hover:bg-[#ECEAF0] text-[#17151F]")}>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold truncate">{open.length === 1 && !l.title ? "Open your files" : `Open ${l.title || "your files"}`}</span>
                  <span className={cn("block text-[12.5px] truncate", i === 0 ? "text-white/65" : "text-[#6B6680]")}>Opens in {linkPlace(l.url!)}</span>
                </span>
                <ExternalLink className="w-[18px] h-[18px] flex-shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <ul className="bg-white rounded-[20px] px-4 divide-y divide-[#F0EEF3]">
      {open.map(l => (
        <li key={l.id}>
          <a href={l.url!} target="_blank" rel="noopener noreferrer" className="min-h-[52px] flex items-center gap-3 text-[#17151F]">
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold truncate">{l.title || "Your files"}</span>
              <span className="block text-[12px] text-[#6B6680] truncate">Opens in {linkPlace(l.url!)}</span>
            </span>
            <ExternalLink className="w-4 h-4 text-[#9A95A8]" />
          </a>
        </li>
      ))}
    </ul>
  );
}
