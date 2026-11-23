/**
 * Big camera files are made smaller in the browser first, so they upload fast on mobile data.
 * Other formats the phone can open (e.g. iPhone HEIC) are turned into a JPEG on the way.
 */
export async function shrink(file: File, max = 3200): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (s === 1 && file.size < 8_000_000 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.93));
    return out ?? file;
  } catch {
    return file;
  }
}
