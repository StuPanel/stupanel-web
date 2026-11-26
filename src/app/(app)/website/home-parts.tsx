"use client";
/**
 * Look → Home page parts (Faisal 26-NOV-2026): the parts of the Home page in the order visitors see them.
 * Drag a part by its handle (mouse or finger) or use the arrows to move it; the switch leaves it out of Home.
 * The top photo is always first and the booking form always last, so they are shown as fixed rows.
 */
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const HOME_PARTS: { key: string; label: string; /** Can't be switched off */ always?: boolean }[] = [
  { key: "marquee", label: "Moving words" },
  { key: "about", label: "About the studio", always: true },
  { key: "albums", label: "Albums" },
  { key: "film", label: "Wedding film" },
  { key: "stories", label: "Stories" },
  { key: "packages", label: "Packages" },
  { key: "reviews", label: "Reviews" },
];

const ROW = 56;

function Fixed({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 text-[#8A8597]" style={{ height: ROW }}>
      <span className="w-9 h-9 flex items-center justify-center flex-shrink-0"><Lock className="w-4 h-4" aria-hidden="true" /></span>
      <p className="flex-1 text-[15px]">{label}</p>
      <span className="text-[12px]">Always here</span>
    </div>
  );
}

export function HomeParts({ order, hide, onOrder, onHide, empty }: {
  /** Every part once, top to bottom */ order: string[]; hide: string[];
  onOrder: (next: string[]) => void; onHide: (next: string[]) => void;
  /** Parts with nothing in them yet (no albums, no film…): shown with a note */ empty?: Record<string, string>;
}) {
  const [drag, setDrag] = useState<{ key: string; dy: number } | null>(null);
  const [said, setSaid] = useState("");
  const start = useRef<{ y: number; index: number } | null>(null);
  /** Where the dragged part is now (the handlers of one drag see the list as it was when it began). */
  const at = useRef(0);
  const label = (k: string) => HOME_PARTS.find(p => p.key === k)?.label ?? k;

  const move = (i: number, to: number) => {
    if (to < 0 || to >= order.length || to === i) return;
    const next = [...order]; const [x] = next.splice(i, 1); next.splice(to, 0, x);
    onOrder(next);
    setSaid(`${label(x)} is now part ${to + 1} of ${order.length}`);
  };
  // While dragging, the row follows the pointer; the list reorders as it passes its neighbours.
  const down = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, index: i }; at.current = i;
    setDrag({ key: order[i], dy: 0 });
  };
  const moving = (e: React.PointerEvent) => {
    const st = start.current;
    if (!st || !drag) return;
    const dy = e.clientY - st.y;
    const steps = Math.round(dy / ROW);
    const to = Math.min(order.length - 1, Math.max(0, st.index + steps));
    const from = order.indexOf(drag.key);
    if (to !== from) {
      const next = [...order]; next.splice(from, 1); next.splice(to, 0, drag.key);
      onOrder(next);
    }
    at.current = to;
    setDrag({ key: drag.key, dy: dy - (to - st.index) * ROW });
  };
  const up = () => {
    if (drag) setSaid(`${label(drag.key)} is now part ${at.current + 1} of ${order.length}`);
    start.current = null; setDrag(null);
  };

  return (
    <div>
      <Fixed label="Top photo and headline" />
      <ol className="divide-y divide-[#EEEBF4] border-y border-[#EEEBF4]">
        {order.map((k, i) => {
          const part = HOME_PARTS.find(p => p.key === k);
          if (!part) return null;
          const on = part.always || !hide.includes(k);
          const lifted = drag?.key === k;
          return (
            <li key={k} className={cn("flex items-center gap-1.5 pl-2 pr-4 bg-white", lifted ? "relative z-10 shadow-[0_10px_30px_rgba(23,21,31,.16)] rounded-[12px]" : "transition-transform duration-150 motion-reduce:transition-none")}
              style={{ height: ROW, transform: lifted ? `translateY(${drag.dy}px) scale(1.01)` : undefined }}>
              <button type="button" aria-label={`Drag ${part.label} to move it`} onPointerDown={e => down(e, i)} onPointerMove={moving} onPointerUp={up} onPointerCancel={up}
                className="w-11 h-11 flex items-center justify-center rounded-[10px] text-[#8A8597] hover:bg-[#F5F3FA] hover:text-[#4A4658] cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
                <GripVertical className="w-5 h-5" aria-hidden="true" />
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-[15px] font-medium truncate", on ? "text-[#17151F]" : "text-[#8A8597]")}>{part.label}</p>
                {empty?.[k] && <p className="text-[12px] text-[#8A8597] truncate">{empty[k]}</p>}
              </div>
              <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${part.label} up`} className="w-9 h-9 rounded-full hover:bg-[#F5F3FA] disabled:opacity-30 flex items-center justify-center text-[#4A4658] flex-shrink-0"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" disabled={i === order.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${part.label} down`} className="w-9 h-9 rounded-full hover:bg-[#F5F3FA] disabled:opacity-30 flex items-center justify-center text-[#4A4658] flex-shrink-0"><ArrowDown className="w-4 h-4" /></button>
              {part.always
                ? <span className="w-[51px] text-center text-[12px] text-[#8A8597] flex-shrink-0 ml-1">Always</span>
                : (
                  <button type="button" role="switch" aria-checked={on} aria-label={`Show ${part.label} on Home`} onClick={() => onHide(on ? [...hide, k] : hide.filter(x => x !== k))}
                    className={cn("relative w-[51px] h-[31px] rounded-full transition-colors flex-shrink-0 ml-1", on ? "bg-[#7D5CEF]" : "bg-[#E4E0EC]")}>
                    <span className={cn("absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-transform", on && "translate-x-[20px]")} />
                  </button>
                )}
            </li>
          );
        })}
      </ol>
      <Fixed label="Booking form" />
      <p className="sr-only" aria-live="polite">{said}</p>
    </div>
  );
}
