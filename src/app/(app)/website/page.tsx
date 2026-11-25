"use client";

/**
 * Website: the studio builds its own public site here. Pick a look, add photos and text, publish.
 * Every change is saved as a draft straight away; visitors see it only after Publish.
 */
import { shrink } from "@/lib/shrink-photo";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Scale, AlertTriangle, BarChart3, BookOpen, Check, HelpCircle, Link2, MessageSquareQuote, Settings2, Share2, ChevronDown, ChevronUp, Clapperboard, Copy, Crop, ExternalLink, Eye, Globe, Home, ImagePlus, Images, LayoutGrid, Loader2, Monitor, Users, ArrowUp, ArrowDown, Package, Palette, Phone, Plus, Search, Smartphone, Trash2, TrendingUp, Undo2, Upload, X, Download, EyeOff } from "lucide-react";
import "./website.css";
import { SITE_SUBDOMAINS, siteUrl } from "@/lib/site-url";
import { DomainGuide } from "./domain-guide";
import { SeoTab } from "./seo-tab";
import { TrackingTab } from "./tracking-tab";
import { VisitorsTab } from "./visitors-tab";
import { StylePanel } from "./style-panel";
import { PackagesTab } from "./packages-tab";
import { TeamSheet } from "./team-sheet";
import { FrameModal } from "@/components/site/frame-modal";
import { MemberSitePanel } from "@/components/team/member-site-panel";
import { AutofillAdd, AutofillText } from "@/lib/site-autofill";
import { PageHeader, RowsSkeleton, EmptyState } from "@/components/ui/apple";
import { Field, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { Sec, TabIntro } from "./ed-kit";
import { askConfirm, notify } from "@/components/feedback";
import { API_URL as API, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LEGAL_MAX, standardLegal } from "@/components/site/site-legal";
import { cropStyle, type SiteAlbum, type SiteContent, type SiteCrop, type SiteStory, type SiteTeamMember } from "@/components/site/site-view";

type Photo = { id: string; url: string; thumbUrl?: string | null; width: number; height: number; blur: string; sizeBytes?: number; /** Nothing on the website (draft or published) uses it since then */ unusedSince?: string | null };
const small = (p: Photo) => p.thumbUrl || p.url;

/**
 * The editor in three groups: what is on the pages, how it looks, and the website's settings (address and
 * status now; Google, ads tracking and visitors join Settings later). Each group shows its own tabs.
 */
const TABS = [
  ["home", "Home page", Home], ["about", "About", Users], ["albums", "Albums", Images], ["films", "Films", Clapperboard],
  ["stories", "Stories", BookOpen], ["packages", "Packages", Package], ["more", "Reviews & FAQ", MessageSquareQuote], ["contact", "Contact", Phone], ["legal", "Terms & privacy", Scale],
  ["design", "Look", Palette], ["photos", "All photos", LayoutGrid], ["visitors", "Visitors", TrendingUp],
  ["address", "Address & domain", Link2], ["seo", "Google & sharing", Search], ["tracking", "Ads & analytics", BarChart3],
] as const;
type Tab = (typeof TABS)[number][0];
const GROUPS: { id: string; name: string; icon: typeof Home; tabs: Tab[] }[] = [
  { id: "pages", name: "Pages", icon: LayoutGrid, tabs: ["home", "about", "albums", "films", "stories", "packages", "more", "contact", "legal"] },
  { id: "look", name: "Look & photos", icon: Palette, tabs: ["design", "photos"] },
  { id: "visitors", name: "Visitors", icon: TrendingUp, tabs: ["visitors"] },
  { id: "settings", name: "Settings", icon: Settings2, tabs: ["address", "seo", "tracking"] },
];
const groupOf = (t: Tab) => GROUPS.find(g => g.tabs.includes(t)) ?? GROUPS[0];
/** Shape of each place a photo goes (width / height), so the framing window matches the website. */
const RATIO = { hero0: 3 / 2, hero1: 3 / 3.6, about: 4 / 4.6, film: 16 / 9, story: 4 / 3, album: 3 / 4 };
type Mine = {
  slug: string; theme: string; content: SiteContent; isPublished: boolean; publishedAt: string | null; hasChanges: boolean;
  photos: Photo[]; photoLimit: number; /** Unused photos are removed for good after this many days */ unusedDays?: number; studio: { name: string; logoUrl: string | null };
  /** Visitors can't see the website now: StuPanel took it offline, the studio is closed, or the plan is unpaid. */
  offline?: "admin" | "closed" | "unpaid" | "plan" | null; offlineNote?: string | null;
  /** Days an old address keeps sending visitors to the new one after a change. */
  renameHoldDays?: number;
  /** Own Google titles, share picture and codes are part of the plan (switch "website_seo") */
  seoAllowed?: boolean;
  /** Facebook Pixel / Google Analytics are part of the plan (switch "website_tracking") */
  trackingAllowed?: boolean;
  /** Own fonts / colours / buttons are part of the plan (switch "website_style") */
  styleAllowed?: boolean;
  /** The studio's own domain (pending until its DNS records work, then live). */
  customDomain?: string | null; customDomainState?: "pending" | "live" | null;
  /** The studio's Team for Website → Team: who is shown, with their own name, title and photo */
  people?: { id: string; memberId: string | null; name: string; title: string; photo: string | null; crop?: SiteCrop | null; show: boolean }[];
};

const THEMES: { id: string; name: string; note: string; colors: [string, string, string] }[] = [
  /** New websites start with this one (Faisal 23-NOV-2026). */
  { id: "gold", name: "Classic Gold", note: "Emerald and gold · the default", colors: ["#FAF6EE", "#B8964A", "#0F3D36"] },
  { id: "signature", name: "Signature", note: "Peach and gold, decorative", colors: ["#FEF1E4", "#D4A843", "#2A211B"] },
  { id: "editorial", name: "Editorial White", note: "Clean black and white", colors: ["#FFFFFF", "#151515", "#F4F2EE"] },
  { id: "cream", name: "Soft Cream", note: "Sage green, round arches", colors: ["#FBF7F1", "#5E6F5A", "#F4E7DF"] },
  { id: "dark", name: "Cinematic Dark", note: "Navy and champagne", colors: ["#0B1320", "#E6C58F", "#111C2E"] },
  { id: "mono", name: "Gallery White", note: "Full-screen photo, plain type", colors: ["#FFFFFF", "#1A1A1A", "#ECECEA"] },
];
const areaCls = inputCls.replace("h-11", "min-h-[96px] py-2.5 leading-relaxed");
const newId = () => Math.random().toString(36).slice(2, 10);
/** The video id of a YouTube link (watch, share, shorts or embed address). */
/** No own cover: pick YouTube's cover or one of three moments from the film (about ¼, ½, ¾ in). */
function FramePick({ vid, value, onPick, name, onAdjust, crop }: { vid: string; value: number; onPick: (n: number) => void; name: string; onAdjust: () => void; crop?: SiteCrop }) {
  const opts = [{ n: 0, label: "Cover" }, { n: 1, label: "Moment 1" }, { n: 2, label: "Moment 2" }, { n: 3, label: "Moment 3" }];
  return (
    <div role="group" aria-label={`Picture from ${name}`}>
      <p className="text-[12.5px] font-semibold text-[#4A4658] mb-1.5">No cover photo? Pick a picture from the film</p>
      <div className="grid grid-cols-4 gap-1.5 max-w-[420px]">
        {opts.map(o => {
          const on = value === o.n;
          return (
            <button key={o.n} type="button" aria-pressed={on} onClick={() => onPick(o.n)} aria-label={`${o.label} of ${name}`}
              className={`relative rounded-[9px] overflow-hidden border-2 transition-colors ${on ? "border-[#7D5CEF]" : "border-transparent hover:border-[#C9C3DA]"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${vid}/${o.n ? `mq${o.n}` : "mqdefault"}.jpg`} alt="" className="block w-full aspect-video object-cover" loading="lazy" style={on ? cropStyle(crop) : undefined} />
              <span className={`absolute inset-x-0 bottom-0 text-[10.5px] font-semibold py-0.5 text-center ${on ? "bg-[#7D5CEF] text-white" : "bg-black/55 text-white"}`}>{o.label}</span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onAdjust} className="mt-1.5 h-8 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[12px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5"><Crop className="w-3.5 h-3.5" />Adjust this picture</button>
    </div>
  );
}

/** A picture from a YouTube film, as a Photo the Adjust window can open (1280 × 720). */
const ytPhoto = (vid: string, n: number): Photo => ({ id: `yt-${vid}-${n}`, url: `https://i.ytimg.com/vi/${vid}/maxres${n || "default"}.jpg`, width: 1280, height: 720, blur: "" });

const ytId = (v: string) => /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/.exec(v || "")?.[1] ?? null;

/** Website → Settings → Your own domain. */
type DomainInfo = {
  allowed: boolean; ready: boolean; domain: string | null; main?: string; twin?: string | null; state: "pending" | "live" | null;
  error?: string | null; checkedAt?: string | null;
  records: { type: "A" | "CNAME" | "TXT"; name: string; value: string; why: string }[];
  parts?: { name: string; ok: boolean }[];
};

export default function WebsitePage() {
  const [site, setSite] = useState<Mine | null>(null);
  /** Website → Team: a member's website settings open; picking who from the Team to show */
  const [memberEdit, setMemberEdit] = useState<string | null>(null);
  const [teamPick, setTeamPick] = useState(false);
  const [state, setState] = useState<"load" | "ok" | "denied" | "error">("load");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [slug, setSlug] = useState("");
  const [slugNote, setSlugNote] = useState<{ ok: boolean; message: string } | null>(null);
  /** The address can only be typed in after "Change address" (no change by a slip). */
  const [editSlug, setEditSlug] = useState(false);
  /** Changing the address of a website that was ever published: warning, then a code from the owner's email. */
  const [addrStep, setAddrStep] = useState<null | "warn" | "code">(null);
  const [addrCode, setAddrCode] = useState("");
  const [addrTo, setAddrTo] = useState("");
  const [addrOk, setAddrOk] = useState(false);
  const [pick, setPick] = useState<{ title: string; multi: boolean; max: number; value: string[]; done: (ids: string[]) => void; first?: string[] } | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  /** Phone preview on the right (computers); the choice is remembered on this browser. */
  const [showPhone, setShowPhone] = useState(true);
  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem("site-ed-phone"); } catch { /* storage off */ }
    if (v !== "off") return;
    const id = setTimeout(() => setShowPhone(false), 0);
    return () => clearTimeout(id);
  }, []);
  const togglePhone = (on: boolean) => { setShowPhone(on); try { localStorage.setItem("site-ed-phone", on ? "on" : "off"); } catch { /* storage off */ } };
  const [allPhotos, setAllPhotos] = useState(false);
  /** Time the page opened, for "days left" on unused photos. */
  const [openedAt] = useState(() => Date.now());
  const [frame, setFrame] = useState<{ key: string; photo: Photo; title: string; ratio: number; round?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ theme?: string; content?: SiteContent }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  /** The phone preview: gets every change at once (no reload, no wait for the save). */
  const frameRef = useRef<HTMLIFrameElement>(null);

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

  // Undo: the draft as it was before each change made in this visit (typing in one box counts as one change).
  const past = useRef<{ content: SiteContent; theme: string }[]>([]);
  const lastChange = useRef<{ key: string; t: ReturnType<typeof setTimeout> | null }>({ key: "", t: null });
  const [undoable, setUndoable] = useState(0);
  // The newest site state. Changes made from a picker that stayed open while photos were uploading must
  // build on this, not on the copy the picker saw when it opened (that copy did not have the new photos).
  const live = useRef<Mine | null>(null);
  useLayoutEffect(() => { live.current = site; });
  const put = (next: Mine) => { live.current = next; setSite(next); };
  /** A member shown or hidden (saved at once on their profile): keep the list and the preview in step. */
  const setPeopleShow = (id: string, show: boolean) => {
    const s = live.current;
    if (s) put({ ...s, people: (s.people ?? []).map(p => (p.id === id ? { ...p, show } : p)) });
  };
  const reloadPreview = () => {
    // Their name, title or photo may have changed: read the team again.
    apiFetch(`${API}/site`).then(r => (r.ok ? r.json() : null)).then((d: Mine | null) => {
      const s = live.current;
      if (d?.people && s) put({ ...s, people: d.people });
    }).catch(() => {});
  };
  // A member's settings save by themselves while their sheet is open: read the team again shortly after.
  const peopleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peopleChanged = (id: string, show: boolean) => {
    setPeopleShow(id, show);
    if (peopleTimer.current) clearTimeout(peopleTimer.current);
    peopleTimer.current = setTimeout(reloadPreview, 500);
  };
  const [showBusy, setShowBusy] = useState<string | null>(null);
  /** Show or hide a member of the Team (saved at once, like in their profile). */
  const showMember = async (id: string, show: boolean) => {
    if (showBusy) return;
    setShowBusy(id);
    try {
      const r = await apiFetch(`${API}/site/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ show }) });
      if (!r.ok) { notify(show ? "Couldn't show them" : "Couldn't hide them", { error: true }); return; }
      setPeopleShow(id, show);
      // The last one picked: nothing left to choose from.
      if (show && !(live.current?.people ?? []).some(p => !p.show)) setTeamPick(false);
      notify(show ? "Shown on the website" : "Hidden from the website");
    } finally { setShowBusy(null); }
  };
  const remember = (key: string, typing = false) => {
    const site = live.current;
    if (!site) return;
    const last = lastChange.current;
    const same = typing && last.key === key && last.t !== null;
    if (last.t) clearTimeout(last.t);
    last.key = key;
    last.t = setTimeout(() => { last.t = null; }, 1500);
    if (same) return;
    past.current = [...past.current.slice(-49), { content: site.content, theme: site.theme }];
    setUndoable(past.current.length);
  };
  const undo = () => {
    const prev = past.current.pop();
    const site = live.current;
    if (!site || !prev) return;
    lastChange.current.key = "";
    setUndoable(past.current.length);
    put({ ...site, content: prev.content, theme: prev.theme, hasChanges: true });
    queue({ content: prev.content, theme: prev.theme });
  };
  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    if (!live.current) return;
    remember(key, typeof value === "string");
    const site = live.current;
    const content = { ...site.content, [key]: value };
    put({ ...site, content, hasChanges: true });
    queue({ content });
  };
  /** Several fields in one save (two set() calls in a row would lose the first). */
  const setMany = (patch: Partial<SiteContent>) => {
    if (!live.current) return;
    remember(Object.keys(patch).join());
    const site = live.current;
    const content = { ...site.content, ...patch };
    put({ ...site, content, hasChanges: true });
    queue({ content });
  };
  // Send the draft to the phone preview as it changes; the preview asks for it when it (re)loads.
  const draftMsg = useCallback(() => {
    const st = live.current;
    if (!st) return null;
    const photos: Record<string, { url: string; sm: string | null; w: number; h: number; blur?: string }> = {};
    for (const p of st.photos) photos[p.id] = { url: p.url, sm: p.thumbUrl ?? null, w: p.width, h: p.height, blur: p.blur };
    // The team as the site shows it: members with their own name, title and photo (as the server does).
    const people = st.people ?? [];
    const shown = people.filter(p => p.show);
    const placed = new Set((st.content.team ?? []).map(r => r.userId).filter(Boolean));
    const crop: Record<string, SiteCrop> = { ...(st.content.crop ?? {}) };
    const asMember = (id: string, p: (typeof people)[number]): SiteTeamMember => {
      if (p.photo) photos[`u:${p.id}`] = { url: p.photo, sm: p.photo, w: 600, h: 600 };
      if (p.crop) crop[`team:${id}`] = p.crop;
      return { id, userId: p.id, memberId: p.memberId ?? undefined, name: p.name, role: p.title, photo: p.photo ? `u:${p.id}` : null };
    };
    const team: SiteTeamMember[] = [
      ...(st.content.team ?? []).flatMap(r => {
        if (!r.userId) return r.name ? [r] : [];
        const p = shown.find(x => x.id === r.userId);
        return p ? [asMember(r.id, p)] : [];
      }),
      ...shown.filter(p => !placed.has(p.id)).map(p => asMember(`m${p.id.replace(/-/g, "").slice(0, 20)}`, p)),
    ];
    return { type: "sg-draft", theme: st.theme, content: { ...st.content, team, crop }, photos, styleOk: st.styleAllowed !== false };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { const m = draftMsg(); if (m) frameRef.current?.contentWindow?.postMessage(m, window.location.origin); }, 60);
    return () => clearTimeout(t);
  }, [site?.content, site?.theme, site?.photos, site?.people, draftMsg]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "sg-ready" || e.source !== frameRef.current?.contentWindow) return;
      const m = draftMsg(); if (m) frameRef.current?.contentWindow?.postMessage(m, window.location.origin);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [draftMsg]);
  const setTheme = (theme: string) => { if (!live.current) return; remember("theme:" + theme); put({ ...live.current, theme, hasChanges: true }); queue({ theme }); };

  // Address: checked while typing, saved when it is free.
  useEffect(() => {
    if (!site || slug === site.slug) return;
    const t = setTimeout(async () => {
      const res = await apiFetch(`${API}/site/slug-check?slug=${encodeURIComponent(slug)}`);
      if (res.ok) setSlugNote(await res.json());
    }, 400);
    return () => clearTimeout(t);
  }, [slug, site]);
  const saveSlug = async (code?: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/site`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, code }) });
      const d = await res.json();
      if (!res.ok) return notify(Array.isArray(d.message) ? d.message[0] : d.message || "Could not change the address", { error: true });
      setSite(s => (s ? { ...s, slug: d.slug } : d)); setSlug(d.slug); setEditSlug(false); setAddrStep(null); setAddrCode(""); notify("Address changed");
    } finally { setBusy(false); }
  };
  /** Ever published → warning and email code first; never published → change at once. */
  const startSlugChange = () => {
    if (!site?.publishedAt) return void saveSlug();
    setAddrOk(false); setAddrCode(""); setAddrStep("warn");
  };
  // ── Own domain ──
  const [dom, setDom] = useState<DomainInfo | null>(null);
  const [domInput, setDomInput] = useState("");
  const [domBusy, setDomBusy] = useState<"" | "connect" | "check" | "code" | "remove">("");
  const [domStep, setDomStep] = useState<null | "warn" | "code">(null);
  const [domCode, setDomCode] = useState("");
  const [domTo, setDomTo] = useState("");
  const domCall = useCallback(async (path: string, body?: unknown, kind: typeof domBusy = "check") => {
    setDomBusy(kind);
    try {
      const res = await apiFetch(`${API}/site/domain${path}`, body === undefined && !path ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Something went wrong", { error: true }); return null; }
      return d;
    } finally { setDomBusy(""); }
  }, []);
  useEffect(() => {
    if (tab !== "address" || dom) return;
    const id = setTimeout(async () => { const d = await domCall(""); if (d) setDom(d); }, 0);
    return () => clearTimeout(id);
  }, [tab, dom, domCall]);
  const connectDomain = async () => {
    const d = await domCall("", { domain: domInput }, "connect");
    if (d) { setDom(d); setDomInput(""); setSite(s => (s ? { ...s, customDomain: d.domain, customDomainState: d.state } : s)); notify("Domain added — now add the records below"); }
  };
  const checkDomain = async () => {
    const d = await domCall("/check", {}, "check");
    if (d) { setDom(d); setSite(s => (s ? { ...s, customDomainState: d.state } : s)); notify(d.state === "live" ? "Your domain works" : "Not ready yet"); }
  };
  const sendDomainCode = async () => {
    const d = await domCall("/code", {}, "code");
    if (d) { setDomTo(d.to); setDomStep("code"); notify("Code sent"); }
  };
  const removeDomain = async () => {
    const d = await domCall("/remove", { code: domCode }, "remove");
    if (d) { setDom(d); setDomStep(null); setDomCode(""); setSite(s => (s ? { ...s, customDomain: null, customDomainState: null } : s)); notify("Domain disconnected"); }
  };

  const sendAddrCode = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/site/address-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await res.json();
      if (!res.ok) return notify(Array.isArray(d.message) ? d.message[0] : d.message || "Could not send the code", { error: true });
      setAddrTo(d.to); setAddrStep("code"); notify("Code sent");
    } finally { setBusy(false); }
  };

  /** Throw away everything changed since the last publish. */
  const discard = async () => {
    if (!site) return;
    if (!(await askConfirm({ title: "Go back to the published version?", message: "Every change you made since you last published will be removed. Your uploaded photos stay in All photos.", confirmLabel: "Remove my changes" }))) return;
    setBusy(true);
    try {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      await flush();
      const res = await apiFetch(`${API}/site/revert`, { method: "POST" });
      if (!res.ok) throw new Error();
      setSite((await res.json()) as Mine);
      past.current = []; setUndoable(0);
      notify("Back to the published version");
    } catch { notify("That did not work. Try again.", { error: true }); } finally { setBusy(false); }
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
      if (on) { past.current = []; setUndoable(0); }
      notify(on ? "Published. Visitors now see this version." : "The website is offline");
    } catch { notify("That did not work. Try again.", { error: true }); } finally { setBusy(false); }
  };

  /** Remove, for good, every photo the website does not use. */
  const cleanup = async (count: number, mb: string) => {
    if (!(await askConfirm({ title: `Remove ${count} unused photo${count > 1 ? "s" : ""}?`, message: `They are not used anywhere on your website, neither in your changes nor in the published version. They are deleted for good (${mb}). This cannot be undone.`, confirmLabel: "Remove for good", danger: true }))) return;
    setBusy(true);
    try {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      await flush();
      const res = await apiFetch(`${API}/site/photos/cleanup`, { method: "POST" });
      if (!res.ok) throw new Error();
      put((await res.json()) as Mine);
      past.current = []; setUndoable(0); // the removed photos cannot come back
      notify("Unused photos removed");
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
        if (live.current) put({ ...live.current, photos: [p, ...live.current.photos] });
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
  const url = site.customDomain && site.customDomainState === "live" ? `https://${site.customDomain}` : siteUrl(site.slug, "", origin);
  const choose = (title: string, value: string[], done: (ids: string[]) => void, multi = false, max = 1, first?: string[]) => setPick({ title, multi, max, value, done, first });
  const setAlbum = (i: number, patch: Partial<SiteAlbum>) => set("albums", c.albums.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const status = !site.isPublished ? "Not published yet" : site.hasChanges ? "Published, with changes not yet published" : "Published";

  const ph = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
  // Website → Team: the studio's order; members shown in their profile but not placed yet come at the end.
  const people = site.people ?? [];
  const shownIds = new Set(people.filter(p => p.show).map(p => p.id));
  const placedIds = new Set((c.team ?? []).map(r => r.userId).filter(Boolean));
  const teamRows: SiteTeamMember[] = [
    ...(c.team ?? []).filter(r => !r.userId || shownIds.has(r.userId)),
    ...people.filter(p => p.show && !placedIds.has(p.id)).map(p => ({ id: `m${p.id.replace(/-/g, "").slice(0, 20)}`, name: "", role: "", photo: null, userId: p.id })),
  ];
  function setRows(next: SiteTeamMember[]) { set("team", next.map(r => (r.userId ? { id: r.id, name: "", role: "", photo: null, userId: r.userId } : r))); }
  const crops = c.crop ?? {};
  /** Gallery White: the photos of its full-screen slideshow. */
  const slides = (c.slides ?? []).filter(id => byId.has(id));
  const mono = site.theme === "mono";
  // Photos the website does not use: the server knows the published side (unusedSince), the draft is checked here.
  const draftJson = JSON.stringify(c);
  const unusedList = site.photos.filter(p => p.unusedSince && !draftJson.includes(`"${p.id}"`));
  const unusedIds = new Set(unusedList.map(p => p.id));
  const unusedDays = site.unusedDays ?? 30;
  const unusedMb = `${(unusedList.reduce((n, p) => n + (p.sizeBytes ?? 0) * 1.35, 0) / 1048576).toFixed(1)} MB`;
  const daysLeft = (p: Photo) => {
    // A photo added after the page opened has a later date than openedAt: never count more than the full period.
    const gone = Math.max(0, Math.floor((openedAt - new Date(p.unusedSince!).getTime()) / 86_400_000));
    const left = Math.min(unusedDays, unusedDays - gone);
    return left <= 1 ? "removed soon" : `${left} days left`;
  };
  /** Tall photos for the main photo on phones (first five looks). */
  /** Computer photos of the first screen: the main photo, then the others (Gallery White: its slideshow). */
  const deskIds = (mono ? slides : [c.heroPhotos[0], ...slides]).filter((id, k, all): id is string => !!id && byId.has(id) && all.indexOf(id) === k);
  const phoneSlides = (c.mobileSlides ?? []).filter(id => byId.has(id));
  /** Open the framing window for the photo in one place (hero0, about, album:<id>…). */
  const adjust = (key: string, id: string | null | undefined, title: string, ratio: number, round?: boolean) => { const photo = ph(id); if (photo) setFrame({ key, photo, title, ratio, round }); };
  /** Adjust a picture from a film (no own cover); a new choice of picture starts without the old adjustment. */
  const adjustYt = (key: string, vid: string, n: number, title: string) => setFrame({ key, photo: ytPhoto(vid, n), title, ratio: RATIO.film });
  const dropCrop = (key: string) => { if (!crops[key]) return; const next = { ...crops }; delete next[key]; set("crop", next); };
  const shownPhotos = allPhotos ? site.photos : site.photos.slice(0, 11);

  return (
    <div className="xl:flex xl:gap-6 xl:items-start">
    <div className="site-ed flex-1 min-w-0">
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
      {site.offline && (
        <div className="mb-4 rounded-[16px] border border-[#F3C9D2] bg-[#FFF1F4] px-4 py-3.5 flex gap-3" role="alert">
          <AlertTriangle className="w-5 h-5 text-[#C2304F] flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-[13px] leading-snug text-[#5A1F2C]">
            <b className="block text-sm">Visitors can&apos;t see your website right now</b>
            {site.offline === "admin" ? <>StuPanel has taken it offline.{site.offlineNote ? ` Note: ${site.offlineNote}` : ""} Please contact StuPanel support.</>
              : site.offline === "unpaid" ? <>Your StuPanel plan has ended. It comes back as soon as the plan is paid.</>
              : site.offline === "plan" ? <>A studio website is not part of your plan. <a href="/billing" className="font-semibold underline">See Plan &amp; billing</a> to change the plan.</>
              : <>Your studio is closed. It comes back if the studio is opened again.</>}
          </div>
        </div>
      )}
      <div className="sticky top-3 z-20 mb-5">
        <div className="ed-tabs sp-card bg-white rounded-[18px] p-1.5">
          <div role="tablist" aria-label="Website sections" className="grid grid-cols-4 gap-1">
            {GROUPS.map(g => {
              const on = groupOf(tab).id === g.id;
              return (
                <button key={g.id} type="button" role="tab" aria-selected={on} onClick={() => { if (!on) { setTab(g.tabs[0]); window.scrollTo({ top: 0 }); } }}
                  className={cn("h-10 px-2 rounded-[13px] text-[13px] font-semibold transition-all inline-flex items-center justify-center gap-1.5 min-w-0",
                    on ? "bg-[#7D5CEF] text-white shadow-[0_6px_16px_-6px_rgba(125,92,239,.8)]" : "text-[#4A4658] hover:bg-[#F1EEF8]")}>
                  <g.icon className="w-4 h-4 flex-shrink-0 hidden sm:block" aria-hidden="true" /><span className="truncate">{g.name}</span>
                </button>
              );
            })}
          </div>
          {groupOf(tab).tabs.length > 1 && (
            <div role="tablist" aria-label={groupOf(tab).name} className="flex gap-1 overflow-x-auto mt-1.5 pt-1.5 border-t border-[#EEEBF4]">
              {TABS.filter(([id]) => groupOf(tab).tabs.includes(id)).map(([id, name, Icon]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}
                  className={cn("h-9 px-3 rounded-[11px] text-[13px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 inline-flex items-center gap-1.5",
                    tab === id ? "bg-[#F1EEF8] text-[#5B3FD0]" : "text-[#6B6680] hover:bg-[#F7F5FB]")}>
                  <Icon className="w-4 h-4" aria-hidden="true" />{name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div hidden={tab !== "address"}>
      <TabIntro icon={Link2} title="Address & domain" text="Your website's link, your own domain and whether it is online." />
      <Sec icon={Link2} tone="blue" where="Your website link" title="Address" help={site.publishedAt ? "Changing it needs a code from the studio owner's email." : "The link works after you publish."}>
        <Field label="Your website link" hint={slugNote && slug !== site.slug ? <span className={slugNote.ok ? "text-[#1F8A4C]" : "text-[#C2304F]"}>{slugNote.message}</span> : editSlug ? "Small letters, numbers and dashes." : undefined}>
          {id => (
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center flex-1 min-w-[220px]">
                {!SITE_SUBDOMAINS && <span className="text-[13px] text-[#6B6680] mr-1.5 hidden sm:inline">{origin.replace(/^https?:\/\//, "")}/site/</span>}
                <input id={id} className={cn(inputCls, !editSlug && "bg-[#F7F5FB] text-[#4A4658]")} value={slug} maxLength={40} autoCapitalize="none" spellCheck={false}
                  readOnly={!editSlug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                {SITE_SUBDOMAINS && <span className="text-[13px] text-[#6B6680] ml-1.5 hidden sm:inline">.stupanel.com</span>}
              </div>
              {editSlug
                ? <>
                  <button type="button" disabled={busy || slug === site.slug || !slugNote?.ok} onClick={startSlugChange} className="h-11 px-4 rounded-[12px] bg-[#17151F] disabled:opacity-40 text-white text-sm font-semibold">Use this address</button>
                  <button type="button" onClick={() => { setSlug(site.slug); setSlugNote(null); setEditSlug(false); }} className="h-11 px-3.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold">Cancel</button>
                </>
                : <>
                  <button type="button" onClick={() => setEditSlug(true)} className="h-11 px-3.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold">Change address</button>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(url); notify("Link copied"); }} className="h-11 px-3.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold inline-flex items-center gap-1.5"><Copy className="w-4 h-4" />Copy</button>
                  {site.isPublished && <a href={url} target="_blank" rel="noopener noreferrer" className="h-11 px-3.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold inline-flex items-center gap-1.5"><ExternalLink className="w-4 h-4" />Open</a>}
                </>}
            </div>
          )}
        </Field>
      </Sec>
      <Sec icon={Globe} tone="blue" where="Your own domain" title="Your own domain" help={dom?.domain ? undefined : "Have a domain like pickphoto.com? Connect it and your website opens there. Your stupanel.com address keeps working and sends visitors to it."}>
        {!dom ? <div className="px-4 py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#9A94AE]" /></div>
          : !dom.allowed ? <p className="px-4 py-3.5 text-[13px] text-[#6B6680]">Your plan doesn&apos;t include your own domain.</p>
          : !dom.domain ? (
            <Field label="Your domain" hint="Buy it from a domain company (Namecheap, GoDaddy, a .com.bd seller…) first. Type it without https://">
              {id => (
                <div className="flex gap-2 flex-wrap">
                  <input id={id} className={cn(inputCls, "flex-1 min-w-[220px]")} value={domInput} placeholder="pickphoto.com" autoCapitalize="none" spellCheck={false} inputMode="url"
                    onChange={e => setDomInput(e.target.value.trim().toLowerCase())} onKeyDown={e => { if (e.key === "Enter" && domInput) void connectDomain(); }} />
                  <button type="button" disabled={!domInput || !!domBusy} onClick={connectDomain} className="h-11 px-4 rounded-[12px] bg-[#17151F] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-2">{domBusy === "connect" && <Loader2 className="w-4 h-4 animate-spin" />}Connect</button>
                </div>
              )}
            </Field>
          ) : (
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[15px] text-[#17151F] break-all">{dom.domain}</span>
                {dom.state === "live"
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E7F6EC] text-[#1F8A4C]"><Check className="w-3.5 h-3.5" />Working</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FFF4E5] text-[#B45309]"><Loader2 className="w-3.5 h-3.5" />Waiting for the records</span>}
                {dom.state === "live" && <a href={`https://${dom.domain}`} target="_blank" rel="noopener noreferrer" className="ml-auto h-9 px-3 rounded-[10px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold inline-flex items-center gap-1.5"><ExternalLink className="w-4 h-4" />Open</a>}
              </div>
              {dom.state === "live"
                ? <p className="text-[13px] text-[#4A4658] mt-1.5">Your website opens at <b>{dom.domain}</b>{dom.twin ? <> (and <b>{dom.twin}</b>)</> : null}. {site.slug}.stupanel.com sends visitors there. Keep the records at your domain company as they are.</p>
                : <DomainGuide dom={{ ...dom, domain: dom.domain }} studioName={site.studio.name} address={url.replace(/^https?:\/\//, "")} busy={domBusy === "check"} onCheck={checkDomain} />}
              <div className="mt-3 flex gap-2 flex-wrap">
                <button type="button" disabled={!!domBusy} onClick={() => { setDomCode(""); setDomStep("warn"); }} className="h-10 px-4 rounded-full border border-[#F3C9D2] text-[13px] font-semibold text-[#C2304F] hover:bg-[#FFF1F4] disabled:opacity-50">Disconnect domain</button>
              </div>
            </div>
          )}
      </Sec>
      <Sec icon={Eye} tone="slate" where="Who can see it" title="Status">
        <div className="px-4 py-3.5 flex flex-wrap items-center gap-3">
          <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", site.offline ? "text-[#C2304F]" : site.isPublished ? "text-[#1F8A4C]" : "text-[#6B6680]")}>
            <span className={cn("w-2.5 h-2.5 rounded-full", site.offline ? "bg-[#C2304F]" : site.isPublished ? "bg-[#1F8A4C]" : "bg-[#C9C3DA]")} aria-hidden="true" />
            {site.offline ? "Offline — visitors can't see it" : site.isPublished ? "Online" : "Not published yet"}
          </span>
          <span className="text-[13px] text-[#6B6680] flex-1 basis-[200px]">{site.isPublished && site.publishedAt ? `Last published ${new Date(site.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "Publish when you are ready. Bookings from the website go to your Leads."}</span>
          {site.isPublished && (
            <button type="button" disabled={busy} onClick={() => publish(false)} className="h-10 px-4 rounded-full border border-[#F3C9D2] text-[13px] font-semibold text-[#C2304F] hover:bg-[#FFF1F4] disabled:opacity-50">Take the website offline</button>
          )}
        </div>
      </Sec>
      </div>

      <div hidden={tab !== "seo"}>
        <SeoTab content={c} studio={site.studio} url={url} allowed={site.seoAllowed !== false} photo={ph}
          onChange={seo => set("seo", seo)}
          onChoosePicture={() => choose("Share picture (wide works best)", c.seo?.image ? [c.seo.image] : [], ids => set("seo", { ...(c.seo ?? { title: "", description: "", image: null, pages: {}, google: "", bing: "", hidden: false }), image: ids[0] ?? null }))} />
      </div>

      <div hidden={tab !== "visitors"}>
        <VisitorsTab active={tab === "visitors"} published={site.isPublished} albums={c.albums} stories={c.stories ?? []} />
      </div>

      <div hidden={tab !== "tracking"}>
        <TrackingTab content={c} allowed={site.trackingAllowed !== false} onChange={t => set("tracking", t)} />
      </div>

      <div hidden={tab !== "design"}>
      <TabIntro icon={Palette} title="Look" text="Choose one of the six looks, then make it yours with fonts and colours." />
      <Sec icon={Palette} tone="violet" where="Every page" title="Look" help="All six have the same sections. You can change the look any time; your text and photos stay.">
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
      </Sec>
      <StylePanel value={c.style} allowed={site.styleAllowed !== false} onChange={v => set("style", v)} />
      </div>

      <div hidden={tab !== "photos"}>
      <TabIntro icon={Images} title="All photos" text="Every photo on your website. Add photos here or right where you use them." />
      <Sec icon={Images} tone="teal" where="Photo library" title={`Photos (${site.photos.length} of ${site.photoLimit})`} help="Every photo on your website is kept here. You can also add a photo right where you use it. Use only photos you have the right to show.">
        <div className="p-3">
          {unusedList.length > 0 && (
            <div className="mb-3 rounded-[14px] bg-[#FFF7E8] border border-[#F3E1B8] px-3.5 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="flex-1 basis-[240px] text-[13px] leading-snug text-[#5A4A22]">
                <b>{unusedList.length} photo{unusedList.length > 1 ? "s are" : " is"} not used</b> anywhere on your website ({unusedMb}). Photos nobody uses are removed for good after {unusedDays} days, to save space.
              </p>
              <button type="button" disabled={busy} onClick={() => cleanup(unusedList.length, unusedMb)} className="h-10 px-4 rounded-full bg-white border border-[#E8D7AE] hover:bg-[#FFF1D6] disabled:opacity-50 text-[13px] font-semibold text-[#5A4A22] inline-flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Remove them now</button>
            </div>
          )}
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
                {unusedIds.has(p.id) && <span className="absolute left-1 bottom-1 right-1 px-1.5 py-1 rounded-[8px] bg-black/65 text-white text-[10px] leading-tight font-semibold text-center">Not used<br />{daysLeft(p)}</span>}
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
      </Sec>
      </div>

      <div hidden={tab !== "home"}>
      <TabIntro icon={Home} title="Home page" text="The first screen visitors see: your words and the main photos. Changes show in the phone preview at once." />
      <Sec icon={Home} tone="violet" where="Home, first screen" title="Top of the page">
        <Field label="Small handwritten line" action={<AutofillText field="home.script" value={c.script} onFill={v => set("script", v)} ctx={{ events: c.events }} />}>{id => <input id={id} className={inputCls} value={c.script} maxLength={40} onChange={e => set("script", e.target.value)} />}</Field>
        <Field label="Big headline" hint="Two or three words look best." action={<AutofillText field="home.headline" value={c.headline} onFill={v => set("headline", v)} ctx={{ events: c.events }} />}>{id => <input id={id} className={inputCls} value={c.headline} maxLength={60} onChange={e => set("headline", e.target.value)} />}</Field>
        <Field label="Line under the headline" hint="For example: Photography and films, Feni" action={<AutofillText field="home.kicker" value={c.kicker} onFill={v => set("kicker", v)} ctx={{ events: c.events }} />}>{id => <input id={id} className={inputCls} value={c.kicker} maxLength={80} onChange={e => set("kicker", e.target.value)} />}</Field>
        <Field label="Short introduction" action={<AutofillText field="home.intro" value={c.intro} onFill={v => set("intro", v)} ctx={{ events: c.events }} />}>{id => <textarea id={id} className={areaCls} value={c.intro} maxLength={300} onChange={e => set("intro", e.target.value)} />}</Field>
        <SwitchRow label="Show my logo image at the top" hint="Off: your studio name is written in the website's own lettering, which suits most logos better." on={!!c.showLogo} onChange={v => set("showLogo", v)} />
        <div className="px-4 py-3.5">
          <div className="text-sm font-semibold text-[#1F1B2E]">First screen photos</div>
          <p className="text-[13px] text-[#6B6680] mt-0.5">{mono ? "Gallery White fills the first screen with these, one after another." : "Computers and phones each have their own photos, because one frame is wide and the other is tall. With more than one photo they change by themselves, one after another."}</p>
          <div className={cn("grid gap-3 mt-3", !mono && "lg:grid-cols-2")}>
            <ScreenPhotos icon={<Monitor className="w-4 h-4" />} title={mono ? "Home screen photos" : "Computer"} shape={mono ? "Wide photos, across the whole screen" : "Wide photos, 3:2 frame"} ratio={mono ? 16 / 9 : RATIO.hero0}
              photos={deskIds.map(id => byId.get(id)!)} crop={(id, i) => crops[`slide:${id}`] ?? (!mono && i === 0 ? crops.hero0 : undefined)} first={!mono}
              empty={mono ? "Nothing chosen yet, so the site shows your album covers here." : "Nothing chosen yet."}
              onChoose={() => choose(mono ? "Home screen photos (wide)" : "Computer photos (wide)", deskIds, ids => mono ? set("slides", ids) : setMany({ heroPhotos: ids[0] ? [ids[0], ...(c.heroPhotos[1] && c.heroPhotos[1] !== ids[0] ? [c.heroPhotos[1]] : [])] : [], slides: ids.slice(1) }), true, mono ? 8 : 9)}
              onClear={() => mono ? set("slides", []) : setMany({ heroPhotos: [], slides: [] })}
              onAdjust={(id, i) => adjust(`slide:${id}`, id, `${mono ? "Home screen" : "Computer"} photo ${i + 1}`, mono ? 16 / 9 : RATIO.hero0)}
              onOrder={ids => {
                if (mono) return set("slides", ids);
                // The old main photo's position was kept under "hero0": give it to that photo before it moves.
                const next = { ...crops };
                if (next.hero0 && deskIds[0] && !next[`slide:${deskIds[0]}`]) next[`slide:${deskIds[0]}`] = next.hero0;
                delete next.hero0;
                setMany({ heroPhotos: ids[0] ? [ids[0], ...(c.heroPhotos[1] && c.heroPhotos[1] !== ids[0] ? [c.heroPhotos[1]] : [])] : [], slides: ids.slice(1), crop: next });
              }} />
            {!mono && (
              <ScreenPhotos icon={<Smartphone className="w-4 h-4" />} title="Phone" shape="Tall photos, 4:5 frame" ratio={4 / 5}
                photos={phoneSlides.map(id => byId.get(id)!)} crop={id => crops[`mslide:${id}`]} first
                empty="Nothing chosen yet, so phones show the computer photos cut to the tall frame."
                onChoose={() => choose("Phone photos (tall)", phoneSlides, ids => set("mobileSlides", ids), true, 8)}
                onClear={() => set("mobileSlides", [])}
                onAdjust={(id, i) => adjust(`mslide:${id}`, id, `Phone photo ${i + 1}`, 4 / 5)}
                onOrder={ids => set("mobileSlides", ids)} />
            )}
          </div>
        </div>
        <Field label="Moving words" hint="The events you cover, with a comma between them."
          action={<AutofillText field="home.events" value={c.events.join(", ")} onFill={v => set("events", v.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10))} />}>
          {id => <input id={id} key={c.events.join(",")} className={inputCls} defaultValue={c.events.join(", ")} onBlur={e => set("events", e.target.value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10))} />}
        </Field>
      </Sec>
      </div>

      <div hidden={tab !== "about"}>
      <TabIntro icon={Users} title="About" text="Your studio's story, photo and team, shown on the About page." />
      <Sec icon={Users} tone="amber" where="About page" title="About the studio">
        <Field label="Title" hint="The first word is shown in handwriting." action={<AutofillText field="about.title" value={c.aboutTitle} onFill={v => set("aboutTitle", v)} ctx={{ events: c.events }} />}>{id => <input id={id} className={inputCls} value={c.aboutTitle} maxLength={40} onChange={e => set("aboutTitle", e.target.value)} />}</Field>
        <Field label="Text" action={<AutofillText field="about.text" value={c.aboutText} onFill={v => set("aboutText", v)} ctx={{ events: c.events }} />}>{id => <textarea id={id} className={areaCls.replace("96px", "140px")} value={c.aboutText} maxLength={900} onChange={e => set("aboutText", e.target.value)} />}</Field>
        <div className="px-4 py-3.5"><Slot p={ph(c.aboutPhoto)} crop={crops.about} onAdjust={() => adjust("about", c.aboutPhoto, "About photo", RATIO.about)} label="Photo" onPick={() => choose("About photo (tall)", c.aboutPhoto ? [c.aboutPhoto] : [], ids => set("aboutPhoto", ids[0] ?? null))} onClear={() => set("aboutPhoto", null)} /></div>
      </Sec>
      <Sec icon={Users} tone="amber" where="About page" title="Team" help="Members of your Team come with their own name, title and photo: show or hide them here or in their profile → Website. People who are not in your Team can be added by hand.">
        <SwitchRow label="Open a member's page on click" hint="Off: the team only moves on the About page. On: clicking a member opens their page." on={!!c.teamClick} onChange={v => set("teamClick", v)} />
        <SwitchRow label="QR code for ID cards" hint="Each member gets a QR code for their ID card (their profile → Website). Scanning it opens their page and shows if they still work here." on={!!c.teamQr} onChange={v => set("teamQr", v)} />
        {teamRows.length === 0 && (
          <p className="px-4 py-6 text-center text-[14px] text-[#6B6680]">Nobody is on the website yet. Choose people from your Team, or add someone by hand.</p>
        )}
        {teamRows.map((m, i) => {
            const rows = teamRows;
            const put = (patch: Partial<SiteTeamMember>) => setRows(rows.map((y, k) => (k === i ? { ...y, ...patch } : y)));
            const move = (d: number) => { const next = [...rows]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); setRows(next); };
            const arrows = (
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button type="button" disabled={i === 0} onClick={() => move(-1)} aria-label="Move up" className="w-10 h-10 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] disabled:opacity-30 text-[#6B6680] flex items-center justify-center"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" disabled={i === rows.length - 1} onClick={() => move(1)} aria-label="Move down" className="w-10 h-10 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] disabled:opacity-30 text-[#6B6680] flex items-center justify-center"><ArrowDown className="w-4 h-4" /></button>
              </div>
            );
            if (m.userId) {
              const person = people.find(p => p.id === m.userId);
              if (!person) return null;
              return (
                <div key={m.id} className="px-4 py-3.5 flex gap-3 items-center">
                  <span className="w-[56px] h-[56px] rounded-full overflow-hidden bg-[#EEE8FD] text-[#5B3FD0] font-semibold flex items-center justify-center flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {person.photo ? <img src={person.photo} alt="" className="w-full h-full object-cover" style={person.crop ? { objectPosition: `${person.crop.x}% ${person.crop.y}%`, transformOrigin: `${person.crop.x}% ${person.crop.y}%`, scale: person.crop.z > 1 ? String(person.crop.z) : undefined } : undefined} /> : person.name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#17151F] truncate">{person.name}</p>
                    <p className="text-[13px] text-[#6B6680] truncate">{[person.title, person.memberId].filter(Boolean).join(" · ")}</p>
                    <span className="mt-1 inline-flex h-6 px-2.5 rounded-full bg-[#E7F5EE] text-[#14613F] text-[12px] font-bold items-center">From Team</span>
                  </div>
                  <button type="button" onClick={() => setMemberEdit(person.id)} className="h-10 px-3.5 rounded-[12px] bg-[#EEE8FD] hover:bg-[#E4DBFB] text-[14px] font-semibold text-[#5B3FD0] flex-shrink-0">Edit</button>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {arrows}
                    <button type="button" disabled={!!showBusy} onClick={() => showMember(person.id, false)} aria-label={`Hide ${person.name} from the website`} title="Hide from the website"
                      className="w-10 h-10 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center disabled:opacity-50">{showBusy === person.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}</button>
                  </div>
                </div>
              );
            }
            const p = ph(m.photo);
            const k = crops[`team:${m.id}`];
            return (
              <div key={m.id} className="px-4 py-3.5 flex gap-3 items-start">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <button type="button" onClick={() => (p ? adjust(`team:${m.id}`, m.photo, `${m.name || "Team member"}: photo`, 1, true) : choose("Team member photo", [], ids => put({ photo: ids[0] ?? null })))}
                    aria-label={p ? `Adjust the photo of ${m.name || "this person"}` : "Choose a photo"}
                    className="relative w-[76px] h-[76px] rounded-full overflow-hidden bg-[#F1EEF8] border-2 border-white shadow-[0_0_0_1px_#E4E0EC] text-[#7D5CEF] flex items-center justify-center">
                    {p ? <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={small(p)} alt="" className="w-full h-full object-cover" style={k ? { objectPosition: `${k.x}% ${k.y}%`, transformOrigin: `${k.x}% ${k.y}%`, scale: k.z > 1 ? String(k.z) : undefined } : undefined} />
                      <span className="absolute inset-x-0 bottom-0 h-6 bg-black/55 text-white flex items-center justify-center"><Crop className="w-3 h-3" /></span>
                    </> : <ImagePlus className="w-5 h-5" />}
                  </button>
                  {p && <button type="button" onClick={() => choose("Team member photo", m.photo ? [m.photo] : [], ids => put({ photo: ids[0] ?? null }))} className="text-[12px] font-semibold text-[#7D5CEF] h-7 px-1">Change</button>}
                </div>
                <div className="flex-1 min-w-0 grid gap-2">
                  <input aria-label="Name" className={inputCls} placeholder="Name" value={m.name} maxLength={80} onChange={e => put({ name: e.target.value })} />
                  <input aria-label="What they do" list="team-roles" className={inputCls} placeholder="Photographer, Cinematographer…" value={m.role} maxLength={60} onChange={e => put({ role: e.target.value })} />
                  <span className="inline-flex w-fit h-6 px-2.5 rounded-full bg-[#F1EFF6] text-[#4A4658] text-[12px] font-bold items-center">Added here</span>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {arrows}
                  <button type="button" onClick={() => setRows(rows.filter((_, x) => x !== i))} aria-label={`Remove ${m.name || "this person"}`} className="w-10 h-10 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        <datalist id="team-roles">{["Founder", "Lead photographer", "Photographer", "Cinematographer", "Lead cinematographer", "Video editor", "Photo editor", "Drone pilot", "Studio manager"].map(r => <option key={r} value={r} />)}</datalist>
        <div className="px-4 py-3.5 flex flex-wrap gap-2">
          {(site.people ?? []).some(p => !p.show) && (
            <button type="button" onClick={() => setTeamPick(true)} className="h-11 px-4 rounded-[12px] border border-[#E4E0EC] bg-white text-[14px] font-semibold text-[#3D3950] inline-flex items-center gap-1.5"><Users className="w-4 h-4" />Choose from your team</button>
          )}
          {(c.team ?? []).length < 24 && (
            <button type="button" onClick={() => set("team", [...(c.team ?? []), { id: newId(), name: "", role: "", photo: null }])} className="h-11 px-4 rounded-[12px] bg-[#EEE8FD] text-[14px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add someone not in your team</button>
          )}
          {c.teamQr && (site.people ?? []).length > 0 && (
            <button type="button" onClick={async () => {
              const list = (site.people ?? []).filter(p => p.memberId).map(p => ({ name: p.name, memberId: p.memberId!, link: `${url}/team/${p.memberId}?v=1` }));
              try { const { qrSheet, saveFile } = await import("@/lib/member-qr"); saveFile(await qrSheet(list, site.studio.name), "team-qr-codes.pdf"); } catch { notify("Couldn't make the file", { error: true }); }
            }} className="h-11 px-4 rounded-[12px] border border-[#E4E0EC] bg-white text-[14px] font-semibold text-[#3D3950] inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Everyone&apos;s QR codes (PDF)</button>
          )}
        </div>
      </Sec>
      </div>

      <div hidden={tab !== "albums"}>
      <TabIntro icon={Images} title="Albums" text="Each album is a wedding you covered. Visitors open it and swipe through the photos." />
      <Sec icon={Images} tone="rose" where="Home and Portfolio" title="Albums" help="Each album opens as its own gallery. Tap the cover to pick another photo for it. Six or more albums fill two moving rows.">
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
      </Sec>
      </div>

      <div hidden={tab !== "films"}>
      <TabIntro icon={Clapperboard} title="Films" text="YouTube films. The first one is shown big on Home; all of them are on the Films page." />
      <Sec icon={Clapperboard} tone="blue" where="Home and Films" title="Wedding film" help="Leave the link empty to hide this part.">
        <Field label="YouTube link">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://youtu.be/…" value={c.filmUrl} maxLength={200} onChange={e => set("filmUrl", e.target.value)} />}</Field>
        <Field label="Film name" action={<AutofillText field="film.title" value={c.filmTitle} onFill={v => set("filmTitle", v)} ctx={{ events: c.events }} />}>{id => <input id={id} className={inputCls} placeholder="Tanvir and Nusrat, the wedding film" value={c.filmTitle} maxLength={80} onChange={e => set("filmTitle", e.target.value)} />}</Field>
        <div className="px-4 py-3.5"><Slot p={ph(c.filmPhoto)} crop={crops.film} onAdjust={() => adjust("film", c.filmPhoto, "Film cover", RATIO.film)} label="Cover photo" onPick={() => choose("Film cover (wide)", c.filmPhoto ? [c.filmPhoto] : [], ids => set("filmPhoto", ids[0] ?? null))} onClear={() => set("filmPhoto", null)} /></div>
        {!c.filmPhoto && ytId(c.filmUrl) && <div className="px-4 pb-3.5"><FramePick vid={ytId(c.filmUrl)!} value={c.filmFrame ?? 0} onPick={n => { set("filmFrame", n); dropCrop("filmf"); }} name={c.filmTitle || "the film"} crop={crops.filmf} onAdjust={() => adjustYt("filmf", ytId(c.filmUrl)!, c.filmFrame ?? 0, `Picture of ${c.filmTitle || "the film"}`)} /></div>}
      </Sec>
      </div>

      <div hidden={tab !== "films"}>
      <Sec icon={Clapperboard} tone="blue" where="Films page" title="More films" help="These show on the Films page, under the film above, ten at a time with Load more. Tap the picture to give a film your own cover; without one, pick a picture from the film (its YouTube cover or one of three moments). Up to 60.">
        {(c.films ?? []).map((f, i) => {
          const putFilm = (patch: Partial<NonNullable<SiteContent["films"]>[number]>) => set("films", (c.films ?? []).map((x, k) => (k === i ? { ...x, ...patch } : x)));
          const vid = ytId(f.url);
          const cover = ph(f.cover);
          const name = f.title || `film ${i + 1}`;
          return (
            <div key={i} className="px-4 py-3.5 flex gap-3 items-start">
              <div className="w-[112px] flex-shrink-0">
                <button type="button" onClick={() => choose(`Cover of ${name} (wide)`, f.cover ? [f.cover] : [], ids => putFilm({ cover: ids[0] ?? null }))} aria-label={cover ? `Change the cover of ${name}` : `Choose a cover for ${name}`}
                  className="relative block w-[112px] h-[63px] rounded-[10px] overflow-hidden bg-[#F5F3FA] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] text-[#6B6680]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {cover ? <img src={small(cover)} alt="" className="w-full h-full object-cover" style={cropStyle(vid ? crops[`filmc:${vid}`] : undefined)} />
                    // eslint-disable-next-line @next/next/no-img-element
                    : vid ? <img src={`https://i.ytimg.com/vi/${vid}/${f.frame ? `mq${f.frame}` : "mqdefault"}.jpg`} alt="" className="w-full h-full object-cover opacity-70" style={cropStyle(crops[`filmf:${vid}`])} /> : <ImagePlus className="w-5 h-5 mx-auto" />}
                  {!cover && <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] font-semibold py-0.5 text-center">Add cover</span>}
                </button>
                {cover && (
                  <div className="flex gap-1 mt-1">
                    {vid && <button type="button" onClick={() => adjust(`filmc:${vid}`, f.cover, `Cover of ${name}`, RATIO.film)} className="flex-1 h-7 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[11px] font-semibold text-[#4A4658] inline-flex items-center justify-center gap-1"><Crop className="w-3 h-3" />Adjust</button>}
                    <button type="button" onClick={() => putFilm({ cover: null })} aria-label={`Use YouTube's picture for ${name}`} className="w-7 h-7 rounded-full bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
              <div className="flex-1 grid gap-2 min-w-0">
                <input aria-label="YouTube link" className={inputCls} inputMode="url" placeholder="https://youtu.be/…" value={f.url} maxLength={200} onChange={e => putFilm({ url: e.target.value })} />
                <input aria-label="Film name" className={inputCls} placeholder="Film name" value={f.title} maxLength={80} onChange={e => putFilm({ title: e.target.value })} />
                {!cover && vid && <FramePick vid={vid} value={f.frame ?? 0} onPick={n => { putFilm({ frame: n }); dropCrop(`filmf:${vid}`); }} name={name} crop={crops[`filmf:${vid}`]} onAdjust={() => adjustYt(`filmf:${vid}`, vid, f.frame ?? 0, `Picture of ${name}`)} />}
              </div>
              <button type="button" aria-label="Remove this film" onClick={() => set("films", (c.films ?? []).filter((_, k) => k !== i))} className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#FDECEF] hover:text-[#C2304F] text-[#6B6680] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          );
        })}
        {(c.films ?? []).length < 60 && (
          <button type="button" onClick={() => set("films", [...(c.films ?? []), { url: "", title: "", id: "" }])} className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add a film</button>
        )}
      </Sec>
      </div>

      <div hidden={tab !== "packages"}>
      <TabIntro icon={Package} title="Packages" text="What you sell, each with its own page. Visitors add extras, see the total and send it to you." />
      <PackagesTab c={c} setMany={setMany} photo={ph} choose={choose} adjust={adjust} theme={site.theme} published={site.isPublished}
        link={path => `${url}${path}`} />
      </div>

      <div hidden={tab !== "more"}>
      <TabIntro icon={MessageSquareQuote} title="Reviews & FAQ" text="Words from your clients and answers to the questions people always ask." />
      <Sec icon={MessageSquareQuote} tone="green" where="Home and Reviews" title="Reviews" help="Use real words from your clients, with their permission.">
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
      </Sec>
      </div>

      <div hidden={tab !== "stories"}>
      <TabIntro icon={BookOpen} title="Stories" text="Short posts about weddings you covered. They help people find you on Google." />
      <Sec icon={BookOpen} tone="teal" where="Stories page and Home" title="Stories (blog)" help="Short posts about weddings you covered. The Stories page appears in the menu when there is at least one with a title and text.">
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
      </Sec>
      </div>

      <div hidden={tab !== "more"}>
      <Sec icon={HelpCircle} tone="amber" where="FAQ page" title="Questions and answers (FAQ)" help="The FAQ page appears in the menu when there is at least one question with an answer.">
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
          <div className="flex flex-wrap items-center gap-2 pr-4">
            <button type="button" onClick={() => set("faqs", [...(c.faqs ?? []), { q: "", a: "" }])} className="flex-1 px-4 py-3.5 text-left text-[15px] font-semibold text-[#7D5CEF] inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add a question</button>
            <AutofillAdd field="faq" max={12} ctx={{ events: c.events }} have={(c.faqs ?? []).map(f => f.q)}
              onAdd={v => set("faqs", [...(c.faqs ?? []).filter(f => f.q.trim() || f.a.trim()), { q: v.a, a: v.b }].slice(0, 12))} />
          </div>
        )}
      </Sec>
      </div>

      <div hidden={tab !== "design"}>
      <Sec icon={LayoutGrid} tone="violet" where="Home" title="Home page parts" help="Switch off a part to leave it out of the Home page. Its own page (Portfolio, Films, Packages, Reviews) stays.">
        {([["marquee", "Moving words"], ["albums", "Albums"], ["film", "Wedding film"], ["stories", "Stories"], ["packages", "Packages"], ["reviews", "Reviews"]] as const).map(([k, label]) => (
          <SwitchRow key={k} label={label} on={!(c.hide ?? []).includes(k)} onChange={v => set("hide", v ? (c.hide ?? []).filter(x => x !== k) : [...(c.hide ?? []), k])} />
        ))}
      </Sec>
      </div>

      <div hidden={tab !== "contact"}>
      <TabIntro icon={Phone} title="Contact" text="How visitors reach you: phone, WhatsApp, email, address and your social pages." />
      <Sec icon={Phone} tone="green" where="Footer, Contact page, WhatsApp button" title="Contact" help="Empty boxes use the phone, email and address from your studio settings.">
        <Field label="Phone">{id => <input id={id} className={inputCls} inputMode="tel" value={c.phone} maxLength={30} onChange={e => set("phone", e.target.value)} />}</Field>
        <Field label="WhatsApp number">{id => <input id={id} className={inputCls} inputMode="tel" value={c.whatsapp} maxLength={30} onChange={e => set("whatsapp", e.target.value)} />}</Field>
        <Field label="Email">{id => <input id={id} className={inputCls} inputMode="email" value={c.email} maxLength={120} onChange={e => set("email", e.target.value)} />}</Field>
        <Field label="Address">{id => <input id={id} className={inputCls} value={c.address} maxLength={200} onChange={e => set("address", e.target.value)} />}</Field>
        <Field label="Open hours" action={<AutofillText field="contact.hours" value={c.hours} onFill={v => set("hours", v)} ctx={{ events: c.events }} />}>{id => <input id={id} className={inputCls} placeholder="Sat to Thu, 10 am to 8 pm" value={c.hours} maxLength={80} onChange={e => set("hours", e.target.value)} />}</Field>
      </Sec>
      </div>

      <div hidden={tab !== "contact"}>
      <Sec icon={Share2} tone="slate" where="Footer" title="Social links and footer">
        <Field label="Facebook page">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://facebook.com/…" value={c.facebook} maxLength={200} onChange={e => set("facebook", e.target.value)} />}</Field>
        <Field label="Instagram">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://instagram.com/…" value={c.instagram} maxLength={200} onChange={e => set("instagram", e.target.value)} />}</Field>
        <Field label="YouTube channel">{id => <input id={id} className={inputCls} inputMode="url" placeholder="https://youtube.com/…" value={c.youtube} maxLength={200} onChange={e => set("youtube", e.target.value)} />}</Field>
        <Field label="One line about the studio (footer)" action={<AutofillText field="footer.line" value={c.footerLine} onFill={v => set("footerLine", v)} ctx={{ events: c.events }} />}>{id => <input id={id} className={inputCls} value={c.footerLine} maxLength={160} onChange={e => set("footerLine", e.target.value)} />}</Field>
      </Sec>
      </div>

      <div hidden={tab !== "legal"}>
      <TabIntro icon={Scale} title="Terms & privacy" text="Your own Terms and Privacy pages, linked in the footer. Leave a box empty to show StuPanel's standard words." />
      {(["terms", "privacy"] as const).map(kind => {
        const key = kind === "terms" ? "termsText" : "privacyText";
        const val = c[key] ?? "";
        const label = kind === "terms" ? "Terms" : "Privacy";
        return (
          <Sec key={kind} icon={Scale} tone={kind === "terms" ? "slate" : "green"} where={`${label} page`} title={kind === "terms" ? "Terms and conditions" : "Privacy policy"}
            help="Write it like a letter. A line that starts with ## becomes a heading, a line that starts with - becomes a point, and an empty line starts a new paragraph. The site sets it in its own fonts and colours.">
            <div className="px-4 py-3.5 grid gap-2.5">
              <textarea aria-label={`${label} page text`} className={areaCls.replace("min-h-[96px]", "min-h-[320px]")} value={val} maxLength={LEGAL_MAX}
                placeholder={`## Bookings\nYour date is held once the advance is paid.\n\n## Payments\n- Advance: 50% to book the date\n- The rest: on the wedding day`}
                onChange={e => set(key, e.target.value)} />
              <div className="flex flex-wrap items-center gap-2">
                <AutofillText field={`legal.${kind}`} value={val} onFill={v => set(key, v)} ctx={{ events: c.events }} />
                {!val.trim() && <button type="button" onClick={() => set(key, standardLegal(kind, site.studio.name))} className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold">Start from the standard words</button>}
                {!!val.trim() && <button type="button" onClick={() => set(key, "")} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#4A4658] text-[13px] font-semibold">Use the standard words again</button>}
                <a href={`/site/${site.slug}/${kind}?preview=1`} target="_blank" rel="noopener noreferrer" className="h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#4A4658] text-[13px] font-semibold inline-flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />See the page</a>
                <span className="ml-auto text-[12px] text-[#8A8599] tabular-nums">{val.length.toLocaleString("en-US")} / {LEGAL_MAX.toLocaleString("en-US")}</span>
              </div>
            </div>
          </Sec>
        );
      })}
      </div>

      {((site.isPublished && site.hasChanges) || undoable > 0) && (
        // Phones: sits above the bottom menu, so it is never hidden behind it.
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+96px)] lg:bottom-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-[#17151F] text-white px-4 py-3 shadow-[0_12px_30px_rgba(22,18,40,.3)]" role="status">
          <p className="flex-1 basis-[220px] text-[13px] leading-snug">{site.isPublished ? (site.hasChanges ? "Your changes are saved, but visitors do not see them yet." : "Draft saved.") : "Draft saved. Not published yet."}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {undoable > 0 && <button type="button" disabled={busy} onClick={undo} className="h-10 px-3.5 rounded-full bg-white/12 hover:bg-white/20 disabled:opacity-50 text-sm font-semibold inline-flex items-center gap-1.5"><Undo2 className="w-4 h-4" />Undo</button>}
            {site.isPublished && site.hasChanges && <button type="button" disabled={busy} onClick={discard} className="h-10 px-3.5 rounded-full bg-white/12 hover:bg-white/20 disabled:opacity-50 text-sm font-semibold">Remove all changes</button>}
            {site.isPublished && site.hasChanges && <button type="button" disabled={busy} onClick={() => publish(true)} className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-50 text-sm font-semibold">Publish changes</button>}
          </div>
        </div>
      )}
      {domStep && dom?.domain && (
        <>
          <div className="fixed inset-0 z-[60] bg-[#17151F]/45" onClick={() => !domBusy && setDomStep(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="dom-title" className="fixed z-[70] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-[480px] sm:h-fit max-h-[94dvh] overflow-y-auto bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-[#FFF1F4] text-[#C2304F] flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 id="dom-title" className="text-[17px] font-bold text-[#17151F]">{domStep === "warn" ? `Disconnect ${dom.domain}?` : "Type the code from the email"}</h2>
                <p className="text-sm text-[#4A4658] mt-1">Your website stays at <b>{site.slug}.stupanel.com</b>.</p>
              </div>
            </div>
            {domStep === "warn" ? (
              <>
                <ul className="mt-4 space-y-2.5 text-[13.5px] leading-snug text-[#4A4658]">
                  <li className="flex gap-2"><span aria-hidden="true">•</span><span>People who open <b>{dom.domain}</b> won&apos;t see your website any more.</span></li>
                  <li className="flex gap-2"><span aria-hidden="true">•</span><span>Links, cards and QR codes with this domain stop working, and Google drops it after some days.</span></li>
                </ul>
                <div className="mt-5 flex gap-2 justify-end">
                  <button type="button" disabled={!!domBusy} onClick={() => setDomStep(null)} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold">Keep it</button>
                  <button type="button" disabled={!!domBusy} onClick={sendDomainCode} className="h-11 px-4 rounded-full bg-[#C2304F] hover:bg-[#A82843] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-2">{domBusy === "code" && <Loader2 className="w-4 h-4 animate-spin" />}Send code to the owner</button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-[13.5px] text-[#4A4658]">We sent a 6-digit code to <b>{domTo}</b>. It works for 15 minutes.</p>
                <label htmlFor="dom-code" className="sr-only">6-digit code</label>
                <input id="dom-code" value={domCode} onChange={e => setDomCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus
                  className="mt-3 h-12 w-full rounded-[12px] border border-[#E1DCEC] px-4 text-center text-xl font-semibold tracking-[.4em] tabular-nums outline-none focus:border-[#7D5CEF]" />
                <div className="mt-5 flex gap-2 justify-end flex-wrap">
                  <button type="button" disabled={!!domBusy} onClick={sendDomainCode} className="h-11 px-4 rounded-full text-sm font-semibold text-[#5B3FD0] hover:bg-[#F1EEF8] mr-auto">Send again</button>
                  <button type="button" disabled={!!domBusy} onClick={() => setDomStep(null)} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold">Cancel</button>
                  <button type="button" disabled={!!domBusy || domCode.length !== 6} onClick={removeDomain} className="h-11 px-4 rounded-full bg-[#C2304F] hover:bg-[#A82843] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-2">{domBusy === "remove" && <Loader2 className="w-4 h-4 animate-spin" />}Disconnect</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {addrStep && (
        <>
          <div className="fixed inset-0 z-[60] bg-[#17151F]/45" onClick={() => !busy && setAddrStep(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="addr-title" className="fixed z-[70] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-[480px] sm:h-fit max-h-[94dvh] overflow-y-auto bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-[#FFF4E5] text-[#B45309] flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 id="addr-title" className="text-[17px] font-bold text-[#17151F]">{addrStep === "warn" ? "Change your website address?" : "Type the code from the email"}</h2>
                <p className="text-sm text-[#4A4658] mt-1 break-all"><b>{site.slug}.stupanel.com</b> → <b>{slug}.stupanel.com</b></p>
              </div>
            </div>
            {addrStep === "warn" ? (
              <>
                <ul className="mt-4 space-y-2.5 text-[13.5px] leading-snug text-[#4A4658]">
                  <li className="flex gap-2"><span aria-hidden="true">•</span><span>Your old address sends visitors to the new one for <b>{site.renameHoldDays ?? 30} days</b>. After that it stops working, and <b>another studio can take it</b>.</span></li>
                  <li className="flex gap-2"><span aria-hidden="true">•</span><span>Links you already shared — Facebook posts, visiting cards, QR codes, WhatsApp — will need the new address.</span></li>
                  <li className="flex gap-2"><span aria-hidden="true">•</span><span>Google needs some days to show the new address.</span></li>
                </ul>
                <label className="mt-4 flex items-start gap-2.5 text-[13.5px] text-[#17151F] cursor-pointer">
                  <input type="checkbox" checked={addrOk} onChange={e => setAddrOk(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#7D5CEF]" />
                  <span>I understand. Send a code to the studio owner&apos;s email to confirm.</span>
                </label>
                <div className="mt-5 flex gap-2 justify-end">
                  <button type="button" disabled={busy} onClick={() => setAddrStep(null)} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold">Keep my address</button>
                  <button type="button" disabled={busy || !addrOk} onClick={sendAddrCode} className="h-11 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send code</button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-[13.5px] text-[#4A4658]">We sent a 6-digit code to <b>{addrTo}</b>. It works for 15 minutes.</p>
                <label htmlFor="addr-code" className="sr-only">6-digit code</label>
                <input id="addr-code" value={addrCode} onChange={e => setAddrCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
                  className="mt-3 h-12 w-full rounded-[12px] border border-[#E1DCEC] px-4 text-center text-xl font-semibold tracking-[.4em] tabular-nums outline-none focus:border-[#7D5CEF]" autoFocus />
                <div className="mt-5 flex gap-2 justify-end flex-wrap">
                  <button type="button" disabled={busy} onClick={sendAddrCode} className="h-11 px-4 rounded-full text-sm font-semibold text-[#5B3FD0] hover:bg-[#F1EEF8] mr-auto">Send again</button>
                  <button type="button" disabled={busy} onClick={() => setAddrStep(null)} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold">Cancel</button>
                  <button type="button" disabled={busy || addrCode.length !== 6} onClick={() => saveSlug(addrCode)} className="h-11 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Change address</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {pick && <PhotoPicker photos={site.photos} {...pick} onUpload={upload} uploading={uploading} onClose={() => setPick(null)} />}
      {memberEdit && (
        <TeamSheet title={(site.people ?? []).find(p => p.id === memberEdit)?.name ?? "Team member"} onClose={() => setMemberEdit(null)}>
          <MemberSitePanel userId={memberEdit} onSaved={ms => peopleChanged(memberEdit, ms.show)} />
        </TeamSheet>
      )}
      {teamPick && (
        <TeamSheet title="Choose from your team" onClose={() => setTeamPick(false)}>
          <p className="text-[14px] text-[#6B6680] mb-3">Tap someone to show them on the website. Their name, title and photo come from their profile; you can change how they appear with Edit.</p>
          <ul className="bg-white rounded-[18px] border border-[#EEEBF3] divide-y divide-[#EEEBF3] overflow-hidden">
            {(site.people ?? []).filter(p => !p.show).map(p => (
              <li key={p.id}>
                <button type="button" disabled={!!showBusy} onClick={() => showMember(p.id, true)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F5FC] disabled:opacity-60">
                  <span className="w-11 h-11 rounded-full overflow-hidden bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold flex items-center justify-center flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover" /> : p.name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0"><span className="block text-[15px] font-semibold text-[#17151F] truncate">{p.name}</span><span className="block text-[13px] text-[#6B6680] truncate">{[p.title, p.memberId].filter(Boolean).join(" · ")}</span></span>
                  {showBusy === p.id ? <Loader2 className="w-5 h-5 text-[#7D5CEF] animate-spin" /> : <Plus className="w-5 h-5 text-[#7D5CEF]" />}
                </button>
              </li>
            ))}
          </ul>
        </TeamSheet>
      )}
      {frame && <FrameModal {...frame} value={crops[frame.key]} onClose={() => setFrame(null)}
        onSave={v => { const next = { ...crops }; if (v) next[frame.key] = v; else delete next[frame.key]; set("crop", next); setFrame(null); }} />}
    </div>
    {/* Phone preview: a real 390 px phone screen drawn at 70 %, so the settings keep most of the width. */}
    <aside className="hidden xl:block sticky top-6 flex-shrink-0 ml-auto" aria-label="Live preview of your website">
      <div className="flex items-center gap-1.5 mb-2 px-1 text-[13px] font-bold text-[#4A4658]">
        <Smartphone className="w-4 h-4" aria-hidden="true" />{showPhone ? "Phone preview" : ""}
        <button type="button" onClick={() => togglePhone(!showPhone)} aria-pressed={showPhone}
          className="ml-auto h-7 px-2.5 rounded-full text-xs font-semibold text-[#5B3FD0] hover:bg-[#F1EEF8]">{showPhone ? "Hide" : "Show"}</button>
      </div>
      {showPhone && (
        <>
          <div className="w-[293px] h-[611px] rounded-[30px] border-[8px] border-[#17151F] overflow-hidden bg-white shadow-[0_20px_50px_rgba(22,18,40,.18)]">
            <iframe ref={frameRef} src={`/site/${site.slug}?preview=1`} title="Website preview" className="border-0 origin-top-left" style={{ width: 395, height: 850, transform: "scale(0.7)" }} />
          </div>
          <p className="text-[11px] text-[#6B6680] mt-2 px-1 w-[293px]">Your draft. Changes show here as you type.</p>
        </>
      )}
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
/** One device's photos for the first screen: small pictures in the frame's own shape, each opening its own Adjust. */
function ScreenPhotos({ icon, title, shape, ratio, photos, crop, first, empty, onChoose, onClear, onAdjust, onOrder }: {
  icon: React.ReactNode; title: string; shape: string; ratio: number; photos: Photo[]; crop: (id: string, i: number) => { x: number; y: number; z: number } | undefined;
  /** Mark the first photo as the one shown first */ first?: boolean; empty: string; onChoose: () => void; onClear: () => void; onAdjust: (id: string, i: number) => void; /** The photos in their new order, after a drag */ onOrder: (ids: string[]) => void;
}) {
  // Drag to reorder: with a mouse, press and move; with a finger, hold a moment first (so the page can still be scrolled).
  const box = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const st = useRef({ id: "", x: 0, y: 0, timer: 0, active: false, skipClick: false, order: [] as string[] });
  const ids = photos.map(p => p.id);
  const idsKey = ids.join();
  const begin = () => {
    const s = st.current;
    s.active = true; s.order = idsKey ? idsKey.split(",") : [];
    setOrder(s.order); setDragId(s.id);
    try { navigator.vibrate?.(12); } catch { /* not allowed */ }
  };
  const over = (x: number, y: number) => {
    const s = st.current;
    const el = document.elementFromPoint(x, y)?.closest("[data-pid]");
    const to = el?.getAttribute("data-pid");
    if (!el || !to || to === s.id || !box.current?.contains(el)) return;
    const next = [...s.order];
    const from = next.indexOf(s.id), at = next.indexOf(to);
    if (from < 0 || at < 0) return;
    next.splice(from, 1); next.splice(at, 0, s.id);
    s.order = next; setOrder(next);
  };
  const finish = () => {
    const s = st.current;
    window.clearTimeout(s.timer);
    if (!s.active) return;
    s.active = false; s.skipClick = true;
    window.setTimeout(() => { s.skipClick = false; }, 350);
    setOrder(null); setDragId(null);
    if (s.order.join() !== idsKey) onOrder(s.order);
  };
  const finishRef = useRef(finish); const overRef = useRef(over); const beginRef = useRef(begin);
  useEffect(() => { finishRef.current = finish; overRef.current = over; beginRef.current = begin; });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Not passive: once a drag has started the page must not scroll under the finger.
    const move = (e: TouchEvent) => {
      const s = st.current, t = e.touches[0];
      if (!t) return;
      if (s.active) { e.preventDefault(); overRef.current(t.clientX, t.clientY); }
      else if (Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10) window.clearTimeout(s.timer);
    };
    el.addEventListener("touchmove", move, { passive: false });
    return () => el.removeEventListener("touchmove", move);
  }, [idsKey]);
  const mouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const s = st.current; s.id = id; s.x = e.clientX; s.y = e.clientY;
    const move = (ev: MouseEvent) => {
      if (!s.active && Math.hypot(ev.clientX - s.x, ev.clientY - s.y) > 6) beginRef.current();
      if (s.active) { ev.preventDefault(); overRef.current(ev.clientX, ev.clientY); }
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); finishRef.current(); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  const touchStart = (id: string, e: React.TouchEvent) => {
    const s = st.current, t = e.touches[0];
    s.id = id; s.x = t.clientX; s.y = t.clientY;
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => beginRef.current(), 260);
  };
  const shown = order ? order.map(id => photos.find(p => p.id === id)).filter((p): p is Photo => !!p) : photos;
  return (
    <div className="rounded-[16px] border border-[#E7E3F1] bg-[#FBFAFE] p-3.5">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-[#EEE9FB] text-[#6143CF] flex items-center justify-center">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1F1B2E]">{title}</div>
          <div className="text-xs text-[#6B6680]">{shape}{photos.length ? `, ${photos.length} chosen` : ""}</div>
        </div>
      </div>
      {photos.length > 0 ? (
        <>
          <div ref={box} className="flex gap-2.5 mt-3.5 flex-wrap select-none">
            {shown.map((p, i) => {
              const k = crop(p.id, ids.indexOf(p.id));
              return (
                <div key={p.id} data-pid={p.id} className="relative" style={{ aspectRatio: String(ratio), height: 76 }}>
                <button type="button" aria-label={`Photo ${i + 1}: tap to adjust, drag to change the order`}
                  onClick={() => { if (st.current.skipClick) return; onAdjust(p.id, ids.indexOf(p.id)); }}
                  onMouseDown={e => mouseDown(p.id, e)} onTouchStart={e => touchStart(p.id, e)} onTouchEnd={() => finishRef.current()} onTouchCancel={() => finishRef.current()}
                  onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}
                  className={cn("relative rounded-[10px] overflow-hidden bg-[#F1EEF8] outline-none transition-[transform,box-shadow,opacity] duration-200 hover:ring-2 hover:ring-[#7D5CEF] focus-visible:ring-2 focus-visible:ring-[#7D5CEF]", "w-full h-full", dragId === p.id ? "ring-2 ring-[#7D5CEF] scale-105 shadow-lg opacity-80 z-10 cursor-grabbing" : "cursor-grab")}
                  style={{ WebkitTouchCallout: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={small(p)} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover pointer-events-none" style={k ? { objectPosition: `${k.x}% ${k.y}%`, transformOrigin: `${k.x}% ${k.y}%`, scale: k.z > 1 ? String(k.z) : undefined } : undefined} />
                  <span className="absolute left-1 top-1 min-w-5 h-5 px-1 rounded-full bg-white/90 text-[10px] font-bold text-[#4A4658] flex items-center justify-center">{first && i === 0 ? "First" : i + 1}</span>
                  <span className="absolute right-1 bottom-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"><Crop className="w-3 h-3" /></span>
                </button>
                {!dragId && <button type="button" onClick={() => onOrder(ids.filter(id => id !== p.id))} aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-1 -top-1 z-10 w-7 h-7 rounded-full bg-white border border-[#E4E0EC] shadow text-[#4A4658] hover:bg-[#FDECEC] hover:text-[#C0392B] flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[#6B6680] mt-2">Tap a photo to move or zoom it inside the frame.{photos.length > 1 ? " To change the order, hold a photo and drag it." : ""} The cross removes a photo from here.</p>
        </>
      ) : <p className="text-[13px] text-[#6B6680] mt-3">{empty}</p>}
      <div className="flex gap-2 mt-3 flex-wrap">
        <button type="button" onClick={onChoose} className="h-11 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />{photos.length ? "Change photos" : "Choose photos"}</button>
        {photos.length > 0 && <button type="button" onClick={onClear} className="h-11 px-4 rounded-full text-[13px] font-semibold text-[#6B6680] hover:bg-[#F1EEF8]">Clear</button>}
      </div>
    </div>
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
                    className={cn("relative aspect-square rounded-[12px] overflow-hidden border-[3px] bg-[#F1EEF8] flex items-center justify-center p-1", n >= 0 ? "border-[#7D5CEF]" : "border-transparent")}>
                    {/* The whole photo in its own shape, so wide and tall ones are easy to tell apart. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={small(p)} alt="" loading="lazy" className="max-w-full max-h-full rounded-[6px] object-contain" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
                    <span className="absolute left-1 bottom-1 px-1.5 h-5 rounded-full bg-white/90 text-[10px] font-bold text-[#4A4658] flex items-center">{p.width > p.height * 1.1 ? "Wide" : p.height > p.width * 1.1 ? "Tall" : "Square"}</span>
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
