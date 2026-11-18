"use client";

/**
 * Program → Delivery: the cover photo on the client's portal page.
 * The studio picks one delivered photo and taps the point that must stay in view (their faces);
 * the portal crops around that point on a phone, a tablet and a computer.
 * No cover → the client sees the studio's name and the program's name on a dark page.
 */
import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { thumbAt } from "@/components/file-thumb";
import { askConfirm, notify } from "@/components/feedback";

type Cover = { fileId: string; x: number; y: number };
type DriveFile = { id: string; fileName: string; mimeType: string; folderName?: string | null; path?: string; thumb?: string | null };

export function PortalCoverCard({ bookingId, cover, onSaved }: { bookingId: string; cover?: Cover | null; onSaved: () => void }) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [open, setOpen] = useState(false);
  // The picture of the current cover needs the Drive list (thumbnail links expire, so they are never stored).
  useEffect(() => {
    let alive = true;
    apiFetch(`${API}/google-drive/files/${bookingId}`).then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setFiles((d?.driveFiles ?? []).filter((f: DriveFile) => f.mimeType?.startsWith("image/") && f.thumb)); })
      .catch(() => { if (alive) setFiles([]); });
    return () => { alive = false; };
  }, [bookingId]);
  const current = cover ? files?.find(f => f.id === cover.fileId) : null;

  async function remove() {
    if (!(await askConfirm({ title: "Remove the cover?", message: "The client's page shows your studio's name and the program's name instead.", confirmLabel: "Remove" }))) return;
    const r = await apiFetch(`${API}/bookings/${bookingId}/portal-cover`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: null }) });
    if (!r.ok) { notify("Couldn't remove the cover", { error: true }); return; }
    notify("Cover removed"); onSaved();
  }

  return (
    <div className="rounded-[16px] border border-[#ECEAF0] bg-white p-3 flex items-center gap-3">
      <span className="w-[72px] h-[54px] rounded-[10px] overflow-hidden bg-[#17151F] flex-shrink-0 flex items-center justify-center">
        {current?.thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumbAt(current.thumb, 300)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: `${cover!.x}% ${cover!.y}%` }} />
          : <ImageIcon className="w-5 h-5 text-white/50" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold text-[#17151F]">Cover for the client&apos;s page</span>
        <span className="block text-[12.5px] text-[#6B6680]">
          {cover ? (files === null ? "Loading…" : current ? "Shown at the top of their portal and their files" : "The photo is no longer in the delivery folder — choose another")
            : "Not chosen — they see your studio's name instead"}
        </span>
      </span>
      {cover && <button type="button" onClick={remove} className="h-9 px-3 rounded-full text-[13px] font-semibold text-[#B42347] hover:bg-[#FDECEF]">Remove</button>}
      <button type="button" onClick={() => setOpen(true)} disabled={files !== null && files.length === 0}
        title={files?.length === 0 ? "Deliver photos first" : undefined}
        className="h-9 px-3.5 rounded-full bg-[#17151F] text-white text-[13px] font-semibold disabled:opacity-40">{cover ? "Change" : "Choose"}</button>
      {open && files && <CoverPicker bookingId={bookingId} files={files} cover={cover ?? null} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved(); }} />}
    </div>
  );
}

function CoverPicker({ bookingId, files, cover, onClose, onSaved }: { bookingId: string; files: DriveFile[]; cover: Cover | null; onClose: () => void; onSaved: () => void }) {
  const [pick, setPick] = useState<DriveFile | null>(() => (cover ? files.find(f => f.id === cover.fileId) ?? null : null));
  const [focus, setFocus] = useState<{ x: number; y: number }>(cover ? { x: cover.x, y: cover.y } : { x: 50, y: 40 });
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const folders = useMemo(() => [...new Set(files.map(f => f.folderName || ""))].filter(Boolean), [files]);
  const shown = files.filter(f => !folder || f.folderName === folder).slice(0, 300);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  function onTap(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setFocus({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 });
  }
  async function save() {
    if (!pick) return;
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/bookings/${bookingId}/portal-cover`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: pick.id, x: focus.x, y: focus.y }) });
      if (!r.ok) throw new Error();
      notify("Cover saved"); onSaved();
    } catch { notify("Couldn't save the cover", { error: true }); } finally { setBusy(false); }
  }

  const src = pick?.thumb ? thumbAt(pick.thumb, 1200) : "";
  const pos = `${focus.x}% ${focus.y}%`;
  return (
    <div className="fixed inset-0 z-[80] bg-[#17151F]/45 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="cover-title" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-[980px] max-h-[94dvh] overflow-y-auto bg-white rounded-t-[24px] sm:rounded-[24px] p-4 sm:p-6 shadow-[0_30px_60px_-30px_rgba(22,18,40,.5)]">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 id="cover-title" className="text-[19px] font-extrabold text-[#17151F]">Cover for the client&apos;s page</h2>
            <p className="mt-0.5 text-[13.5px] text-[#6B6680]">{pick ? "Tap the most important part of the photo — their faces stay in view on every screen." : "Choose a delivered photo. Pick one with the couple, not the venue."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-[#F3F3F1] hover:bg-[#ECEAF0] flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {!pick ? (
          <div className="mt-4">
            {folders.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
                {["", ...folders].map(f => (
                  <button key={f || "all"} type="button" onClick={() => setFolder(f)}
                    className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap border", folder === f ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#17151F] border-[#E6E4EA]")}>{f || "All"}</button>
                ))}
              </div>
            )}
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {shown.map(f => (
                <button key={f.id} type="button" onClick={() => setPick(f)} title={f.fileName} className="relative aspect-square rounded-[8px] overflow-hidden bg-[#ECEAF0] hover:ring-2 hover:ring-[#7D5CEF]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbAt(f.thumb!, 400)} alt={f.fileName} referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid md:grid-cols-[minmax(0,1fr)_300px] gap-5">
            <button type="button" onClick={onTap} aria-label="Tap the point that must stay in view" className="relative block w-full rounded-[16px] overflow-hidden bg-[#17151F] cursor-crosshair">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={pick.fileName} referrerPolicy="no-referrer" className="block w-full h-auto max-h-[60dvh] object-contain mx-auto select-none" draggable={false} />
              <span className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full border-2 border-white shadow-[0_0_0_4px_rgba(0,0,0,.25)] pointer-events-none" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
              <span className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-white pointer-events-none" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
              <span className="absolute left-3 bottom-3 h-7 px-3 rounded-full bg-black/55 text-white text-[12px] font-semibold inline-flex items-center">Tap to move the focus</span>
            </button>
            <div>
              <p className="text-[12.5px] font-bold text-[#6B6680]">How it will look</p>
              <div className="mt-2 flex items-end gap-3">
                <Preview src={src} pos={pos} className="w-[92px] h-[164px]" label="Phone" />
                <Preview src={src} pos={pos} className="w-[124px] h-[124px]" label="Tablet" />
              </div>
              <Preview src={src} pos={pos} className="w-full h-[104px]" label="Computer" wide />
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-[#F0EEF3] flex items-center gap-2">
          {pick && <button type="button" onClick={() => setPick(null)} className="h-11 px-4 rounded-xl border border-[#E6E4EA] text-[14px] font-semibold text-[#17151F]">Choose another photo</button>}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl text-[14px] font-semibold text-[#4A4658] hover:bg-[#F3F3F1]">Cancel</button>
          <button type="button" onClick={save} disabled={!pick || busy}
            className="h-11 px-5 rounded-xl bg-[#17151F] text-white text-[14px] font-bold inline-flex items-center gap-2 disabled:opacity-40">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save cover
          </button>
        </div>
      </section>
    </div>
  );
}

function Preview({ src, pos, className, label, wide }: { src: string; pos: string; className: string; label: string; wide?: boolean }) {
  return (
    <span className={cn("flex flex-col items-center gap-1.5", wide && "mt-3 w-full")}>
      <span className={cn("block rounded-[12px] overflow-hidden bg-[#17151F]", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: pos }} />
      </span>
      <span className="text-[12px] font-semibold text-[#4A4658]">{label}</span>
    </span>
  );
}
