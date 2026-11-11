/**
 * Sort the client's chosen photos on the studio's own computer (Chrome / Edge on a computer).
 * The studio picks the folder with the original photos; we find each chosen file by its name
 * (and, when asked, the RAW file with the same name) and COPY it into
 *   <picked folder>/Album selection - <title>/<album>/Most important | Chosen
 * The originals are never moved, renamed or deleted.
 */
import { MARK_FOLDER, folderName, isPicked, isRawName, type GPhoto } from "@/lib/photos";

/* Minimal File System Access types (not in every TypeScript lib yet). */
type FileHandle = { kind: "file"; name: string; getFile(): Promise<File>; createWritable(): Promise<WritableStream & { close(): Promise<void> }> };
type DirHandle = {
  kind: "directory"; name: string;
  values(): AsyncIterable<FileHandle | DirHandle>;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FileHandle>;
};

export const canSortLocally = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export type SortProgress = { phase: "reading" | "copying" | "done"; found: number; total: number; done: number; copied: number; skipped: number; current?: string };
export type SortResult = { copied: number; skipped: number; missing: string[]; folder: string; scanned: number };

const stem = (n: string) => n.replace(/\.[^.]+$/, "").toLowerCase();
const MAX_FILES = 60000;

/** Ask for the folder. Returns null when the person closes the picker. */
export async function pickFolder(): Promise<DirHandle | null> {
  try {
    return await (window as unknown as { showDirectoryPicker(o: { mode: "readwrite"; id?: string }): Promise<DirHandle> }).showDirectoryPicker({ mode: "readwrite", id: "stupanel-originals" });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return null;
    throw e;
  }
}

export async function sortLocally(dir: DirHandle, opts: {
  title: string; photos: GPhoto[]; albums: { id: string; name: string }[]; withRaw: boolean;
  onProgress: (p: SortProgress) => void; signal?: { cancelled: boolean };
}): Promise<SortResult> {
  const outName = folderName(`Album selection - ${opts.title}`);
  const chosen = opts.photos.filter(p => isPicked(p.m));
  const byName = new Map<string, FileHandle[]>();
  const byStem = new Map<string, FileHandle[]>();
  let scanned = 0;
  const p: SortProgress = { phase: "reading", found: 0, total: chosen.length, done: 0, copied: 0, skipped: 0 };

  // 1. Read the folder (and folders inside it, a few levels down) — skip our own output folder.
  const walk = async (d: DirHandle, depth: number) => {
    for await (const h of d.values()) {
      if (opts.signal?.cancelled || scanned > MAX_FILES) return;
      if (h.kind === "directory") {
        if (depth < 4 && h.name !== outName && !h.name.startsWith(".")) await walk(h, depth + 1);
        continue;
      }
      scanned++;
      const n = h.name.toLowerCase();
      byName.set(n, [...(byName.get(n) ?? []), h]);
      if (isRawName(h.name)) byStem.set(stem(h.name), [...(byStem.get(stem(h.name)) ?? []), h]);
      if (scanned % 500 === 0) { p.found = scanned; opts.onProgress({ ...p }); }
    }
  };
  await walk(dir, 0);
  p.found = scanned; p.phase = "copying"; opts.onProgress({ ...p });

  // 2. Copy each chosen photo into album / mark folders.
  const out = await dir.getDirectoryHandle(outName, { create: true });
  const albumName = new Map(opts.albums.map(a => [a.id, a.name]));
  const folders = new Map<string, DirHandle>();
  const folderFor = async (albumId: string, important: boolean) => {
    const key = `${albumId}:${important}`;
    const hit = folders.get(key); if (hit) return hit;
    const a = await out.getDirectoryHandle(folderName(albumName.get(albumId) ?? "Photos"), { create: true });
    const f = await a.getDirectoryHandle(important ? MARK_FOLDER.important : MARK_FOLDER.selected, { create: true });
    folders.set(key, f); return f;
  };
  const exists = async (d: DirHandle, name: string) => { try { await d.getFileHandle(name); return true; } catch { return false; } };
  const missing: string[] = [];

  for (const ph of chosen) {
    if (opts.signal?.cancelled) break;
    p.current = ph.n;
    const matches = [...(byName.get(ph.n.toLowerCase()) ?? []).slice(0, 1)];
    if (opts.withRaw) for (const r of byStem.get(stem(ph.n)) ?? []) if (!matches.some(m => m.name.toLowerCase() === r.name.toLowerCase())) matches.push(r);
    if (!matches.length) { missing.push(ph.n); p.done++; opts.onProgress({ ...p }); continue; }
    const target = await folderFor(ph.a, ph.m === "important");
    for (const h of matches) {
      if (await exists(target, h.name)) { p.skipped++; continue; }
      const file = await h.getFile();
      const w = await (await target.getFileHandle(h.name, { create: true })).createWritable();
      await file.stream().pipeTo(w);
      p.copied++;
    }
    p.done++;
    opts.onProgress({ ...p });
  }
  p.phase = "done"; opts.onProgress({ ...p });
  return { copied: p.copied, skipped: p.skipped, missing, folder: `${dir.name}/${outName}`, scanned };
}
