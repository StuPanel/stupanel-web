/**
 * One video or photo set an editor sends (Faisal 25-NOV-2026); same rules as stupanel-api bookings/work-items.ts.
 * Key: "<type>" or "<type>|<day or name>". Versions of one video share the key. Old work has no key: its type.
 */
export const WORK_LABEL: Record<string, string> = {
  highlight_video: "Highlight video", full_video: "Full video", teaser: "Teaser", reel: "Reel",
  photo_delivery: "Photos", album: "Album", other: "Other",
};
export const VIDEO_KINDS = ["highlight_video", "full_video", "teaser", "reel", "other"];
export const PHOTO_KINDS = ["photo_delivery", "album", "other"];

export const cleanSlot = (v: string) => v.replace(/[|\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
export const typeOf = (key: string) => key.split("|")[0];
export const slotOf = (key: string) => (key.includes("|") ? key.slice(key.indexOf("|") + 1) : "");
export const makeKey = (type: string, slot?: string) => { const s = cleanSlot(slot ?? ""); return s ? `${type}|${s}` : type; };
export const keyOf = (s: { itemKey?: string | null; deliverableType: string }) => s.itemKey || s.deliverableType;
export function titleOf(key: string, title?: string | null) {
  if (title?.trim()) return title.trim();
  const t = WORK_LABEL[typeOf(key)] ?? typeOf(key);
  const s = slotOf(key);
  return s ? `${s} — ${t}` : t;
}
/** "Holud Trailer.mp4" → "Holud Trailer" */
export const nameFromFile = (n: string) => cleanSlot(n.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " "));
