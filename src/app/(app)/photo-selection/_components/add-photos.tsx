"use client";

/**
 * Add photos to a selection, three ways:
 *  - From the program's raw files on Drive (already uploaded through StuPanel)
 *  - From the program's delivery (edited photos) on Drive
 *  - From this computer: the browser makes a small copy of each photo and uploads only that
 * Each Drive folder / computer folder can become its own album.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FolderOpen, HardDrive, ImagePlus, Images, Loader2, MonitorUp, PackageCheck, TriangleAlert } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { FormDrawer } from "@/components/ui/form-kit";
import { CARD_SHADOW } from "@/components/ui/apple";
import { byFolder, canUpload, isRawName, makeUploadCopy, type Album } from "@/lib/photos";

type Folder = { path: string; photos: number; bytes: number; other: number };
type Sources = { driveConnected: boolean; raw: Folder[]; delivery: Folder[]; storage: { enabled: boolean; limitBytes: number; usedBytes: number; perPhotoBytes: number } };
type Tab = "raw" | "delivery" | "computer";
export type UploadState = { total: number; done: number; failed: number; skipped: number; current: string; running: boolean; notes: string[] };

const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`);
const folderLabel = (p: string) => p || "Main folder";
const lastPart = (p: string) => p.split("/").filter(Boolean).pop() || "Photos";
const NEW = "__new__";
/** An album that fits a folder name: same name, or one name inside the other ("Holud" ↔ "Gaye Holud"). */
const fitAlbum = (albums: Album[], folder: string) => {
  const f = folder.trim().toLowerCase();
  if (!f) return undefined;
  return albums.find(a => a.name.toLowerCase() === f) ?? albums.find(a => { const n = a.name.toLowerCase(); return n.includes(f) || f.includes(n); });
};

/** Upload photos from this computer into albums (album id, or a name to create). Runs on after the drawer closes. */
export async function uploadPhotos(galleryId: string, groups: { albumId?: string; albumName?: string; files: File[] }[], onState: (s: UploadState) => void) {
  const st: UploadState = { total: 0, done: 0, failed: 0, skipped: 0, current: "", running: true, notes: [] };
  const push = () => onState({ ...st, notes: [...st.notes] });
  const ready = groups.map(g => {
    const ok = g.files.filter(canUpload);
    const raw = g.files.filter(f => isRawName(f.name)).length;
    st.skipped += g.files.length - ok.length;
    if (raw) st.notes.push(`${raw} RAW file${raw > 1 ? "s" : ""} skipped — add RAW photos from "Raw files" (Drive) instead.`);
    return { ...g, files: ok };
  });
  st.total = ready.reduce((n, g) => n + g.files.length, 0);
  push();
  for (const g of ready) {
    if (!g.files.length) continue;
    let albumId = g.albumId;
    if (!albumId) {
      const r = await apiFetch(`${API}/photo-selection/${galleryId}/albums`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: g.albumName || "Photos" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { st.failed += g.files.length; st.notes.push(Array.isArray(d.message) ? d.message[0] : d.message || "Could not make the album"); push(); continue; }
      albumId = d.id;
    }
    for (let i = 0; i < g.files.length; i += 100) {
      const chunk = g.files.slice(i, i + 100);
      const r = await apiFetch(`${API}/photo-selection/${galleryId}/uploads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId, files: chunk.map(f => ({ name: f.name, size: f.size })) }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok) { st.failed += chunk.length; st.notes.push(Array.isArray(d.message) ? d.message[0] : d.message || "Upload could not start — check your internet"); push(); if (r?.status === 400 || r?.status === 403) { st.running = false; push(); return st; } continue; }
      const slots: { id: string; url: string }[] = d.files;
      const ok: string[] = [], bad: string[] = [];
      let next = 0;
      const worker = async () => {
        while (next < slots.length) {
          const k = next++;
          const f = chunk[k], slot = slots[k];
          st.current = f.name; push();
          try {
            const copy = await makeUploadCopy(f);
            let sent = false;
            for (let attempt = 0; attempt < 3 && !sent; attempt++) {
              const put = await fetch(slot.url, { method: "PUT", body: copy.blob, headers: { "Content-Type": "image/jpeg" } }).catch(() => null);
              sent = !!put?.ok;
            }
            if (!sent) throw new Error("upload");
            ok.push(slot.id); st.done++;
          } catch {
            bad.push(slot.id); st.failed++;
          }
          push();
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      await apiFetch(`${API}/photo-selection/${galleryId}/uploads/done`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: ok, failed: bad }),
      }).catch(() => null);
    }
  }
  st.running = false; st.current = ""; push();
  return st;
}

export function AddPhotos({ galleryId, programId, albums, onClose, onAdded, onUpload }: {
  galleryId: string; programId: string; albums: Album[];
  onClose: () => void; onAdded: () => void;
  onUpload: (groups: { albumId?: string; albumName?: string; files: File[] }[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("raw");
  const [src, setSrc] = useState<Sources | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({}); // folder path → album id or NEW
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<string>(albums[0]?.id ?? NEW);
  const [perFolder, setPerFolder] = useState(true);
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch(`${API}/photo-selection/sources/${programId}`).then(r => (r.ok ? r.json() : null)).then((d: Sources | null) => {
      setSrc(d);
      if (d && !d.raw.length) setTab(d.delivery.length ? "delivery" : "computer");
    }).catch(() => setSrc(null));
  }, [programId]);

  useEffect(() => { setChosen({}); setNames({}); }, [tab]);

  const folders = tab === "raw" ? src?.raw ?? [] : tab === "delivery" ? src?.delivery ?? [] : [];
  const picked = folders.filter(f => chosen[f.path]);
  const pickedCount = picked.reduce((n, f) => n + f.photos, 0);
  const groups = useMemo(() => byFolder(files), [files]);
  const uploadable = files.filter(canUpload).length;
  const left = src?.storage.limitBytes ? src.storage.limitBytes - src.storage.usedBytes : null;
  const need = (tab === "computer" ? uploadable : pickedCount) * (src?.storage.perPhotoBytes ?? 360 * 1024);
  const tooBig = left !== null && need > left;

  function toggle(f: Folder) {
    setChosen(c => {
      const n = { ...c };
      if (n[f.path]) delete n[f.path];
      else {
        const same = fitAlbum(albums, lastPart(f.path));
        // Only one album and it is still empty (and no other folder is going there): fill it first
        const lone = albums.length === 1 && !albums[0].total && !Object.values(n).includes(albums[0].id) ? albums[0] : undefined;
        n[f.path] = same ? same.id : lone ? lone.id : NEW;
      }
      return n;
    });
  }

  async function importNow() {
    if (!picked.length) return;
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/photo-selection/${galleryId}/import`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: tab, folders: picked.map(f => chosen[f.path] === NEW
            ? { path: f.path, albumName: (names[f.path] ?? lastPart(f.path)).trim() || lastPart(f.path) }
            : { path: f.path, albumId: chosen[f.path] }),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't add", { error: true }); return; }
      notify(d.added ? `${d.added} photos added — previews are being made` : d.skipped || "Nothing new to add");
      onAdded(); onClose();
    } finally { setBusy(false); }
  }

  function startUpload() {
    if (!uploadable) return;
    const g: { albumId?: string; albumName?: string; files: File[] }[] = [];
    if (perFolder && groups.size > 1) {
      for (const [folder, list] of groups) {
        const same = fitAlbum(albums, folder || "");
        if (!folder) g.push(target === NEW ? { albumName: "Photos", files: list } : { albumId: target, files: list });
        else g.push(same ? { albumId: same.id, files: list } : { albumName: folder, files: list });
      }
    } else {
      const all = [...groups.values()].flat();
      const folder = [...groups.keys()][0];
      g.push(target === NEW ? { albumName: folder || "Photos", files: all } : { albumId: target, files: all });
    }
    onUpload(g);
    onClose();
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; n?: number }[] = [
    { id: "raw", label: "Raw files", icon: HardDrive, n: src?.raw.reduce((n, f) => n + f.photos, 0) },
    { id: "delivery", label: "Delivery", icon: PackageCheck, n: src?.delivery.reduce((n, f) => n + f.photos, 0) },
    { id: "computer", label: "This computer", icon: MonitorUp },
  ];

  const albumSelect = (value: string, onChange: (v: string) => void, newLabel: string, label: string) => (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="h-9 pl-3 pr-8 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] outline-none max-w-[200px]">
      <option value={NEW}>{newLabel}</option>
      {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  );

  return (
    <FormDrawer open onClose={onClose} icon={ImagePlus} color="red" title="Add photos" sub="Clients see a small copy with your watermark"
      footer={
        <>
          <p className={cn("flex-1 self-center text-[13px]", tooBig ? "text-[#C2304F] font-semibold" : "text-[#6B6680]")}>
            {tooBig ? `Not enough cloud storage (${mb(need)} needed, ${mb(Math.max(0, left ?? 0))} left)`
              : tab === "computer" ? (uploadable ? `${uploadable} photos · about ${mb(need)} of storage` : "Choose a folder or photos")
              : pickedCount ? `${pickedCount} photos · about ${mb(need)} of storage` : "Tick the folders to add"}
          </p>
          {tab === "computer" ? (
            <button type="button" onClick={startUpload} disabled={!uploadable || tooBig}
              className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">
              <MonitorUp className="w-4 h-4" />Upload
            </button>
          ) : (
            <button type="button" onClick={importNow} disabled={!pickedCount || busy || tooBig}
              className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Add {pickedCount || ""} photos
            </button>
          )}
        </>
      }>
      <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-[18px] bg-white mb-4 shadow-[0_1px_2px_rgba(22,18,40,.05)]" role="tablist" aria-label="Where from">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("rounded-[14px] py-2.5 px-2 flex flex-col items-center gap-1 transition-all",
              tab === t.id ? "bg-[#7D5CEF] text-white shadow-[0_8px_18px_-10px_rgba(125,92,239,.8)]" : "text-[#4A4658] hover:bg-[#F5F3FA]")}>
            <t.icon className="w-5 h-5" />
            <span className="text-[12.5px] font-bold leading-tight text-center">{t.label}</span>
            {t.n !== undefined && <span className={cn("text-[12px]", tab === t.id ? "text-white/80" : "text-[#6B6680]")}>{src ? `${t.n} photos` : "…"}</span>}
          </button>
        ))}
      </div>

      {src && !src.storage.enabled && (
        <div className="mb-4 rounded-[16px] bg-[#FDECEF] p-3.5 flex gap-2.5 text-[13px] text-[#6E1C2D]">
          <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#C2304F]" />
          <p>Photo selection keeps small copies in StuPanel cloud storage, which is not on for your studio yet. Please contact support.</p>
        </div>
      )}

      {tab !== "computer" ? (
        src === null ? <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="sp-skel h-14 rounded-[16px]" />)}</div>
          : folders.length === 0 ? (
            <div className={cn("bg-white rounded-[20px] p-6 text-center", CARD_SHADOW)}>
              <FolderOpen className="w-8 h-8 text-[#A29DB3] mx-auto" />
              <p className="text-[14px] font-semibold text-[#17151F] mt-2">No photos here yet</p>
              <p className="text-[13px] text-[#6B6680] mt-1">
                {!src.driveConnected ? "Connect Google Drive in Settings first."
                  : tab === "raw" ? "Upload the photos in the program's Raw files, or choose “This computer”."
                  : "Approved edited photos show up here."}
              </p>
            </div>
          ) : (
            <div className={cn("bg-white rounded-[20px] divide-y divide-[#EEEBF4] overflow-hidden", CARD_SHADOW)}>
              {folders.map(f => {
                const on = !!chosen[f.path];
                return (
                  <div key={f.path} className={cn("px-3.5 py-3 transition-colors", on && "bg-[#FAF8FF]")}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={on} onChange={() => toggle(f)} className="w-5 h-5 accent-[#7D5CEF] flex-shrink-0" />
                      <span className="w-9 h-9 rounded-[10px] bg-[#FDECEF] text-[#C2304F] flex items-center justify-center flex-shrink-0"><Images className="w-4 h-4" /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-[#17151F] truncate">{folderLabel(f.path)}</span>
                        <span className="block text-[12.5px] text-[#6B6680]">{f.photos} photos · {mb(f.bytes)}{f.other ? ` · ${f.other} other files left out` : ""}</span>
                      </span>
                    </label>
                    {on && (
                      <div className="mt-2.5 ml-8 flex flex-wrap items-center gap-2 sp-fade-in">
                        <span className="text-[12.5px] text-[#6B6680]">Album</span>
                        {albumSelect(chosen[f.path], v => setChosen(c => ({ ...c, [f.path]: v })), "New album", `Album for ${folderLabel(f.path)}`)}
                        {chosen[f.path] === NEW && (
                          <input value={names[f.path] ?? lastPart(f.path)} onChange={e => setNames(n => ({ ...n, [f.path]: e.target.value }))} maxLength={80} aria-label="New album name"
                            className="h-9 px-3 rounded-full bg-[#F5F3FA] text-[13px] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF] w-40" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
      ) : (
        <div>
          <div className={cn("bg-white rounded-[20px] p-5 text-center", CARD_SHADOW)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const list = [...e.dataTransfer.files]; if (list.length) setFiles(list); }}>
            <span className="w-14 h-14 mx-auto rounded-[18px] bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center"><MonitorUp className="w-6 h-6" /></span>
            <p className="text-[15px] font-bold text-[#17151F] mt-3">Choose photos from this computer</p>
            <p className="text-[13px] text-[#6B6680] mt-1">JPG or PNG. Only a small copy is uploaded, so it&apos;s quick — your originals stay with you.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <button type="button" onClick={() => folderInput.current?.click()} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><FolderOpen className="w-4 h-4" />Choose folders</button>
              <button type="button" onClick={() => fileInput.current?.click()} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[#4A4658] text-[13px] font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />Choose photos</button>
            </div>
            <input ref={folderInput} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={e => { setFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
            <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { setFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          {files.length > 0 && (
            <div className={cn("bg-white rounded-[20px] p-4 mt-4 sp-fade-in", CARD_SHADOW)}>
              <p className="text-[14px] font-bold text-[#17151F] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />{uploadable} photos ready</p>
              {files.length > uploadable && <p className="text-[12.5px] text-[#C2304F] mt-1">{files.length - uploadable} file{files.length - uploadable > 1 ? "s" : ""} will be left out (not JPG/PNG{files.some(f => isRawName(f.name)) ? " — RAW files can be added from Raw files on Drive" : ""}).</p>}
              {groups.size > 1 && (
                <label className="flex items-center gap-2 mt-3 text-[13px] text-[#4A4658] cursor-pointer">
                  <input type="checkbox" checked={perFolder} onChange={e => setPerFolder(e.target.checked)} className="w-4 h-4 accent-[#7D5CEF]" />
                  Each folder becomes an album ({[...groups.keys()].filter(Boolean).slice(0, 4).join(", ")}{groups.size > 4 ? "…" : ""})
                </label>
              )}
              {(!perFolder || groups.size <= 1) && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[13px] text-[#6B6680]">Put them in</span>
                  {albumSelect(target, setTarget, `New album${[...groups.keys()][0] ? `: ${[...groups.keys()][0]}` : ""}`, "Album")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </FormDrawer>
  );
}
