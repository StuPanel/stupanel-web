"use client";
/**
 * A team member on the studio's website (Faisal 25-NOV-2026): shown or not, their page's parts, the studio's own
 * photo for them, and their ID card QR code. Used in their profile (Website tab) and from Website → Team.
 * Their page shows who they are only; a part that is off or empty is left out. See stupanel-api site/member-site.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, ImagePlus, Loader2, Plus, Undo2, X } from "lucide-react";
import { API_URL as API, apiFetch } from "@/lib/api";
import { notify } from "@/components/feedback";
import { shrink } from "@/lib/shrink-photo";
import { cn } from "@/lib/utils";
import { card } from "@/components/ui/profile-page";
import { qrPng, qrSvg, saveFile } from "@/lib/member-qr";

export type MemberSite = {
  show: boolean; title: string; photoUrl: string | null;
  about: string; aboutOn: boolean; years: string; yearsOn: boolean; languages: string; languagesOn: boolean;
  skills: string[]; skillsOn: boolean; weddingsOn: boolean; sinceOn: boolean; instagram: string; facebook: string;
};
type Data = {
  memberId: string; name: string; site: MemberSite; defaults: { title: string; photo: string | null };
  link: string; qrLink: string; teamClick: boolean; teamQr: boolean; studio: { name: string; logoUrl: string | null };
};

const input = "w-full h-11 px-3 rounded-[12px] border border-[#E4E0EC] bg-white text-[15px] text-[#17151F] placeholder:text-[#A09AAE] focus:outline-none focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/10";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn("relative w-[46px] h-[28px] rounded-full transition-colors flex-shrink-0", on ? "bg-[#7D5CEF]" : "bg-[#E4E0EC]")}>
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

export function MemberSitePanel({ userId, onShowChange }: { userId: string; /** Website → Team keeps its list in step */ onShowChange?: (show: boolean) => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<MemberSite | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [skill, setSkill] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const take = (x: Data) => { setD(x); setS(x.site); };
  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/site/members/${userId}`);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.message || "Couldn't load the website settings."); return; }
    take(await r.json());
  }, [userId]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const dirty = !!d && !!s && JSON.stringify(d.site) !== JSON.stringify(s);
  const put = (p: Partial<MemberSite>) => setS(x => (x ? { ...x, ...p } : x));

  async function save(patch?: Partial<MemberSite>) {
    const body = { ...(s ?? {}), ...(patch ?? {}) };
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/site/members/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(j.message) ? j.message[0] : j.message || "Couldn't save", { error: true }); return; }
      const showChanged = d?.site.show !== j.site.show;
      take(j);
      if (showChanged) onShowChange?.(j.site.show);
      notify(patch && "show" in patch ? (j.site.show ? "Shown on the website" : "Hidden from the website") : "Saved");
    } finally { setSaving(false); }
  }

  async function upload(f: File) {
    setPhotoBusy(true);
    try {
      const small = await shrink(f, 1200).catch(() => f);
      const fd = new FormData(); fd.append("file", small);
      const r = await apiFetch(`${API}/site/members/${userId}/photo`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notify(j.message || "Couldn't add the photo", { error: true }); return; }
      setD(j); setS(x => (x ? { ...x, photoUrl: j.site.photoUrl } : j.site));
      notify("Website photo set");
    } finally { setPhotoBusy(false); }
  }
  async function removePhoto() {
    setPhotoBusy(true);
    try {
      const r = await apiFetch(`${API}/site/members/${userId}/photo`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notify("Couldn't remove the photo", { error: true }); return; }
      setD(j); setS(x => (x ? { ...x, photoUrl: null } : j.site));
      notify("Back to their own photo");
    } finally { setPhotoBusy(false); }
  }

  if (err) return <p role="alert" className="px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#9C2340] text-sm">{err}</p>;
  if (!d || !s) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>;

  const photo = s.photoUrl || d.defaults.photo;
  const addSkill = () => { const v = skill.trim(); if (v && !s.skills.includes(v) && s.skills.length < 8) put({ skills: [...s.skills, v] }); setSkill(""); };
  const fileName = `${d.memberId}-${d.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}`;

  return (
    <div className="space-y-4">
      <div className={cn(card, "flex items-center gap-3 px-4 py-3.5")}>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#17151F]">Show on the website</p>
          <p className="text-xs text-[#6B6680] mt-0.5">In the team on the About page</p>
        </div>
        <Switch on={s.show} onChange={v => { put({ show: v }); save({ show: v }); }} label="Show on the website" />
      </div>

      <div className={cn(card, "p-4 space-y-3")}>
        <div className="min-w-0">
          <p className="text-[13px] text-[#6B6680]">Their page</p>
          <p className="text-[14px] font-semibold text-[#17151F] break-all">{d.link.replace(/^https:\/\//, "")}</p>
          <p className="text-xs text-[#6B6680] mt-1">
            {d.teamQr ? "Opens from their ID card QR code." : "Turn on “QR code for ID cards” in Website → Team to use their QR code."}
            {d.teamClick ? " Visitors also open it by clicking them on the About page." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={d.link} target="_blank" rel="noopener noreferrer" className="h-10 px-3.5 rounded-[12px] border border-[#E4E0EC] bg-white text-[13px] font-semibold text-[#3D3950] inline-flex items-center gap-1.5"><ExternalLink className="w-4 h-4" />Open</a>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(d.link).then(() => notify("Link copied"), () => notify("Couldn't copy", { error: true })); }} className="h-10 px-3.5 rounded-[12px] border border-[#E4E0EC] bg-white text-[13px] font-semibold text-[#3D3950] inline-flex items-center gap-1.5"><Copy className="w-4 h-4" />Copy link</button>
          <button type="button" onClick={async () => { try { saveFile(await qrPng(d.qrLink, { logo: d.studio.logoUrl, studio: d.studio.name, label: `${d.studio.name} · ${d.memberId}` }), `${fileName}-qr.png`); } catch { notify("Couldn't make the QR code", { error: true }); } }}
            className="h-10 px-3.5 rounded-[12px] bg-[#EEE8FD] text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5"><Download className="w-4 h-4" />QR with logo (PNG)</button>
          <button type="button" onClick={async () => { try { saveFile(new Blob([await qrSvg(d.qrLink)], { type: "image/svg+xml" }), `${fileName}-qr.svg`); } catch { notify("Couldn't make the QR code", { error: true }); } }}
            className="h-10 px-3.5 rounded-[12px] border border-[#E4E0EC] bg-white text-[13px] font-semibold text-[#3D3950] inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Plain QR (SVG)</button>
        </div>
      </div>

      <div className={cn(card, "flex items-center gap-3 px-4 py-3.5")}>
        <span className="w-14 h-14 rounded-full overflow-hidden bg-[#EEE8FD] text-[#5B3FD0] font-semibold flex items-center justify-center flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : d.name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#17151F]">Photo on the website</p>
          <p className="text-xs text-[#6B6680] mt-0.5">{s.photoUrl ? "Your photo. It stays even if they change theirs." : d.defaults.photo ? "The photo they set in their own panel." : "No photo yet: their initials show."}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
          <button type="button" disabled={photoBusy} onClick={() => file.current?.click()} className="h-10 px-3 rounded-[12px] border border-[#E4E0EC] bg-white text-[13px] font-semibold text-[#3D3950] inline-flex items-center gap-1.5 disabled:opacity-50">
            {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}{s.photoUrl ? "Change" : "Set photo"}
          </button>
          {s.photoUrl && <button type="button" disabled={photoBusy} onClick={removePhoto} className="h-10 px-3 rounded-[12px] text-[13px] font-semibold text-[#6B6680] hover:text-[#C2304F]">Use theirs</button>}
        </div>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      </div>

      <label className="block">
        <span className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">Title on the website</span>
        <input className={input} value={s.title} maxLength={60} placeholder={d.defaults.title || "Photographer"} onChange={e => put({ title: e.target.value })} />
      </label>

      <div className={cn(card, "overflow-hidden")}>
        <p className="px-4 py-3 text-[13px] font-semibold text-[#4A4658] bg-[#FAF9FC] border-b border-[#EEEBF3]">On their page · switch off what you don&apos;t need</p>
        <div className="divide-y divide-[#EEEBF3]">
          <Part title="With the studio since" hint="The year they joined" on={s.sinceOn} onChange={v => put({ sinceOn: v })} />
          <Part title="About them" on={s.aboutOn} onChange={v => put({ aboutOn: v })}>
            <textarea aria-label="About them" className={cn(input, "h-auto min-h-[96px] py-2.5 resize-y")} maxLength={700} value={s.about} placeholder="A few lines about how they work" onChange={e => put({ about: e.target.value })} />
          </Part>
          <Part title="Experience" on={s.yearsOn} onChange={v => put({ yearsOn: v })}>
            <input aria-label="Experience" className={input} maxLength={20} value={s.years} placeholder="6 years" onChange={e => put({ years: e.target.value })} />
          </Part>
          <Part title="Languages" on={s.languagesOn} onChange={v => put({ languagesOn: v })}>
            <input aria-label="Languages" className={input} maxLength={80} value={s.languages} placeholder="Bangla, English" onChange={e => put({ languages: e.target.value })} />
          </Part>
          <Part title="Good at" on={s.skillsOn} onChange={v => put({ skillsOn: v })}>
            <div className="flex flex-wrap gap-1.5">
              {s.skills.map(k => (
                <span key={k} className="h-8 pl-3 pr-1 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-medium inline-flex items-center gap-1">
                  {k}<button type="button" aria-label={`Remove ${k}`} onClick={() => put({ skills: s.skills.filter(x => x !== k) })} className="w-6 h-6 rounded-full hover:bg-white/60 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                </span>
              ))}
            </div>
            {s.skills.length < 8 && (
              <div className="flex gap-2 mt-2">
                <input aria-label="Add a skill" className={input} maxLength={40} value={skill} placeholder="Candid moments, Drone…" onChange={e => setSkill(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addSkill(); } }} />
                <button type="button" onClick={addSkill} disabled={!skill.trim()} className="h-11 px-3.5 rounded-[12px] bg-[#F1EEF7] text-[#3D3950] text-[13px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Plus className="w-4 h-4" />Add</button>
              </div>
            )}
          </Part>
          <Part title="Number of weddings" hint="Counted from their programs in StuPanel" on={s.weddingsOn} onChange={v => put({ weddingsOn: v })} />
          <div className="px-4 py-3.5 space-y-2">
            <div>
              <p className="text-[15px] font-medium text-[#17151F]">Social links</p>
              <p className="text-xs text-[#6B6680] mt-0.5">Shown only when a link is filled in</p>
            </div>
            <input aria-label="Instagram link" className={input} maxLength={300} value={s.instagram} placeholder="Instagram link or @name" onChange={e => put({ instagram: e.target.value })} />
            <input aria-label="Facebook link" className={input} maxLength={300} value={s.facebook} placeholder="Facebook link" onChange={e => put({ facebook: e.target.value })} />
          </div>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-3 z-10 flex justify-end gap-2">
          <button type="button" onClick={() => setS(d.site)} disabled={saving} className="h-11 px-4 rounded-[14px] bg-white border border-[#E4E0EC] text-[14px] font-semibold text-[#3D3950] inline-flex items-center gap-1.5"><Undo2 className="w-4 h-4" />Undo</button>
          <button type="button" onClick={() => save()} disabled={saving} className="h-11 px-5 rounded-[14px] bg-[#7D5CEF] text-white text-[14px] font-semibold inline-flex items-center gap-1.5 shadow-[0_8px_20px_rgba(125,92,239,.3)]">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save
          </button>
        </div>
      )}
    </div>
  );
}
