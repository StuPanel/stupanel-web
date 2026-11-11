/**
 * Phone numbers for WhatsApp links (wa.me needs the full international number, digits only).
 * A number typed the local way ("01712…", "07911…") gets the studio's country code
 * (Settings → Studio → Country). Numbers already written with a country code stay as they are.
 */

const CODES: Record<string, string> = {
  bangladesh: "880", bd: "880",
  india: "91", in: "91",
  pakistan: "92", pk: "92",
  nepal: "977", np: "977",
  "sri lanka": "94", lk: "94",
  bhutan: "975", bt: "975",
  maldives: "960", mv: "960",
  myanmar: "95", mm: "95",
  "united states": "1", "united states of america": "1", usa: "1", us: "1",
  canada: "1", ca: "1",
  "united kingdom": "44", uk: "44", gb: "44", england: "44", scotland: "44", wales: "44",
  ireland: "353", ie: "353",
  australia: "61", au: "61",
  "new zealand": "64", nz: "64",
  "united arab emirates": "971", uae: "971", ae: "971",
  "saudi arabia": "966", ksa: "966", sa: "966",
  qatar: "974", qa: "974",
  kuwait: "965", kw: "965",
  oman: "968", om: "968",
  bahrain: "973", bh: "973",
  malaysia: "60", my: "60",
  singapore: "65", sg: "65",
  indonesia: "62", id: "62",
  philippines: "63", ph: "63",
  thailand: "66", th: "66",
  vietnam: "84", vn: "84",
  japan: "81", jp: "81",
  "south korea": "82", korea: "82", kr: "82",
  china: "86", cn: "86",
  "hong kong": "852", hk: "852",
  turkey: "90", "türkiye": "90", tr: "90",
  egypt: "20", eg: "20",
  "south africa": "27", za: "27",
  nigeria: "234", ng: "234",
  kenya: "254", ke: "254",
  germany: "49", de: "49",
  france: "33", fr: "33",
  italy: "39", it: "39",
  spain: "34", es: "34",
  portugal: "351", pt: "351",
  netherlands: "31", nl: "31",
  belgium: "32", be: "32",
  switzerland: "41", ch: "41",
  austria: "43", at: "43",
  sweden: "46", se: "46",
  norway: "47", no: "47",
  denmark: "45", dk: "45",
  finland: "358", fi: "358",
  poland: "48", pl: "48",
  greece: "30", gr: "30",
  mexico: "52", mx: "52",
  brazil: "55", br: "55",
  argentina: "54", ar: "54",
};

let studioCountry = "";
/** Set by AuthProvider when the studio loads (and when Country changes in Settings). */
export function setStudioCountry(c: string | null | undefined) { studioCountry = (c ?? "").trim(); }

/** "880" for Bangladesh, "44" for the UK… null when the country is unknown. */
export function callingCode(country: string | null | undefined = studioCountry): string | null {
  const k = (country ?? "").trim().toLowerCase().replace(/\./g, "");
  return CODES[k] ?? null;
}

/** Digits for wa.me, or null when there is no number. */
export function waNumber(phone: string | null | undefined, country: string | null | undefined = studioCountry): string | null {
  const raw = (phone ?? "").trim();
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (raw.startsWith("+")) return d;               // written with its country code
  if (d.startsWith("00")) return d.slice(2);        // 00 44 7911… = +44 7911…
  const cc = callingCode(country);
  if (d.startsWith("0")) {
    if (cc) return cc + d.slice(1);                 // local with trunk 0: 01712… → 8801712…
    if (d.length === 11 && d.startsWith("01")) return "88" + d; // studio country not set: old Bangladesh rule
    return d;
  }
  if (cc && !d.startsWith(cc) && d.length <= 10) d = cc + d; // local without the 0: 5551234567 → 15551234567
  return d;
}
