/**
 * Photo selection (albums): shared types and helpers for the studio pages and the client portal.
 */

export type Mark = "selected" | "important" | "rejected";
export const PICKED: Mark[] = ["selected", "important"];
export const isPicked = (m?: Mark | null) => m === "selected" || m === "important";

/** A photo, in the short form the API sends (thousands per gallery). */
export type GPhoto = {
  id: string; a: string; n: string; w: number | null; h: number | null;
  m: Mark | null; no: string | null; hl: boolean;
  /** Folder inside the album ("Holud", "Wedding"); null = none */
  f: string | null;
  /** The file on Google Drive (the picture is loaded straight from Google) */
  d: string | null;
  /** studio only */
  st?: "pending" | "processing" | "ready" | "failed"; err?: string | null; src?: string; t?: boolean;
};

export type Album = {
  id: string; name: string; minPicks: number | null; maxPicks: number | null; allowExtra?: boolean; limit: string;
  picked: number; total?: number; ready?: number; important?: number; rejected?: number; sortOrder?: number;
};

export type GalleryStatus = "preparing" | "open" | "submitted" | "taken" | "closed";

export type GalleryCard = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; submittedAt: string | null; takenAt: string | null;
  reopenRequestedAt: string | null; changedAfterSubmitAt: string | null; createdAt: string; updatedAt: string;
  program: { id: string; name: string; number: string; date: string | null };
  client: { id: string; name: string };
  albums: { id: string; name: string; minPicks: number | null; maxPicks: number | null; limit: string; picked: number; total: number }[];
  counts: Counts; covers: string[];
};

export type Counts = { total: number; ready: number; failed: number; working: number; picked: number; important: number; rejected: number };

export type GalleryDetail = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; allowNotes: boolean; welcome: string | null;
  clientNote: string | null; submittedAt: string | null; changedAfterSubmitAt: string | null; takenAt: string | null;
  reopenRequestedAt: string | null; reopenReason: string | null; createdAt: string; updatedAt: string;
  program: { id: string; name: string; number: string; date: string | null };
  client: { id: string; name: string; firstName: string; lastName: string | null; phone: string | null; email: string | null };
  albums: Album[]; counts: Counts; photos: GPhoto[];
  /** What the client has done so far, also before sending */
  activity?: { opens: number; lastOpenAt: string | null; lastPickAt: string | null };
};

export type ClientGalleryCard = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; bookingId: string; program: string; submittedAt: string | null;
  photos: number; picked: number; albums: { id: string; name: string; minPicks: number | null; maxPicks: number | null; limit: string; picked: number }[];
  covers: string[];
};

export type ClientGallery = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; welcome: string | null; allowNotes: boolean;
  clientNote: string | null; submittedAt: string | null; takenAt: string | null; reopenRequestedAt: string | null;
  studio: string; canChange: boolean; lockedWhy: string;
  /** For the welcome screen */
  studioLogo?: string | null; clientName?: string; program?: { name: string | null; date: string | null };
  albums: Album[]; photos: GPhoto[];
};

/**
 * Picture link for a photo: it comes straight from Google Drive at the width asked
 * (Google makes the size; we keep no copy). The file is open "to anyone with the link".
 */
export const THUMB_W = 480;
export const VIEW_W = 1600;
export const drivePhoto = (driveFileId: string, width: number = THUMB_W) => `https://lh3.googleusercontent.com/d/${driveFileId}=w${width}`;
/** Small (grid) and big (opened) links of a photo; "" while it is not ready. */
export const thumbOf = (p: { d: string | null }) => (p.d ? drivePhoto(p.d, THUMB_W) : "");
export const viewOf = (p: { d: string | null }) => (p.d ? drivePhoto(p.d, VIEW_W) : "");
/** A sharper copy, loaded only when someone zooms in. */
export const ZOOM_W = 2560;
export const zoomOf = (p: { d: string | null }) => (p.d ? drivePhoto(p.d, ZOOM_W) : "");

/** The folders inside an album, in the order the photos come (photos without one are last, as ""). */
export function foldersOf(photos: { a: string; f: string | null }[], albumId?: string) {
  const names: string[] = [];
  let loose = false;
  for (const p of photos) {
    if (albumId && p.a !== albumId) continue;
    if (!p.f) { loose = true; continue; }
    if (!names.includes(p.f)) names.push(p.f);
  }
  return names.length && loose ? [...names, ""] : names;
}

/** Where uploads from a phone or computer go inside the program's Drive folder. */
export const UPLOAD_PATH = "Album selection/Photos to choose";

export const STATUS_LABEL: Record<GalleryStatus, string> = {
  preparing: "Getting ready", open: "Client is choosing", submitted: "Client sent", taken: "Album started", closed: "Closed",
};

export const STATUS_STYLE: Record<GalleryStatus, string> = {
  preparing: "bg-white/90 text-[#4A4658]",
  open: "bg-[#EEE8FD] text-[#5B3FD0]",
  submitted: "bg-[#E2F4EA] text-[#1F8A5B]",
  taken: "bg-[#E6EEF8] text-[#1F5C99]",
  closed: "bg-[#F5F3FA] text-[#A29DB3]",
};

/** "just now", "12 min ago", "3 hours ago", "2 days ago" */
export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** "3 days left", "Ends today", "Ended" */
export function timeLeft(deadline: string | null, now = Date.now()) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return { text: "Time is over", over: true, soon: true };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 2) return { text: `${days} days left`, over: false, soon: days <= 3 };
  if (days === 1) return { text: `1 day ${hours}h left`, over: false, soon: true };
  const mins = Math.floor((ms % 3600000) / 60000);
  return { text: hours ? `${hours}h ${mins}m left` : `${mins} min left`, over: false, soon: true };
}

/** "60–80", "up to 80", "at least 60", "" — with the count: "42 / 60–80" */
export function albumProgress(a: { minPicks: number | null; maxPicks: number | null; limit: string }, picked: number) {
  const under = a.minPicks !== null && picked < a.minPicks;
  const over = a.maxPicks !== null && picked > a.maxPicks;
  const full = a.maxPicks !== null && picked >= a.maxPicks;
  const target = a.maxPicks ?? a.minPicks ?? 0;
  const pct = target ? Math.min(100, Math.round((picked / target) * 100)) : picked ? 100 : 0;
  const okRange = picked > 0 && !under && !over && (a.minPicks !== null || a.maxPicks !== null);
  return { under, over, full, pct, okRange, text: a.limit ? `${picked} / ${a.limit}` : `${picked}` };
}

/** File names, one per line — paste into Lightroom's search or a text file. Grouped by album, then folder. */
export function namesList(photos: GPhoto[], albums: { id: string; name: string }[], which: "picked" | "important" = "picked", byAlbum = true) {
  const keep = photos.filter(p => (which === "important" ? p.m === "important" : isPicked(p.m)));
  if (!byAlbum) return keep.map(p => p.n).join("\n");
  return albums
    .map(a => ({ a, list: keep.filter(p => p.a === a.id) }))
    .filter(x => x.list.length)
    .map(x => {
      const folders = foldersOf(x.list);
      const body = folders.length
        ? folders.map(f => { const l = x.list.filter(p => (p.f ?? "") === f); return `-- ${f || "Other photos"} (${l.length}) --\n${l.map(p => p.n).join("\n")}`; }).join("\n\n")
        : x.list.map(p => p.n).join("\n");
      return `${x.a.name} (${x.list.length})\n${body}`;
    })
    .join("\n\n");
}

/** A CSV the studio can open in Excel: album, file, mark, note. */
export function namesCsv(photos: GPhoto[], albums: { id: string; name: string }[]) {
  const name = new Map(albums.map(a => [a.id, a.name]));
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = photos.filter(p => p.m).map(p => [name.get(p.a) ?? "", p.f ?? "", p.n, p.m === "important" ? "Important" : p.m === "selected" ? "Selected" : "Rejected", p.no ?? ""].map(esc).join(","));
  return ["Album,Folder,File,Mark,Note", ...rows].join("\n");
}

// ─── Uploads from a phone or computer (they go to the program's Drive folder) ─

const OK_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/i;
const RAW_EXT = /\.(cr2|cr3|nef|nrw|arw|srf|sr2|raf|rw2|orf|dng|pef|x3f|srw|3fr|iiq)$/i;
export const isRawName = (n: string) => RAW_EXT.test(n);
export const canUpload = (f: File) => OK_TYPES.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

/** Group files picked as folders by their folder name ("Wedding/IMG_1.jpg" → "Wedding"). Loose files → "". */
export function byFolder(files: File[]) {
  const map = new Map<string, File[]>();
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    const parts = rel.split("/").filter(Boolean);
    const folder = parts.length > 1 ? parts[parts.length - 2] : "";
    map.set(folder, [...(map.get(folder) ?? []), f]);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return map;
}

// ─── After the client has chosen (phase 2–3) ─────────────────────────────────

export type DriveCopy = {
  state: "running" | "done" | "failed";
  total: number; done: number; copied: number; skipped: number; failed: number;
  notOnDrive: number;
  startedAt: string; finishedAt?: string; error?: string;
  folders: { email: string; url: string }[];
};
export type Handoff = {
  drive: DriveCopy | null;
  designer: { userId: string; name: string; assignmentId: string; status: string; deadline: string | null } | null;
  share: { token: string; url: string } | null;
};

/** Folder names used on Drive and on the computer. */
export const MARK_FOLDER = { important: "Most important", selected: "Chosen" } as const;
/** "Md / Bappy's" → a name a folder can have. */
export const folderName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Photos";

/** The family's view-only page. */
export type SharedGallery = {
  id: string; title: string;
  studio: { name: string; logoUrl: string | null; phone: string | null };
  client: string;
  event: { name: string | null; date: string | null };
  albums: { id: string; name: string }[];
  photos: { id: string; a: string; w: number | null; h: number | null; hl: boolean; f: string | null; d: string | null; c: boolean }[];
};
