/** Music selection — shapes shared by the studio, the client portal and the editor. */
/** A part of a program that needs music: a day and/or a kind of video ("Holud · Trailer"). */
export type MusicPart = { key: string; label: string; kind: "day" | "video" | "custom"; event?: string; video?: string };
export type MusicSong = { youtubeId: string; title: string; channel?: string; thumb: string; url: string };
export type MusicPick = MusicSong & { note?: string; from: "studio" | "client" };
export type MusicSuggestion = MusicSong & { parts: string[] };
export type MusicCounts = { total: number; filled: number; parts: number; empty: string[] };

export type MusicSelection = {
  status: "open" | "submitted" | "off";
  parts: MusicPart[];
  perPart: number;
  suggestions: MusicSuggestion[];
  picks: Record<string, MusicPick[]>;
  counts: MusicCounts;
  clientNote: string | null;
  submittedAt: string | null;
  reopenRequestedAt: string | null;
  reopenReason: string | null;
};

/** A song in the studio's library. `tags` are the studio's own (private) tags; the rest are shared tag ids. */
export type LibrarySong = MusicSong & {
  id: string; tags: string[]; usedCount: number;
  events: string[]; videos: string[]; moods: string[]; language: string | null;
  altNames: string | null; shared: boolean;
};
/** A song from outside the studio's library: a StuPanel pick, a community song, or one its clients brought. */
export type OutsideSong = MusicSong & {
  events: string[]; videos: string[]; moods: string[]; language: string | null; altNames?: string | null;
  studios?: number; chosen?: number; times?: number;
  /** already in the studio's own library */
  mine: boolean;
};
export type MusicSourceMode = "off" | "me" | "clients";
export type MusicSettings = { picks: MusicSourceMode; community: MusicSourceMode; fromClients: MusicSourceMode; share: boolean; outsideLimit: number; hiddenCount?: number };
export type OutsideMusic = {
  settings: MusicSettings; country: string;
  picks: OutsideSong[]; community: { country: OutsideSong[]; world: OutsideSong[] }; fromClients: OutsideSong[];
};

/** One shared tag; `also` = other names for it (any language); `more` = not usual in this studio's country. */
export type MusicTag = { id: string; name: string; also: string[]; more: boolean };
export type TagCatalog = { events: MusicTag[]; videos: MusicTag[]; moods: MusicTag[]; languages: MusicTag[]; own: string[] };
/** The same short name the server makes for a day ("Gaye Holud" → "gaye-holud"), used in a part's key. */
export const partSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
export const EMPTY_CATALOG: TagCatalog = { events: [], videos: [], moods: [], languages: [], own: [] };
export const tagName = (list: MusicTag[], id: string) => list.find(t => t.id === id)?.name ?? id;

/** The 11-character video id in a pasted YouTube link (or null). */
export function youtubeIdOf(input: string): string | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/.exec(raw);
  return m ? m[1] : null;
}

// ─── Search ──────────────────────────────────────────────────────────────────

/** Lower case, no accents or punctuation, single spaces: "Tum-Hi  HO!" → "tum hi ho". */
export const plainText = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

/** Are two words the same but for a small typing mistake? (1 slip in a short word, 2 in a long one) */
function nearly(a: string, b: string) {
  if (a === b) return true;
  const max = a.length <= 3 ? 0 : a.length <= 6 ? 1 : 2;
  if (!max || Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? prev[j - 1] : 99); // two letters swapped
      cur.push(v); if (v < low) low = v;
    }
    if (low > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** How well one typed word matches a text: 0 = not at all. Starts-with beats inside beats "nearly". */
function wordScore(token: string, text: string, words: string[], squashed: string) {
  if (!text) return 0;
  if (text.startsWith(token)) return 100;
  if (words.some(w => w.startsWith(token))) return 80;
  if (text.includes(token)) return 60;
  if (squashed.includes(token)) return 55; // "tumhiho" finds "tum hi ho"
  if (words.some(w => nearly(token, w) || (w.length > token.length + 1 && nearly(token, w.slice(0, token.length))))) return 40;
  return 0;
}

export type SongHit<T> = { song: T; score: number };
type Searchable = { youtubeId: string; title: string; channel?: string; altNames?: string | null; usedCount?: number;
  events?: string[]; videos?: string[]; moods?: string[]; language?: string | null; tags?: string[] };

/**
 * Find songs by what the person typed: the song's name (any part of it), its other names, the artist
 * or channel, a tag or any other name of a tag ("haldi", "হলুদ" → Holud), mood, language — or a pasted
 * YouTube link. Every typed word must be found somewhere; small spelling mistakes are forgiven.
 * Best first: name starts with it, name contains it, artist, tag; ties go to the song chosen more often.
 */
export function searchSongs<T extends Searchable>(songs: T[], query: string, cat: TagCatalog): SongHit<T>[] {
  const link = youtubeIdOf(query);
  if (link) return songs.filter(s => s.youtubeId === link).map(song => ({ song, score: 1000 }));
  const whole = plainText(query);
  if (!whole) return songs.map(song => ({ song, score: 0 }));
  const tokens = whole.split(" ");
  const names = (list: MusicTag[], ids: string[] | undefined) => (ids ?? []).flatMap(id => { const t = list.find(x => x.id === id); return t ? [t.name, ...t.also] : []; });
  const out: SongHit<T>[] = [];
  for (const song of songs) {
    const title = plainText(song.title), alt = plainText(song.altNames ?? ""), artist = plainText(song.channel ?? "");
    const tagWords = [...names(cat.events, song.events), ...names(cat.videos, song.videos), ...names(cat.moods, song.moods),
      ...names(cat.languages, song.language ? [song.language] : []), ...(song.tags ?? [])].map(plainText).filter(Boolean);
    const f = {
      title: [title, title.split(" "), title.replace(/ /g, "")] as const,
      alt: [alt, alt.split(" "), alt.replace(/ /g, "")] as const,
      artist: [artist, artist.split(" "), artist.replace(/ /g, "")] as const,
    };
    let total = 0, ok = true;
    for (const t of tokens) {
      const inTitle = wordScore(t, ...f.title), inAlt = wordScore(t, ...f.alt) * 0.9, inArtist = wordScore(t, ...f.artist) * 0.5;
      let inTag = 0;
      for (const w of tagWords) { const v = wordScore(t, w, w.split(" "), w.replace(/ /g, "")) * 0.45; if (v > inTag) inTag = v; }
      const best = Math.max(inTitle, inAlt, inArtist, inTag);
      if (!best) { ok = false; break; }
      total += best;
    }
    if (!ok) continue;
    // The whole phrase at the start of the name is the best match of all.
    if (title.startsWith(whole)) total += 60; else if (title.includes(whole)) total += 25;
    out.push({ song, score: total / tokens.length + Math.min(song.usedCount ?? 0, 50) / 100 });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** The song's name cut into pieces, marking the bits that match what was typed (for bold in the list). */
export function markMatch(title: string, query: string): { text: string; hit: boolean }[] {
  const tokens = plainText(query).split(" ").filter(t => t.length > 1);
  if (!tokens.length) return [{ text: title, hit: false }];
  const lower = title.toLowerCase();
  const marks = new Array(title.length).fill(false);
  for (const t of tokens) {
    let i = lower.indexOf(t);
    while (i >= 0) {
      // A short word only counts at the start of a word ("hi" in "Hi Ho", not inside "Aashiqui").
      const atStart = i === 0 || !/[\p{L}\p{N}]/u.test(lower[i - 1]);
      if (t.length >= 4 || atStart) for (let k = i; k < i + t.length; k++) marks[k] = true;
      i = lower.indexOf(t, i + t.length);
    }
  }
  const out: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < title.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hit === marks[i]) last.text += title[i]; else out.push({ text: title[i], hit: marks[i] });
  }
  return out;
}

/** What the client portal gets for one program. */
export type ClientMusic = Omit<MusicSelection, "suggestions"> & {
  bookingId: string; program: string; eventDate: string | null;
  /** `src`: where a suggestion comes from when it is not the studio's own — StuPanel picks, other studios, other clients. */
  ideas: Record<string, (MusicSong & { pick: boolean; src?: "picks" | "community" | "clients" })[]>;
};

export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

/** The list as plain text — to paste to an editor on WhatsApp. */
export function musicAsText(program: string, parts: MusicPart[], picks: Record<string, MusicPick[]>, note?: string | null) {
  const lines = [`🎵 Music — ${program}`];
  for (const p of parts) {
    const list = picks[p.key] ?? [];
    lines.push("", `▸ ${p.label}`);
    if (!list.length) lines.push("   (no song chosen)");
    list.forEach((s, i) => lines.push(`   ${i + 1}. ${s.title}${s.note ? ` — ${s.note}` : ""}`, `      ${s.url}`));
  }
  if (note) lines.push("", `Note: ${note}`);
  return lines.join("\n");
}
