/**
 * Lays an album out from the client's picks, with no AI and no cost: photos go in order, chapter by
 * chapter (the selection's folders: Holud, Wedding…), into the chosen design's page layouts. Tall photos
 * go to tall frames and wide to wide; every chapter opens with a title page.
 */
import { LOOKS, lookOf, variantOf, type Ctx, type Look, type Variant } from "./looks";
import { QUOTES } from "./quotes";
import type { APhoto, ImgItem, Item, LookId, Names, Spread } from "./types";

let seq = 0;
export const uid = (p = "i") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const shape = (p: APhoto | undefined) => (!p?.w || !p?.h ? "a" : p.w >= p.h * 1.05 ? "l" : p.h >= p.w * 1.05 ? "p" : "a");
const fits = (want: string, s: string) => (want === "a" || s === "a" ? 1 : want === s ? 2 : 0);

/** Puts `photos` into the frames of a layout, matching tall to tall and wide to wide. */
function place(items: Item[], photos: APhoto[]) {
  const frames = items.filter((i): i is ImgItem => i.k === "img").sort((a, b) => (a.bg ? 1 : 0) - (b.bg ? 1 : 0) || (a.want === "a" ? 1 : 0) - (b.want === "a" ? 1 : 0));
  const left = [...photos];
  for (const f of frames) {
    if (!left.length) { f.p = null; continue; }
    let best = 0, score = -1;
    left.forEach((p, i) => { const s = fits(f.want, shape(p)); if (s > score) { score = s; best = i; } });
    f.p = left.splice(best, 1)[0].id;
  }
}

/** One page of a design with these photos. */
export function makeSpread(look: Look, v: Variant, photos: APhoto[], ctx: Ctx, chapter: string | null = null): Spread {
  const items = v.make(ctx).map(d => ({ ...d, id: uid() })) as Item[];
  place(items, photos);
  return { id: uid("s"), look: look.id, v: v.id, bg: look.bg, items, chapter };
}

/** The photos a page holds, in frame order. */
export const photosOn = (s: Spread) => s.items.filter((i): i is ImgItem => i.k === "img").map(i => i.p).filter((p): p is string => !!p);

/** Same photos, another layout (or design): texts the studio typed are kept where the new layout has the same kind. */
export function relayout(s: Spread, lookId: LookId, variantId: string | null, byId: Map<string, APhoto>, base: Omit<Ctx, "quote" | "title">): Spread {
  const look = lookOf(lookId);
  const ids = photosOn(s);
  const pool = ids.map(id => byId.get(id)).filter((p): p is APhoto => !!p);
  const hadTitle = s.items.some(i => i.k === "text");
  const choices = look.variants.filter(v => !!v.title === hadTitle);
  const v = variantId ? variantOf(look, variantId) : (choices.find(c => c.photos === pool.length) ?? choices[0] ?? look.variants[0]);
  const oldText = s.items.filter(i => i.k === "text") as Extract<Item, { k: "text" }>[];
  const quote = oldText.find(t => t.role === "quote")?.t ?? QUOTES[0];
  const title = oldText.find(t => t.role === "title" || t.role === "name")?.t ?? s.chapter ?? null;
  const next = makeSpread(look, v, pool, { ...base, quote, title: s.chapter ? title : null }, s.chapter ?? null);
  return { ...next, id: s.id };
}

/** The next layout of the same design and kind (the editor's Shuffle). */
export function nextVariant(s: Spread) {
  const look = lookOf(s.look);
  const isTitle = !!variantOf(look, s.v).title;
  const same = look.variants.filter(v => !!v.title === isTitle);
  const i = same.findIndex(v => v.id === s.v);
  return same[(i + 1) % same.length]?.id ?? s.v;
}

export type AutoOptions = { look: LookId; spreads: number; names: Names; ar: number; mixLooks?: boolean };

/** The whole album: photos in chapters, a title page per chapter, then photo pages of the design. */
export function autoLayout(all: APhoto[], o: AutoOptions): Spread[] {
  const look = lookOf(o.look);
  const chapters: { name: string | null; photos: APhoto[] }[] = [];
  for (const p of all) {
    const name = p.f ?? null;
    const last = chapters[chapters.length - 1];
    if (last && last.name === name) last.photos.push(p); else chapters.push({ name, photos: [p] });
  }
  const total = Math.max(1, all.length);
  const out: Spread[] = [];
  let q = 0;
  const titleV = look.variants.filter(v => v.title);
  const photoV = look.variants.filter(v => !v.title);
  chapters.forEach((ch, ci) => {
    // Pages for this chapter, in proportion to its photos (at least one).
    const share = Math.max(1, Math.round((ch.photos.length / total) * o.spreads));
    const perPage = ch.photos.length / share;
    let at = 0;
    for (let n = 0; n < share && at < ch.photos.length; n++) {
      const isTitle = n === 0;
      const pool = isTitle ? titleV : photoV;
      // The layout whose number of photos is closest to what this chapter needs, taking turns among equals.
      const ranked = [...pool].sort((a, b) => Math.abs(a.photos - perPage) - Math.abs(b.photos - perPage));
      const near = ranked.filter(v => Math.abs(v.photos - perPage) === Math.abs(ranked[0].photos - perPage));
      let v = near[(n + ci) % near.length] ?? pool[0];
      // Near the end of a chapter, a layout with no more frames than photos left (no empty frames).
      const left = ch.photos.length - at;
      if (v.photos > left) {
        const smaller = pool.filter(x => x.photos <= left).sort((a, b) => b.photos - a.photos)[0]
          ?? look.variants.filter(x => x.photos <= left).sort((a, b) => b.photos - a.photos)[0];
        if (smaller) v = smaller;
      }
      const take = ch.photos.slice(at, at + v.photos);
      at += take.length;
      const ctx: Ctx = { ar: o.ar, names: o.names, quote: QUOTES[q++ % QUOTES.length], title: isTitle && ci > 0 ? ch.name : null };
      out.push(makeSpread(look, v, take, ctx, isTitle ? ch.name : null));
    }
  });
  return out.slice(0, 80);
}

/** How many pages an album of n photos usually gets (the studio can change it). */
export const suggestedSpreads = (n: number) => Math.max(6, Math.min(40, Math.round(n / 5)));

export { LOOKS };
