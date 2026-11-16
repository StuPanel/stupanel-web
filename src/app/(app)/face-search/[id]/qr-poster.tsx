"use client";

/**
 * A print-ready poster for the event: the gallery's QR, what to do in three steps, the code if there is one.
 * Drawn in the browser on a canvas (A5 at 300 dpi), so nothing is uploaded anywhere.
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Group } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";

type Look = "light" | "dark";
const W = 1748, H = 2480; // A5 portrait, 300 dpi
const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
const LOOKS: Record<Look, { bg: string; ink: string; soft: string; accent: string; card: string }> = {
  light: { bg: "#FAF4EB", ink: "#17151F", soft: "#4A4658", accent: "#7D5CEF", card: "#FFFFFF" },
  dark: { bg: "#17151F", ink: "#FFFFFF", soft: "#C9C2DA", accent: "#B7A2FF", card: "#FFFFFF" },
};

function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** Break a line so it fits the width; at most `max` lines. */
function wrap(c: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const out: string[] = []; let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width <= width || !line) line = next; else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/.{0,3}$/, "")}…`; }
  return out;
}

async function draw(canvas: HTMLCanvasElement, o: { link: string; title: string; headline: string; footer: string; pin: string; look: Look }) {
  const k = LOOKS[o.look];
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return;
  try { await document.fonts.load(`800 100px ${FONT}`); } catch { /* the system font is used */ }
  c.fillStyle = k.bg; c.fillRect(0, 0, W, H);
  c.textAlign = "center"; c.textBaseline = "alphabetic";

  // Headline
  c.fillStyle = k.ink; c.font = `800 150px ${FONT}`;
  let y = 330;
  for (const l of wrap(c, o.headline || "Find your photos", W - 260, 2)) { c.fillText(l, W / 2, y); y += 170; }
  // Event name
  c.fillStyle = k.soft; c.font = `600 68px ${FONT}`;
  for (const l of wrap(c, o.title, W - 320, 2)) { c.fillText(l, W / 2, y - 40); y += 84; }

  // QR card
  const size = 980, cx = (W - size) / 2, cy = Math.max(y - 10, 720);
  c.save(); c.shadowColor = "rgba(40,28,96,.22)"; c.shadowBlur = 80; c.shadowOffsetY = 30; c.fillStyle = k.card; round(c, cx, cy, size, size, 90); c.fill(); c.restore();
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, o.link, { margin: 0, width: 800, errorCorrectionLevel: "H", color: { dark: "#17151F", light: "#FFFFFF" } });
  c.drawImage(qr, cx + 90, cy + 90, size - 180, size - 180);

  // Three steps
  const steps = ["Scan the code", "Take a selfie", "Get your photos"];
  const top = cy + size + 130, colW = (W - 200) / 3;
  steps.forEach((s, i) => {
    const x = 100 + colW * i + colW / 2;
    c.fillStyle = k.accent; c.beginPath(); c.arc(x, top, 62, 0, Math.PI * 2); c.fill();
    c.fillStyle = o.look === "dark" ? "#17151F" : "#FFFFFF"; c.font = `800 68px ${FONT}`; c.fillText(String(i + 1), x, top + 24);
    c.fillStyle = k.ink; c.font = `700 56px ${FONT}`; c.fillText(s, x, top + 160);
  });

  // Code and footer
  const fy = top + 300;
  if (o.pin) {
    c.fillStyle = k.soft; c.font = `600 52px ${FONT}`; c.fillText("Code", W / 2, fy);
    c.fillStyle = k.ink; c.font = `800 120px ${FONT}`; c.fillText(o.pin.split("").join(" "), W / 2, fy + 125);
  }
  if (o.footer.trim()) { c.fillStyle = k.soft; c.font = `600 54px ${FONT}`; c.fillText(wrap(c, o.footer.trim(), W - 300, 1)[0], W / 2, H - 85); }
}

export function QrPoster({ link, title, pin }: { link: string; title: string; pin: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // The studio's last wording is kept on this device.
  const [saved] = useState<{ headline?: string; footer?: string; look?: string }>(() => { try { return JSON.parse(localStorage.getItem("sp-face-poster") || "{}"); } catch { return {}; } });
  const [look, setLook] = useState<Look>(saved.look === "dark" ? "dark" : "light");
  const [headline, setHeadline] = useState(saved.headline || "Find your photos");
  const [footer, setFooter] = useState(saved.footer || "");
  const [showPin, setShowPin] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let on = true;
    const t = setTimeout(() => {
      if (!canvas.current) return;
      void draw(canvas.current, { link, title, headline, footer, pin: showPin ? pin : "", look }).then(() => { if (on) setReady(true); });
      try { localStorage.setItem("sp-face-poster", JSON.stringify({ headline, footer, look })); } catch { /* private window */ }
    }, 250);
    return () => { on = false; clearTimeout(t); };
  }, [link, title, headline, footer, pin, showPin, look]);

  function download() {
    canvas.current?.toBlob(b => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = url; a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "gallery"} poster A5.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  }

  return (
    <Group title="Poster for the event" note="Print it A5 or A4 and put it on tables or at the entrance. It is made on this device.">
      <div className="p-4 sm:p-5 grid sm:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start">
        <div className="relative mx-auto w-[220px] aspect-[1748/2480] rounded-[14px] overflow-hidden ring-1 ring-[#EEEBF4] bg-[#F5F3FA]">
          <canvas ref={canvas} role="img" aria-label={`Poster with the QR code for ${title}`} className="w-full h-full" />
          {!ready && <span className="absolute inset-0 flex items-center justify-center text-[#A29DB3]"><Loader2 className="w-5 h-5 animate-spin" /></span>}
        </div>
        <div className="space-y-3.5 min-w-0">
          <div>
            <label htmlFor="qp-head" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Big line</label>
            <input id="qp-head" className={inputCls} maxLength={40} value={headline} onChange={e => setHeadline(e.target.value)} />
          </div>
          <div>
            <label htmlFor="qp-foot" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Line at the bottom (optional)</label>
            <input id="qp-foot" className={inputCls} maxLength={60} value={footer} placeholder="Photos by your studio name" onChange={e => setFooter(e.target.value)} />
          </div>
          <div role="radiogroup" aria-label="Poster colour" className="flex gap-2">
            {(["light", "dark"] as const).map(v => (
              <button key={v} type="button" role="radio" aria-checked={look === v} onClick={() => setLook(v)}
                className={cn("h-11 px-4 rounded-full text-[13.5px] font-semibold capitalize focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", look === v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#17151F]")}>{v}</button>
            ))}
          </div>
          {pin && (
            <label className="flex items-center gap-2.5 text-[14px] text-[#17151F] min-h-[44px]">
              <input type="checkbox" className="w-5 h-5 accent-[#7D5CEF]" checked={showPin} onChange={e => setShowPin(e.target.checked)} />Print the 4-digit code on it
            </label>
          )}
          <button type="button" onClick={download} disabled={!ready} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-[13.5px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Download poster</button>
        </div>
      </div>
    </Group>
  );
}
