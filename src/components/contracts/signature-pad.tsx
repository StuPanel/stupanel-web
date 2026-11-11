"use client";

/**
 * Sign by drawing (finger, pen or mouse) or by typing your name.
 * The drawing is kept as a small transparent PNG. Undo removes the last stroke.
 */
import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIGN_FONT } from "./contract-paper";

type Pt = { x: number; y: number };
const W = 600, H = 200; // stored size — small file, sharp enough for print

export function SignaturePad({ name, onChange }: {
  /** The typed full name (used for the "type" style) */
  name: string;
  onChange: (v: { kind: "drawn" | "typed"; image: string | null; ready: boolean }) => void;
}) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const drawing = useRef(false);
  const [count, setCount] = useState(0);

  function paint() {
    const c = canvas.current; if (!c) return;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#17151F"; g.lineWidth = 3.2;
    for (const s of strokes.current) {
      if (s.length === 1) { g.beginPath(); g.arc(s[0].x, s[0].y, 1.8, 0, Math.PI * 2); g.fillStyle = "#17151F"; g.fill(); continue; }
      g.beginPath(); g.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length - 1; i++) { const mx = (s[i].x + s[i + 1].x) / 2, my = (s[i].y + s[i + 1].y) / 2; g.quadraticCurveTo(s[i].x, s[i].y, mx, my); }
      g.lineTo(s[s.length - 1].x, s[s.length - 1].y); g.stroke();
    }
  }
  function report() {
    const n = strokes.current.length; setCount(n);
    const long = strokes.current.reduce((t, s) => t + s.length, 0) > 8; // a dot is not a signature
    onChange({ kind: "drawn", image: n && long ? canvas.current!.toDataURL("image/png") : null, ready: n > 0 && long });
  }
  const at = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  useEffect(() => {
    if (mode === "type") onChange({ kind: "typed", image: null, ready: name.trim().length >= 2 });
    else { paint(); report(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, name]);

  return (
    <div>
      <div role="radiogroup" aria-label="How to sign" className="inline-flex p-1 rounded-full bg-[#F1EFF6] mb-2.5">
        {([["draw", "Draw", PenLine], ["type", "Type", Type]] as const).map(([m, l, Icon]) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
            className={cn("h-8 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors",
              mode === m ? "bg-white text-[#17151F] shadow-[0_1px_3px_rgba(22,18,40,.12)]" : "text-[#6B6680]")}>
            <Icon className="w-3.5 h-3.5" />{l}
          </button>
        ))}
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas ref={canvas} width={W} height={H} aria-label="Draw your signature here"
            className="w-full aspect-[3/1] rounded-[14px] border-2 border-dashed border-[#CFC8E4] bg-white touch-none cursor-crosshair"
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; strokes.current.push([at(e)]); paint(); }}
            onPointerMove={e => { if (!drawing.current) return; strokes.current[strokes.current.length - 1].push(at(e)); paint(); }}
            onPointerUp={() => { if (drawing.current) { drawing.current = false; report(); } }}
            onPointerCancel={() => { if (drawing.current) { drawing.current = false; report(); } }} />
          {count === 0 && <p className="absolute inset-0 flex items-center justify-center text-[14px] text-[#A29DB3] pointer-events-none">Sign here with your finger or mouse</p>}
          <div className="absolute right-2 top-2 flex gap-1">
            <button type="button" disabled={!count} onClick={() => { strokes.current.pop(); paint(); report(); }} aria-label="Undo the last stroke" title="Undo"
              className="w-8 h-8 rounded-full bg-white shadow-[0_1px_3px_rgba(22,18,40,.15)] text-[#4A4658] flex items-center justify-center disabled:opacity-0"><Undo2 className="w-4 h-4" /></button>
            <button type="button" disabled={!count} onClick={() => { strokes.current = []; paint(); report(); }} aria-label="Clear the signature" title="Clear"
              className="w-8 h-8 rounded-full bg-white shadow-[0_1px_3px_rgba(22,18,40,.15)] text-[#C2304F] flex items-center justify-center disabled:opacity-0"><Eraser className="w-4 h-4" /></button>
          </div>
        </div>
      ) : (
        <div className="w-full aspect-[3/1] rounded-[14px] border-2 border-dashed border-[#CFC8E4] bg-white flex items-center justify-center px-4 overflow-hidden">
          {name.trim()
            ? <span className="text-[40px] sm:text-[46px] leading-none text-[#17151F] truncate" style={{ fontFamily: SIGN_FONT }}>{name.trim()}</span>
            : <span className="text-[14px] text-[#A29DB3]">Type your full name above</span>}
        </div>
      )}
    </div>
  );
}
