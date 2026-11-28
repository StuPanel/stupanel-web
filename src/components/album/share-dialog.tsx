"use client";

/** Share the album with the client: a link (no login) where they turn the pages, write notes and approve. */
import { useState } from "react";
import { Check, Copy, Link2, Loader2, RefreshCw, X } from "lucide-react";
import { notify } from "@/components/feedback";
import { albumApi } from "@/lib/album/api";
import type { AlbumDetail, AlbumStatus } from "@/lib/album/types";

export function ShareDialog({ album, onClose, onChange }: { album: AlbumDetail; onClose: () => void; onChange: (url: string | null, status: AlbumStatus) => void }) {
  const [url, setUrl] = useState(album.proofUrl);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function set(on: boolean, reset = false) {
    setBusy(true);
    try { const r = await albumApi.proof(album.id, on, reset); setUrl(r.url); onChange(r.url, r.status as AlbumStatus); if (reset) notify("New link made. The old one no longer works."); }
    catch (e) { notify((e as Error).message, { error: true }); } finally { setBusy(false); }
  }
  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { notify("Could not copy. Select the link and copy it.", { error: true }); }
  }
  const wa = url ? `https://wa.me/?text=${encodeURIComponent(`আপনার অ্যালবাম দেখুন, প্রতিটা পাতায় মন্তব্য দিন, আর ঠিক থাকলে "সব ঠিক আছে" চাপুন:\n${url}`)}` : null;

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(23,21,31,.45)] flex items-center justify-center p-3" role="dialog" aria-modal aria-label="Share with client">
      <div className="w-full max-w-[480px] rounded-[26px] bg-white p-6 flex flex-col gap-4 shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)]">
        <div className="flex items-start gap-3">
          <div className="flex-1"><h2 className="text-[21px] font-extrabold">Share with client</h2><p className="text-[14px] text-[#5B5670]">The client turns the pages on their phone, writes on any page and approves the album. No login.</p></div>
          <button aria-label="Close" onClick={onClose} className="w-9 h-9 rounded-full bg-[#F2EFF8] flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        {url ? (
          <>
            <div className="flex items-center gap-2 rounded-2xl border border-[#E4E0EC] p-2 pl-3">
              <Link2 className="w-4 h-4 text-[#6B6680] flex-shrink-0" />
              <input readOnly value={url} onFocus={e => e.target.select()} className="flex-1 min-w-0 text-[13px] outline-none bg-transparent" aria-label="Album link" />
              <button onClick={copy} className="h-9 px-3 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy"}</button>
            </div>
            <a href={wa!} target="_blank" rel="noopener noreferrer" className="h-12 rounded-full bg-[#1FA855] text-white text-[15px] font-bold flex items-center justify-center">Send on WhatsApp</a>
            <div className="flex items-center justify-between text-[13px]">
              <button onClick={() => set(true, true)} disabled={busy} className="font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Make a new link</button>
              <button onClick={() => set(false)} disabled={busy} className="font-semibold text-[#B42318]">Turn the link off</button>
            </div>
          </>
        ) : (
          <button onClick={() => set(true)} disabled={busy} className="h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-bold inline-flex items-center justify-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Make the client’s link</button>
        )}
        <p className="text-[12.5px] text-[#6B6680]">You can keep changing the album; the client always sees the latest pages. Their notes show on each page here, and you get a phone and email notice.</p>
      </div>
    </div>
  );
}
