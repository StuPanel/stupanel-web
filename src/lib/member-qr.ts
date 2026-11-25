/**
 * A team member's ID card QR code (Faisal 25-NOV-2026): it opens their page on the studio website with the
 * green "verified" bar. Two kinds: with the studio's logo and "Scan to verify" (PNG, print size), and a plain
 * code (SVG) for studios that design their own card. Everything is drawn in the browser.
 */
import QRCode from "qrcode";

export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Plain code, sharp at any size. */
export async function qrSvg(text: string, color = "#000000") {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: color, light: "#ffffff00" } });
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "★";

/** The studio's logo as an image we may draw (null when the file can't be read). */
async function loadLogo(url: string | null | undefined): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    return await createImageBitmap(await r.blob());
  } catch { return null; }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * The card-ready code: round dots, rounded corner squares, the studio's logo (or its initials) in the middle,
 * "SCAN TO VERIFY" and the studio + member ID under it. 1200 px wide: sharp when printed on an ID card.
 */
export async function qrPng(text: string, opt: { logo?: string | null; studio: string; label: string; color?: string }): Promise<Blob> {
  const ink = opt.color ?? "#1A1A1A";
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const W = 1200, pad = 90, size = W - pad * 2, cell = size / n, H = W + 230;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF"; rounded(ctx, 0, 0, W, H, 70); ctx.fill();

  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const hole = Math.ceil(n * 0.24) | 1, h0 = Math.floor((n - hole) / 2);
  const inHole = (x: number, y: number) => x >= h0 && x < h0 + hole && y >= h0 && y < h0 + hole;
  ctx.fillStyle = ink;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!qr.modules.get(x, y) || finder(x, y) || inHole(x, y)) continue;
    ctx.beginPath(); ctx.arc(pad + (x + 0.5) * cell, pad + (y + 0.5) * cell, cell * 0.42, 0, Math.PI * 2); ctx.fill();
  }
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    const X = pad + fx * cell, Y = pad + fy * cell;
    ctx.fillStyle = ink; rounded(ctx, X, Y, cell * 7, cell * 7, cell * 2); ctx.fill();
    ctx.fillStyle = "#FFFFFF"; rounded(ctx, X + cell, Y + cell, cell * 5, cell * 5, cell * 1.4); ctx.fill();
    ctx.fillStyle = ink; rounded(ctx, X + cell * 2, Y + cell * 2, cell * 3, cell * 3, cell); ctx.fill();
  }
  // The middle: the studio's logo, else its initials on a dark tile.
  const box = hole * cell, bx = pad + h0 * cell, by = pad + h0 * cell, inset = cell * 0.9;
  ctx.fillStyle = "#FFFFFF"; rounded(ctx, bx, by, box, box, cell * 2); ctx.fill();
  const logo = await loadLogo(opt.logo);
  if (logo) {
    const s = Math.min((box - inset * 2) / logo.width, (box - inset * 2) / logo.height);
    const w = logo.width * s, h = logo.height * s;
    ctx.drawImage(logo, bx + (box - w) / 2, by + (box - h) / 2, w, h);
  } else {
    ctx.fillStyle = ink; rounded(ctx, bx + inset, by + inset, box - inset * 2, box - inset * 2, cell * 1.6); ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(box * 0.3)}px Georgia, serif`;
    ctx.fillText(initials(opt.studio), bx + box / 2, by + box / 2 + 4);
  }
  // Caption
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = ink;
  ctx.font = "600 50px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const words = "SCAN TO VERIFY";
  // letter spacing by hand (canvas letterSpacing is not everywhere yet)
  const sp = 10, widths = [...words].map(ch => ctx.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let cx = W / 2 - total / 2;
  ctx.textAlign = "left";
  [...words].forEach((ch, i) => { ctx.fillText(ch, cx, W + 50); cx += widths[i] + sp; });
  ctx.textAlign = "center"; ctx.fillStyle = "#5E5868";
  ctx.font = "400 42px system-ui, -apple-system, 'Segoe UI', sans-serif";
  let label = opt.label;
  while (ctx.measureText(label).width > W - 120 && label.length > 8) label = `${label.slice(0, -2)}…`;
  ctx.fillText(label, W / 2, W + 130);
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}

/** Everyone's code on A4 pages (12 a page), name and ID under each: one file to print the whole team's cards. */
export async function qrSheet(people: { name: string; memberId: string; link: string }[], studio: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cols = 3, rows = 4, w = 210, mx = 15, cw = (w - mx * 2) / cols, ch = 64, q = 42;
  for (let i = 0; i < people.length; i++) {
    if (i && i % (cols * rows) === 0) doc.addPage();
    const k = i % (cols * rows), c = k % cols, r = Math.floor(k / cols);
    const x = mx + c * cw, y = 18 + r * ch;
    const url = await QRCode.toDataURL(people[i].link, { errorCorrectionLevel: "M", margin: 1, width: 600 });
    doc.addImage(url, "PNG", x + (cw - q) / 2, y, q, q);
    doc.setFontSize(10); doc.setTextColor(23, 21, 31);
    doc.text(people[i].name.slice(0, 34), x + cw / 2, y + q + 6, { align: "center" });
    doc.setFontSize(8.5); doc.setTextColor(94, 88, 104);
    doc.text(`${people[i].memberId} · Scan to verify`, x + cw / 2, y + q + 11, { align: "center" });
  }
  doc.setProperties({ title: `${studio} team QR codes` });
  return doc.output("blob");
}
