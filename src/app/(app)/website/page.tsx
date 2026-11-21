"use client";

/**
 * Website: the studio builds its own public site here. Pick a look, add photos and text, publish.
 * Every change is saved as a draft straight away; visitors see it only after Publish.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Eye, Globe, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { PageHeader, RowsSkeleton, EmptyState } from "@/components/ui/apple";
import { Field, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { askConfirm, notify } from "@/components/feedback";
import { API_URL as API, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SiteAlbum, SiteContent } from "@/components/site/site-view";

type Photo = { id: string; url: string; width: number; height: number; blur: string };
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
];
const areaCls = inputCls.replace("h-11", "min-h-[96px] py-2.5 leading-relaxed");
const newId = () => Math.random().toString(36).slice(2, 10);

/** Big camera files are made smaller in the browser first, so they upload fast on mobile data. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const s = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    if (s === 1 && file.size < 3_000_000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.9));
    return out ?? file;
  } catch {
    return file;
  }
}

export default function WebsitePage() {
  const [site, setSite] = useState<Mine | null>(null);
  const [state, setState] = useState<"load" | "ok" | "denied" | "error">("load");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [slug, setSlug] = useState("");
  const [slugNote, setSlugNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [pick, setPick] = useState<{ title: string; multi: boolean; max: number; value: string[]; done: (ids: string[]) => void } | null>(null);
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

  const upload = async (files: FileList | null) => {
    if (!files?.length || !site) return;
    const room = site.photoLimit - site.photos.length;
    const list = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, room);
    if (!list.length) return notify(room <= 0 ? `The website holds ${site.photoLimit} photos. Remove some first.` : "Choose JPG, PNG or WebP photos.", { error: true });
    if (files.length > list.length) notify(`Only ${list.length} added: the website holds ${site.photoLimit} photos.`);
    let failed = 0;
    setUploading({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        const fd = new FormData();
        fd.append("file", await shrink(list[i]), "photo.jpg");
        const res = await apiFetch(`${API}/site/photos`, { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        const p = (await res.json()) as Photo;
        setSite(s => (s ? { ...s, photos: [p, ...s.photos] } : s));
      } catch { failed++; }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    if (failed) notify(`${failed} photo${failed > 1 ? "s" : ""} could not be added. Try them again.`, { error: true });
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
  const choose = (title: string, value: string[], done: (ids: string[]) => void, multi = false, max = 1) => setPick({ title, multi, max, value, done });
  const setAlbum = (i: number, patch: Partial<SiteAlbum>) => set("albums", c.albums.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const status = !site.isPublished ? "Not published yet" : site.hasChanges ? "Published, with changes not yet published" : "Published";

  const ph = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

  return (
    <div className="max-w-[820px]">
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

      <FormGroup title="Look" note="All five have the same sections and animation. You can change the look any time; your text and photos stay.">
        <div className="p-3 grid grid-cols-2 sm:grid-cols-5 gap-2.5" role="radiogroup" aria-label="Website look">
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

      <FormGroup title={`Photos (${site.photos.length} of ${site.photoLimit})`} note="Add your best photos here first, then choose where each one goes below. Use only photos you have the right to show.">
        <div className="p-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => upload(e.target.files)} />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <button type="button" disabled={!!uploading} onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-[12px] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] bg-[#F5F3FA] text-[#4A4658] flex flex-col items-center justify-center gap-1 text-xs font-semibold">
              {uploading ? <><Loader2 className="w-5 h-5 animate-spin" />{uploading.done} of {uploading.total}</> : <><ImagePlus className="w-5 h-5" />Add photos</>}
            </button>
            {site.photos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-[12px] overflow-hidden group bg-[#F5F3FA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" style={{ backgroundImage: `url(${p.blur})`, backgroundSize: "cover" }} />
                <button type="button" onClick={() => removePhoto(p)} aria-label="Remove this photo"
                  className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center sm:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </FormGroup>

      <FormGroup title="Top of the page">
        <Field label="Small handwritten line">{id => <input id={id} className={inputCls} value={c.script} maxLength={40} onChange={e => set("script", e.target.value)} />}</Field>
        <Field label="Big headline" hint="Two or three words look best.">{id => <input id={id} className={inputCls} value={c.headline} maxLength={60} onChange={e => set("headline", e.target.value)} />}</Field>
        <Field label="Line under the headline" hint="For example: Photography and films, Feni">{id => <input id={id} className={inputCls} value={c.kicker} maxLength={80} onChange={e => set("kicker", e.target.value)} />}</Field>
        <Field label="Short introduction">{id => <textarea id={id} className={areaCls} value={c.intro} maxLength={300} onChange={e => set("intro", e.target.value)} />}</Field>
        <div className="px-4 py-3.5 flex gap-4">
          <Slot p={ph(c.heroPhotos[0])} label="Main photo" onPick={() => choose("Main photo (wide)", c.heroPhotos.slice(0, 1), ids => set("heroPhotos", [ids[0], c.heroPhotos[1]].filter(Boolean) as string[]))} onClear={() => set("heroPhotos", c.heroPhotos.slice(1))} />
          <Slot p={ph(c.heroPhotos[1])} label="Second photo" onPick={() => choose("Second photo (tall)", c.heroPhotos.slice(1, 2), ids => set("heroPhotos", [c.heroPhotos[0] ?? ids[0], ids[0]].filter(Boolean) as string[]))} onClear={() => set("heroPhotos", c.heroPhotos.slice(0, 1))} />
        </div>
        <Field label="Moving words" hint="The events you cover, with a comma between them.">
          {id => <input id={id} className={inputCls} defaultValue={c.events.join(", ")} onBlur={e => set("events", e.target.value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10))} />}
        </Field>
      </FormGroup>

      <FormGroup title="About the studio">
        <Field label="Title" hint="The first word is shown in handwriting.">{id => <input id={id} className={inputCls} value={c.aboutTitle} maxLength={40} onChange={e => set("aboutTitle", e.target.value)} />}</Field>
        <Field label="Text">{id => <textarea id={id} className={areaCls.replace("96px", "140px")} value={c.aboutText} maxLength={900} onChange={e => set("aboutText", e.target.value)} />}</Field>
        <div className="px-4 py-3.5"><Slot p={ph(c.aboutPhoto)} label="Photo" onPick={() => choose("About photo (tall)", c.aboutPhoto ? [c.aboutPhoto] : [], ids => set("aboutPhoto", ids[0] ?? null))} onClear={() => set("aboutPhoto", null)} /></div>
      </FormGroup>

      <FormGroup title="Albums" note="Each album opens as its own gallery. The first photo is the cover. Six or more albums fill two moving rows.">
        {c.albums.map((a, i) => (
          <div key={a.id} className="px-4 py-3.5">
            <div className="flex gap-2 items-start">
              <div className="flex-1 grid sm:grid-cols-[1fr_170px] gap-2">
                <input aria-label="Album name" className={inputCls} placeholder="Nabil and Riya" value={a.title} maxLength={60} onChange={e => setAlbum(i, { title: e.target.value })} />
                <input aria-label="Event" className={inputCls} placeholder="Wedding" value={a.tag} maxLength={30} onChange={e => setAlbum(i, { tag: e.target.value })} />
              </div>
              <button type="button" aria-label={`Remove the album ${a.title || i + 1}`} onClick={() => set("albums", c.albums.filter((_, k) => k !== i))} className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
              {a.photos.slice(0, 7).map(id => byId.get(id) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={byId.get(id)!.url} alt="" className="w-12 h-12 rounded-[8px] object-cover" />
              ))}
              {a.photos.length > 7 && <span className="text-xs text-[#6B6680] px-1">+{a.photos.length - 7}</span>}
              <button type="button" onClick={() => choose(`Photos for ${a.title || "this album"}`, a.photos, ids => setAlbum(i, { photos: ids, cover: ids[0] ?? null }), true, 30)}
                className="h-12 px-3.5 rounded-[8px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />{a.photos.length ? "Change photos" : "Choose photos"}</button>
            </div>
          </div>
        ))}
        {c.albums.length < 12 && (
          <button type="button" onClick={() => set("albums", [...c.albums, { id: newId(), title: "", tag: "", cover: null, photos: [] }])}
            className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add an album</button>
        )}
      </FormGroup>

      <FormGroup title="Wedding film" note="Leave the link empty to hide this part.">
        <Field label="YouTube link">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://youtu.be/…" value={c.filmUrl} maxLength={200} onChange={e => set("filmUrl", e.target.value)} />}</Field>
        <Field label="Film name">{id => <input id={id} className={inputCls} placeholder="Tanvir and Nusrat, the wedding film" value={c.filmTitle} maxLength={80} onChange={e => set("filmTitle", e.target.value)} />}</Field>
        <div className="px-4 py-3.5"><Slot p={ph(c.filmPhoto)} label="Cover photo" onPick={() => choose("Film cover (wide)", c.filmPhoto ? [c.filmPhoto] : [], ids => set("filmPhoto", ids[0] ?? null))} onClear={() => set("filmPhoto", null)} /></div>
      </FormGroup>

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

      <FormGroup title="Packages" note="Shows your active packages from the Packages page, grouped by category, with their prices.">
        <SwitchRow label="Show packages and prices" on={c.showPackages} onChange={v => set("showPackages", v)} />
      </FormGroup>

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

      <FormGroup title="Contact" note="Empty boxes use the phone, email and address from your studio settings.">
        <Field label="Phone">{id => <input id={id} className={inputCls} inputMode="tel" value={c.phone} maxLength={30} onChange={e => set("phone", e.target.value)} />}</Field>
        <Field label="WhatsApp number">{id => <input id={id} className={inputCls} inputMode="tel" value={c.whatsapp} maxLength={30} onChange={e => set("whatsapp", e.target.value)} />}</Field>
        <Field label="Email">{id => <input id={id} className={inputCls} inputMode="email" value={c.email} maxLength={120} onChange={e => set("email", e.target.value)} />}</Field>
        <Field label="Address">{id => <input id={id} className={inputCls} value={c.address} maxLength={200} onChange={e => set("address", e.target.value)} />}</Field>
        <Field label="Open hours">{id => <input id={id} className={inputCls} placeholder="Sat to Thu, 10 am to 8 pm" value={c.hours} maxLength={80} onChange={e => set("hours", e.target.value)} />}</Field>
      </FormGroup>

      <FormGroup title="Social links and footer">
        <Field label="Facebook page">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://facebook.com/…" value={c.facebook} maxLength={200} onChange={e => set("facebook", e.target.value)} />}</Field>
        <Field label="Instagram">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://instagram.com/…" value={c.instagram} maxLength={200} onChange={e => set("instagram", e.target.value)} />}</Field>
        <Field label="YouTube channel">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://youtube.com/…" value={c.youtube} maxLength={200} onChange={e => set("youtube", e.target.value)} />}</Field>
        <Field label="One line about the studio (footer)">{id => <input id={id} className={inputCls} value={c.footerLine} maxLength={160} onChange={e => set("footerLine", e.target.value)} />}</Field>
      </FormGroup>

      {site.isPublished && (
        <button type="button" disabled={busy} onClick={() => publish(false)} className="text-sm font-semibold text-[#C2304F] px-1 mb-10">Take the website offline</button>
      )}

      {pick && <PhotoPicker photos={site.photos} {...pick} onClose={() => setPick(null)} />}
    </div>
  );
}

function Slot({ p, label, onPick, onClear }: { p: Photo | undefined; label: string; onPick: () => void; onClear: () => void }) {
  return (
    <div className="relative w-[104px]">
      <button type="button" onClick={onPick} aria-label={p ? `Change ${label}` : `Choose ${label}`}
        className="w-[104px] h-[104px] rounded-[14px] overflow-hidden bg-[#F5F3FA] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] flex items-center justify-center text-[#6B6680] transition-colors">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p ? <img src={p.url} alt="" className="w-full h-full object-cover" style={{ backgroundImage: `url(${p.blur})`, backgroundSize: "cover" }} /> : <ImagePlus className="w-6 h-6" />}
      </button>
      {p && <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#17151F] text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>}
      <p className="text-xs text-[#6B6680] mt-1.5 text-center">{label}</p>
    </div>
  );
}

function PhotoPicker({ photos, title, multi, max, value, done, onClose }: {
  photos: Photo[]; title: string; multi: boolean; max: number; value: string[]; done: (ids: string[]) => void; onClose: () => void;
}) {
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
          {photos.length === 0
            ? <p className="text-sm text-[#6B6680] py-10 text-center">No photos yet. Close this and use “Add photos” first.</p>
            : <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map(p => {
                const n = sel.indexOf(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => tap(p.id)} aria-pressed={n >= 0} aria-label={n >= 0 ? "Chosen photo" : "Choose this photo"}
                    className={cn("relative aspect-square rounded-[12px] overflow-hidden border-[3px]", n >= 0 ? "border-[#7D5CEF]" : "border-transparent")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
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
