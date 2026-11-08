"use client";

/** Who did what with a program's files (uploads, deletes, renames, moves…). Opens on demand. */
import { useCallback, useState } from "react";
import { ChevronDown, Copy, FolderInput, History, Link2, Loader2, Pencil, ShieldCheck, Trash2, Upload, UserMinus } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";

type Row = { id: string; at: string; area: "raw" | "delivery"; kind: string; who: string; text: string };

const ICON: Record<string, typeof Upload> = {
  upload: Upload, delete: Trash2, rename: Pencil, move: FolderInput, copy: Copy, link: Link2, backup: ShieldCheck, access: UserMinus,
};

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function FileActivity({ bookingId, area }: { bookingId: string; area: "raw" | "delivery" }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    apiFetch(`${API}/google-drive/activity/${bookingId}?area=${area}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Row[]) => setRows(d))
      .catch(() => setFailed(true));
  }, [bookingId, area]);

  return (
    <div className="rounded-2xl border border-[#EEEBF4] overflow-hidden">
      <button type="button" onClick={() => { const next = !open; setOpen(next); if (next) load(); }}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-[#FBFAFD]">
        <History className="w-4 h-4 text-[#5B3FD0]" />
        <span className="flex-1 text-[13px] font-bold text-[#4A4658]">Activity</span>
        <ChevronDown className={cn("w-4 h-4 text-[#A29DB3] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-[#EEEBF4] max-h-72 overflow-y-auto">
          {failed ? (
            <button type="button" onClick={load} className="w-full px-3 py-4 text-[12px] text-[#5B3FD0] font-semibold">Couldn&apos;t load — try again</button>
          ) : !rows ? (
            <div className="px-3 py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-[#A29DB3]" /></div>
          ) : !rows.length ? (
            <p className="px-3 py-4 text-[12px] text-[#8A8599] text-center">Nothing yet. Uploads, deletes, renames and moves show here.</p>
          ) : (
            <ul className="divide-y divide-[#F2EFF8]">
              {rows.map(r => {
                const I = ICON[r.kind] ?? History;
                return (
                  <li key={r.id} className="px-3 py-2 flex items-start gap-2.5">
                    <span className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", r.kind === "delete" ? "bg-[#FDECEF] text-[#C2304F]" : "bg-[#EEE8FD] text-[#5B3FD0]")}>
                      <I className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] text-[#17151F] break-words"><b>{r.who}</b> {r.text}</span>
                      <span className="block text-[11px] text-[#8A8599]">{when(r.at)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
