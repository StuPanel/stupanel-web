/** Music selection — shapes shared by the studio, the client portal and the editor. */
export type MusicPart = { key: string; label: string; kind: "day" | "video" | "custom" };
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

export type LibrarySong = MusicSong & { id: string; tags: string[]; usedCount: number };

/** What the client portal gets for one program. */
export type ClientMusic = Omit<MusicSelection, "suggestions"> & {
  bookingId: string; program: string; eventDate: string | null;
  ideas: Record<string, (MusicSong & { pick: boolean })[]>;
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
