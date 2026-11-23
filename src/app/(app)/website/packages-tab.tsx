"use client";

/**
 * Website → Packages: packages made for the website. Each one gets its own page and link (for Facebook ads):
 * photos, price and offer, short facts, day plan, what the client gets, extras, a film and questions.
 * "Make from my package" fills everything the studio's own package already knows and marks what is left.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Copy, Crop, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Package, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { SwitchRow, inputCls } from "@/components/ui/form-kit";
import { Sec } from "./ed-kit";
import { askConfirm, notify } from "@/components/feedback";
import { API_URL as API, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { cropStyle, type SiteContent, type SiteCrop } from "@/components/site/site-view";
import type { SiteOffer } from "@/lib/site-offer-kit";

type Photo = { id: string; url: string; thumbUrl?: string | null; blur: string };
const small = (p: Photo) => p.thumbUrl || p.url;
const MAX = 30;

/** A studio package (Packages page), as the API sends it. */
type Program = {
  id: string; name: string; description?: string | null; category?: string | null; basePrice: string | number; priceIsNegotiable?: boolean;
  durationHours?: string | number | null; durationDays?: number | null; durationUnit?: string | null; deliveryDays?: number | null;
  deliverablesDescription?: string | null; eventTypesIncluded?: string[]; staffing?: { role: string; level?: string; count: number }[];
  photoEditCount?: number | null; trailerCount?: number | null; fullVideoCount?: number | null; ritualsIncluded?: string[];
  deliveryMethod?: string | null; isActive?: boolean; updatedAt: string; deletedAt?: string | null;
};

/** How the cover sits in each look's card (width / height), so "Adjust" shows the same frame. */
export const OFFER_RATIO: Record<string, number> = { signature: 3 / 4.1, editorial: 4 / 5, cream: 3 / 2, dark: 16 / 9, gold: 3 / 2, mono: 4 / 5 };

const slug = (v: string) => (v || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/g, "");
const tmpId = () => `new-${Math.random().toString(36).slice(2, 8)}`;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

export const emptyOffer = (): SiteOffer => ({
  id: tmpId(), name: "", group: "", tagline: "", cover: null, photos: [], price: null, was: null, from: false, badge: "", ends: "",
  facts: [], days: [], gets: [], extras: [], film: "", filmId: null, note: "", faqs: [], hidden: false, src: null, srcAt: "",
});

const ROLE: Record<string, [string, string]> = {
  photographer: ["photographer", "photographers"], cinematographer: ["cinematographer", "cinematographers"], drone_pilot: ["drone pilot", "drone pilots"],
};
const DELIVERY: Record<string, string> = { pendrive: "On a USB drive", google_drive: "Online on Google Drive", both: "Online and on a USB drive" };

/** The team of a studio package as one short line: "2 photographers, 1 cinematographer". */
function teamLine(p: Program) {
  const per = new Map<string, number>();
  for (const s of p.staffing ?? []) if (ROLE[s.role] && Number(s.count) > 0) per.set(s.role, (per.get(s.role) ?? 0) + Number(s.count));
  return Array.from(per, ([r, n]) => `${n} ${ROLE[r][n > 1 ? 1 : 0]}`).join(", ");
}

/** Everything a studio package already knows, as a website package (the rest is left empty to fill in). */
function fromProgram(p: Program, keep?: SiteOffer): SiteOffer {
  const days = p.durationUnit === "days" && num(p.durationDays) ? num(p.durationDays) : 1;
  const hours = num(p.durationHours);
  const people = (p.staffing ?? []).filter(s => ROLE[s.role]).reduce((n, s) => n + num(s.count), 0);
  const films = num(p.trailerCount) + num(p.fullVideoCount);
  const facts: SiteOffer["facts"] = [];
  if (days > 1) facts.push({ v: String(days), l: "days" }); else if (hours) facts.push({ v: String(hours), l: "hours" });
  if (people) facts.push({ v: String(people), l: people > 1 ? "people" : "person" });
  if (films) facts.push({ v: String(films), l: films > 1 ? "films" : "film" });
  if (num(p.photoEditCount)) facts.push({ v: String(num(p.photoEditCount)), l: "photos" });
  if (num(p.deliveryDays)) facts.push({ v: String(num(p.deliveryDays)), l: "days delivery" });
  // Days: the events the package covers (Holud, Wedding…), one per day when they match the number of days.
  const events = (p.eventTypesIncluded?.length ? p.eventTypesIncluded : p.ritualsIncluded ?? []).filter(Boolean);
  const team = teamLine(p);
  const dayList: SiteOffer["days"] = events.length
    ? events.slice(0, 7).map(e => ({ name: e, hours: hours ? `${hours} hours` : "", team }))
    : days > 1 ? Array.from({ length: Math.min(days, 7) }, (_, i) => ({ name: `Day ${i + 1}`, hours: hours ? `${hours} hours` : "", team })) : [];
  const gets: SiteOffer["gets"] = [];
  if (num(p.photoEditCount)) gets.push({ t: `${num(p.photoEditCount)} edited photos`, d: "" });
  const vid = [num(p.trailerCount) ? `${num(p.trailerCount) > 1 ? `${num(p.trailerCount)} trailers` : "Trailer"}` : "", num(p.fullVideoCount) ? `${num(p.fullVideoCount) > 1 ? `${num(p.fullVideoCount)} full films` : "full film"}` : ""].filter(Boolean).join(" and ");
  if (vid) gets.push({ t: vid.charAt(0).toUpperCase() + vid.slice(1), d: "" });
  if (team) gets.push({ t: "The team", d: team.charAt(0).toUpperCase() + team.slice(1) });
  if (p.deliveryMethod && DELIVERY[p.deliveryMethod] || num(p.deliveryDays)) gets.push({ t: num(p.deliveryDays) ? `Ready in ${num(p.deliveryDays)} days` : "Delivery", d: p.deliveryMethod ? DELIVERY[p.deliveryMethod] ?? "" : "" });
  const desc = (p.description ?? "").trim().split(/\n+/).map(x => x.trim()).filter(Boolean);
  const price = num(p.basePrice) || null;
  const base = keep ?? emptyOffer();
  return {
    ...base,
    name: keep?.name || p.name, group: keep?.group || p.category || "",
    tagline: keep?.tagline || (desc[0] ?? "").slice(0, 160),
    // While an offer runs, the package's new price becomes the struck "old" price (when it is still higher).
    ...(keep?.was ? { price: keep.price, was: price && price > (keep.price ?? 0) ? price : keep.was } : { price, was: null }),
    from: keep?.from ?? false,
    facts: facts.slice(0, 6), days: dayList, gets: gets.slice(0, 10),
    note: keep?.note || desc.slice(1).join("\n").slice(0, 1000),
    src: p.id, srcAt: p.updatedAt,
  };
}

/** What a package still needs before it looks good (shown as "Fill this"). */
function missing(o: SiteOffer): string[] {
  const out: string[] = [];
  if (!o.cover) out.push("cover photo");
  if (o.photos.length < 3) out.push("more photos");
  if (!o.tagline) out.push("one line");
  if (!o.days.length) out.push("day plan");
  if (!o.gets.length) out.push("what you get");
  if (!o.extras.length) out.push("extras");
  return out;
}

const Need = ({ on }: { on: boolean }) => (on ? <span className="ml-2 inline-flex items-center h-5 px-2 rounded-full bg-[#FFF4D6] text-[#8A5A00] text-[11px] font-bold align-middle">Fill this</span> : null);
const iconBtn = "w-10 h-10 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] disabled:opacity-30 text-[#6B6680] flex items-center justify-center flex-shrink-0";
const delBtn = "w-10 h-10 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0";
const addBtn = "w-full px-4 py-3 text-left text-[14px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2";
const pill = "h-9 px-3 rounded-full bg-[#F1EEF8] hover:bg-[#E7E2F3] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5";
const money = (n: number | null) => (n === null ? "Ask for the price" : `৳ ${n.toLocaleString("en-IN")}`);

export function PackagesTab({ c, setMany, photo, choose, adjust, theme, link, published }: {
  c: SiteContent; setMany: (patch: Partial<SiteContent>) => void;
  photo: (id: string | null | undefined) => Photo | undefined;
  choose: (title: string, value: string[], done: (ids: string[]) => void, multi?: boolean, max?: number, first?: string[]) => void;
  adjust: (key: string, id: string | null | undefined, title: string, ratio: number) => void;
  theme: string; /** The website address of a page */ link: (path: string) => string; published: boolean;
}) {
  const offers = c.offers ?? [];
  const crops: Record<string, SiteCrop> = c.crop ?? {};
  const [open, setOpen] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  // The studio's own packages: for "Make from my package" and "changed since".
  useEffect(() => {
    let on = true;
    apiFetch(`${API}/packages`).then(async r => { if (!on) return; if (r.ok) setPrograms(((await r.json()) as Program[]).filter(p => !p.deletedAt)); else setLoadErr(true); }).catch(() => on && setLoadErr(true));
    return () => { on = false; };
  }, []);
  const byId = useMemo(() => new Map((programs ?? []).map(p => [p.id, p])), [programs]);

  const save = (list: SiteOffer[], crop?: Record<string, SiteCrop>) => setMany(crop ? { offers: list, crop } : { offers: list });
  const put = (id: string, patch: Partial<SiteOffer>) => save(offers.map(o => (o.id === id ? { ...o, ...patch } : o)));
  /** The web address from the name, once (a temporary one is replaced; the studio can still change it). */
  const settleId = (o: SiteOffer) => {
    if (!o.id.startsWith("new-") || !o.name.trim()) return;
    const want = slug(o.name) || "package";
    let id = want;
    for (let k = 2; offers.some(x => x.id === id && x !== o); k++) id = `${want.slice(0, 46)}-${k}`;
    renameId(o, id);
  };
  const renameId = (o: SiteOffer, id: string) => {
    if (!id || id === o.id) return;
    const crop = { ...crops };
    if (crop[`offer:${o.id}`]) { crop[`offer:${id}`] = crop[`offer:${o.id}`]; delete crop[`offer:${o.id}`]; }
    save(offers.map(x => (x === o ? { ...x, id } : x)), crop);
    if (open === o.id) setOpen(id);
  };
  const add = (o: SiteOffer) => { save([...offers, o]); setOpen(o.id); };
  const remove = async (o: SiteOffer) => {
    if (!(await askConfirm({ title: `Remove ${o.name || "this package"} from the website?`, message: published ? "Its page and link stop working after you publish. Your studio package is not touched." : "Your studio package is not touched.", confirmLabel: "Remove", danger: true }))) return;
    const crop = { ...crops }; delete crop[`offer:${o.id}`];
    save(offers.filter(x => x !== o), crop);
  };
  const move = (i: number, by: number) => { const list = [...offers]; const [x] = list.splice(i, 1); list.splice(i + by, 0, x); save(list); };
  const makeFrom = (p: Program) => {
    const o = fromProgram(p);
    let id = slug(o.name) || "package";
    for (let k = 2; offers.some(x => x.id === id); k++) id = `${(slug(o.name) || "package").slice(0, 46)}-${k}`;
    add({ ...o, id });
    setImporting(false);
    notify(`${p.name} added. Fill the parts marked "Fill this".`);
  };
  const refresh = (o: SiteOffer, p: Program) => { put(o.id, fromProgram(p, o)); notify("Price and details updated from your package"); };
  const copy = async (path: string) => { try { await navigator.clipboard.writeText(link(path)); notify("Link copied"); } catch { notify("Could not copy. Select the link and copy it.", { error: true }); } };
  const groups = Array.from(new Set([...offers.map(o => o.group).filter(Boolean), ...(c.events ?? [])]));

  return (
    <>
      <Sec icon={Package} tone="violet" title="Your packages" where="Packages page and Home"
        help="Tap a package to edit it. Each one has its own page and link for Facebook, WhatsApp or an ad. The cards arrange themselves for any number of packages; change the order with the arrows inside a package.">
        {offers.length === 0 && (
          <div className="px-4 py-6 text-center">
            <Package className="w-8 h-8 mx-auto text-[#A29DB3]" aria-hidden="true" />
            <p className="text-[15px] font-semibold text-[#17151F] mt-2">No website packages yet</p>
            <p className="text-[13px] text-[#6B6680] mt-1 max-w-[380px] mx-auto">Start from one of your packages — the price, days, team and photos count come in by themselves.</p>
          </div>
        )}
        {offers.map((o, i) => {
          const cover = photo(o.cover) ?? photo(o.photos[0]);
          const need = missing(o);
          const src = o.src ? byId.get(o.src) : undefined;
          const changed = !!src && !!o.srcAt && new Date(src.updatedAt).getTime() > new Date(o.srcAt).getTime() + 1000;
          const isOpen = open === o.id;
          return (
            <div key={o.id} className="px-4 py-3.5">
              <div className="flex gap-3 items-center">
                <button type="button" onClick={() => setOpen(isOpen ? null : o.id)} className="flex gap-3 items-center flex-1 min-w-0 text-left" aria-expanded={isOpen}>
                  <span className="w-[64px] h-[64px] rounded-[12px] overflow-hidden bg-[#F5F3FA] flex-shrink-0 flex items-center justify-center text-[#A29DB3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {cover ? <img src={small(cover)} alt="" className="w-full h-full object-cover" style={cropStyle(crops[`offer:${o.id}`])} /> : <ImagePlus className="w-5 h-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#17151F] truncate">{o.name || "New package"}{o.hidden && <span className="ml-2 text-[11px] font-bold text-[#6B6680] bg-[#F1EEF8] rounded-full px-2 py-0.5 align-middle">Hidden</span>}</span>
                    <span className="block text-[13px] text-[#6B6680] truncate">{[o.group, money(o.price)].filter(Boolean).join(" · ")}</span>
                    {need.length > 0 && <span className="block text-[12px] text-[#8A5A00] truncate">Add: {need.join(", ")}</span>}
                  </span>
                  {isOpen ? <ChevronUp className="w-5 h-5 text-[#6B6680] flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-[#6B6680] flex-shrink-0" />}
                </button>
              </div>
              {changed && src && (
                <div className="mt-2.5 rounded-[12px] bg-[#EEF4FF] text-[#1E3A8A] px-3 py-2.5 text-[13px] flex items-center gap-2 flex-wrap">
                  <span className="flex-1 min-w-[180px]">Your package <b>{src.name}</b> changed (now {money(num(src.basePrice) || null)}).</span>
                  <button type="button" onClick={() => refresh(o, src)} className="h-8 px-3 rounded-full bg-white text-[13px] font-semibold inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Update price and details</button>
                  <button type="button" onClick={() => put(o.id, { srcAt: src.updatedAt })} className="h-8 px-3 rounded-full text-[13px] font-semibold">Keep mine</button>
                </div>
              )}
              {isOpen && (
                <OfferEditor o={o} i={i} count={offers.length} put={p => put(o.id, p)} settle={() => settleId(o)} rename={id => renameId(o, id)} taken={id => offers.some(x => x.id === id && x !== o)}
                  photo={photo} crops={crops} choose={choose} adjust={adjust} theme={theme} groups={groups} link={link} copy={copy} published={published}
                  move={by => move(i, by)} remove={() => remove(o)} />
              )}
            </div>
          );
        })}
        {offers.length < MAX && (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <button type="button" onClick={() => setImporting(true)} className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Package className="w-4 h-4" />Make from my package</button>
            <button type="button" onClick={() => add(emptyOffer())} className="h-10 px-4 rounded-full bg-[#F1EEF8] hover:bg-[#E7E2F3] text-sm font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Start empty</button>
          </div>
        )}
      </Sec>

      {importing && (
        <>
          <div className="fixed inset-0 z-[60] bg-[#17151F]/45" onClick={() => setImporting(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="imp-title" className="fixed z-[70] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-[520px] sm:h-fit max-h-[86dvh] overflow-y-auto bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <h2 id="imp-title" className="text-[17px] font-bold text-[#17151F] flex-1">Make from my package</h2>
              <button type="button" onClick={() => setImporting(false)} aria-label="Close" className="w-9 h-9 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[13px] text-[#6B6680] mb-3">The name, price, days, team, photos and films come in by themselves. You add the photos, one line about it and the extras.</p>
            {programs === null && !loadErr && <p className="py-6 text-center text-[#6B6680]"><Loader2 className="w-5 h-5 animate-spin inline" /></p>}
            {loadErr && <p className="py-4 text-[13px] text-[#C2304F]">Your packages could not load. Check your internet and open this again.</p>}
            {programs?.length === 0 && <p className="py-4 text-[13px] text-[#6B6680]">You have no packages yet. Add them on the Packages page, or start empty.</p>}
            <div className="divide-y divide-[#EEEBF4]">
              {(programs ?? []).map(p => {
                const used = offers.some(o => o.src === p.id);
                return (
                  <button key={p.id} type="button" onClick={() => makeFrom(p)} className="w-full text-left py-3 flex items-center gap-3 hover:bg-[#FAF9FD] px-1 rounded-[10px]">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-[#17151F] truncate">{p.name}{p.isActive === false && <span className="ml-2 text-[11px] text-[#6B6680]">(off)</span>}</span>
                      <span className="block text-[13px] text-[#6B6680] truncate">{[p.category, money(num(p.basePrice) || null), teamLine(p)].filter(Boolean).join(" · ")}</span>
                    </span>
                    {used ? <span className="text-[12px] text-[#1F8A4C] font-semibold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />On the website</span> : <Plus className="w-4 h-4 text-[#7D5CEF]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** One numbered part of a package: what it is, what it changes on the website, and whether it is filled. */
function Step({ n, title, help, done, optional, children }: { n: number; title: string; help: string; done: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] bg-white border border-[#ECE8F4] p-3.5 sm:p-4">
      <header className="flex items-start gap-3 mb-3">
        <span className={cn("w-7 h-7 rounded-full text-[12px] font-bold flex items-center justify-center flex-shrink-0", done ? "bg-[#E2F4EA] text-[#1F8A5B]" : optional ? "bg-[#F1EEF8] text-[#6B6680]" : "bg-[#FFF4D6] text-[#8A5A00]")}>
          {done ? <Check className="w-3.5 h-3.5" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[14.5px] font-bold text-[#17151F] leading-tight">{title}{!done && !optional && <Need on />}{optional && !done && <span className="ml-2 text-[11px] font-semibold text-[#8B86A0] align-middle">Optional</span>}</h4>
          <p className="text-[12.5px] text-[#6B6680] mt-1 leading-relaxed">{help}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

/** How the package's card looks on the website (simple, the same in every look), updated while typing. */
function CardPreview({ o, cover, crop }: { o: SiteOffer; cover?: Photo; crop?: SiteCrop }) {
  const facts = o.facts.slice(0, 3).map(f => [f.v, f.l].filter(Boolean).join(" ")).filter(Boolean);
  return (
    <div className="rounded-[16px] bg-white border border-[#ECE8F4] p-3 flex gap-3 items-center">
      <span className="w-[92px] h-[70px] rounded-[10px] overflow-hidden bg-[#EEEBF4] flex-shrink-0 relative flex items-center justify-center text-[#A29DB3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={small(cover)} alt="" className="w-full h-full object-cover" style={cropStyle(crop)} /> : <ImagePlus className="w-5 h-5" />}
        {(o.badge || o.was) && <span className="absolute left-1 top-1 rounded-[4px] bg-[#17151F]/80 text-white text-[9px] font-bold px-1.5 py-0.5">{o.badge || "Offer"}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-wide text-[#8B86A0] uppercase">On the website</span>
        <span className="block text-[15px] font-bold text-[#17151F] truncate">{o.name || "Package name"}</span>
        <span className="block text-[12.5px] text-[#6B6680] truncate">{o.tagline || "One line about it"}</span>
        <span className="block text-[12.5px] text-[#4A4658] truncate">{facts.join(" · ") || "Short facts"}{" · "}<b className="font-semibold text-[#17151F]">{o.price === null ? "Ask for the price" : `${o.from ? "from " : ""}${money(o.price)}`}</b>{o.was !== null && <s className="ml-1 text-[#A29DB3]">{money(o.was)}</s>}</span>
      </span>
    </div>
  );
}

function Rows<T>({ list, max, empty, set, row, add, label }: {
  list: T[]; max: number; empty: T; set: (l: T[]) => void; label: string;
  row: (x: T, put: (p: Partial<T>) => void, i: number) => React.ReactNode; add: string;
}) {
  return (
    <div>
      {list.map((x, i) => (
        <div key={i} className="flex gap-2 items-start py-1.5">
          <div className="flex-1 min-w-0">{row(x, p => set(list.map((y, k) => (k === i ? { ...y, ...p } : y))), i)}</div>
          <button type="button" aria-label={`Move ${label} ${i + 1} up`} disabled={i === 0} onClick={() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; set(l); }} className={cn(iconBtn, "hidden sm:flex")}><ArrowUp className="w-4 h-4" /></button>
          <button type="button" aria-label={`Remove ${label} ${i + 1}`} onClick={() => set(list.filter((_, k) => k !== i))} className={delBtn}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {list.length < max && <button type="button" onClick={() => set([...list, empty])} className={cn(addBtn, "px-0")}><Plus className="w-4 h-4" />{add}</button>}
    </div>
  );
}

function OfferEditor({ o, i, count, put, settle, rename, taken, photo, crops, choose, adjust, theme, groups, link, copy, published, move, remove }: {
  o: SiteOffer; i: number; count: number; put: (p: Partial<SiteOffer>) => void; settle: () => void; rename: (id: string) => void; taken: (id: string) => boolean;
  photo: (id: string | null | undefined) => Photo | undefined; crops: Record<string, SiteCrop>;
  choose: (title: string, value: string[], done: (ids: string[]) => void, multi?: boolean, max?: number, first?: string[]) => void;
  adjust: (key: string, id: string | null | undefined, title: string, ratio: number) => void;
  theme: string; groups: string[]; link: (path: string) => string; copy: (path: string) => void; published: boolean;
  move: (by: number) => void; remove: () => void;
}) {
  const [addr, setAddr] = useState<string | null>(null);
  const cover = photo(o.cover) ?? photo(o.photos[0]);
  const name = o.name || "this package";
  const path = `/packages/${o.id}`;
  const listId = `grp-${i}`;
  const gallery = o.photos.map(id => photo(id)).filter((p): p is Photo => !!p);
  const movePhoto = (k: number, by: number) => { const l = [...o.photos]; const [x] = l.splice(k, 1); l.splice(k + by, 0, x); put({ photos: l }); };
  return (
    <div className="mt-3 rounded-[18px] bg-[#F7F5FB] p-2.5 sm:p-3.5 space-y-2.5">
      <CardPreview o={o} cover={cover} crop={crops[`offer:${o.id}`]} />
      <Step n={1} title="Name and one line" done={!!o.name && !!o.tagline} help="Shown big on the card and at the top of the package page. The category puts it under a tab (Wedding, Holud…).">
      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="block"><span className="block text-[13px] font-semibold text-[#4A4658] mb-1">Name *</span>
          <input className={inputCls} value={o.name} maxLength={80} placeholder="Royal Wedding" onChange={e => put({ name: e.target.value })} onBlur={settle} /></label>
        <label className="block"><span className="block text-[13px] font-semibold text-[#4A4658] mb-1">Category (tab on the page)</span>
          <input className={inputCls} value={o.group} maxLength={40} placeholder="Wedding" list={listId} onChange={e => put({ group: e.target.value })} />
          <datalist id={listId}>{groups.map(g => <option key={g} value={g} />)}</datalist></label>
      </div>
      <label className="block mt-2.5"><span className="block text-[13px] font-semibold text-[#4A4658] mb-1">One line about it</span>
        <input className={inputCls} value={o.tagline} maxLength={160} placeholder="Holud, wedding and reception — the whole story" onChange={e => put({ tagline: e.target.value })} /></label>

      </Step>
      <Step n={2} title="Photos" done={!!o.cover && o.photos.length >= 3} help="The cover is the photo on the card, and the picture Facebook and WhatsApp show when the link is shared. The other photos are on the package page.">
      <div className="flex gap-3 items-start flex-wrap">
        <div className="w-[104px]">
          <button type="button" onClick={() => choose(`Cover of ${name}`, o.cover ? [o.cover] : [], ids => put({ cover: ids[0] ?? null }), false, 1, o.photos)}
            aria-label={cover ? `Change the cover of ${name}` : `Choose a cover for ${name}`}
            className="w-[104px] h-[104px] rounded-[14px] overflow-hidden bg-white border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] flex items-center justify-center text-[#6B6680]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cover ? <img src={small(cover)} alt="" className="w-full h-full object-cover" style={cropStyle(crops[`offer:${o.id}`])} /> : <ImagePlus className="w-6 h-6" />}
          </button>
          <p className="text-xs text-[#6B6680] mt-1 text-center">Cover</p>
          {cover && <button type="button" onClick={() => adjust(`offer:${o.id}`, cover.id, `Cover of ${name}`, OFFER_RATIO[theme] ?? 3 / 2)} className="mt-1 w-full h-8 rounded-full bg-white hover:bg-[#EEEBF4] border border-[#EEEBF4] text-xs font-semibold text-[#4A4658] inline-flex items-center justify-center gap-1"><Crop className="w-3.5 h-3.5" />Adjust</button>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex gap-1.5 flex-wrap">
            {gallery.map((p, k) => (
              <div key={p.id} className="relative w-[64px] h-[64px] rounded-[10px] overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={small(p)} alt="" loading="lazy" className="w-full h-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <button type="button" disabled={k === 0} onClick={() => movePhoto(k, -1)} aria-label={`Move photo ${k + 1} earlier`} className="w-7 h-6 text-white disabled:opacity-30 flex items-center justify-center"><ArrowLeft className="w-3.5 h-3.5" /></button>
                  <button type="button" disabled={k === gallery.length - 1} onClick={() => movePhoto(k, 1)} aria-label={`Move photo ${k + 1} later`} className="w-7 h-6 text-white disabled:opacity-30 flex items-center justify-center"><ArrowRight className="w-3.5 h-3.5" /></button>
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => choose(`Photos for ${name} (up to 20)`, o.photos, ids => put({ photos: ids, cover: o.cover ?? ids[0] ?? null }), true, 20)} className={cn(pill, "mt-2")}><ImagePlus className="w-4 h-4" />{o.photos.length ? `Change photos (${o.photos.length})` : "Choose photos"}</button>
          <p className="text-xs text-[#6B6680] mt-1.5">Shown on the package page; visitors tap one to see it big and swipe through.</p>
        </div>
      </div>

      </Step>
      <Step n={3} title="Price and offer" done={o.price !== null} help="Leave the price empty to show “Ask for the price”. For an offer, write the old price too: it shows struck through, with the end date.">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <label className="block"><span className="block text-[12px] text-[#6B6680] mb-1">Price (৳)</span>
          <input className={inputCls} inputMode="numeric" value={o.price ?? ""} placeholder="Ask for the price" onChange={e => { const v = e.target.value.replace(/\D/g, ""); put({ price: v ? Number(v) : null }); }} /></label>
        <label className="block"><span className="block text-[12px] text-[#6B6680] mb-1">Old price (offer)</span>
          <input className={inputCls} inputMode="numeric" value={o.was ?? ""} placeholder="—" onChange={e => { const v = e.target.value.replace(/\D/g, ""); put({ was: v ? Number(v) : null }); }} /></label>
        <label className="block col-span-2 sm:col-span-1"><span className="block text-[12px] text-[#6B6680] mb-1">Offer ends</span>
          <input type="date" className={inputCls} value={o.ends} disabled={!o.was} onChange={e => put({ ends: e.target.value })} /></label>
      </div>
      {o.was !== null && o.price !== null && o.was <= o.price && <p className="text-xs text-[#C2304F] mt-1.5">The old price must be higher than the price to show as an offer.</p>}
      {o.was !== null && o.ends && <p className="text-xs text-[#6B6680] mt-1.5">After this day the old price comes back by itself.</p>}
      <div className="grid sm:grid-cols-2 gap-2.5 mt-2.5">
        <label className="flex items-center gap-2 text-[14px] text-[#17151F] min-h-[44px]"><input type="checkbox" className="w-4 h-4 accent-[#7D5CEF]" checked={o.from} onChange={e => put({ from: e.target.checked })} />Show as &quot;from&quot; price</label>
        <label className="block"><span className="sr-only">Label on the card</span>
          <input className={inputCls} value={o.badge} maxLength={30} placeholder="Label on the card: Most loved" onChange={e => put({ badge: e.target.value })} /></label>
      </div>

      </Step>
      <Step n={4} title="Short facts" done={o.facts.length > 0} help="Two to three small facts under the name on the card (3 days · 4 people · 3 films). All of them show as tiles on the package page.">
      <Rows label="fact" list={o.facts} max={6} empty={{ v: "", l: "" }} set={l => put({ facts: l })} add="Add a fact"
        row={(f, p) => <div className="grid grid-cols-[90px_1fr] gap-2"><input aria-label="Number" className={inputCls} value={f.v} maxLength={12} placeholder="3" onChange={e => p({ v: e.target.value })} /><input aria-label="What" className={inputCls} value={f.l} maxLength={24} placeholder="days" onChange={e => p({ l: e.target.value })} /></div>} />

      </Step>
      <Step n={5} title="Day by day" done={o.days.length > 0} help="One row for each event. On the package page they show in order, and the booking form opens one event for each row, so the client only picks the dates.">
      <Rows label="day" list={o.days} max={7} empty={{ name: "", hours: "", team: "" }} set={l => put({ days: l })} add="Add a day"
        row={(d, p) => <div className="grid sm:grid-cols-[1fr_110px_1.4fr] gap-2"><input aria-label="Event" className={inputCls} value={d.name} maxLength={40} placeholder="Holud" onChange={e => p({ name: e.target.value })} /><input aria-label="Hours" className={inputCls} value={d.hours} maxLength={20} placeholder="6 hours" onChange={e => p({ hours: e.target.value })} /><input aria-label="Team" className={inputCls} value={d.team} maxLength={80} placeholder="1 photographer, 1 cinematographer" onChange={e => p({ team: e.target.value })} /></div>} />

      </Step>
      <Step n={6} title="What the client gets" done={o.gets.length > 0} help="Photos, films, album, delivery time. Each line shows with a tick on the package page.">
      <Rows label="item" list={o.gets} max={10} empty={{ t: "", d: "" }} set={l => put({ gets: l })} add="Add a line"
        row={(g, p) => <div className="grid sm:grid-cols-[1fr_1.4fr] gap-2"><input aria-label="What" className={inputCls} value={g.t} maxLength={60} placeholder="40-page album" onChange={e => p({ t: e.target.value })} /><input aria-label="Detail" className={inputCls} value={g.d} maxLength={160} placeholder="Photos chosen online (optional)" onChange={e => p({ d: e.target.value })} /></div>} />

      </Step>
      <Step n={7} title="Extras (add-ons)" done={o.extras.length > 0} help="Things the client can tick, like Drone or a second album. The total updates as they tick, and you see what they chose on the lead.">
      <Rows label="extra" list={o.extras} max={10} empty={{ name: "", price: 0 }} set={l => put({ extras: l })} add="Add an extra"
        row={(x, p) => <div className="grid grid-cols-[1fr_120px] gap-2"><input aria-label="Extra" className={inputCls} value={x.name} maxLength={60} placeholder="Drone" onChange={e => p({ name: e.target.value })} /><input aria-label="Price" className={inputCls} inputMode="numeric" value={x.price || ""} placeholder="৳ 0" onChange={e => p({ price: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></div>} />

      </Step>
      <Step n={8} title="Film" optional done={!!o.film} help="A YouTube link of a trailer for this package. It plays on the package page (optional).">
      <input aria-label="YouTube link" className={inputCls} inputMode="url" value={o.film ?? ""} maxLength={200} placeholder="https://youtu.be/… (a trailer of this package)" onChange={e => put({ film: e.target.value })} />

      </Step>
      <Step n={9} title="Good to know and questions" optional done={!!o.note || o.faqs.length > 0} help="Advance, travel, what changes are possible. Questions open with a tap on the package page (optional).">
      <textarea aria-label="Good to know" className={inputCls.replace("h-11", "min-h-[84px] py-2.5 leading-relaxed")} value={o.note} maxLength={1000} placeholder="A 30% advance books your date. Outside the city we add travel." onChange={e => put({ note: e.target.value })} />
      <Rows label="question" list={o.faqs} max={8} empty={{ q: "", a: "" }} set={l => put({ faqs: l })} add="Add a question"
        row={(f, p) => <div className="grid gap-2"><input aria-label="Question" className={inputCls} value={f.q} maxLength={160} placeholder="Can we swap a day?" onChange={e => p({ q: e.target.value })} /><input aria-label="Answer" className={inputCls} value={f.a} maxLength={800} placeholder="Answer" onChange={e => p({ a: e.target.value })} /></div>} />

      </Step>
      <Step n={10} title="Link and showing it" done help="Use this link on Facebook, in an ad or on WhatsApp. Turn it off to keep the package here without showing it.">
      {addr === null ? (
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-[13px] bg-white border border-[#EEEBF4] rounded-[10px] px-3 py-2 break-all flex-1 min-w-[200px]">{link(path)}</code>
          <button type="button" onClick={() => copy(path)} className={pill}><Copy className="w-4 h-4" />Copy</button>
          {published && <a href={link(path)} target="_blank" rel="noopener noreferrer" className={pill}><ExternalLink className="w-4 h-4" />Open</a>}
          <button type="button" onClick={() => setAddr(o.id.startsWith("new-") ? "" : o.id)} className="h-9 px-2 text-[13px] font-semibold text-[#5B3FD0]">Change</button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2 items-center">
            <span className="text-[13px] text-[#6B6680] whitespace-nowrap">/packages/</span>
            <input aria-label="Link" className={inputCls} value={addr} maxLength={50} onChange={e => setAddr(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"))} />
            <button type="button" disabled={!slug(addr) || taken(slug(addr))} onClick={() => { rename(slug(addr)); setAddr(null); }} className="h-11 px-4 rounded-full bg-[#7D5CEF] disabled:opacity-40 text-white text-sm font-semibold">Save</button>
            <button type="button" onClick={() => setAddr(null)} className="h-11 px-3 text-sm font-semibold text-[#6B6680]">Cancel</button>
          </div>
          <p className="text-xs text-[#B45309] mt-1.5">{taken(slug(addr)) ? "Another package has this link." : "Links you already shared or used in ads stop working after a change."}</p>
        </div>
      )}
      {!published && <p className="text-xs text-[#6B6680] mt-1.5">The link works after you publish the website.</p>}

      <div className="mt-3 rounded-[14px] bg-[#F7F5FB]">
        <SwitchRow label="Show on the website" hint={o.hidden ? "Hidden: visitors don't see it; it stays here." : undefined} on={!o.hidden} onChange={v => put({ hidden: !v })} />
      </div>
      <div className="flex gap-2 mt-3 flex-wrap items-center">
        <button type="button" disabled={i === 0} onClick={() => move(-1)} aria-label="Move up" className={iconBtn}><ArrowUp className="w-4 h-4" /></button>
        <button type="button" disabled={i === count - 1} onClick={() => move(1)} aria-label="Move down" className={iconBtn}><ArrowDown className="w-4 h-4" /></button>
        <span className="text-xs text-[#6B6680]">{o.hidden ? <EyeOff className="w-3.5 h-3.5 inline" /> : <Eye className="w-3.5 h-3.5 inline" />} Order on the website</span>
        <button type="button" onClick={remove} className="ml-auto h-10 px-3.5 rounded-full bg-[#FDECEF] hover:bg-[#F9D9E0] text-[#C2304F] text-sm font-semibold inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />Remove</button>
      </div>
      </Step>
    </div>
  );
}
