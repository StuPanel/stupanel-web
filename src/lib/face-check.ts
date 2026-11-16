/**
 * Is the guest's face ready for the selfie? Runs in the browser on a small copy of the camera picture
 * (nothing is sent anywhere). Used by the guest page to take the selfie by itself only when the face is
 * clear, centred, the right size, well lit and still.
 */
import pico from "./pico";

export type FaceState =
  | "none" | "many" | "far" | "close" | "off-centre" | "dark" | "bright" | "moving" | "good";

export const FACE_HINT: Record<FaceState, string> = {
  none: "Bring your face inside the oval.",
  many: "Only one person, please.",
  far: "Come a little closer.",
  close: "Move back a little.",
  "off-centre": "Put your face in the middle of the oval.",
  dark: "Too dark. Turn towards the light.",
  bright: "Too bright. Turn away from the light a little.",
  moving: "Hold still.",
  good: "Perfect. Hold still.",
};

const W = 180, H = 240; // the part of the camera picture that shows inside the oval (3:4)

export async function loadFaceCheck() {
  const r = await fetch("/face/facefinder");
  if (!r.ok) throw new Error("no detector");
  const classify = pico.unpack_cascade(new Int8Array(await r.arrayBuffer()));
  const memory = pico.instantiate_detection_memory(4);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const gray = new Uint8Array(W * H);
  let last: { x: number; y: number } | null = null;

  /** Look at the current camera frame. */
  return function check(video: HTMLVideoElement): FaceState {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return "none";
    // The same centre crop the oval shows (object-fit: cover).
    const ratio = W / H;
    const sw = vw / vh > ratio ? vh * ratio : vw;
    const sh = vw / vh > ratio ? vh : vw / ratio;
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    for (let i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = (2 * px[i] + 7 * px[i + 1] + px[i + 2]) / 10;

    let dets = pico.run_cascade({ pixels: gray, nrows: H, ncols: W, ldim: W }, classify, { shiftfactor: 0.1, minsize: 40, maxsize: 240, scalefactor: 1.1 });
    dets = pico.cluster_detections(memory(dets), 0.2).filter(d => d[3] > 40).sort((a, b) => b[2] - a[2]);
    if (!dets.length) { last = null; return "none"; }
    const [row, col, size] = dets[0];
    // A second face nearly as large as the first: two people in the frame.
    if (dets[1] && dets[1][2] > size * 0.7) { last = null; return "many"; }

    const x = col / W, y = row / H, s = size / W;
    const moved = last ? Math.hypot(x - last.x, y - last.y) : 1;
    last = { x, y };
    if (s < 0.42) return "far";
    if (s > 0.92) return "close";
    if (Math.abs(x - 0.5) > 0.14 || Math.abs(y - 0.47) > 0.14) return "off-centre";

    // Light on the face itself (the middle of the detected square).
    const half = Math.floor(size * 0.3);
    let sum = 0, n = 0;
    for (let r = Math.max(0, Math.floor(row - half)); r < Math.min(H, row + half); r += 2)
      for (let c = Math.max(0, Math.floor(col - half)); c < Math.min(W, col + half); c += 2) { sum += gray[r * W + c]; n++; }
    const light = n ? sum / n : 0;
    if (light < 55) return "dark";
    if (light > 228) return "bright";
    if (moved > 0.035) return "moving";
    return "good";
  };
}
