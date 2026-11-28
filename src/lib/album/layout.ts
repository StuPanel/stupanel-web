/**
 * Lays an album out from the client's picks, with no AI and no cost: photos go in order, chapter by
 * chapter (the selection's folders: Holud, Wedding…), into the chosen design's page layouts. Tall photos
 * go to tall frames and wide to wide; every chapter opens with a title page.
 */
import { LOOKS, lookOf, variantOf, type Ctx, type Look, type Variant } from "./looks";
import { QUOTES } from "./quotes";
import { faceCentre } from "./faces";
import { faceOnFold } from "./checks";
import type { APhoto, Faces, ImgItem, Item, LookId, Names, Spread } from "./types";

let seq = 0;
export const uid = (p = "i") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const shape = (p: APhoto | undefined) => (!p?.w || !p?.h ? "a" : p.w >= p.h * 1.05 ? "l" : p.h >= p.w * 1.05 ? "p" : "a");
const fits = (want: string, s: string) => (want === "a" || s === "a" ? 1 : want === s ? 2 : 0);

const loved = (p: APhoto) => (p.m === "important" ? 2 : 0) + (p.hl ? 1 : 0);
const area = (f: ImgItem) => f.w * f.h;

/**
 * Puts `photos` into the frames: the biggest frames first, each taking the best photo left (right shape
 * first, then the client's "love most" and the studio's highlights). Background photos are filled last.
 */
function place(items: Item[], photos: APhoto[], ctx?: Pick<Ctx, "ar" | "faces">) {
  const frames = items.filter((i): i is ImgItem => i.k === "img").sort((a, b) => (a.bg ? 1 : 0) - (b.bg ? 1 : 0) || area(b) - area(a));
  const left = [...photos];
  for (const f of frames) {
    if (!left.length) { f.p = null; continue; }
    let best = 0, score = -1;
    const overFold = f.x < 48 && f.x + f.w > 52;
    left.forEach((p, i) => {
      let s = fits(f.want, shape(p)) * 10 + (f.bg ? -loved(p) : loved(p));
      // A frame over the fold takes a photo whose faces can stay off it (or one with no faces).
      if (overFold && ctx?.faces) {
        const pos = focusFor(f, p, ctx.faces[p.id], ctx.ar);
        if (faceOnFold({ ...f, ...pos }, p, ctx.faces[p.id], ctx.ar)) s -= 40;
      }
      if (s > score) { score = s; best = i; }
    });
    const p = left.splice(best, 1)[0];
    f.p = p.id;
    if (ctx) Object.assign(f, focusFor(f, p, ctx.faces?.[p.id], ctx.ar));
  }
  // Not enough photos for a dim background: it repeats one of the page's photos (in black and white).
  const back = frames.find(f => f.bg && !f.p);
  const first = frames.find(f => !f.bg && f.p);
  if (back && first) {
    back.p = first.p;
    const ph = photos.find(x => x.id === first.p);
    if (ctx && ph) Object.assign(back, focusFor(back, ph, ctx.faces?.[ph.id], ctx.ar));
  }
}

/** Where a photo shows in its frame (object-position %) so the faces are in view and, for frames over the fold, off it. */
export function focusFor(f: Pick<ImgItem, "x" | "w" | "h" | "z" | "fx" | "fy"> & { bg?: boolean }, p: APhoto, boxes: number[][] | undefined, ar: number): { fx: number; fy: number; z?: number } {
  const c = faceCentre(boxes);
  if (!c || !p.w || !p.h) return { fx: f.fx ?? 50, fy: f.fy ?? 40 };
  const fw = (f.w / 100) * ar, fh = f.h / 100, pa = p.w / p.h;
  const s = Math.max(fw / pa, fh) * (f.z ?? 1);
  const dw = pa * s, dh = s;
  const pos = (frame: number, drawn: number, centre: number, aim: number) => (drawn - frame < 1e-6 ? 50 : Math.max(0, Math.min(100, ((aim * frame - centre * drawn) / (frame - drawn)) * 100)));
  let fx = pos(fw, dw, c.x / 100, 0.5);
  const fy = pos(fh, dh, c.y / 100, 0.42);
  // A frame across the middle: slide the photo (and zoom a dim background a little) until no face sits on the fold.
  let z = f.z ?? 1;
  if (f.x < 48 && f.x + f.w > 52 && boxes?.length) {
    const probe = { ...f, y: 0, fy } as ImgItem;
    if (faceOnFold({ ...probe, fx, z }, p, boxes, ar)) {
      let found: { fx: number; z: number } | null = null;
      for (const zz of (f as ImgItem).bg ? [1, 1.3, 1.6, 2] : [z]) {
        let bestD = Infinity;
        for (let t = 0; t <= 100; t += 2) if (!faceOnFold({ ...probe, fx: t, z: zz }, p, boxes, ar) && Math.abs(t - fx) < bestD) { bestD = Math.abs(t - fx); found = { fx: t, z: zz }; }
        if (found) break;
      }
      if (found) { fx = found.fx; z = found.z; }
    }
  }
  return { fx: Math.round(fx), fy: Math.round(fy), ...(z !== (f.z ?? 1) ? { z } : {}) };
}

/** One page of a design with these photos. */
export function makeSpread(look: Look, v: Variant, photos: APhoto[], ctx: Ctx, chapter: string | null = null): Spread {
  const items = v.make(ctx).map(d => ({ ...d, id: uid() })) as Item[];
  place(items, photos, ctx);
  return { id: uid("s"), look: look.id, v: v.id, bg: look.bg, items, chapter };
}

/** The photos a page holds, in frame order. */
export const photosOn = (s: Spread) => s.items.filter((i): i is ImgItem => i.k === "img").map(i => i.p).filter((p): p is string => !!p);

/** Same photos, another layout (or design): texts the studio typed are kept where the new layout has the same kind. */
export function relayout(s: Spread, lookId: LookId, variantId: string | null, byId: Map<string, APhoto>, base: Omit<Ctx, "quote" | "title">, spare: APhoto[] = []): Spread {
  const look = lookOf(lookId);
  const ids = photosOn(s);
  const own = ids.map(id => byId.get(id)).filter((p): p is APhoto => !!p);
  // A layout with more frames takes photos not used yet (loved first); one with fewer frees the rest.
  const extra = [...spare].sort((a, b) => loved(b) - loved(a));
  const pool = [...own, ...extra];
  const hadTitle = s.items.some(i => i.k === "text");
  const wasEnd = s.items.some(i => i.k === "logo");
  const choices = look.variants.filter(v => (wasEnd ? !!v.end : !!v.title === hadTitle && !v.end));
  const v = variantId ? variantOf(look, variantId) : (choices.find(c => c.photos === own.length) ?? choices[0] ?? look.variants[0]);
  const oldText = s.items.filter(i => i.k === "text") as Extract<Item, { k: "text" }>[];
  const quote = oldText.find(t => t.role === "quote")?.t ?? QUOTES[0];
  const title = oldText.find(t => t.role === "title" || t.role === "name")?.t ?? s.chapter ?? null;
  const next = makeSpread(look, v, pool.slice(0, Math.max(v.photos, 0)), { ...base, quote, title: s.chapter ? title : null }, s.chapter ?? null);
  return { ...next, id: s.id };
}

/** The next layout of the same design and kind (the editor's Shuffle). */
export function nextVariant(s: Spread) {
  const look = lookOf(s.look);
  const cur = variantOf(look, s.v);
  const same = look.variants.filter(v => (cur.end ? !!v.end : !!v.title === !!cur.title && !v.end));
  const i = same.findIndex(v => v.id === s.v);
  return same[(i + 1) % same.length]?.id ?? s.v;
}

export type AutoOptions = { look: LookId; spreads: number; names: Names; ar: number; faces?: Faces; skip?: Set<string> };

/** The whole album: photos in chapters, a title page per chapter, then photo pages of the design. */
export function autoLayout(input: APhoto[], o: AutoOptions): Spread[] {
  const look = lookOf(o.look);
  // Look-alike shots stay out (they wait in the editor's photo list).
  const all = o.skip?.size ? input.filter(p => !o.skip!.has(p.id)) : input;
  const chapters: { name: string | null; photos: APhoto[] }[] = [];
  for (const p of all) {
    const name = p.f ?? null;
    const last = chapters[chapters.length - 1];
    if (last && last.name === name) last.photos.push(p); else chapters.push({ name, photos: [p] });
  }
  const total = Math.max(1, all.length);
  const out: Spread[] = [];
  let q = 0;
  const titleV = look.variants.filter(v => v.title && !v.end);
  const photoV = look.variants.filter(v => !v.title);
  const endV = look.variants.find(v => v.end);
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
      // The chapter's title page gets its most loved photos.
      let take = ch.photos.slice(at, at + v.photos);
      if (isTitle) {
        const best = [...ch.photos].sort((a, b) => loved(b) - loved(a)).slice(0, v.photos);
        if (best.some(b => loved(b) > 0)) { const ids = new Set(best.map(b => b.id)); ch.photos = [...best, ...ch.photos.filter(p => !ids.has(p.id))]; take = ch.photos.slice(at, at + v.photos); }
      }
      at += take.length;
      const ctx: Ctx = { ar: o.ar, names: o.names, faces: o.faces, quote: QUOTES[q++ % QUOTES.length], title: isTitle && ci > 0 ? ch.name : null };
      out.push(makeSpread(look, v, take, ctx, isTitle ? ch.name : null));
    }
  });
  // A closing page with the studio's logo, the couple's names and a loved photo.
  if (endV && out.length >= 4) {
    const usedIds = new Set(out.flatMap(photosOn));
    const pick = [...all].sort((a, b) => loved(b) - loved(a)).find(p => !usedIds.has(p.id)) ?? [...all].sort((a, b) => loved(b) - loved(a))[0];
    if (pick) out.push(makeSpread(look, endV, [pick], { ar: o.ar, names: o.names, faces: o.faces, quote: "", title: null }, null));
  }
  return out.slice(0, 80);
}

/** How many pages an album of n photos usually gets (the studio can change it). */
export const suggestedSpreads = (n: number) => Math.max(6, Math.min(40, Math.round(n / 5)));

export { LOOKS };
