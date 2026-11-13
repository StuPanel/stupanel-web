/**
 * Studio shifts (Settings → Programs → Shifts, each on or off) and how a shift's time and a venue's map link
 * are shown. The same rules as the API (bookings/team-assign.ts).
 */
/** `active: false` = turned off in Settings: not offered anywhere (older saved shifts have no flag = on). */
export type StudioShift = { id: string; name: string; start: string | null; end: string | null; active: boolean };

/** The shifts a studio can pick now. */
export const activeShifts = (list: StudioShift[]) => list.filter(s => s.active !== false);

/** Used until the studio's own list loads (same as the server defaults). */
export const DEFAULT_SHIFTS: StudioShift[] = [
  { id: "day", name: "Day", start: "11:00", end: "16:00", active: true },
  { id: "evening", name: "Evening", start: "17:00", end: "22:00", active: true },
  { id: "night", name: "Night", start: "20:00", end: "01:00", active: true },
  { id: "full-day", name: "Full day", start: "10:00", end: "22:00", active: true },
];

/** "17:00" → "5:00 PM" */
export function fmtTime(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** "5:00 PM – 10:00 PM" (or "from 5:00 PM", or ""). */
export function timeRange(start?: string | null, end?: string | null): string {
  const a = fmtTime(start), b = fmtTime(end);
  return a && b ? `${a} – ${b}` : a ? `from ${a}` : "";
}

const GOOGLE_MAPS = /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
export const isMapLink = (u?: string | null) => GOOGLE_MAPS.test((u ?? "").trim());

/** The day's Google Maps link: the pasted one, else a search for the venue ("" when neither). */
export function mapLink(d: { mapUrl?: string | null; location?: string | null }): string {
  if (isMapLink(d.mapUrl)) return d.mapUrl!.trim();
  const loc = (d.location ?? "").trim();
  return loc ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}` : "";
}
