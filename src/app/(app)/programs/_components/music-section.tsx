"use client";

/**
 * Music for one program (studio side).
 * Off → "Let the client choose music" with the parts taken from the program (days + planned videos).
 * On → status, the client's songs per part (in their order, with notes), the studio's suggestions, lock / open again.
 * The client chooses in their portal — same link and access code as everything else.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Check, ChevronDown, Copy, ExternalLink, Library, Link2, Loader2, Lock, LockOpen, Music2, Plus, Settings2, X,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { PortalAccessModal } from "@/components/portal-access-modal";
import { inputCls } from "@/components/ui/form-kit";
import { musicAsText, type LibrarySong, type MusicPart, type MusicSelection, type MusicSuggestion } from "@/lib/music";
import type { Booking } from "./types";

type Client = { id: string; firstName: string; lastName?: string | null; phone?: string | null };

const chip = "h-8 px-3 rounded-full text-[12.5px] font-semibold inline-flex items-center gap-1.5";
const err = async (r: Response) => { const d = await r.json().catch(() => ({})); return (Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong"; };

export function MusicSection({ booking }: { booking: Booking }) {
  const [sel, setSel] = useState<MusicSelection | null>(null);
  const [defaults, setDefaults] = useState<MusicPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [parts, setParts] = useState<MusicPart[]>([]);
  const [perPart, setPerPart] = useState(3);
  const [newPart, setNewPart] = useState("");
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState("");
  const [forPart, setForPart] = useState("");
  const [library, setLibrary] = useState<LibrarySong[] | null>(null);
  const [showLib, setShowLib] = useState(false);
  const [portal, setPortal] = useState(false);
  /** The studio's own music tags (e.g. Outdoor trailer) — offered as parts too. */
  const [ownTags, setOwnTags] = useState<string[]>([]);
  useEffect(() => {
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => setOwnTags(Array.isArray(d?.musicTags) ? d.musicTags : [])).catch(() => {});
  }, []);

  const client = (booking as unknown as { client?: Client }).client;
  const program = booking.eventName || booking.bookingNumber;

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/music/booking/${booking.id}`);
      if (r.ok) { const d = await r.json(); setSel(d.selection); setDefaults(d.defaultParts ?? []); }
    } finally { setLoading(false); }
  }, [booking.id]);
  useEffect(() => { load(); }, [load]);

  function openSetup() {
    setParts(sel ? sel.parts : defaults); setPerPart(sel?.perPart ?? 3); setNewPart(""); setSetup(true);
  }

  async function put(body: object, okText?: string) {
    const r = await apiFetch(`${API}/music/booking/${booking.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { notify(await err(r), { error: true }); return false; }
    setSel(await r.json()); if (okText) notify(okText);
    return true;
  }

  async function saveSetup() {
    if (!parts.length) { notify("Add at least one part", { error: true }); return; }
    setBusy("setup");
    if (await put({ parts, perPart }, sel ? "Saved" : "Music is on — the client can choose in their portal")) setSetup(false);
    setBusy("");
  }

  async function setStatus(status: "open" | "submitted" | "off") {
    if (status === "off" && !(await askConfirm({ title: "Turn music off for this program?", message: "The client will no longer see it. Their songs are kept if you turn it on again.", confirmLabel: "Turn off", danger: true }))) return;
    setBusy(status);
    const r = await apiFetch(`${API}/music/booking/${booking.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setBusy("");
    if (!r.ok) { notify(await err(r), { error: true }); return; }
    const v: MusicSelection = await r.json();
    setSel(v.status === "off" ? null : v);
    notify(status === "open" ? "Opened — the client can change the songs" : status === "submitted" ? "Locked" : "Music turned off");
  }

  async function addSuggestion(s: { youtubeId: string; title: string; channel?: string }) {
    if (!sel) return;
    if (sel.suggestions.some(x => x.youtubeId === s.youtubeId)) { notify("Already suggested", { error: true }); return; }
    await put({ suggestions: [...sel.suggestions, { ...s, parts: forPart ? [forPart] : [] }] }, "Suggestion added");
  }

  async function addByLink() {
    if (!link.trim()) return;
    setBusy("link");
    try {
      const r = await apiFetch(`${API}/music/lookup?url=${encodeURIComponent(link.trim())}`);
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      await addSuggestion(await r.json()); setLink("");
    } finally { setBusy(""); }
  }

  async function openLibrary() {
    setShowLib(v => !v);
    if (library) return;
    const r = await apiFetch(`${API}/music/songs`).catch(() => null);
    setLibrary(r?.ok ? await r.json() : []);
  }

  function copyList() {
    if (!sel) return;
    navigator.clipboard.writeText(musicAsText(program, sel.parts, sel.picks, sel.clientNote)).then(() => notify("Song list copied"), () => notify("Couldn't copy", { error: true }));
  }

  if (loading) return <div className="rounded-[16px] bg-[#F5F3FA] p-4"><div className="sp-skel h-4 w-40 rounded-full" /></div>;

  // ── Off ──
  if (!sel && !setup) {
    return (
      <div className="rounded-[16px] bg-[#F5F3FA] p-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-[12px] bg-[#F7E6F3] flex items-center justify-center flex-shrink-0"><Music2 className="w-5 h-5 text-[#9E3A8C]" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#17151F]">Music</p>
          <p className="text-[12.5px] text-[#6B6680]">Let the client choose songs for {defaults.map(p => p.label).slice(0, 3).join(", ")}{defaults.length > 3 ? "…" : ""} in their portal.</p>
        </div>
        <button type="button" onClick={openSetup} className="h-9 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold flex-shrink-0">Turn on</button>
      </div>
    );
  }

  // ── Set-up / edit parts ──
  if (setup) {
    return (
      <div className="rounded-[16px] bg-[#F5F3FA] p-4 space-y-3">
        <p className="text-[14px] font-bold text-[#17151F] flex items-center gap-2"><Music2 className="w-4 h-4 text-[#9E3A8C]" />Which parts need music?</p>
        <div className="flex flex-wrap gap-1.5">
          {parts.map(p => (
            <span key={p.key} className={cn(chip, "bg-white text-[#17151F] pr-1.5")}>
              {p.label}
              <button type="button" aria-label={`Remove ${p.label}`} onClick={() => setParts(parts.filter(x => x.key !== p.key))} className="w-5 h-5 rounded-full hover:bg-[#EEEBF4] flex items-center justify-center text-[#6B6680]"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {defaults.filter(d => !parts.some(p => p.key === d.key)).map(d => (
            <button key={d.key} type="button" onClick={() => setParts([...parts, d])} className={cn(chip, "border border-dashed border-[#CFC8DD] text-[#6B6680]")}><Plus className="w-3 h-3" />{d.label}</button>
          ))}
          {ownTags.filter(t => ![...parts, ...defaults].some(p => p.label.toLowerCase() === t.toLowerCase())).map(t => (
            <button key={`tag-${t}`} type="button" onClick={() => setParts([...parts, { key: `custom-${Date.now()}-${t.length}`, label: t, kind: "custom" }])} className={cn(chip, "border border-dashed border-[#CFC8DD] text-[#6B6680]")}><Plus className="w-3 h-3" />{t}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newPart} onChange={e => setNewPart(e.target.value)} placeholder="Add another part — e.g. Entry song, Reel" aria-label="New part name" maxLength={60}
            onKeyDown={e => { if (e.key === "Enter" && newPart.trim()) { setParts([...parts, { key: `custom-${Date.now()}`, label: newPart.trim(), kind: "custom" }]); setNewPart(""); } }}
            className={cn(inputCls, "h-10 bg-white")} />
          <button type="button" disabled={!newPart.trim()} onClick={() => { setParts([...parts, { key: `custom-${Date.now()}`, label: newPart.trim(), kind: "custom" }]); setNewPart(""); }}
            className="h-10 px-4 rounded-[12px] bg-white text-[#5B3FD0] text-[13px] font-semibold disabled:opacity-50 flex-shrink-0">Add</button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[#4A4658]">Songs the client can choose for each part</p>
          <div className="flex items-center gap-1 bg-white rounded-full p-0.5" role="group" aria-label="Songs per part">
            {[1, 2, 3, 5].map(n => (
              <button key={n} type="button" aria-pressed={perPart === n} onClick={() => setPerPart(n)}
                className={cn("w-9 h-8 rounded-full text-[13px] font-bold", perPart === n ? "bg-[#17151F] text-white" : "text-[#4A4658]")}>{n}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setSetup(false)} className="h-10 px-4 rounded-full bg-white text-[#4A4658] text-[13px] font-semibold">Cancel</button>
          <button type="button" onClick={saveSetup} disabled={busy === "setup"} className="flex-1 h-10 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {busy === "setup" && <Loader2 className="w-4 h-4 animate-spin" />}{sel ? "Save" : "Turn on music"}
          </button>
        </div>
      </div>
    );
  }

  // ── On ──
  const s = sel!;
  const sent = s.status === "submitted";
  const wantsChange = sent && !!s.reopenRequestedAt;

  return (
    <div className="rounded-[16px] bg-[#F5F3FA] p-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[12px] bg-[#F7E6F3] flex items-center justify-center flex-shrink-0"><Music2 className="w-5 h-5 text-[#9E3A8C]" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#17151F]">Music</p>
          <p className="text-[12.5px] mt-0.5">
            {wantsChange ? <span className="font-semibold text-[#C2304F]">Client wants to change the songs{s.reopenReason ? ` — “${s.reopenReason}”` : ""}</span>
              : sent ? <span className="font-semibold text-[#1F8A5B] inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Client sent {s.counts.total} song{s.counts.total === 1 ? "" : "s"}{s.submittedAt ? ` · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(s.submittedAt))}` : ""}</span>
              : s.counts.total ? <span className="text-[#6B6680]">Client is choosing — {s.counts.filled} of {s.counts.parts} parts so far</span>
              : <span className="text-[#6B6680]">Waiting for the client · up to {s.perPart} per part</span>}
          </p>
        </div>
        <button type="button" onClick={openSetup} aria-label="Change parts" className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#6B6680] flex-shrink-0"><Settings2 className="w-4 h-4" /></button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {sent
          ? <button type="button" onClick={() => setStatus("open")} disabled={!!busy} className={cn(chip, wantsChange ? "bg-[#7D5CEF] text-white" : "bg-white text-[#17151F]")}><LockOpen className="w-3.5 h-3.5" />Open again for the client</button>
          : <button type="button" onClick={() => setStatus("submitted")} disabled={!!busy || !s.counts.total} className={cn(chip, "bg-white text-[#17151F] disabled:opacity-50")}><Lock className="w-3.5 h-3.5" />Lock now</button>}
        {s.counts.total > 0 && <button type="button" onClick={copyList} className={cn(chip, "bg-white text-[#17151F]")}><Copy className="w-3.5 h-3.5" />Copy list</button>}
        {client && !sent && <button type="button" onClick={() => setPortal(true)} className={cn(chip, "bg-[#E2F4EA] text-[#1F8A5B]")}><Link2 className="w-3.5 h-3.5" />Client portal link</button>}
        <button type="button" onClick={() => setStatus("off")} disabled={!!busy} className={cn(chip, "text-[#6B6680]")}>Turn off</button>
      </div>

      {/* The client's songs */}
      <div className="mt-3 space-y-2">
        {s.parts.map(p => {
          const list = s.picks[p.key] ?? [];
          return (
            <div key={p.key} className="rounded-[14px] bg-white p-3">
              <p className="text-[13px] font-bold text-[#17151F] flex items-center justify-between">{p.label}<span className="text-[12px] font-semibold text-[#6B6680] tabular-nums">{list.length}/{s.perPart}</span></p>
              {list.length === 0 ? <p className="text-[12.5px] text-[#A29DB3] mt-1">{sent ? "No song chosen — your choice" : "Nothing yet"}</p> : (
                <ol className="mt-2 space-y-2">
                  {list.map((x, i) => (
                    <li key={x.youtubeId} className="flex items-center gap-2.5">
                      <span className="w-5 text-[12px] font-bold text-[#5B3FD0] tabular-nums">{i + 1}.</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.thumb} alt="" className="w-14 h-9 rounded-[8px] object-cover flex-shrink-0 bg-[#EEEBF4]" loading="lazy" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-[#17151F] truncate">{x.title}</span>
                        <span className="block text-[12px] text-[#6B6680] truncate">{x.note ? `“${x.note}”` : x.from === "studio" ? "From your suggestions" : "Client's own link"}</span>
                      </span>
                      <a href={x.url} target="_blank" rel="noreferrer" aria-label={`Open ${x.title} on YouTube`} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA] flex-shrink-0"><ExternalLink className="w-4 h-4" /></a>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
        {s.clientNote && <p className="rounded-[14px] bg-white p-3 text-[13px] text-[#4A4658]"><b className="text-[#17151F]">Client&apos;s note:</b> {s.clientNote}</p>}
      </div>

      {/* Suggestions */}
      <details className="mt-3 group">
        <summary className="cursor-pointer list-none flex items-center justify-between text-[13px] font-bold text-[#4A4658] py-1">
          Your suggestions for this client <span className="inline-flex items-center gap-1 text-[#6B6680] font-semibold">{s.suggestions.length}<ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" /></span>
        </summary>
        <p className="text-[12px] text-[#6B6680] mb-2">Songs from your library that fit a part are shown to the client automatically. Add extra ones just for this program here.</p>
        <div className="flex gap-2">
          <select value={forPart} onChange={e => setForPart(e.target.value)} aria-label="Suggest for" className="h-10 px-2.5 rounded-[12px] bg-white text-[13px] text-[#17151F] outline-none flex-shrink-0 max-w-[40%]">
            <option value="">Every part</option>
            {s.parts.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addByLink(); }} placeholder="Paste a YouTube link" aria-label="YouTube link" className={cn(inputCls, "h-10 bg-white")} />
          <button type="button" onClick={addByLink} disabled={busy === "link" || !link.trim()} className="h-10 w-10 rounded-[12px] bg-[#7D5CEF] text-white flex items-center justify-center disabled:opacity-50 flex-shrink-0" aria-label="Add suggestion">
            {busy === "link" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        <button type="button" onClick={openLibrary} className="mt-2 text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5"><Library className="w-3.5 h-3.5" />{showLib ? "Hide my library" : "Pick from my library"}</button>
        {showLib && (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-[14px] bg-white divide-y divide-[#EEEBF4]">
            {library === null && <li className="p-3 text-[13px] text-[#6B6680]">Loading…</li>}
            {library?.length === 0 && <li className="p-3 text-[13px] text-[#6B6680]">Your library is empty. Add songs in <a href="/music" className="font-semibold text-[#5B3FD0]">Music Library</a>.</li>}
            {library?.map(x => {
              const has = s.suggestions.some(y => y.youtubeId === x.youtubeId);
              return (
                <li key={x.id} className="flex items-center gap-2.5 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.thumb} alt="" className="w-12 h-8 rounded-[6px] object-cover flex-shrink-0" loading="lazy" />
                  <span className="flex-1 min-w-0 text-[13px] text-[#17151F] truncate">{x.title}</span>
                  <button type="button" disabled={has} onClick={() => addSuggestion(x)} className="h-8 px-3 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12.5px] font-semibold disabled:opacity-50 flex-shrink-0">{has ? "Added" : "Suggest"}</button>
                </li>
              );
            })}
          </ul>
        )}
        {s.suggestions.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {s.suggestions.map((x: MusicSuggestion) => (
              <li key={x.youtubeId} className="flex items-center gap-2.5 rounded-[12px] bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.thumb} alt="" className="w-12 h-8 rounded-[6px] object-cover flex-shrink-0" loading="lazy" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#17151F] truncate">{x.title}</span>
                  <span className="block text-[12px] text-[#6B6680] truncate">{x.parts.length ? x.parts.map(k => s.parts.find(p => p.key === k)?.label ?? k).join(", ") : "Every part"}</span>
                </span>
                <button type="button" aria-label={`Remove ${x.title}`} onClick={() => put({ suggestions: s.suggestions.filter(y => y.youtubeId !== x.youtubeId) })} className="w-8 h-8 rounded-full flex items-center justify-center text-[#C2304F] hover:bg-[#FDECEF] flex-shrink-0"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </details>

      {portal && client && <PortalAccessModal client={client} onClose={() => setPortal(false)} />}
    </div>
  );
}
