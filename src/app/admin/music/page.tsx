"use client";

/**
 * StuPanel team: the music every studio can get.
 *  • Picks — songs StuPanel adds (by YouTube link) with tags and, if wanted, the countries they are for.
 *  • Community — every song studios share, one row per song: make it a pick, take it out, or say
 *    "this is the same song as that one" (two uploads of one song are then counted together).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Building2, Check, ExternalLink, Flame, GitMerge, Loader2, Music2, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
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

// The same list the studios see (music-tags.ts on the server).
const EVENTS: Tag[] = [["holud", "Holud"], ["mehendi", "Mehendi"], ["sangeet", "Sangeet"], ["akdh", "Akdh"], ["wedding", "Wedding"], ["reception", "Reception"], ["engagement", "Engagement"], ["pre_wedding", "Pre-wedding"], ["post_wedding", "Post-wedding"], ["ceremony", "Ceremony"], ["first_dance", "First dance"], ["getting_ready", "Getting ready"], ["birthday", "Birthday"], ["anniversary", "Anniversary"], ["baby", "Baby & family"], ["corporate", "Corporate"]].map(([id, name]) => ({ id, name }));
const VIDEOS: Tag[] = [["trailer", "Trailer"], ["teaser", "Teaser"], ["highlight", "Highlight"], ["full_video", "Full video"], ["reel", "Reel"], ["slideshow", "Photo slideshow"]].map(([id, name]) => ({ id, name }));
const MOODS: Tag[] = [["romantic", "Romantic"], ["energetic", "Energetic"], ["emotional", "Emotional"], ["traditional", "Traditional"], ["happy", "Happy"]].map(([id, name]) => ({ id, name }));
const LANGS: Tag[] = [["bangla", "Bangla"], ["hindi", "Hindi"], ["english", "English"], ["urdu", "Urdu"], ["punjabi", "Punjabi"], ["tamil", "Tamil"], ["telugu", "Telugu"], ["arabic", "Arabic"], ["spanish", "Spanish"], ["instrumental", "Instrumental"], ["other", "Other"]].map(([id, name]) => ({ id, name }));
const nameOf = (l: Tag[], id: string) => l.find(t => t.id === id)?.name ?? id;

export default function AdminMusicPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"picks" | "community" | "removed">("picks");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Partial<Row> & { url?: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/admin/music`, { headers: authH() });
    if (r.status === 401 || r.status === 403) { router.replace("/admin/login"); return; }
    if (r.ok) setData(await r.json());
  }, [router]);
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
        {([["picks", `Picks (${picks.length})`, Sparkles], ["community", `Shared by studios (${data?.community.length ?? 0})`, Building2], ["removed", `Removed & merged (${removed.length})`, Ban]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5", tab === id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}><Icon className="w-4 h-4" />{label}</button>
        ))}
        <div className="relative w-full sm:w-auto sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or channel" className="h-9 w-full sm:w-64 pl-9 pr-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500" />
        </div>
      </div>

      {!data ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
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

      {form && <PickForm start={form} onClose={() => setForm(null)} onSave={async body => { if (await save(body, form.mergeInto !== undefined ? "Counted as the same song" : "Saved")) setForm(null); }} />}
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

function PickForm({ start, onClose, onSave }: { start: Partial<Row> & { url?: string }; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<void> }) {
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
            <div><label className={label}>Event (none = any)</label><Chips list={EVENTS} value={events} onChange={setEvents} /></div>
            <div><label className={label}>Kind of video (none = any)</label><Chips list={VIDEOS} value={videos} onChange={setVideos} /></div>
            <div><label className={label}>Mood</label><Chips list={MOODS} value={moods} onChange={setMoods} /></div>
            <div><label className={label}>Language</label><Chips list={LANGS} value={language} onChange={setLanguage} single /></div>
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
