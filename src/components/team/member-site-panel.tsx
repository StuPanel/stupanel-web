"use client";
/**
 * A team member on the studio's website (Faisal 25-NOV-2026): shown or not, how they appear, the parts of their
 * page, and their ID card QR code. Used in their profile (Website tab) and from Website → Team.
 * Every change saves by itself a moment after it is made (Faisal 26-NOV: no Save button to forget, nothing lost
 * when the sheet is closed). Their page shows who they are only; a part that is off or empty is left out.
 * See stupanel-api site/member-site.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Crop, Download, ExternalLink, ImagePlus, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { FrameModal } from "@/components/site/frame-modal";
import { cropStyle } from "@/components/site/site-view";
import { API_URL as API, apiFetch } from "@/lib/api";
import { notify } from "@/components/feedback";
import { shrink } from "@/lib/shrink-photo";
import { cn } from "@/lib/utils";
import { card } from "@/components/ui/profile-page";
import { qrPng, qrSvg, saveFile } from "@/lib/member-qr";

export type MemberSite = {
  show: boolean; title: string; photoUrl: string | null;
  crop: { x: number; y: number; z: number } | null;
  /** Its placing in the round team row (null: same as the page) */
  rowCrop?: { x: number; y: number; z: number } | null;
  about: string; aboutOn: boolean; years: string; yearsOn: boolean;
  skills: string[]; skillsOn: boolean; weddings: string; weddingsOn: boolean; sinceYear: number | null; instagram: string; facebook: string;
};
type Data = {
  memberId: string; name: string; site: MemberSite; defaults: { title: string; photo: string | null };
  link: string; qrLink: string; teamClick: boolean; teamQr: boolean; live?: { teamClick: boolean; teamQr: boolean }; theme?: string;
  studio: { name: string; logoUrl: string | null };
};

const input = "w-full h-11 px-3 rounded-[12px] border border-[#E4E0EC] bg-white text-[15px] text-[#17151F] placeholder:text-[#A09AAE] focus:outline-none focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/10";
const btn = "h-10 px-3.5 rounded-[12px] border border-[#E4E0EC] bg-white hover:bg-[#F7F5FC] text-[13px] font-semibold text-[#3D3950] inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none";
const heading = "px-4 py-3 text-[13px] font-semibold text-[#4A4658] bg-[#FAF9FC] border-b border-[#EEEBF3]";

/** What is sent and compared: everything but the photo (it has its own upload). */
const initialsOf = (n: string) => { const w = n.trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase(); };
const bodyOf = (s: MemberSite) => { const { photoUrl: _photo, ...rest } = s; void _photo; return rest; };

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn("relative w-[46px] h-[28px] rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/25", on ? "bg-[#7D5CEF]" : "bg-[#E4E0EC]")}>
      <span className={cn("absolute top-[2px] left-[2px] w-[24px] h-[24px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-transform", on && "translate-x-[18px]")} />
    </button>
  );
}

/** One part of their page: a name, its switch, and its box (shown while on). */
function Part({ title, hint, on, onChange, children }: { title: string; hint?: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[#17151F]">{title}</p>
          {hint && <p className="text-xs text-[#6B6680] mt-0.5">{hint}</p>}
        </div>
        <Switch on={on} onChange={onChange} label={title} />
      </div>
      {on && children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

export function MemberSitePanel({ userId, onSaved }: { userId: string; /** After each save: Website → Team keeps its list in step */ onSaved?: (site: MemberSite) => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<MemberSite | null>(null);
  /** The last text the server has (as sent). Different from now = a save is on its way. */
  const [savedJson, setSavedJson] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [qrBusy, setQrBusy] = useState("");
  const [skill, setSkill] = useState("");
  const [adjust, setAdjust] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ s: MemberSite | null; saved: string }>({ s: null, saved: "" });
  const savedCb = useRef(onSaved);
  useEffect(() => { savedCb.current = onSaved; });

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/site/members/${userId}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(r.status === 403 ? "You don't have access to the Website part. The studio owner can tick “Website” for you in Team." : j.message || "Couldn't load the website settings.");
      return;
    }
    const x: Data = await r.json();
    setD(x); setS(x.site); setSavedJson(JSON.stringify(bodyOf(x.site)));
  }, [userId]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const send = useCallback(async (next: MemberSite) => {
    const json = JSON.stringify(bodyOf(next));
    setSaving(true); setFailed(false);
    try {
      const r = await apiFetch(`${API}/site/members/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: json });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.site) { setFailed(true); return; }
      setD(j); setSavedJson(json);
      savedCb.current?.(j.site);
    } catch { setFailed(true); } finally { setSaving(false); }
  }, [userId]);

  // Save by itself a moment after the last change.
  const nowJson = s ? JSON.stringify(bodyOf(s)) : "";
  const dirty = !!s && !!savedJson && nowJson !== savedJson;
  useEffect(() => { latest.current = { s, saved: savedJson }; });
  useEffect(() => {
    if (!dirty || !s) return;
    timer.current = setTimeout(() => { timer.current = null; send(s); }, 700);
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [nowJson, dirty, s, send]);
  // Closed with a change still waiting: send it now.
  useEffect(() => () => {
    const { s: last, saved } = latest.current;
    if (last && saved && JSON.stringify(bodyOf(last)) !== saved) send(last);
  }, [send]);

  const put = (p: Partial<MemberSite>) => setS(x => (x ? { ...x, ...p } : x));

  async function upload(f: File) {
    setPhotoBusy(true);
    try {
      const small = await shrink(f, 1200).catch(() => f);
      const fd = new FormData(); fd.append("file", small);
      const r = await apiFetch(`${API}/site/members/${userId}/photo`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notify(j.message || "Couldn't add the photo", { error: true }); return; }
      setD(j); put({ photoUrl: j.site.photoUrl, crop: null, rowCrop: null });
      savedCb.current?.(j.site);
      notify("Website photo set");
    } finally { setPhotoBusy(false); }
  }
  async function removePhoto() {
    setPhotoBusy(true);
    try {
      const r = await apiFetch(`${API}/site/members/${userId}/photo`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notify("Couldn't remove the photo", { error: true }); return; }
      setD(j); put({ photoUrl: null, crop: null, rowCrop: null });
      savedCb.current?.(j.site);
      notify(j.defaults?.photo ? "Back to their own photo" : "Photo removed");
    } finally { setPhotoBusy(false); }
  }

  if (err) return <p role="alert" className="px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#9C2340] text-sm">{err}</p>;
  if (!d || !s) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>;

  const photo = s.photoUrl || d.defaults.photo;
  const first = d.name.split(/\s+/)[0] || "They";
  const addSkill = () => { const v = skill.trim(); if (v && !s.skills.some(k => k.toLowerCase() === v.toLowerCase()) && s.skills.length < 8) put({ skills: [...s.skills, v] }); setSkill(""); };
  const fileName = `${d.memberId}-${d.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}`;
  const round = !d.theme || d.theme === "signature" || d.theme === "dark";
  // What visitors can open right now, and what only waits for "Publish".
  const live = d.live ?? { teamClick: d.teamClick, teamQr: d.teamQr };
  const pageOpen = live.teamQr || (live.teamClick && d.site.show);
  const waitsPublish = !pageOpen && (d.teamQr || (d.teamClick && d.site.show));
  const qrWaits = d.teamQr && !live.teamQr;
  const linkHint = (kind: "instagram" | "facebook") => {
    const typed = s[kind].trim(), kept = d.site[kind];
    if (!typed || dirty || saving) return null;
    if (!kept) return <p role="alert" className="text-xs text-[#C2304F] mt-1">This doesn&apos;t look like {kind === "instagram" ? "an Instagram" : "a Facebook"} link, so it is not shown.</p>;
    const bare = (x: string) => x.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return bare(kept) !== bare(typed) ? <p className="text-xs text-[#6B6680] mt-1 break-all">Saved as {kept.replace(/^https:\/\//, "")}</p> : null;
  };
  const makeQr = async (kind: "png" | "svg") => {
    setQrBusy(kind);
    try {
      if (kind === "png") saveFile(await qrPng(d.qrLink, { logo: d.studio.logoUrl, studio: d.studio.name, label: `${d.studio.name} · ${d.memberId}` }), `${fileName}-qr.png`);
      else saveFile(new Blob([await qrSvg(d.qrLink)], { type: "image/svg+xml" }), `${fileName}-qr.svg`);
    } catch { notify("Couldn't make the QR code", { error: true }); } finally { setQrBusy(""); }
  };

  return (
    <div className="space-y-4">
      {/* 1. Shown or not, and the saving state */}
      <div className={cn(card, "px-4 py-3.5")}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#17151F]">Show on the website</p>
            <p className="text-xs text-[#6B6680] mt-0.5">{s.show ? "In the team on the About page" : "Not in the team on the About page"}</p>
          </div>
          <Switch on={s.show} onChange={v => put({ show: v })} label="Show on the website" />
        </div>
        <p aria-live="polite" className={cn("mt-2.5 pt-2.5 border-t border-[#EEEBF3] text-xs flex items-center gap-1.5", failed ? "text-[#C2304F]" : "text-[#6B6680]")}>
          {failed ? <>Couldn&apos;t save. <button type="button" onClick={() => send(s)} className="font-semibold underline inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" />Try again</button></>
            : dirty || saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
            : <><Check className="w-3.5 h-3.5 text-[#14613F]" />Changes save by themselves and show on the website at once.</>}
        </p>
      </div>

      {/* 2. How they appear */}
      <div className={cn(card, "overflow-hidden")}>
        <p className={heading}>How they appear</p>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-16 h-16 rounded-full overflow-hidden bg-[#EEE8FD] text-[#5B3FD0] font-semibold flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <img src={photo} alt="" className="w-full h-full object-cover" style={cropStyle(s.rowCrop ?? s.crop ?? undefined)} /> : initialsOf(d.name)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-[#17151F]">Photo</p>
              <p className="text-xs text-[#6B6680] mt-0.5">{s.photoUrl ? `Your photo of ${first}. It stays even if they change theirs.` : d.defaults.photo ? `The photo ${first} set in their own panel.` : "No photo yet: their initials show."}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" disabled={photoBusy} onClick={() => file.current?.click()} className={btn}>
              {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}{s.photoUrl ? "Change photo" : "Set your own photo"}
            </button>
            {photo && <button type="button" onClick={() => setAdjust(true)} className={btn}><Crop className="w-4 h-4" />Adjust</button>}
            {s.photoUrl && <button type="button" disabled={photoBusy} onClick={removePhoto} className={cn(btn, "border-transparent text-[#6B6680] hover:text-[#C2304F]")}>{d.defaults.photo ? "Use their own photo" : "Remove photo"}</button>}
          </div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
        </div>
        <label className="block px-4 py-3.5 border-t border-[#EEEBF3]">
          <span className="block text-[15px] font-medium text-[#17151F]">Title</span>
          <span className="block text-xs text-[#6B6680] mt-0.5 mb-2">Under their name. Empty: {d.defaults.title ? `“${d.defaults.title}”, from their work.` : "nothing is shown."}</span>
          <input className={input} value={s.title} maxLength={60} placeholder={d.defaults.title || "Photographer"} onChange={e => put({ title: e.target.value })} />
        </label>
      </div>

      {/* 3. Their page */}
      <div className={cn(card, "overflow-hidden")}>
        <p className={heading}>On their page · a part that is off or empty is left out</p>
        <div className="divide-y divide-[#EEEBF3]">
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-[#17151F]">With the studio since</p>
              <p className="text-xs text-[#6B6680] mt-0.5">The year they started working with you</p>
            </div>
            <select aria-label="With the studio since" value={s.sinceYear ?? ""} onChange={e => put({ sinceYear: e.target.value ? Number(e.target.value) : null })}
              className="h-11 pl-3 pr-8 rounded-[12px] border border-[#E4E0EC] bg-white text-[15px] text-[#17151F] focus:outline-none focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/10">
              <option value="">Don&apos;t show</option>
              {Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Part title="About them" on={s.aboutOn} onChange={v => put({ aboutOn: v })}>
            <textarea aria-label="About them" className={cn(input, "h-auto min-h-[96px] py-2.5 resize-y")} maxLength={700} value={s.about} placeholder="A few lines about how they work" onChange={e => put({ about: e.target.value })} />
            <p className="text-xs text-[#6B6680] mt-1 text-right tabular-nums">{s.about.length} / 700</p>
          </Part>
          <Part title="Experience" on={s.yearsOn} onChange={v => put({ yearsOn: v })}>
            <input aria-label="Experience" className={input} maxLength={20} value={s.years} placeholder="6 years" onChange={e => put({ years: e.target.value })} />
          </Part>
          <Part title="Weddings covered" on={s.weddingsOn} onChange={v => put({ weddingsOn: v })}>
            <input aria-label="Weddings covered" className={input} maxLength={12} value={s.weddings} placeholder="150+" onChange={e => put({ weddings: e.target.value })} />
          </Part>
          <Part title="Good at" hint="Up to 8" on={s.skillsOn} onChange={v => put({ skillsOn: v })}>
            {s.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {s.skills.map(k => (
                  <span key={k} className="h-8 pl-3 pr-1 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-medium inline-flex items-center gap-1">
                    {k}<button type="button" aria-label={`Remove ${k}`} onClick={() => put({ skills: s.skills.filter(x => x !== k) })} className="w-6 h-6 rounded-full hover:bg-white/60 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
            {s.skills.length < 8 && (
              <div className="flex gap-2">
                <input aria-label="Add a skill" className={input} maxLength={40} value={skill} placeholder="Candid moments, Drone…" onChange={e => setSkill(e.target.value)} onBlur={addSkill}
                  onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addSkill(); } }} />
                <button type="button" onClick={addSkill} disabled={!skill.trim()} className={cn(btn, "h-11 bg-[#F1EEF7] border-transparent")}><Plus className="w-4 h-4" />Add</button>
              </div>
            )}
          </Part>
          <div className="px-4 py-3.5">
            <p className="text-[15px] font-medium text-[#17151F]">Social links</p>
            <p className="text-xs text-[#6B6680] mt-0.5 mb-2">Shown only when a link is filled in</p>
            <input aria-label="Instagram link" className={input} maxLength={300} value={s.instagram} placeholder="Instagram link or @name" onChange={e => put({ instagram: e.target.value })} />
            {linkHint("instagram")}
            <input aria-label="Facebook link" className={cn(input, "mt-2")} maxLength={300} value={s.facebook} placeholder="Facebook link" onChange={e => put({ facebook: e.target.value })} />
            {linkHint("facebook")}
          </div>
        </div>
      </div>

      {/* 4. Their page's link and the QR code for their ID card */}
      <div className={cn(card, "overflow-hidden")}>
        <p className={heading}>Their page and ID card QR code</p>
        <div className="px-4 py-3.5">
          <p className="text-[14px] font-semibold text-[#17151F] break-all">{d.link.replace(/^https:\/\//, "")}</p>
          <p className="text-xs text-[#6B6680] mt-1">
            {pageOpen
              ? <>{live.teamQr ? "Opens from their ID card QR code." : ""}{live.teamClick && d.site.show ? " Visitors open it by clicking them on the About page." : ""}</>
              : waitsPublish ? "Publish your website changes to open this page to visitors."
              : "Their page is off. In Website → About → Team, turn on “QR code for ID cards” or “Open a member's page on click”."}
          </p>
          {pageOpen && (
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={d.link} target="_blank" rel="noopener noreferrer" className={btn}><ExternalLink className="w-4 h-4" />Open</a>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(d.link).then(() => notify("Link copied"), () => notify("Couldn't copy", { error: true })); }} className={btn}><Copy className="w-4 h-4" />Copy link</button>
            </div>
          )}
        </div>
        <div className="px-4 py-3.5 border-t border-[#EEEBF3]">
          <p className="text-[15px] font-medium text-[#17151F]">QR code for their ID card</p>
          <p className="text-xs text-[#6B6680] mt-0.5">
            {!d.teamQr ? "Turn on “QR code for ID cards” in Website → About → Team first."
              : qrWaits ? "Scanning works after you publish your website changes."
              : "Scanning it opens their page with a green “Verified member” bar. If they leave, it says so."}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" disabled={!d.teamQr || !!qrBusy} onClick={() => makeQr("png")} className={cn(btn, "bg-[#EEE8FD] border-transparent text-[#5B3FD0] hover:bg-[#E4DBFB]")}>{qrBusy === "png" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}With your logo (PNG)</button>
            <button type="button" disabled={!d.teamQr || !!qrBusy} onClick={() => makeQr("svg")} className={btn}>{qrBusy === "svg" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Plain code (SVG)</button>
          </div>
        </div>
      </div>

      {adjust && photo && (
        <FrameModal photo={{ url: photo }} title={d.name} onClose={() => setAdjust(false)}
          views={[
            { key: "row", label: "Team row", ratio: 1, round: true, value: s.rowCrop ?? s.crop ?? undefined },
            { key: "page", label: "Their page", ratio: round ? 1 : 4 / 5, round, shape: d.theme === "cream" ? "999px 999px 0 0" : undefined, value: s.crop ?? undefined },
          ]}
          onSaveAll={v => { const c = v.page; put({ rowCrop: v.row, crop: c.x === 50 && c.y === 50 && c.z === 1 ? null : c }); setAdjust(false); }} />
      )}
    </div>
  );
}
