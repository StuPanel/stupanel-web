"use client";
/**
 * Choose the cover photo: the first picture a client or guest sees when they open the link, and the picture of the
 * link preview on WhatsApp / Facebook. Tap a photo to make it the cover.
 */
import { useState } from "react";
import { Check, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormDrawer } from "@/components/ui/form-kit";

export type CoverItem = { id: string; src: string; name: string };

export function CoverPicker({ items, current, onPick, onClose, auto, more, loading, who = "the client" }: {
  items: CoverItem[];
  current: string | null;
  onPick: (id: string | null) => Promise<boolean>;
  onClose: () => void;
  /** What is shown when no cover is chosen (e.g. "the first highlight"); offers "Choose for me". */
  auto?: string;
  /** More photos to load (big galleries): a "Show more" button. */
  more?: { left: number; load: () => void; busy: boolean };
  loading?: boolean;
  who?: string;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  async function pick(id: string | null) {
    if (saving) return;
    setSaving(id ?? "auto");
    const ok = await onPick(id);
    setSaving(null);
    if (ok) onClose();
  }

  return (
    <FormDrawer open onClose={onClose} icon={ImageIcon} color="violet" title="Cover photo"
      sub={`What ${who} sees first when the link opens`}
      footer={<button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#F5F3FA] text-[15px] font-semibold text-[#17151F]">Close</button>}>
      {auto && (
        <button type="button" onClick={() => pick(null)} disabled={!!saving}
          className={cn("w-full mb-4 rounded-[16px] px-4 py-3 flex items-center gap-3 text-left bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)]", !current && "ring-2 ring-[#7D5CEF] bg-[#F6F2FF]")}>
          <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0">{saving === "auto" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-semibold text-[#17151F]">Choose for me</span>
            <span className="block text-[12.5px] text-[#6B6680]">StuPanel shows {auto}</span>
          </span>
          {!current && <Check className="w-5 h-5 text-[#5B3FD0]" strokeWidth={3} />}
        </button>
      )}
      <p className="text-[13px] font-semibold text-[#4A4658] mb-2">Tap a photo to make it the cover</p>
      <p className="text-[12.5px] text-[#6B6680] -mt-1 mb-3">It is also the picture people see when the link is shared on WhatsApp or Facebook.</p>
      {loading ? <div className="py-12 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : !items.length ? <p className="text-[14px] text-[#6B6680] py-8 text-center">No photo is ready yet.</p>
        : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {items.map(p => {
              const on = p.id === current;
              return (
                <button key={p.id} type="button" onClick={() => pick(p.id)} disabled={!!saving} aria-pressed={on} aria-label={`Make ${p.name} the cover`}
                  className={cn("relative aspect-square rounded-[12px] overflow-hidden bg-[#EEEBF4] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", on && "ring-[3px] ring-[#7D5CEF] ring-offset-2")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                  {on && <span className="absolute left-1.5 top-1.5 h-6 px-2 rounded-full bg-[#7D5CEF] text-white text-[11px] font-bold inline-flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} />Cover</span>}
                  {saving === p.id && <span className="absolute inset-0 bg-white/60 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#5B3FD0]" /></span>}
                </button>
              );
            })}
          </div>
        )}
      {more && more.left > 0 && (
        <div className="flex justify-center mt-4">
          <button type="button" onClick={more.load} disabled={more.busy} className="h-11 px-5 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-2 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
            {more.busy && <Loader2 className="w-4 h-4 animate-spin" />}Show more ({more.left} left)
          </button>
        </div>
      )}
    </FormDrawer>
  );
}
