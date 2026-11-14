"use client";

/**
 * StuPanel team: the music every studio can get.
 *  • Picks — songs StuPanel adds (by YouTube link) with tags and, if wanted, the countries they are for.
 *  • Community — every song studios share, one row per song: make it a pick, take it out, or say
 *    "this is the same song as that one" (two uploads of one song are then counted together).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Building2, Check, ExternalLink, Flame, GitMerge, Loader2, Music2, Pencil, Plus, Search, Sparkles, Tags, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";

const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
type Tag = { id: string; name: string };
type Row = {
  youtubeId: string; title: string; channel?: string | null; thumb: string; url: string;
  events: string[]; videos: string[]; moods: string[]; language: string | null; altNames?: string | null;
  isPick: boolean; blocked: boolean; mergeInto?: string | null; countries?: string[];
  studios?: number; chosen?: number; shown?: boolean;
};
type Data = { catalog: Row[]; community: Row[]; studiosSharing: number };

type FullTag = Tag & { also: string[]; countries: string[]; hidden: boolean; added: boolean };
type TagKind = "event" | "video" | "mood" | "language";
type Suggested = { kind: TagKind; id: string; name: string; studios: number; at: string };
type TagData = { events: FullTag[]; videos: FullTag[]; moods: FullTag[]; languages: FullTag[]; suggested: Suggested[] };
const KINDS: { kind: TagKind; key: "events" | "videos" | "moods" | "languages"; title: string }[] = [
  { kind: "event", key: "events", title: "Events" }, { kind: "video", key: "videos", title: "Kinds of video" },
  { kind: "mood", key: "moods", title: "Moods" }, { kind: "language", key: "languages", title: "Languages" },
];
const nameOf = (l: Tag[], id: string) => l.find(t => t.id === id)?.name ?? id;

export default function AdminMusicPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"picks" | "community" | "removed" | "tags">("picks");
  const [tags, setTags] = useState<TagData | null>(null);
  const [tagForm, setTagForm] = useState<{ kind: TagKind; tag?: FullTag; suggestion?: Suggested } | null>(null);
  // Pickers offer the tags studios can choose; names of hidden ones still show on songs that have them.
  const EVENTS = useMemo(() => tags?.events ?? [], [tags]);
  const VIDEOS = useMemo(() => tags?.videos ?? [], [tags]);
  const MOODS = useMemo(() => tags?.moods ?? [], [tags]);
  const LANGS = useMemo(() => tags?.languages ?? [], [tags]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Partial<Row> & { url?: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/admin/music`, { headers: authH() });
    if (r.status === 401 || r.status === 403) { router.replace("/admin/login"); return; }
    if (r.ok) setData(await r.json());
    const t = await fetch(`${API}/admin/music/tags`, { headers: authH() });
    if (t.ok) setTags(await t.json());
  }, [router]);

  async function tagCall(path: string, body: Record<string, unknown>, text: string) {
    const r = await fetch(`${API}/admin/music/${path}`, { method: "POST", headers: authH(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save", { error: true }); return false; }
    notify(text); await load(); return true;
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function save(body: Record<string, unknown>, text: string) {
    const r = await fetch(`${API}/admin/music`, { method: "POST", headers: authH(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save", { error: true }); return false; }
    notify(text); await load(); return true;
  }
  async function remove(row: Row) {
    if (!(await askConfirm({ title: "Remove from StuPanel's list?", message: `${row.title}\nIt stops being a pick, and any "removed" or "same song as" mark on it is cleared.`, confirmLabel: "Remove", danger: true }))) return;
    const r = await fetch(`${API}/admin/music/${row.youtubeId}`, { method: "DELETE", headers: authH() });
    if (!r.ok) { notify("Couldn't remove", { error: true }); return; }
    notify("Removed"); load();
  }

  const picks = useMemo(() => (data?.catalog ?? []).filter(c => c.isPick && !c.blocked && !c.mergeInto), [data]);
  const removed = useMemo(() => (data?.catalog ?? []).filter(c => c.blocked || c.mergeInto), [data]);
  const list = (tab === "picks" ? picks : tab === "community" ? data?.community ?? [] : removed)
    .filter(r => { const k = q.trim().toLowerCase(); return !k || r.title.toLowerCase().includes(k) || (r.channel ?? "").toLowerCase().includes(k) || r.youtubeId === k; });

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Music</h1>
          <p className="text-sm text-slate-400 mt-0.5">StuPanel picks for every studio, and the songs studios share{data ? ` · ${data.studiosSharing} studio${data.studiosSharing === 1 ? "" : "s"} sharing` : ""}</p>
        </div>
        <button type="button" onClick={() => setForm({ url: "", isPick: true, events: [], videos: [], moods: [], language: null, countries: [] })}
          className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add a pick</button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {([["picks", `Picks (${picks.length})`, Sparkles], ["community", `Shared by studios (${data?.community.length ?? 0})`, Building2], ["removed", `Removed & merged (${removed.length})`, Ban], ["tags", `Tags${tags?.suggested.length ? ` (${tags.suggested.length} new)` : ""}`, Tags]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5", tab === id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}><Icon className="w-4 h-4" />{label}</button>
        ))}
        <div className={cn("relative w-full sm:w-auto sm:ml-auto", tab === "tags" && "hidden")}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or channel" className="h-9 w-full sm:w-64 pl-9 pr-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500" />
        </div>
      </div>

      {tab === "tags" ? (
        !tags ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div> : (
          <div className="space-y-4">
            {tags.suggested.length > 0 && (
              <div className="bg-slate-800 border border-amber-500/40 rounded-xl overflow-hidden">
                <p className="px-4 py-3 text-sm font-semibold text-amber-200 border-b border-slate-700/70">Suggested by studios</p>
                <div className="divide-y divide-slate-700/70">
                  {tags.suggested.map(sg => (
                    <div key={sg.kind + sg.id} className="p-3 flex items-center gap-3 flex-wrap">
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="text-sm font-semibold text-white">{sg.name}</p>
                        <p className="text-xs text-slate-400">{sg.kind === "event" ? "Event" : "Kind of video"} · asked by {sg.studios} studio{sg.studios === 1 ? "" : "s"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button type="button" onClick={() => tagCall("tags/resolve", { kind: sg.kind, id: sg.id, action: "approve" }, `“${sg.name}” is now a tag for every studio`)} className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Add for everyone</button>
                        <button type="button" onClick={() => setTagForm({ kind: sg.kind, suggestion: sg })} className="h-8 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold inline-flex items-center gap-1"><GitMerge className="w-3.5 h-3.5" />Another name of…</button>
                        <button type="button" onClick={() => tagCall("tags/resolve", { kind: sg.kind, id: sg.id, action: "reject" }, "Not added")} className="h-8 px-3 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-200 text-xs font-semibold inline-flex items-center gap-1"><X className="w-3.5 h-3.5" />No</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {KINDS.map(k => (
              <div key={k.kind} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-semibold text-white">{k.title} <span className="text-slate-500 font-normal">({tags[k.key].length})</span></p>
                  <button type="button" onClick={() => setTagForm({ kind: k.kind })} className="h-8 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags[k.key].map(t => (
                    <button key={t.id} type="button" onClick={() => setTagForm({ kind: k.kind, tag: t })} title={[...t.also].join(", ") || "No other names"}
                      className={cn("h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5", t.hidden ? "bg-slate-900 text-slate-500 line-through" : "bg-slate-700 text-slate-200 hover:bg-slate-600")}>
                      {t.name}{t.countries.length > 0 && <span className="text-emerald-300 font-normal no-underline">{t.countries.length > 3 ? `${t.countries.length} countries` : t.countries.join(" ")}</span>}{t.added && <span className="text-indigo-300 font-normal">new</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">Press a tag to change its name, other names (what search and old typed tags match), the countries where it is shown first, or to hide it from the pickers. Tags from the first list cannot be deleted, only hidden — songs that have them keep them.</p>
          </div>
        )
      ) : !data ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        : list.length === 0 ? (
          <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
            <Music2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">{tab === "picks" ? "No picks yet. Add songs for each kind of video — new studios' clients see them from the first day." : tab === "community" ? "No studio has shared a song yet." : "Nothing removed or merged."}</p>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700/70 overflow-hidden">
            {list.map(r => (
              <div key={r.youtubeId} className="p-3 flex items-center gap-3 flex-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumb} alt="" loading="lazy" className="w-24 h-[54px] rounded-lg object-cover bg-slate-700 flex-shrink-0" />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-semibold text-white truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 truncate">{r.channel}
                    {r.studios !== undefined && <span className="ml-2 text-indigo-300 inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{r.studios} studio{r.studios === 1 ? "" : "s"}</span>}
                    {!!r.chosen && <span className="ml-2 text-pink-300 inline-flex items-center gap-1"><Flame className="w-3 h-3" />chosen {r.chosen}×</span>}
                    {tab === "community" && !r.shown && <span className="ml-2 text-slate-500">not shown to studios yet (needs 2 studios or 3 choices)</span>}
                    {r.mergeInto && <span className="ml-2 text-amber-300">same song as {r.mergeInto}</span>}
                    {r.blocked && <span className="ml-2 text-rose-300">removed from the community list</span>}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.events.map(e => <span key={e} className="h-5 px-1.5 rounded bg-indigo-500/20 text-indigo-200 text-[11px] font-semibold inline-flex items-center">{nameOf(EVENTS, e)}</span>)}
                    {r.videos.map(v => <span key={v} className="h-5 px-1.5 rounded bg-sky-500/20 text-sky-200 text-[11px] font-semibold inline-flex items-center">{nameOf(VIDEOS, v)}</span>)}
                    {r.language && <span className="h-5 px-1.5 rounded bg-slate-700 text-slate-300 text-[11px] font-semibold inline-flex items-center">{nameOf(LANGS, r.language)}</span>}
                    {(r.countries ?? []).length > 0 && <span className="h-5 px-1.5 rounded bg-emerald-500/20 text-emerald-200 text-[11px] font-semibold inline-flex items-center">{r.countries!.join(", ")}</span>}
                    {tab === "community" && r.isPick && <span className="h-5 px-1.5 rounded bg-amber-500/20 text-amber-200 text-[11px] font-semibold inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />Pick</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {tab === "community" && !r.isPick && <button type="button" onClick={() => setForm({ ...r, url: r.url, isPick: true, countries: [] })} className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Make a pick</button>}
                  {tab === "community" && <button type="button" title="This is another upload of a song that is already in the list" onClick={() => setForm({ ...r, url: r.url, isPick: false, mergeInto: "" })} className="h-8 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold inline-flex items-center gap-1"><GitMerge className="w-3.5 h-3.5" />Same as…</button>}
                  {tab === "community" && <button type="button" onClick={async () => { if (await askConfirm({ title: "Take this song out of the community list?", message: `${r.title}\nNo studio will see it under "Popular in studios". Studios that added it keep it in their own library.`, confirmLabel: "Take out", danger: true })) save({ url: r.url, blocked: true, isPick: false }, "Taken out of the community list"); }} className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-200 inline-flex items-center justify-center" aria-label="Take out of the community list" title="Take out of the community list"><Ban className="w-3.5 h-3.5" /></button>}
                  {tab === "picks" && <button type="button" onClick={() => setForm({ ...r, url: r.url })} className="h-8 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5" />Edit</button>}
                  {tab !== "community" && <button type="button" onClick={() => remove(r)} className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-200 inline-flex items-center justify-center" aria-label="Remove" title={tab === "removed" ? "Put it back" : "Remove"}><Trash2 className="w-3.5 h-3.5" /></button>}
                  <a href={r.url} target="_blank" rel="noreferrer" className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 inline-flex items-center justify-center" aria-label="Open on YouTube"><ExternalLink className="w-3.5 h-3.5" /></a>
                </div>
              </div>
            ))}
          </div>
        )}

      {tagForm && tags && <TagForm kind={tagForm.kind} tag={tagForm.tag} suggestion={tagForm.suggestion} list={tags[KINDS.find(k => k.kind === tagForm.kind)!.key]} onClose={() => setTagForm(null)}
        onSave={async (path, body, text) => { if (await tagCall(path, body, text)) setTagForm(null); }} />}
      {form && <PickForm tags={{ EVENTS, VIDEOS, MOODS, LANGS }} start={form} onClose={() => setForm(null)} onSave={async body => { if (await save(body, form.mergeInto !== undefined ? "Counted as the same song" : "Saved")) setForm(null); }} />}
    </div>
  );
}

function Chips({ list, value, onChange, single }: { list: Tag[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map(t => { const on = value.includes(t.id); return (
        <button key={t.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter(x => x !== t.id) : single ? [t.id] : [...value, t.id])}
          className={cn("h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1", on ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}>{on && <Check className="w-3 h-3" strokeWidth={3} />}{t.name}</button>
      ); })}
    </div>
  );
}

function TagForm({ kind, tag, suggestion, list, onClose, onSave }: {
  kind: TagKind; tag?: FullTag; suggestion?: Suggested; list: FullTag[]; onClose: () => void;
  onSave: (path: string, body: Record<string, unknown>, text: string) => Promise<void>;
}) {
  const [name, setName] = useState(tag?.name ?? "");
  const [also, setAlso] = useState((tag?.also ?? []).join(", "));
  const [countries, setCountries] = useState((tag?.countries ?? []).join(", "));
  const [hidden, setHidden] = useState(tag?.hidden ?? false);
  const [sameAs, setSameAs] = useState("");
  const [busy, setBusy] = useState(false);
  const label = "block text-xs font-semibold text-slate-400 mb-1.5";
  const input = "w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500";
  const kindName = KINDS.find(k => k.kind === kind)!.title.toLowerCase();
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl p-5 my-8 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{suggestion ? `“${suggestion.name}” is another name of…` : tag ? `Tag: ${tag.name}` : `New tag (${kindName})`}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-slate-700 text-slate-400 inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        {suggestion ? (
          <div>
            <label className={label}>The tag that means the same</label>
            <div className="flex flex-wrap gap-1.5">
              {list.map(t => <button key={t.id} type="button" aria-pressed={sameAs === t.id} onClick={() => setSameAs(t.id)} className={cn("h-8 px-3 rounded-lg text-xs font-semibold", sameAs === t.id ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}>{t.name}</button>)}
            </div>
            <p className="text-xs text-slate-500 mt-2">Studios that search or type “{suggestion.name}” will then get that tag.</p>
          </div>
        ) : (
          <>
            <div><label className={label}>Name (what studios see)</label><input value={name} onChange={e => setName(e.target.value)} autoFocus={!tag} maxLength={60} placeholder="e.g. Cake cutting" className={input} /></div>
            <div><label className={label}>Other names, with commas (any language)</label><textarea value={also} onChange={e => setAlso(e.target.value)} rows={3} placeholder="cake, কেক কাটা" className={cn(input, "h-auto py-2")} /></div>
            <div><label className={label}>Countries where it is shown first (empty = everywhere)</label><input value={countries} onChange={e => setCountries(e.target.value)} placeholder="BD, IN or Bangladesh, India" className={input} /></div>
            {tag && <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} className="w-4 h-4 accent-indigo-500" />Hide from the pickers (songs that have it keep it)</label>}
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg bg-slate-700 text-slate-200 text-sm font-semibold">Cancel</button>
          <button type="button" disabled={busy || (suggestion ? !sameAs : name.trim().length < 2)}
            onClick={async () => {
              setBusy(true);
              try {
                if (suggestion) await onSave("tags/resolve", { kind, id: suggestion.id, action: "same", sameAs }, "Added as another name");
                else await onSave("tags", { kind, id: tag?.id, name, also: also.split(","), countries: countries.split(","), hidden }, tag ? "Tag saved" : "Tag added for every studio");
              } finally { setBusy(false); }
            }}
            className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save
          </button>
        </div>
      </div>
    </div>
  );
}

function PickForm({ tags, start, onClose, onSave }: { tags: { EVENTS: FullTag[]; VIDEOS: FullTag[]; MOODS: FullTag[]; LANGS: FullTag[] }; start: Partial<Row> & { url?: string }; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const pick = (l: FullTag[], on: string[]) => l.filter(t => !t.hidden || on.includes(t.id));
  const merging = start.mergeInto !== undefined && !start.isPick;
  const [url, setUrl] = useState(start.url ?? "");
  const [events, setEvents] = useState(start.events ?? []);
  const [videos, setVideos] = useState(start.videos ?? []);
  const [moods, setMoods] = useState(start.moods ?? []);
  const [language, setLanguage] = useState(start.language ? [start.language] : []);
  const [countries, setCountries] = useState((start.countries ?? []).join(", "));
  const [altNames, setAltNames] = useState(start.altNames ?? "");
  const [mergeInto, setMergeInto] = useState("");
  const [busy, setBusy] = useState(false);
  const label = "block text-xs font-semibold text-slate-400 mb-1.5";
  const input = "w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500";
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-xl bg-slate-800 border border-slate-700 rounded-2xl p-5 my-8 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{merging ? "Same song as…" : start.title ? "StuPanel pick" : "Add a pick"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-slate-700 text-slate-400 inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        {start.title && <p className="text-sm text-slate-300">{start.title}</p>}
        {!start.title && <div><label className={label}>YouTube link</label><input value={url} onChange={e => setUrl(e.target.value)} autoFocus placeholder="https://youtube.com/watch?v=…" className={input} /></div>}
        {merging ? (
          <div>
            <label className={label}>YouTube link of the song this is the same as</label>
            <input value={mergeInto} onChange={e => setMergeInto(e.target.value)} autoFocus placeholder="https://youtube.com/watch?v=…" className={input} />
            <p className="text-xs text-slate-500 mt-1.5">Studios and choices of this upload are then counted with that song, and only that one shows in “Popular in studios”.</p>
          </div>
        ) : (
          <>
            <div><label className={label}>Event (none = any)</label><Chips list={pick(tags.EVENTS, events)} value={events} onChange={setEvents} /></div>
            <div><label className={label}>Kind of video (none = any)</label><Chips list={pick(tags.VIDEOS, videos)} value={videos} onChange={setVideos} /></div>
            <div><label className={label}>Mood</label><Chips list={pick(tags.MOODS, moods)} value={moods} onChange={setMoods} /></div>
            <div><label className={label}>Language</label><Chips list={pick(tags.LANGS, language)} value={language} onChange={setLanguage} single /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={label}>Countries (empty = every country)</label><input value={countries} onChange={e => setCountries(e.target.value)} placeholder="BD, IN or Bangladesh, India" className={input} /></div>
              <div><label className={label}>Other names (for search)</label><input value={altNames} onChange={e => setAltNames(e.target.value)} placeholder="another spelling, local name" className={input} /></div>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg bg-slate-700 text-slate-200 text-sm font-semibold">Cancel</button>
          <button type="button" disabled={busy || !url.trim() || (merging && !mergeInto.trim())}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(merging ? { url, mergeInto, isPick: false }
                  : { url, isPick: true, blocked: false, mergeInto: null, events, videos, moods, language: language[0] ?? null, altNames, countries: countries.split(",").map(c => c.trim()).filter(Boolean) });
              } finally { setBusy(false); }
            }}
            className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{merging ? "Count as the same song" : "Save pick"}
          </button>
        </div>
      </div>
    </div>
  );
}
