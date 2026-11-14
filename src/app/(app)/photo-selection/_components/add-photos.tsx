"use client";

/**
 * Add photos to a selection. Everything is shown straight from Google Drive, so there are three ways in:
 *  - the program's raw files on Drive
 *  - the program's delivery (edited photos) on Drive
 *  - a phone or computer: the photos are uploaded to the program's own Drive folder
 *    ("Album selection / Photos to choose / <folder>") and then added like the others
 * Several folders (Holud, Wedding, Reception) go into ONE album; each stays a folder inside it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FolderOpen, HardDrive, ImagePlus, Images, Loader2, MonitorUp, PackageCheck } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { FormDrawer } from "@/components/ui/form-kit";
import { CARD_SHADOW } from "@/components/ui/apple";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { byFolder, canUpload, isRawName, UPLOAD_PATH, type Album } from "@/lib/photos";

type Folder = { path: string; photos: number; bytes: number; other: number };
type Sources = { driveConnected: boolean; raw: Folder[]; delivery: Folder[] };
type Tab = "raw" | "delivery" | "computer";

const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`);
const folderLabel = (p: string) => p || "Main folder";
/** The name a Drive folder gets inside the album: its last part, or the part before a plain "Photo" / "JPG" folder ("Holud/Photo" → "Holud"). */
const lastPart = (p: string) => {
  if (p.toLowerCase() === UPLOAD_PATH.toLowerCase()) return ""; // loose uploads have no folder
  const parts = p.split("/").map(x => x.trim()).filter(Boolean);
  const last = parts.pop() || "";
  return /^(photos?|pictures?|images?|jpe?gs?|raws?|edited|stills?)$/i.test(last) && parts.length ? parts[parts.length - 1] : last;
};
const cleanFolder = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
const NEW = "__new__";
const errText = (d: { message?: string | string[] }, fallback: string) => (Array.isArray(d.message) ? d.message[0] : d.message || fallback);

/**
 * Ask the server to bring in the photos that are in the program's Drive upload folder but not in the selection yet.
 * The Drive folder is the truth, so a reloaded tab or an upload continued later loses nothing.
 */
export async function syncUploads(galleryId: string): Promise<number> {
  const r = await apiFetch(`${API}/photo-selection/${galleryId}/uploads/sync`, { method: "POST" }).catch(() => null);
  const d = r?.ok ? await r.json().catch(() => ({})) : {};
  return Number(d.added) || 0;
}

/**
 * Send photos from this phone or computer to the program's Drive folder; they are put in the album as they arrive.
 * The upload goes on in the corner of the screen (it can be paused and continues after a break).
 */
export async function uploadToSelection(opts: {
  galleryId: string; programId: string; programName?: string;
  groups: { folder: string; files: File[] }[]; onAdded: () => void;
}) {
  let started = 0;
  // Catch up a few seconds after files arrive (and at least every 20 s while they keep coming).
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = 0;
  const run = async () => { timer = undefined; first = 0; if (await syncUploads(opts.galleryId)) opts.onAdded(); };
  const soon = () => {
    const now = Date.now();
    if (!first) first = now;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), now - first > 20000 ? 0 : 3000);
  };
  for (const g of opts.groups) {
    const folder = cleanFolder(g.folder);
    const files = g.files.filter(canUpload);
    if (!files.length) continue;
    const path = folder ? `${UPLOAD_PATH}/${folder}` : UPLOAD_PATH;
    // A photo that is already in the Drive folder is not sent again — the catch-up adds it.
    const check = await checkDuplicates({ files, bookingId: opts.programId, folderFor: () => path, kind: "raw" }).catch(() => null);
    const plan = check ? applyDuplicateChoice(check, "skip") : { files, plans: undefined };
    started += plan.files.length;
    uploadToDrive({
      kind: "raw", files: plan.files, bookingId: opts.programId, bookingName: opts.programName,
      folderFor: () => path, plans: plan.plans, onDone: soon,
    });
  }
  soon();
  return started;
}

export function AddPhotos({ galleryId, programId, programName, albums, onClose, onAdded }: {
  galleryId: string; programId: string; programName?: string; albums: Album[];
  onClose: () => void; onAdded: () => void;
}) {
  const [tab, setTab] = useState<Tab>("raw");
  const [src, setSrc] = useState<Sources | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({}); // Drive folder path → ticked
  const [names, setNames] = useState<Record<string, string>>({}); // folder path (or computer folder) → name inside the album
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<string>(albums[0]?.id ?? NEW);
  const [newName, setNewName] = useState("Album");
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
  const nameOf = (key: string) => names[key] ?? lastPart(key);

  /** The album everything goes into (made now if "New album" is chosen). */
  async function albumId(): Promise<string | null> {
    if (target !== NEW) return target;
    const r = await apiFetch(`${API}/photo-selection/${galleryId}/albums`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() || "Album" }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { notify(errText(d, "Could not make the album"), { error: true }); return null; }
    return d.id as string;
  }

  async function importNow() {
    if (!picked.length) return;
    setBusy(true);
    try {
      const album = await albumId();
      if (!album) return;
      const r = await apiFetch(`${API}/photo-selection/${galleryId}/import`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: tab, folders: picked.map(f => ({ path: f.path, albumId: album, folder: cleanFolder(nameOf(f.path)) })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(errText(d, "Couldn't add"), { error: true }); return; }
      notify(d.added ? `${d.added} photos added — getting them ready` : d.skipped || "Nothing new to add");
      onAdded(); onClose();
    } finally { setBusy(false); }
  }

  async function startUpload() {
    if (!uploadable) return;
    setBusy(true);
    try {
      const album = await albumId();
      if (!album) return;
      const list = [...groups].map(([folder, files]) => ({ folder: cleanFolder(nameOf(folder)), files }));
      // Tell the server which album these folders belong to; the photos are put there as they arrive on Drive.
      const t = await apiFetch(`${API}/photo-selection/${galleryId}/uploads/target`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ albumId: album, folders: [...new Set(list.map(g => g.folder))] }),
      }).catch(() => null);
      if (!t?.ok) { notify("Upload could not start — check your internet", { error: true }); return; }
      const n = await uploadToSelection({ galleryId, programId, programName, onAdded, groups: list });
      notify(n ? `Uploading ${n} photo${n === 1 ? "" : "s"} to your Google Drive` : "These photos are already on Drive — adding them");
      onAdded(); onClose();
    } catch (e) {
      notify((e as Error).message || "Upload could not start", { error: true });
    } finally { setBusy(false); }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; n?: number }[] = [
    { id: "raw", label: "Raw files", icon: HardDrive, n: src?.raw.reduce((n, f) => n + f.photos, 0) },
    { id: "delivery", label: "Delivery", icon: PackageCheck, n: src?.delivery.reduce((n, f) => n + f.photos, 0) },
    { id: "computer", label: "Phone or computer", icon: MonitorUp },
  ];

  const nameInput = (key: string, label: string) => (
    <input value={nameOf(key)} onChange={e => setNames(n => ({ ...n, [key]: e.target.value }))} maxLength={120} aria-label={label} placeholder="No folder"
      className="h-9 px-3 rounded-full bg-[#F5F3FA] text-[13px] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF] w-44 max-w-full" />
  );

  return (
    <FormDrawer open onClose={onClose} icon={ImagePlus} color="red" title="Add photos" sub="Shown to the client straight from your Google Drive"
      footer={
        <>
          <p className="flex-1 self-center text-[13px] text-[#6B6680]">
            {tab === "computer" ? (uploadable ? `${uploadable} photos go to your Google Drive` : "Choose a folder or photos")
              : pickedCount ? `${pickedCount} photos` : "Tick the folders to add"}
          </p>
          {tab === "computer" ? (
            <button type="button" onClick={startUpload} disabled={!uploadable || busy}
              className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorUp className="w-4 h-4" />}Upload
            </button>
          ) : (
            <button type="button" onClick={importNow} disabled={!pickedCount || busy}
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


      {/* One album for everything that is added now */}
      <div className={cn("bg-white rounded-[20px] p-4 mb-4 flex flex-wrap items-center gap-2.5", CARD_SHADOW)}>
        <span className="text-[14px] font-bold text-[#17151F]">Album</span>
        <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Album"
          className="h-10 pl-3.5 pr-8 rounded-full bg-[#F5F3FA] text-[14px] font-semibold text-[#17151F] outline-none max-w-[220px]">
          {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value={NEW}>New album…</option>
        </select>
        {target === NEW && (
          <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={80} aria-label="New album name"
            className="h-10 px-3.5 rounded-full bg-[#F5F3FA] text-[14px] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF] w-44" />
        )}
        <p className="basis-full text-[12.5px] text-[#6B6680]">Every folder you add stays a folder inside this album (Holud, Wedding, Reception…). The client chooses from all of them for one album.</p>
      </div>

      {tab !== "computer" ? (
        src === null ? <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="sp-skel h-14 rounded-[16px]" />)}</div>
          : folders.length === 0 ? (
            <div className={cn("bg-white rounded-[20px] p-6 text-center", CARD_SHADOW)}>
              <FolderOpen className="w-8 h-8 text-[#A29DB3] mx-auto" />
              <p className="text-[14px] font-semibold text-[#17151F] mt-2">No photos here yet</p>
              <p className="text-[13px] text-[#6B6680] mt-1">
                {!src.driveConnected ? "Connect Google Drive in Settings first."
                  : tab === "raw" ? "Upload the photos in the program's Raw files, or choose “Phone or computer”."
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
                      <input type="checkbox" checked={on} onChange={() => setChosen(c => ({ ...c, [f.path]: !c[f.path] }))} className="w-5 h-5 accent-[#7D5CEF] flex-shrink-0" />
                      <span className="w-9 h-9 rounded-[10px] bg-[#FDECEF] text-[#C2304F] flex items-center justify-center flex-shrink-0"><Images className="w-4 h-4" /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-[#17151F] truncate">{folderLabel(f.path)}</span>
                        <span className="block text-[12.5px] text-[#6B6680]">{f.photos} photos · {mb(f.bytes)}{f.other ? ` · ${f.other} other files left out` : ""}</span>
                      </span>
                    </label>
                    {on && (
                      <div className="mt-2.5 ml-8 flex flex-wrap items-center gap-2 sp-fade-in">
                        <span className="text-[12.5px] text-[#6B6680]">Folder name in the album</span>
                        {nameInput(f.path, `Folder name for ${folderLabel(f.path)}`)}
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
            <p className="text-[15px] font-bold text-[#17151F] mt-3">Choose photos from this phone or computer</p>
            <p className="text-[13px] text-[#6B6680] mt-1">JPG, PNG or HEIC. They are saved in this program&apos;s folder on your Google Drive (Album selection → Photos to choose).</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <button type="button" onClick={() => folderInput.current?.click()} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><FolderOpen className="w-4 h-4" />Choose folders</button>
              <button type="button" onClick={() => fileInput.current?.click()} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[#4A4658] text-[13px] font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />Choose photos</button>
            </div>
            <input ref={folderInput} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={e => { setFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
            <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden"
              onChange={e => { setFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          {files.length > 0 && (
            <div className={cn("bg-white rounded-[20px] p-4 mt-4 sp-fade-in", CARD_SHADOW)}>
              <p className="text-[14px] font-bold text-[#17151F] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />{uploadable} photos ready</p>
              {files.length > uploadable && <p className="text-[12.5px] text-[#C2304F] mt-1">{files.length - uploadable} file{files.length - uploadable > 1 ? "s" : ""} will be left out (not JPG/PNG{files.some(f => isRawName(f.name)) ? " — RAW files can be added from Raw files on Drive" : ""}).</p>}
              <div className="mt-3 space-y-2">
                {[...groups].map(([folder, list]) => (
                  <div key={folder || "-"} className="flex flex-wrap items-center gap-2">
                    <span className="w-8 h-8 rounded-[10px] bg-[#FDECEF] text-[#C2304F] flex items-center justify-center flex-shrink-0"><Images className="w-4 h-4" /></span>
                    <span className="text-[13px] text-[#4A4658] min-w-[92px]">{list.filter(canUpload).length} photos{folder ? ` · ${folder}` : ""}</span>
                    {nameInput(folder, "Folder name in the album")}
                  </div>
                ))}
                <p className="text-[12.5px] text-[#6B6680]">The name is the folder inside the album — for example Holud or Wedding. Leave it empty for no folder.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </FormDrawer>
  );
}
