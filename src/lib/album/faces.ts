/**
 * Faces and look-alike photos, found in the studio's browser for free (Google's MediaPipe face finder,
 * served from our own address: public/mediapipe). Each photo is read once at 640 px from Google Drive.
 *  - faces: boxes [x, y, w, h] in 0–1 of the photo, so frames keep faces in view and off the fold;
 *  - looks: a 64-bit picture fingerprint (dHash), so near-identical shots are not placed twice.
 */
import { photoUrl, type APhoto, type Faces } from "./types";

type Det = { boundingBox: { xCenter: number; yCenter: number; width: number; height: number } };
type FD = {
  setOptions: (o: Record<string, unknown>) => void;
  onResults: (cb: (r: { detections?: Det[] }) => void) => void;
  send: (i: { image: HTMLImageElement | HTMLCanvasElement }) => Promise<void>;
  initialize: () => Promise<void>;
};

let loading: Promise<FD | null> | null = null;
function loadFinder(): Promise<FD | null> {
  if (loading) return loading;
  loading = new Promise<FD | null>(ok => {
    const w = window as unknown as { FaceDetection?: new (o: { locateFile: (f: string) => string }) => FD };
    const start = async () => {
      try {
        const fd = new w.FaceDetection!({ locateFile: f => `/mediapipe/fd/${f}` });
        fd.setOptions({ model: "full", minDetectionConfidence: 0.5 });
        await fd.initialize();
        ok(fd);
      } catch { ok(null); }
    };
    if (w.FaceDetection) { start(); return; }
    const s = document.createElement("script");
    s.src = "/mediapipe/fd/face_detection.js"; s.async = true; s.crossOrigin = "anonymous";
    s.onload = start; s.onerror = () => ok(null);
    document.head.appendChild(s);
  });
  return loading;
}

function loadImg(url: string) {
  return new Promise<HTMLImageElement>((ok, bad) => {
    const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
    im.onload = () => ok(im); im.onerror = () => bad(new Error("image")); im.src = url;
  });
}

/** 9×8 grey thumbnail → 64 bits, as a 16-character hex string. */
function dhash(im: HTMLImageElement) {
  const c = document.createElement("canvas"); c.width = 9; c.height = 8;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(im, 0, 0, 9, 8);
  const d = x.getImageData(0, 0, 9, 8).data;
  let bits = "";
  for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) {
    const a = (y * 9 + i) * 4, b = a + 4;
    bits += d[a] + d[a + 1] + d[a + 2] > d[b] + d[b + 1] + d[b + 2] ? "1" : "0";
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
export function hamming(a: string, b: string) {
  let n = 0;
  for (let i = 0; i < a.length; i++) { let v = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (v) { n += v & 1; v >>= 1; } }
  return n;
}

export type Scan = { faces: Faces; looks: Record<string, string> };

/**
 * Reads each photo once. Works without the face finder too (fingerprints only). `stop()` returning true ends early.
 */
export async function scanPhotos(photos: APhoto[], onStep: (done: number, total: number) => void, stop: () => boolean = () => false): Promise<Scan> {
  const fd = await loadFinder().catch(() => null);
  let latest: Det[] = [];
  fd?.onResults(r => { latest = r.detections ?? []; });
  const faces: Faces = {}, looks: Record<string, string> = {};
  const list = photos.filter(p => p.d);
  let done = 0;
  for (const p of list) {
    if (stop()) break;
    try {
      const im = await loadImg(photoUrl(p.d!, 640));
      looks[p.id] = dhash(im);
      if (fd) {
        latest = [];
        await fd.send({ image: im });
        faces[p.id] = latest.slice(0, 12).map(d => {
          const b = d.boundingBox;
          return [b.xCenter - b.width / 2, b.yCenter - b.height / 2, b.width, b.height].map(v => Math.round(v * 1000) / 1000);
        });
      }
    } catch { /* a photo that can't be read is just skipped */ }
    onStep(++done, list.length);
  }
  return { faces, looks };
}

/** Photos that look almost the same as an earlier one (burst shots): the later ones are left out of the layout. */
export function lookAlikes(order: APhoto[], looks: Record<string, string>, max = 6) {
  const kept: string[] = [], skip = new Set<string>();
  for (const p of order) {
    const h = looks[p.id]; if (!h) continue;
    if (kept.some(k => hamming(k, h) <= max)) skip.add(p.id); else kept.push(h);
  }
  return skip;
}

/** Centre of the faces (0–100 of the photo), or null when there are none. */
export function faceCentre(boxes: number[][] | undefined): { x: number; y: number } | null {
  if (!boxes?.length) return null;
  let l = 1, t = 1, r = 0, b = 0;
  for (const [x, y, w, h] of boxes) { l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x + w); b = Math.max(b, y + h); }
  return { x: Math.round(((l + r) / 2) * 100), y: Math.round(((t + b) / 2) * 100) };
}
