"use client";

/**
 * Website: the studio builds its own public site here. Pick a look, add photos and text, publish.
 * Every change is saved as a draft straight away; visitors see it only after Publish.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, Clapperboard, Copy, Crop, ExternalLink, Eye, Globe, Home, ImagePlus, Images, LayoutGrid, Loader2, Package, Palette, Phone, Plus, Trash2, Upload, X } from "lucide-react";
import "./website.css";
import { PageHeader, RowsSkeleton, EmptyState } from "@/components/ui/apple";
import { Field, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { askConfirm, notify } from "@/components/feedback";
import { API_URL as API, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { cropStyle, type SiteAlbum, type SiteContent, type SiteCrop, type SiteStory } from "@/components/site/site-view";

type Photo = { id: string; url: string; thumbUrl?: string | null; width: number; height: number; blur: string };
const small = (p: Photo) => p.thumbUrl || p.url;

const TABS = [["design", "Design", Palette], ["home", "Home page", Home], ["albums", "Albums", Images], ["films", "Films", Clapperboard], ["stories", "Stories", BookOpen], ["more", "Packages, reviews, FAQ", Package], ["contact", "Contact", Phone], ["photos", "All photos", LayoutGrid]] as const;
type Tab = (typeof TABS)[number][0];
/** Shape of each place a photo goes (width / height), so the framing window matches the website. */
const RATIO = { hero0: 3 / 2, hero1: 3 / 3.6, about: 4 / 4.6, film: 16 / 9, story: 4 / 3, album: 3 / 4 };
type Mine = {
  slug: string; theme: string; content: SiteContent; isPublished: boolean; publishedAt: string | null; hasChanges: boolean;
  photos: Photo[]; photoLimit: number; studio: { name: string; logoUrl: string | null };
};

const THEMES: { id: string; name: string; note: string; colors: [string, string, string] }[] = [
  { id: "signature", name: "Signature", note: "Peach and gold, decorative", colors: ["#FEF1E4", "#D4A843", "#2A211B"] },
  { id: "editorial", name: "Editorial White", note: "Clean black and white", colors: ["#FFFFFF", "#151515", "#F4F2EE"] },
  { id: "cream", name: "Soft Cream", note: "Sage green, round arches", colors: ["#FBF7F1", "#5E6F5A", "#F4E7DF"] },
  { id: "dark", name: "Cinematic Dark", note: "Navy and champagne", colors: ["#0B1320", "#E6C58F", "#111C2E"] },
  { id: "gold", name: "Classic Gold", note: "Emerald and gold", colors: ["#FAF6EE", "#B8964A", "#0F3D36"] },
  { id: "mono", name: "Gallery White", note: "Full-screen photo, plain type", colors: ["#FFFFFF", "#1A1A1A", "#ECECEA"] },
];
const areaCls = inputCls.replace("h-11", "min-h-[96px] py-2.5 leading-relaxed");
const newId = () => Math.random().toString(36).slice(2, 10);

/** Big camera files are made smaller in the browser first, so they upload fast on mobile data. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const s = Math.min(1, 3200 / Math.max(bmp.width, bmp.height));
    if (s === 1 && file.size < 8_000_000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.93));
    return out ?? file;
  } catch {
    return file;
  }
}

export default function WebsitePage() {
  const [site, setSite] = useState<Mine | null>(null);
  const [state, setState] = useState<"load" | "ok" | "denied" | "error">("load");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  /** Goes up after every saved change, so the side preview loads the new draft. */
  const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [slug, setSlug] = useState("");
  const [slugNote, setSlugNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [pick, setPick] = useState<{ title: string; multi: boolean; max: number; value: string[]; done: (ids: string[]) => void; first?: string[] } | null>(null);
  const [tab, setTab] = useState<Tab>("design");
  const [allPhotos, setAllPhotos] = useState(false);
  const [frame, setFrame] = useState<{ key: string; photo: Photo; title: string; ratio: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ theme?: string; content?: SiteContent }>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/site`);
      if (res.status === 403) return setState("denied");
      if (!res.ok) return setState("error");
      const d = (await res.json()) as Mine;
      setSite(d); setSlug(d.slug); setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const flush = useCallback(async () => {
    const body = pending.current;
    pending.current = {};
    if (!body.theme && !body.content) return;
    setSaving("saving");
    try {
      const res = await apiFetch(`${API}/site`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as Mine;
      // Keep what is on screen (the person may still be typing); take only the server's status.
      setSite(s => (s ? { ...s, hasChanges: d.hasChanges, isPublished: d.isPublished } : d));
      setSaving("saved");
      setRev(n => n + 1);
    } catch {
      setSaving("idle");
      notify("Could not save. Check your internet and change it again.", { error: true });
    }
  }, []);
  const queue = (patch: { theme?: string; content?: SiteContent }) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush(); } }, [flush]);

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    if (!site) return;
    const content = { ...site.content, [key]: value };
    setSite({ ...site, content, hasChanges: true });
    queue({ content });
  };
  const setTheme = (theme: string) => { if (!site) return; setSite({ ...site, theme, hasChanges: true }); queue({ theme }); };

  // Address: checked while typing, saved when it is free.
  useEffect(() => {
    if (!site || slug === site.slug) return;
    const t = setTimeout(async () => {
      const res = await apiFetch(`${API}/site/slug-check?slug=${encodeURIComponent(slug)}`);
      if (res.ok) setSlugNote(await res.json());
    }, 400);
    return () => clearTimeout(t);
  }, [slug, site]);
  const saveSlug = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/site`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await res.json();
      if (!res.ok) return notify(Array.isArray(d.message) ? d.message[0] : d.message || "Could not change the address", { error: true });
      setSite(s => (s ? { ...s, slug: d.slug } : d)); setSlug(d.slug); notify("Address changed");
    } finally { setBusy(false); }
  };

  const publish = async (on: boolean) => {
    if (!site) return;
    if (!on && !(await askConfirm({ title: "Take the website offline?", message: "Visitors will see \"not found\" until you publish again. Nothing is deleted.", confirmLabel: "Take offline" }))) return;
    setBusy(true);
    try {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      await flush();
      const res = await apiFetch(`${API}/site/${on ? "publish" : "unpublish"}`, { method: "POST" });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as Mine;
      setSite(d);
      notify(on ? "Published. Visitors now see this version." : "The website is offline");
    } catch { notify("That did not work. Try again.", { error: true }); } finally { setBusy(false); }
  };

  const upload = async (files: FileList | null): Promise<Photo[]> => {
    if (!files?.length || !site) return [];
    const room = site.photoLimit - site.photos.length;
    const list = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, room);
    if (!list.length) { notify(room <= 0 ? `The website holds ${site.photoLimit} photos. Remove some first.` : "Choose JPG, PNG or WebP photos.", { error: true }); return []; }
    if (files.length > list.length) notify(`Only ${list.length} added: the website holds ${site.photoLimit} photos.`);
    let failed = 0;
    const added: Photo[] = [];
    setUploading({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        const fd = new FormData();
        fd.append("file", await shrink(list[i]), "photo.jpg");
        const res = await apiFetch(`${API}/site/photos`, { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        const p = (await res.json()) as Photo;
        added.push(p);
        setSite(s => (s ? { ...s, photos: [p, ...s.photos] } : s));
      } catch { failed++; }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    if (failed) notify(`${failed} photo${failed > 1 ? "s" : ""} could not be added. Try them again.`, { error: true });
    return added;
  };
  const removePhoto = async (p: Photo) => {
    if (!(await askConfirm({ title: "Remove this photo?", message: "It is taken off the website and deleted. This cannot be undone.", confirmLabel: "Remove", danger: true }))) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await flush();
    const res = await apiFetch(`${API}/site/photos/${p.id}`, { method: "DELETE" });
    if (res.ok) setSite(await res.json()); else notify("Could not remove the photo", { error: true });
  };

  if (state === "load") return <div><PageHeader icon={Globe} color="violet" title="Website" /><RowsSkeleton n={5} /></div>;
  if (state !== "ok" || !site) {
    return <div><PageHeader icon={Globe} color="violet" title="Website" />
      <EmptyState icon={Globe} title={state === "denied" ? "Only the studio owner can edit the website" : "The website page could not load"} text={state === "denied" ? "Ask the owner to make changes here." : "Check your internet and open this page again."} /></div>;
  }

  const c = site.content;
  const byId = new Map(site.photos.map(p => [p.id, p]));
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.stupanel.com";
  const url = `${origin}/site/${site.slug}`;
  const choose = (title: string, value: string[], done: (ids: string[]) => void, multi = false, max = 1, first?: string[]) => setPick({ title, multi, max, value, done, first });
  const setAlbum = (i: number, patch: Partial<SiteAlbum>) => set("albums", c.albums.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const status = !site.isPublished ? "Not published yet" : site.hasChanges ? "Published, with changes not yet published" : "Published";

  const ph = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
  const crops = c.crop ?? {};
  /** Gallery White: the photos of its full-screen slideshow. */
  const slides = (c.slides ?? []).filter(id => byId.has(id));
  /** Open the framing window for the photo in one place (hero0, about, album:<id>…). */
  const adjust = (key: string, id: string | null | undefined, title: string, ratio: number) => { const photo = ph(id); if (photo) setFrame({ key, photo, title, ratio }); };
  const shownPhotos = allPhotos ? site.photos : site.photos.slice(0, 11);

  return (
    <div className="xl:flex xl:gap-8 xl:items-start">
    <div className="site-ed max-w-[820px] flex-1 min-w-0">
      <PageHeader icon={Globe} color="violet" title="Website" sub={<>{status}{saving === "saving" ? " · Saving" : saving === "saved" ? " · Draft saved" : ""}</>}>
        <a href={`/site/${site.slug}?preview=1`} target="_blank" rel="noopener noreferrer"
          className="h-10 px-4 rounded-full bg-white border border-[#E4E0EC] hover:bg-[#F5F3FA] text-sm font-semibold text-[#17151F] inline-flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
          <Eye className="w-4 h-4" />Preview
        </a>
        <button type="button" disabled={busy || (site.isPublished && !site.hasChanges)} onClick={() => publish(true)}
          className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{site.isPublished ? (site.hasChanges ? "Publish changes" : "Published") : "Publish"}
        </button>
      </PageHeader>
      <div className="sticky top-3 z-20 mb-5">
        <div role="tablist" aria-label="Website parts" className="ed-tabs sp-card bg-white rounded-[18px] p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map(([id, name, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}
              className={cn("h-10 px-3.5 rounded-[13px] text-[13px] font-semibold whitespace-nowrap transition-all flex-shrink-0 inline-flex items-center gap-1.5",
                tab === id ? "bg-[#7D5CEF] text-white shadow-[0_6px_16px_-6px_rgba(125,92,239,.8)]" : "text-[#4A4658] hover:bg-[#F1EEF8]")}>
              <Icon className="w-4 h-4" aria-hidden="true" />{name}
            </button>
          ))}
        </div>
      </div>

      <div hidden={tab !== "design"}>
      <FormGroup title="Address" note={site.isPublished ? undefined : "The link works after you publish."}>
        <Field label="Your website link" hint={slugNote && slug !== site.slug ? <span className={slugNote.ok ? "text-[#1F8A4C]" : "text-[#C2304F]"}>{slugNote.message}</span> : "Small letters, numbers and dashes."}>
          {id => (
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center flex-1 min-w-[220px]">
                <span className="text-[13px] text-[#6B6680] mr-1.5 hidden sm:inline">{origin.replace(/^https?:\/\//, "")}/site/</span>
                <input id={id} className={inputCls} value={slug} maxLength={40} autoCapitalize="none" spellCheck={false}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
              </div>
              {slug !== site.slug
                ? <button type="button" disabled={busy || !slugNote?.ok} onClick={saveSlug} className="h-11 px-4 rounded-[12px] bg-[#17151F] disabled:opacity-40 text-white text-sm font-semibold">Use this address</button>
                : <>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(url); notify("Link copied"); }} className="h-11 px-3.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold inline-flex items-center gap-1.5"><Copy className="w-4 h-4" />Copy</button>
                  {site.isPublished && <a href={url} target="_blank" rel="noopener noreferrer" className="h-11 px-3.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold inline-flex items-center gap-1.5"><ExternalLink className="w-4 h-4" />Open</a>}
                </>}
            </div>
          )}
        </Field>
      </FormGroup>
      </div>

      <div hidden={tab !== "design"}>
      <FormGroup title="Look" note="All six have the same sections. You can change the look any time; your text and photos stay.">
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Website look">
          {THEMES.map(t => {
            const on = site.theme === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setTheme(t.id)}
                className={cn("text-left rounded-[14px] p-2.5 border-2 transition-colors", on ? "border-[#7D5CEF] bg-[#F5F3FA]" : "border-transparent hover:bg-[#F5F3FA]")}>
                <span className="flex h-14 rounded-[10px] overflow-hidden border border-[#E4E0EC]" aria-hidden="true">
                  <span className="flex-[3]" style={{ background: t.colors[0] }} /><span className="flex-1" style={{ background: t.colors[1] }} /><span className="flex-1" style={{ background: t.colors[2] }} />
                </span>
                <span className="block text-[13px] font-bold text-[#17151F] mt-2">{t.name}</span>
                <span className="block text-[11px] text-[#6B6680] leading-snug">{t.note}</span>
              </button>
            );
          })}
        </div>
      </FormGroup>
      </div>

      <div hidden={tab !== "photos"}>
      <FormGroup title={`Photos (${site.photos.length} of ${site.photoLimit})`} note="Every photo on your website is kept here. You can also add a photo right where you use it. Use only photos you have the right to show.">
        <div className="p-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => upload(e.target.files)} />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <button type="button" disabled={!!uploading} onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-[12px] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] bg-[#F5F3FA] text-[#4A4658] flex flex-col items-center justify-center gap-1 text-xs font-semibold">
              {uploading ? <><Loader2 className="w-5 h-5 animate-spin" />{uploading.done} of {uploading.total}</> : <><ImagePlus className="w-5 h-5" />Add photos</>}
            </button>
            {shownPhotos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-[12px] overflow-hidden group bg-[#F5F3FA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={small(p)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ backgroundImage: `url(${p.blur})`, backgroundSize: "cover" }} />
                <button type="button" onClick={() => removePhoto(p)} aria-label="Remove this photo"
                  className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center sm:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          {site.photos.length > 11 && (
            <button type="button" onClick={() => setAllPhotos(v => !v)} aria-expanded={allPhotos} className="mt-3 w-full h-10 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold text-[#4A4658] inline-flex items-center justify-center gap-1.5">
              {allPhotos ? <><ChevronUp className="w-4 h-4" />Show fewer</> : <><ChevronDown className="w-4 h-4" />Show all {site.photos.length} photos</>}
            </button>
          )}
        </div>
      </FormGroup>
      </div>

      <div hidden={tab !== "home"}>
      <FormGroup title="Top of the page">
        <Field label="Small handwritten line">{id => <input id={id} className={inputCls} value={c.script} maxLength={40} onChange={e => set("script", e.target.value)} />}</Field>
        <Field label="Big headline" hint="Two or three words look best.">{id => <input id={id} className={inputCls} value={c.headline} maxLength={60} onChange={e => set("headline", e.target.value)} />}</Field>
        <Field label="Line under the headline" hint="For example: Photography and films, Feni">{id => <input id={id} className={inputCls} value={c.kicker} maxLength={80} onChange={e => set("kicker", e.target.value)} />}</Field>
        <Field label="Short introduction">{id => <textarea id={id} className={areaCls} value={c.intro} maxLength={300} onChange={e => set("intro", e.target.value)} />}</Field>
        <SwitchRow label="Show my logo image at the top" hint="Off: your studio name is written in the website's own lettering, which suits most logos better." on={!!c.showLogo} onChange={v => set("showLogo", v)} />
        {site.theme === "mono" && (
            <div className="px-4 py-3.5">
              <div className="text-sm font-semibold text-[#1F1B2E]">Home screen photos (slideshow)</div>
              <p className="text-[13px] text-[#6B6680] mt-0.5">Gallery White fills the first screen with these, one after another. Wide (landscape) photos look best. Pick up to 8, in the order they should show.</p>
              {slides.length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {slides.map(id => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={id} src={small(byId.get(id)!)} alt="" loading="lazy" className="w-[84px] h-14 rounded-[8px] object-cover" />
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2.5 flex-wrap">
                <button type="button" onClick={() => choose("Home screen photos (wide)", slides, ids => set("slides", ids), true, 8)}
                  className="h-11 px-4 rounded-full bg-[#F1EEF8] hover:bg-[#E7E2F3] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />{slides.length ? "Change photos" : "Choose photos"}</button>
                {slides.length > 0 && <button type="button" onClick={() => set("slides", [])} className="h-11 px-4 rounded-full text-[13px] font-semibold text-[#6B6680] hover:bg-[#F5F3FA]">Clear</button>}
              </div>
              {slides.length === 0 && <p className="text-[13px] text-[#6B6680] mt-2">Nothing chosen yet, so the site shows your album covers here.</p>}
            </div>
        )}
        {site.theme !== "mono" && <div className="px-4 py-3.5 flex gap-4">
          <Slot p={ph(c.heroPhotos[0])} crop={crops.hero0} onAdjust={() => adjust("hero0", c.heroPhotos[0], "Main photo", RATIO.hero0)} label="Main photo" onPick={() => choose("Main photo (wide)", c.heroPhotos.slice(0, 1), ids => set("heroPhotos", [ids[0], c.heroPhotos[1]].filter(Boolean) as string[]))} onClear={() => set("heroPhotos", c.heroPhotos.slice(1))} />
          <Slot p={ph(c.heroPhotos[1])} crop={crops.hero1} onAdjust={() => adjust("hero1", c.heroPhotos[1], "Second photo", RATIO.hero1)} label="Second photo" onPick={() => choose("Second photo (tall)", c.heroPhotos.slice(1, 2), ids => set("heroPhotos", [c.heroPhotos[0] ?? ids[0], ids[0]].filter(Boolean) as string[]))} onClear={() => set("heroPhotos", c.heroPhotos.slice(0, 1))} />
        </div>}
        <Field label="Moving words" hint="The events you cover, with a comma between them.">
          {id => <input id={id} className={inputCls} defaultValue={c.events.join(", ")} onBlur={e => set("events", e.target.value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10))} />}
        </Field>
      </FormGroup>
      </div>

      <div hidden={tab !== "home"}>
      <FormGroup title="About the studio">
        <Field label="Title" hint="The first word is shown in handwriting.">{id => <input id={id} className={inputCls} value={c.aboutTitle} maxLength={40} onChange={e => set("aboutTitle", e.target.value)} />}</Field>
        <Field label="Text">{id => <textarea id={id} className={areaCls.replace("96px", "140px")} value={c.aboutText} maxLength={900} onChange={e => set("aboutText", e.target.value)} />}</Field>
        <div className="px-4 py-3.5"><Slot p={ph(c.aboutPhoto)} crop={crops.about} onAdjust={() => adjust("about", c.aboutPhoto, "About photo", RATIO.about)} label="Photo" onPick={() => choose("About photo (tall)", c.aboutPhoto ? [c.aboutPhoto] : [], ids => set("aboutPhoto", ids[0] ?? null))} onClear={() => set("aboutPhoto", null)} /></div>
      </FormGroup>
      </div>

      <div hidden={tab !== "albums"}>
      <FormGroup title="Albums" note="Each album opens as its own gallery. Tap the cover to pick another photo for it. Six or more albums fill two moving rows.">
        {c.albums.map((a, i) => {
          const cover = ph(a.cover) ?? ph(a.photos[0]);
          const name = a.title || "this album";
          return (
            <div key={a.id} className="px-4 py-4 flex gap-3.5">
              <div className="flex-shrink-0 w-[84px]">
                <button type="button" onClick={() => choose(`Cover of ${name}`, a.cover ? [a.cover] : [], ids => setAlbum(i, { cover: ids[0] ?? null, photos: ids[0] && !a.photos.includes(ids[0]) ? [ids[0], ...a.photos].slice(0, 30) : a.photos }), false, 1, a.photos)}
                  aria-label={`Change the cover of ${name}`} className="block w-[84px] h-[112px] rounded-[12px] overflow-hidden bg-[#F5F3FA] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] text-[#6B6680]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {cover ? <img src={small(cover)} alt="" className="w-full h-full object-cover" style={cropStyle(crops[`album:${a.id}`])} /> : <ImagePlus className="w-6 h-6 mx-auto" />}
                </button>
                <p className="text-xs text-[#6B6680] mt-1 text-center">Cover</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 grid sm:grid-cols-[1fr_150px] gap-2">
                    <input aria-label="Album name" className={inputCls} placeholder="Nabil and Riya" value={a.title} maxLength={60} onChange={e => setAlbum(i, { title: e.target.value })} />
                    <input aria-label="Event" className={inputCls} placeholder="Wedding" value={a.tag} maxLength={30} onChange={e => setAlbum(i, { tag: e.target.value })} />
                  </div>
                  <button type="button" aria-label={`Remove the album ${a.title || i + 1}`} onClick={() => set("albums", c.albums.filter((_, k) => k !== i))} className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-1.5 mt-2.5 items-center">
                  {a.photos.slice(0, 6).map(id => byId.get(id) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={id} src={small(byId.get(id)!)} alt="" loading="lazy" className="w-10 h-10 rounded-[8px] object-cover flex-shrink-0" />
                  ))}
                  <span className="text-xs text-[#6B6680] px-1 whitespace-nowrap">{a.photos.length} photo{a.photos.length === 1 ? "" : "s"}</span>
                </div>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  <button type="button" onClick={() => choose(`Photos for ${name}`, a.photos, ids => setAlbum(i, { photos: ids, cover: a.cover && ids.includes(a.cover) ? a.cover : ids[0] ?? null }), true, 30)}
                    className="h-9 px-3 rounded-full bg-[#F1EEF8] hover:bg-[#E7E2F3] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />{a.photos.length ? "Change photos" : "Choose photos"}</button>
                  {a.photos.length > 0 && <button type="button" onClick={() => choose(`Cover of ${name}`, a.cover ? [a.cover] : [], ids => setAlbum(i, { cover: ids[0] ?? null, photos: ids[0] && !a.photos.includes(ids[0]) ? [ids[0], ...a.photos].slice(0, 30) : a.photos }), false, 1, a.photos)}
                    className="h-9 px-3 rounded-full bg-[#F1EEF8] hover:bg-[#E7E2F3] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><Images className="w-4 h-4" />Change cover</button>}
                  {cover && <button type="button" onClick={() => adjust(`album:${a.id}`, cover.id, `Cover of ${name}`, RATIO.album)}
                    className="h-9 px-3 rounded-full bg-[#F1EEF8] hover:bg-[#E7E2F3] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><Crop className="w-4 h-4" />Adjust cover</button>}
                </div>
              </div>
            </div>
          );
        })}
        {c.albums.length < 12 && (
          <button type="button" onClick={() => set("albums", [...c.albums, { id: newId(), title: "", tag: "", cover: null, photos: [] }])}
            className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add an album</button>
        )}
      </FormGroup>
      </div>

      <div hidden={tab !== "films"}>
      <FormGroup title="Wedding film" note="Leave the link empty to hide this part.">
        <Field label="YouTube link">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://youtu.be/…" value={c.filmUrl} maxLength={200} onChange={e => set("filmUrl", e.target.value)} />}</Field>
        <Field label="Film name">{id => <input id={id} className={inputCls} placeholder="Tanvir and Nusrat, the wedding film" value={c.filmTitle} maxLength={80} onChange={e => set("filmTitle", e.target.value)} />}</Field>
        <div className="px-4 py-3.5"><Slot p={ph(c.filmPhoto)} crop={crops.film} onAdjust={() => adjust("film", c.filmPhoto, "Film cover", RATIO.film)} label="Cover photo" onPick={() => choose("Film cover (wide)", c.filmPhoto ? [c.filmPhoto] : [], ids => set("filmPhoto", ids[0] ?? null))} onClear={() => set("filmPhoto", null)} /></div>
      </FormGroup>
      </div>

      <div hidden={tab !== "films"}>
      <FormGroup title="More films" note="These show on the Films page, under the film above. Up to 9.">
        {(c.films ?? []).map((f, i) => (
          <div key={i} className="px-4 py-3.5 flex gap-2 items-start">
            <div className="flex-1 grid sm:grid-cols-2 gap-2">
              <input aria-label="YouTube link" className={inputCls} inputMode="url" placeholder="https://youtu.be/…" value={f.url} maxLength={200} onChange={e => set("films", (c.films ?? []).map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
              <input aria-label="Film name" className={inputCls} placeholder="Film name" value={f.title} maxLength={80} onChange={e => set("films", (c.films ?? []).map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
            </div>
            <button type="button" aria-label="Remove this film" onClick={() => set("films", (c.films ?? []).filter((_, k) => k !== i))} className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {(c.films ?? []).length < 9 && (
          <button type="button" onClick={() => set("films", [...(c.films ?? []), { url: "", title: "", id: "" }])} className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add a film</button>
        )}
      </FormGroup>
      </div>

      <div hidden={tab !== "more"}>
      <FormGroup title="Packages" note="Shows your active packages from the Packages page, grouped by category, with their prices.">
        <SwitchRow label="Show packages and prices" on={c.showPackages} onChange={v => set("showPackages", v)} />
      </FormGroup>
      </div>

      <div hidden={tab !== "more"}>
      <FormGroup title="Reviews" note="Use real words from your clients, with their permission.">
        {c.reviews.map((r, i) => (
          <div key={i} className="px-4 py-3.5 flex gap-2 items-start">
            <div className="flex-1 grid gap-2">
              <textarea aria-label="Review" className={areaCls.replace("96px", "76px")} placeholder="What the client said" value={r.text} maxLength={400} onChange={e => set("reviews", c.reviews.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} />
              <input aria-label="Client name" className={inputCls} placeholder="Client name" value={r.name} maxLength={60} onChange={e => set("reviews", c.reviews.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            </div>
            <button type="button" aria-label="Remove this review" onClick={() => set("reviews", c.reviews.filter((_, k) => k !== i))} className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {c.reviews.length < 8 && (
          <button type="button" onClick={() => set("reviews", [...c.reviews, { text: "", name: "" }])} className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add a review</button>
        )}
      </FormGroup>
      </div>

      <div hidden={tab !== "stories"}>
      <FormGroup title="Stories (blog)" note="Short posts about weddings you covered. The Stories page appears in the menu when there is at least one with a title and text.">
        {(c.stories ?? []).map((x, i) => {
          const put = (patch: Partial<SiteStory>) => set("stories", (c.stories ?? []).map((y, k) => (k === i ? { ...y, ...patch } : y)));
          return (
            <div key={x.id} className="px-4 py-3.5">
              <div className="flex gap-2 items-start">
                <div className="flex-1 grid sm:grid-cols-[1fr_170px] gap-2">
                  <input aria-label="Story title" className={inputCls} placeholder="A winter wedding in Feni" value={x.title} maxLength={100} onChange={e => put({ title: e.target.value })} />
                  <input aria-label="Date" type="date" className={inputCls} value={x.date} onChange={e => put({ date: e.target.value })} />
                </div>
                <button type="button" aria-label={`Remove the story ${x.title || i + 1}`} onClick={() => set("stories", (c.stories ?? []).filter((_, k) => k !== i))} className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
              <textarea aria-label="Story text" className={cn(areaCls.replace("96px", "150px"), "mt-2")} placeholder="Write the story. An empty line starts a new paragraph." value={x.text} maxLength={4000} onChange={e => put({ text: e.target.value })} />
              <div className="mt-2.5"><Slot p={ph(x.cover)} crop={crops[`story:${x.id}`]} onAdjust={() => adjust(`story:${x.id}`, x.cover, "Story cover", RATIO.story)} label="Cover photo" onPick={() => choose("Story cover (wide)", x.cover ? [x.cover] : [], ids => put({ cover: ids[0] ?? null }))} onClear={() => put({ cover: null })} /></div>
            </div>
          );
        })}
        {(c.stories ?? []).length < 12 && (
          <button type="button" onClick={() => set("stories", [...(c.stories ?? []), { id: newId(), title: "", date: "", cover: null, text: "" }])} className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add a story</button>
        )}
      </FormGroup>
      </div>

      <div hidden={tab !== "more"}>
      <FormGroup title="Questions and answers (FAQ)" note="The FAQ page appears in the menu when there is at least one question with an answer.">
        {(c.faqs ?? []).map((f, i) => (
          <div key={i} className="px-4 py-3.5 flex gap-2 items-start">
            <div className="flex-1 grid gap-2">
              <input aria-label="Question" className={inputCls} placeholder="How do we book a date?" value={f.q} maxLength={160} onChange={e => set("faqs", (c.faqs ?? []).map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))} />
              <textarea aria-label="Answer" className={areaCls.replace("96px", "76px")} placeholder="Answer" value={f.a} maxLength={800} onChange={e => set("faqs", (c.faqs ?? []).map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))} />
            </div>
            <button type="button" aria-label="Remove this question" onClick={() => set("faqs", (c.faqs ?? []).filter((_, k) => k !== i))} className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {(c.faqs ?? []).length < 12 && (
          <button type="button" onClick={() => set("faqs", [...(c.faqs ?? []), { q: "", a: "" }])} className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add a question</button>
        )}
      </FormGroup>
      </div>

      <div hidden={tab !== "design"}>
      <FormGroup title="Home page parts" note="Switch off a part to leave it out of the Home page. Its own page (Portfolio, Films, Packages, Reviews) stays.">
        {([["marquee", "Moving words"], ["albums", "Albums"], ["film", "Wedding film"], ["packages", "Packages"], ["reviews", "Reviews"]] as const).map(([k, label]) => (
          <SwitchRow key={k} label={label} on={!(c.hide ?? []).includes(k)} onChange={v => set("hide", v ? (c.hide ?? []).filter(x => x !== k) : [...(c.hide ?? []), k])} />
        ))}
      </FormGroup>
      </div>

      <div hidden={tab !== "contact"}>
      <FormGroup title="Contact" note="Empty boxes use the phone, email and address from your studio settings.">
        <Field label="Phone">{id => <input id={id} className={inputCls} inputMode="tel" value={c.phone} maxLength={30} onChange={e => set("phone", e.target.value)} />}</Field>
        <Field label="WhatsApp number">{id => <input id={id} className={inputCls} inputMode="tel" value={c.whatsapp} maxLength={30} onChange={e => set("whatsapp", e.target.value)} />}</Field>
        <Field label="Email">{id => <input id={id} className={inputCls} inputMode="email" value={c.email} maxLength={120} onChange={e => set("email", e.target.value)} />}</Field>
        <Field label="Address">{id => <input id={id} className={inputCls} value={c.address} maxLength={200} onChange={e => set("address", e.target.value)} />}</Field>
        <Field label="Open hours">{id => <input id={id} className={inputCls} placeholder="Sat to Thu, 10 am to 8 pm" value={c.hours} maxLength={80} onChange={e => set("hours", e.target.value)} />}</Field>
      </FormGroup>
      </div>

      <div hidden={tab !== "contact"}>
      <FormGroup title="Social links and footer">
        <Field label="Facebook page">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://facebook.com/…" value={c.facebook} maxLength={200} onChange={e => set("facebook", e.target.value)} />}</Field>
        <Field label="Instagram">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://instagram.com/…" value={c.instagram} maxLength={200} onChange={e => set("instagram", e.target.value)} />}</Field>
        <Field label="YouTube channel">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://youtube.com/…" value={c.youtube} maxLength={200} onChange={e => set("youtube", e.target.value)} />}</Field>
        <Field label="One line about the studio (footer)">{id => <input id={id} className={inputCls} value={c.footerLine} maxLength={160} onChange={e => set("footerLine", e.target.value)} />}</Field>
      </FormGroup>
      </div>

      {site.isPublished && (
        <button type="button" disabled={busy} onClick={() => publish(false)} className="text-sm font-semibold text-[#C2304F] px-1 mb-10">Take the website offline</button>
      )}

      {site.isPublished && site.hasChanges && (
        <div className="sticky bottom-3 z-20 flex items-center gap-3 rounded-[16px] bg-[#17151F] text-white px-4 py-3 shadow-[0_12px_30px_rgba(22,18,40,.3)]" role="status">
          <p className="flex-1 text-[13px] leading-snug">Your changes are saved, but visitors do not see them yet.</p>
          <button type="button" disabled={busy} onClick={() => publish(true)} className="h-9 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-50 text-sm font-semibold flex-shrink-0">Publish changes</button>
        </div>
      )}
      {pick && <PhotoPicker photos={site.photos} {...pick} onUpload={upload} uploading={uploading} onClose={() => setPick(null)} />}
      {frame && <FrameModal {...frame} value={crops[frame.key]} onClose={() => setFrame(null)}
        onSave={v => { const next = { ...crops }; if (v) next[frame.key] = v; else delete next[frame.key]; set("crop", next); setFrame(null); }} />}
    </div>
    <aside className="hidden xl:block sticky top-6 flex-shrink-0" aria-label="Live preview of your website">
      <p className="text-[13px] font-bold text-[#4A4658] mb-2 px-1">Live preview (phone)</p>
      <div className="w-[390px] h-[760px] rounded-[36px] border-[10px] border-[#17151F] overflow-hidden bg-white shadow-[0_20px_50px_rgba(22,18,40,.18)]">
        <iframe key={rev} src={`/site/${site.slug}?preview=1`} title="Website preview" className="w-full h-full border-0" />
      </div>
      <p className="text-xs text-[#6B6680] mt-2 px-1">Shows your draft. It reloads after each saved change.</p>
    </aside>
    </div>
  );
}

function Slot({ p, label, onPick, onClear, crop, onAdjust }: { p: Photo | undefined; label: string; onPick: () => void; onClear: () => void; crop?: SiteCrop; onAdjust?: () => void }) {
  return (
    <div className="relative w-[112px]">
      <button type="button" onClick={onPick} aria-label={p ? `Change ${label}` : `Choose ${label}`}
        className="w-[112px] h-[112px] rounded-[14px] overflow-hidden bg-[#F5F3FA] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] flex items-center justify-center text-[#6B6680] transition-colors">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p ? <img src={small(p)} alt="" className="w-full h-full object-cover" style={{ backgroundImage: `url(${p.blur})`, backgroundSize: "cover", ...cropStyle(crop) }} /> : <ImagePlus className="w-6 h-6" />}
      </button>
      {p && <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#17151F] text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>}
      <p className="text-xs text-[#6B6680] mt-1.5 text-center">{label}</p>
      {p && onAdjust && <button type="button" onClick={onAdjust} className="mt-1 w-full h-8 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-xs font-semibold text-[#4A4658] inline-flex items-center justify-center gap-1"><Crop className="w-3.5 h-3.5" />Adjust</button>}
    </div>
  );
}

/** Move and zoom a photo inside the shape it has on the website. Nothing is cut from the photo itself. */
function FrameModal({ photo, title, ratio, value, onSave, onClose }: {
  photo: Photo; title: string; ratio: number; value?: SiteCrop; onSave: (v: SiteCrop | null) => void; onClose: () => void;
}) {
  const [v, setV] = useState<SiteCrop>(value ?? { x: 50, y: 50, z: 1 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n * 10) / 10));
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    // Dragging right shows more of the left side of the photo.
    setV(c => ({ ...c, x: clamp(c.x - (dx / r.width) * 140 / c.z), y: clamp(c.y - (dy / r.height) * 140 / c.z) }));
  };
  return (
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Adjust: ${title}`} className="fixed z-[70] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-[520px] sm:h-fit max-h-[94dvh] overflow-y-auto bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold text-[#17151F] truncate">Adjust: {title}</h2>
            <p className="text-[13px] text-[#6B6680]">Drag the photo to move it. Use the slider to zoom.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F3FA] text-[#6B6680]"><X className="w-4 h-4" /></button>
        </div>
        <div ref={box} className="relative mx-auto overflow-hidden rounded-[12px] bg-[#F5F3FA] touch-none cursor-grab active:cursor-grabbing select-none"
          style={{ aspectRatio: String(ratio), width: ratio >= 1 ? "100%" : `min(100%, ${Math.round(420 * ratio)}px)` }}
          onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={cropStyle({ ...v, z: Math.max(v.z, 1.0001) })} />
        </div>
        <label className="flex items-center gap-3 mt-4 text-[13px] font-semibold text-[#4A4658]">Zoom
          <input type="range" min={1} max={3} step={0.05} value={v.z} onChange={e => setV(c => ({ ...c, z: Number(e.target.value) }))} className="flex-1 accent-[#7D5CEF]" />
          <span className="w-10 text-right tabular-nums">{v.z.toFixed(1)}×</span>
        </label>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={() => setV({ x: 50, y: 50, z: 1 })} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold text-[#4A4658]">Reset</button>
          <button type="button" onClick={() => onSave(v.x === 50 && v.y === 50 && v.z === 1 ? null : v)} className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold">Use this</button>
        </div>
      </div>
    </>
  );
}

function PhotoPicker({ photos, title, multi, max, value, done, onClose, onUpload, uploading, first }: {
  /** Photos to list before the others (an album's own photos when choosing its cover) */ first?: string[];
  photos: Photo[]; title: string; multi: boolean; max: number; value: string[]; done: (ids: string[]) => void; onClose: () => void;
  /** Add photos from the computer or phone right here; they also land in All photos. */
  onUpload: (files: FileList | null) => Promise<Photo[]>; uploading: { done: number; total: number } | null;
}) {
  const file = useRef<HTMLInputElement>(null);
  // Photos already in this place come first (in their order), then the rest, newest first.
  const lead = [...new Set([...value, ...(first ?? [])])];
  const shown = [...lead.map(id => photos.find(p => p.id === id)).filter((p): p is Photo => !!p), ...photos.filter(p => !lead.includes(p.id))];
  const add = async (files: FileList | null) => {
    const added = await onUpload(files);
    if (file.current) file.current.value = "";
    if (!added.length) return;
    if (!multi) { done([added[0].id]); onClose(); return; }
    setSel(s => [...s, ...added.map(p => p.id)].slice(0, max));
  };
  const [sel, setSel] = useState<string[]>(value.filter(id => photos.some(p => p.id === id)));
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const tap = (id: string) => {
    if (!multi) { done([id]); onClose(); return; }
    setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.length >= max ? s : [...s, id]));
  };
  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="fixed z-50 inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-[640px] sm:h-fit max-h-[86dvh] bg-white rounded-t-[24px] sm:rounded-[24px] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold text-[#17151F] truncate">{title}</h2>
            {multi && <p className="text-[13px] text-[#6B6680]">{sel.length} chosen (up to {max}). The order you tap is the order shown.</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F3FA] text-[#6B6680]"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple={multi} hidden onChange={e => add(e.target.files)} />
          {<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button type="button" disabled={!!uploading} onClick={() => file.current?.click()}
                className="aspect-square rounded-[12px] border border-dashed border-[#7D5CEF] bg-[#F5F3FA] text-[#7D5CEF] flex flex-col items-center justify-center gap-1 text-xs font-semibold text-center px-1">
                {uploading ? <><Loader2 className="w-5 h-5 animate-spin" />{uploading.done} of {uploading.total}</> : <><Upload className="w-5 h-5" />Upload from this device</>}
              </button>
              {shown.map(p => {
                const n = sel.indexOf(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => tap(p.id)} aria-pressed={n >= 0} aria-label={n >= 0 ? "Chosen photo" : "Choose this photo"}
                    className={cn("relative aspect-square rounded-[12px] overflow-hidden border-[3px]", n >= 0 ? "border-[#7D5CEF]" : "border-transparent")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={small(p)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    {n >= 0 && <span className="absolute top-1 right-1 min-w-6 h-6 px-1 rounded-full bg-[#7D5CEF] text-white text-xs font-bold flex items-center justify-center">{multi ? n + 1 : <Check className="w-3.5 h-3.5" />}</span>}
                  </button>
                );
              })}
            </div>}
        </div>
        {multi && (
          <div className="px-5 py-4 border-t border-[#EEEBF4]">
            <button type="button" onClick={() => { done(sel); onClose(); }} className="w-full h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold">Use {sel.length} photo{sel.length === 1 ? "" : "s"}</button>
          </div>
        )}
      </div>
    </>
  );
}
