"use client";
import { coverPos, coverZoom, type CoverFocus } from "@/lib/cover-focus";

/**
 * AI Face Search — the guest page behind the QR. Landing → (code) → selfie scan → searching → your photos.
 * The selfie is made small here and sent once; the server keeps only its face data. The guest's key stays
 * in this browser, so coming back shows the photos again (and any new ones) without another selfie.
 */
import { StudioLogo } from "@/components/studio-logo";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL as API } from "@/lib/api";
import { PhotoViewer } from "@/components/photo-viewer";
import { faceFileUrl, facePhotoUrl, faceSaveUrl, type Cover, type FacePhoto } from "@/lib/face";
import { FACE_HINT, loadFaceCheck, type FaceState } from "@/lib/face-check";
import { N, P, T } from "./i18n";
import "./guest.css";

type Ask = "hide" | "optional" | "required";
/** What the details form asks for: each field off (hide), optional or required; oneOf = with WhatsApp and Email both optional, one of the two is needed. */
type Rules = { name: Ask; phone: Ask; email: Ask; oneOf: boolean };
type DownloadSize = "original" | "medium" | "small";
type BookWhen = "end" | "results" | "downloaded" | "afterFollow";
type FollowWhen = "off" | "before" | "results" | "open" | "download" | "downloaded";
type Open = { /** When the Book us card shows, and whether it is asked again / kept at the end */ bookWhen?: BookWhen; bookAgain?: boolean; bookKeepCard?: boolean; /** "Book us" card after the photos, and the review link */ bookButton?: boolean; bookWhatsApp?: string; bookText?: string; reviewUrl?: string; /** The file guests save (see the studio's settings) */ downloadSize?: DownloadSize; /** When the follow card shows, and its rules (see the studio's settings) */ followWhen?: FollowWhen; followSkip?: boolean; followAgain?: boolean; followTitle?: string; followText?: string; shareButton?: boolean; shareCaption?: string; /** Which share link this is: the guests' link, the all-photos link (no selfie needed) or the VIP link (no details asked) */ link?: "guest" | "full" | "vip"; /** Set when the cover carries the watermark: its version */ watermark?: string | null; askPhone?: Ask; askEmail?: Ask; askName?: Ask; contactOne?: boolean; title: string; status: "draft" | "published" | "closed"; eventDate: string | null; studio: { name: string; logoUrl: string | null }; cover: Cover; /** How the cover sits in its frame (the studio's "Adjust") */ coverFocus?: CoverFocus | null; needsPin: boolean; /** The gallery has a second code that opens every photo */ hasFullCode?: boolean; welcome: string; downloads: boolean; ready: boolean; register?: "off" | "optional" | "required"; follow?: { site: "facebook" | "instagram"; url: string }[] };
type Result = { key: string; registered: boolean; /** This guest is never asked who they are */ noDetails?: boolean; /** false = came by the all-photos link and took no selfie */ selfie?: boolean; /** Set when the gallery has a watermark: its version, part of every photo link */ watermark?: string | null; /** Photos are held back until the guest gives their details */ needsRegister?: boolean; /** The photos are not out yet: the guest is on the list and will be told */ waiting?: boolean; count?: number; photos: FacePhoto[]; /** Near misses: "these might be you too" (the guest says yes) */ maybe?: FacePhoto[]; /** How many photos were looked through */ searched?: number; more: FacePhoto[]; moreKind: "all" | "highlights"; downloads: boolean; /** Many at once: Download all and Choose */ downloadAll?: boolean };
type List = "mine" | "more" | "maybe";
/** Near misses the guest said "Yes, it's me" to, on this phone. */
function readYes(store: string) {
  try { return new Set<string>(JSON.parse(localStorage.getItem(`${store}:yes`) || "[]")); } catch { return new Set<string>(); }
}
type Step = "load" | "bad" | "land" | "pin" | "selfie" | "search" | "register" | "wait" | "follow" | "results";

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "S";
const longDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "");

/** A simple face mesh (same on every face): brow, eyes, nose, mouth, jaw. */
const PTS: [number, number][] = [[124, 96], [70, 132], [178, 132], [96, 150], [152, 150], [124, 140], [124, 186], [100, 190], [148, 190], [88, 226], [160, 226], [124, 222], [124, 244], [104, 268], [144, 268], [124, 290], [58, 190], [190, 190]];
const LINES: [number, number][] = [[0, 1], [0, 2], [0, 5], [1, 3], [2, 4], [3, 5], [4, 5], [3, 7], [4, 8], [5, 6], [6, 7], [6, 8], [1, 16], [2, 17], [7, 9], [8, 10], [6, 11], [9, 11], [10, 11], [11, 12], [9, 13], [10, 14], [12, 13], [12, 14], [13, 15], [14, 15], [16, 9], [17, 10], [16, 3], [17, 4]];
function Mesh({ now }: { now?: boolean }) {
  return (
    <svg className={`gf-mesh${now ? " gf-mesh-now" : ""}`} viewBox="0 0 248 332" preserveAspectRatio="none" aria-hidden="true">
      {LINES.map(([a, b], i) => <line key={i} pathLength={1} style={{ ["--i" as string]: i }} x1={PTS[a][0]} y1={PTS[a][1]} x2={PTS[b][0]} y2={PTS[b][1]} />)}
      {PTS.map(([x, y], i) => <circle key={i} style={{ ["--i" as string]: i }} cx={x} cy={y} r={3} />)}
    </svg>
  );
}
const Ic = ({ d, size = 20, w = 2.2 }: { d: React.ReactNode; size?: number; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const DL = <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />;
const BACK = <path d="M15 5l-7 7 7 7" />;

async function shrink(src: CanvasImageSource, w: number, h: number, max = 1280) {
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}

/** Where the guest's link goes: shown on "You are on the list" (kept in this browser). */
type SentTo = { email?: string; phone?: string };

export default function GuestFacePage({ params }: { params: Promise<{ token: string }> }) {
  // ?preview=host: the studio's Settings shows this page in a phone frame and sends what to show.
  // (?preview=1 is the real guest page as a guest sees it, with nothing counted — the "Guest preview" button.)
  const [preview] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "host" && window.parent !== window);
  return preview ? <PreviewHost /> : <GuestLive params={params} />;
}

type PreviewData = { open: Open; screen: "land" | "register" | "wait" | "results" | "follow" | "book"; photos: FacePhoto[] };

/** The guest page as the studio's settings make it, with sample answers. Nothing is sent anywhere. */
function PreviewHost() {
  const [d, setD] = useState<PreviewData | null>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "sp-face-preview") return;
      setD(e.data.data as PreviewData);
    };
    window.addEventListener("message", on);
    window.parent.postMessage({ type: "sp-face-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", on);
  }, []);
  if (!d) return <Shell><div className="gf-step" style={{ alignItems: "center", justifyContent: "center" }}><span className="gf-dots" role="status" aria-label="Loading"><i style={{ background: "#7D5CEF" }} /><i style={{ background: "#7D5CEF" }} /><i style={{ background: "#7D5CEF" }} /></span></div></Shell>;
  const g = d.open;
  const n = d.photos.length;
  const early = g.status === "draft";
  const rules: Rules = { name: g.askName ?? "required", phone: g.askPhone ?? "optional", email: g.askEmail ?? "optional", oneOf: g.contactOne ?? true };
  const res: Result = { key: "", registered: false, needsRegister: g.register === "required", waiting: early, count: n, photos: d.photos, more: [], moreKind: "highlights", downloads: g.downloads, downloadAll: true };
  const noForm = !g.register || g.register === "off";
  return (
    <Shell>
      {d.screen === "land" && <Landing g={g} base="" note="" onStart={() => undefined} onCode={() => undefined} />}
      {d.screen === "register" && (noForm
        ? <div className="gf-step" style={{ alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center", gap: 10 }}><h1 style={{ fontSize: 22, fontWeight: 800 }}>{T("No details are asked")}</h1><p style={{ color: "#4A4658", fontSize: 15 }}>{T("Guests go straight to their photos after the selfie.")}</p></div>
        : <Register key={JSON.stringify(rules) + g.register} base="" dry res={res} rules={rules} studio={g.studio.name} selfie="" must={g.register === "required" || early} onDone={() => undefined} onSkip={() => undefined} />)}
      {d.screen === "wait" && <Waiting studio={g.studio.name} title={g.title} selfie="" sentTo={rules.email !== "hide" ? { email: "name@example.com" } : { phone: "01XXXXXXXXX" }} onRetake={() => undefined} />}
      {(d.screen === "results" || d.screen === "follow") && <div inert style={{ display: "contents" }}><Results g={g} res={{ ...res, waiting: false, needsRegister: false }} selfie="" base="" onOpen={() => undefined} onRetake={() => undefined} /></div>}
      {d.screen === "book" && (g.bookButton || g.reviewUrl
        ? <><div inert style={{ display: "contents" }}><Results g={g} res={{ ...res, waiting: false, needsRegister: false, photos: d.photos.slice(0, 2), count: Math.min(2, n) }} selfie="" base="" onOpen={() => undefined} onRetake={() => undefined} /></div>
          {(g.bookWhen ?? "end") !== "end" && <BookSheet key={JSON.stringify([g.bookWhen, g.bookText, g.bookWhatsApp, g.reviewUrl])} g={g} onDone={() => undefined} onClose={() => undefined} />}</>
        : <div className="gf-step" style={{ alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}><b style={{ fontSize: 17 }}>{T("Add a WhatsApp number or a review link to show this card.")}</b></div>)}
      {d.screen === "follow" && (g.follow?.length
        ? (g.followWhen === "before" ? <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "var(--base)" }}><Follow g={g} count={n || 12} onFollowed={() => undefined} onSkip={() => undefined} /></div>
          : <FollowSheet key={JSON.stringify([g.followTitle, g.followText, g.followSkip, g.followWhen, g.follow])} g={g} gate={g.followWhen === "download" ? () => undefined : undefined} onFollowed={() => undefined} onSkip={() => undefined} onClose={() => undefined} />)
        : <div className="gf-sheet-wrap"><div className="gf-sheet" style={{ textAlign: "center" }}><b style={{ fontSize: 17 }}>{g.followWhen === "off" ? T("The follow card is off. Guests are not asked to follow.") : T("Add your Instagram or Facebook page to ask guests to follow.")}</b></div></div>)}
    </Shell>
  );
}

function GuestLive({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const base = `${API}/public/face/${encodeURIComponent(token)}`;
  const store = `sp-face:${token}`;
  const [g, setG] = useState<Open | null>(null);
  const [step, setStep] = useState<Step>("load");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [selfie, setSelfie] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const [view, setView] = useState<{ list: List; i: number } | null>(null);
  /** Seconds the last search took (shown once, after a new selfie). */
  const [took, setTook] = useState<number | null>(null);
  const [sentTo, setSentTo] = useState<SentTo>({});
  // Taps that help the studio grow are counted against this guest.
  useEffect(() => {
    const key = res?.key;
    // The studio's preview (?preview=1) counts nothing.
    if (new URLSearchParams(window.location.search).get("preview") === "1") { track = () => undefined; return; }
    track = (kind, site) => { fetch(`${base}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...(site ? { site } : {}), ...(key ? { key } : {}) }), keepalive: true }).catch(() => undefined); };
  }, [base, res?.key]);
  /** The follow card on screen; `gate` = a download waiting for the answer. */
  const [ask, setAsk] = useState<null | { gate?: () => void }>(null);
  const visitStart = useRef(Date.now());
  /** The Book us card sliding up; it waits while the follow card is on screen. */
  const [bookAsk, setBookAsk] = useState(false);
  const bookNow = useRef(false);
  const bookWaits = useRef(false);
  const followOpen = useRef(false);
  const askedNow = useRef(false);

  /** The secret of the share link the guest came by (all photos / VIP); "" = the guests' link. */
  const via = useRef("");
  const [linkKey, setLinkKey] = useState("");
  // A gallery with a watermark: every photo is asked from StuPanel (with the watermark), not from Google Drive.
  /** The gallery's download size (known once the page opened). */
  const size = useRef<DownloadSize>("original");
  const stamp = useCallback((o: Result): Result => {
    const tag = (p: FacePhoto) => ({
      ...p,
      ...(o.watermark ? { wm: `${base}/photo/${p.id}/{size}.jpg?v=${o.watermark}` } : {}),
      // The saved file always comes from StuPanel: Original is the camera's own file (Google's picture link is
      // a re-compressed copy, Faisal 27-NOV); Medium / Small are the same pixels in a smaller file.
      file: `${base}/file/${p.id}.jpg?s=${size.current}${o.watermark ? `&v=${o.watermark}` : ""}`,
    });
    // Photos the guest said "Yes, it's me" to on this phone stay with their own photos.
    const yes = readYes(store);
    const maybe = (o.maybe ?? []).map(tag);
    return { ...o, photos: [...o.photos.map(tag), ...maybe.filter(p => yes.has(p.id))], maybe: maybe.filter(p => !yes.has(p.id)), more: o.more.map(tag) };
  }, [base, store]);

  /** "Yes, it's me": a near miss joins the guest's own photos (kept on this phone). */
  const itsMe = useCallback((id: string) => {
    const yes = readYes(store); yes.add(id);
    try { localStorage.setItem(`${store}:yes`, JSON.stringify([...yes].slice(-200))); } catch { /* private window */ }
    setRes(r => {
      const p = r?.maybe?.find(x => x.id === id);
      return r && p ? { ...r, photos: [...r.photos, p], maybe: r.maybe!.filter(x => x.id !== id), count: (r.count ?? r.photos.length) + 1 } : r;
    });
  }, [store]);

  // ── the all-photos link: open every photo without a selfie ──
  const openAll = useCallback(async (d: Open, code?: string) => {
    let saved: { key?: string; selfie?: string } = {};
    try { saved = JSON.parse(localStorage.getItem(store) || "{}"); } catch { /* private window */ }
    const r = await fetch(`${base}/all`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link: via.current, ...(saved.key ? { key: saved.key } : {}), ...(code ? { pin: code } : {}) }) }).catch(() => null);
    const o = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) {
      if (o?.code === "WRONG_PIN") { setPin(""); setNote(code ? T("That code is not right. Please check it and try again.") : ""); setG(v => (v ? { ...v, needsPin: true } : v)); setStep("pin"); return true; }
      setNote(r?.status === 429 ? T("Too many tries. Please wait a minute and try again.") : (Array.isArray(o?.message) ? o.message[0] : o?.message) || T("Something went wrong. Please check your internet and try again."));
      return false;
    }
    const out = stamp(o as Result);
    warm(out);
    try { localStorage.setItem(store, JSON.stringify({ ...saved, key: out.key })); } catch { /* private window */ }
    setSelfie(saved.selfie || ""); setRes(out);
    let followed = false; try { followed = localStorage.getItem(`${store}:followed`) === "1"; } catch { /* private window */ }
    setStep(out.needsRegister ? "register" : d.followWhen === "before" && d.follow?.length && (out.count ?? out.photos.length + out.more.length) && !followed ? "follow" : "results");
    return true;
  }, [base, store, stamp]);

  // ── open ──
  useEffect(() => {
    let on = true;
    (async () => {
      const a = new URLSearchParams(window.location.search).get("a") || "";
      via.current = /^[\w-]{6,40}$/.test(a) ? a : "";
      const r = await fetch(via.current ? `${base}?a=${via.current}` : base).catch(() => null);
      if (!on) return;
      setLinkKey(via.current);
      if (!r?.ok) { setErr(T("This link is not working. Please ask the studio for a new one.")); return setStep("bad"); }
      const d: Open = await r.json();
      // The studio's preview: the first screen as guests will see it (also before Publish), never the studio's own saved search.
      const preview = new URLSearchParams(window.location.search).get("preview") === "1";
      if (preview && d.status === "draft") d.status = "published";
      size.current = d.downloadSize ?? "original";
      setG(d);
      // Came back in the same browser: show the photos again without a selfie.
      let saved: { key?: string; selfie?: string; sentTo?: SentTo } = {};
      if (!preview) try { saved = JSON.parse(localStorage.getItem(store) || "{}"); } catch { /* private window */ }
      if (saved.sentTo) setSentTo(saved.sentTo);
      // The guest's own link (sent by email or WhatsApp) carries their key: keep it, and take it out of the address bar.
      const own = new URLSearchParams(window.location.search).get("k");
      if (own && /^[\w-]{16,64}$/.test(own)) {
        if (own !== saved.key) saved = { key: own };
        try { localStorage.setItem(store, JSON.stringify(saved)); } catch { /* private window */ }
        window.history.replaceState(null, "", window.location.pathname);
      }
      // The all-photos link: every photo at once, no selfie (a code or a closed gallery goes by the first screen).
      if (d.link === "full" && d.status === "published" && !d.needsPin) { if (on && !(await openAll(d))) setStep("land"); return; }
      if (saved.key && d.status !== "closed") {
        // The link this visit came by decides what it may see (all-photos link: every photo; guests' link: own photos).
        const m = await fetch(`${base}/mine${via.current ? `?a=${via.current}` : ""}`, { headers: { "x-guest-key": saved.key } }).catch(() => null);
        if (on && m?.ok) { const out = stamp(await m.json()); warm(out); setSelfie(saved.selfie || ""); setRes(out);
          if (out.waiting) return setStep(out.registered ? "wait" : "register");
          let followed = false; try { followed = localStorage.getItem(`${store}:followed`) === "1"; } catch { /* private window */ }
          return setStep(out.needsRegister ? "register" : d.followWhen === "before" && d.follow?.length && (out.count ?? out.photos.length) && !followed ? "follow" : "results"); }
      }
      if (on) setStep("land");
    })();
    return () => { on = false; };
  }, [base, store, stamp, openAll]);

  // ── search ──
  const search = useCallback(async (image: string, code?: string) => {
    const usePin = code ?? pin;
    setSelfie(image); setStep("search"); setCount(0); setNote(""); setTook(null);
    let key: string | undefined;
    try { key = JSON.parse(localStorage.getItem(store) || "{}").key; } catch { /* private window */ }
    const started = Date.now();
    const r = await fetch(`${base}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: image.split(",")[1], ...(key ? { key } : {}), ...(usePin ? { pin: usePin } : {}), ...(via.current ? { link: via.current } : {}) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    const secs = (Date.now() - started) / 1000;
    if (!r?.ok) {
      const codeErr = d?.code;
      // The gallery got a code after this page was opened (or the code changed): ask for it without calling it wrong,
      // and keep the selfie, so the guest does not have to take it again.
      if (codeErr === "WRONG_PIN") { setPin(""); setNote(usePin ? T("That code is not right. Please check it and try again.") : ""); setG(v => (v ? { ...v, needsPin: true } : v)); return setStep("pin"); }
      setNote(r?.status === 429 ? T("Too many tries. Please wait a minute and try again.") : (Array.isArray(d?.message) ? d.message[0] : d?.message) || T("Something went wrong. Please check your internet and try again."));
      return setStep(r?.status === 403 ? "land" : "selfie");
    }
    const out = stamp(d as Result);
    warm(out);
    try { localStorage.setItem(store, JSON.stringify({ key: out.key, selfie: await thumbOfSelfie(image) })); } catch { /* private window */ }
    // The photos are not out yet: the selfie is kept, and the guest says where to send them.
    if (out.waiting) { await new Promise(ok => setTimeout(ok, Math.max(0, 1200 - (Date.now() - started)))); setRes(out); return setStep(out.registered ? "wait" : "register"); }
    // Let the search screen be seen for a moment, then count up to the number found.
    await new Promise(ok => setTimeout(ok, Math.max(0, 1400 - (Date.now() - started))));
    const n = out.count ?? out.photos.length;
    for (let i = 1; i <= n; i++) { setCount(i); await new Promise(ok => setTimeout(ok, Math.max(40, Math.min(160, 1400 / n)))); }
    await new Promise(ok => setTimeout(ok, n ? 500 : 200));
    setRes(out); setTook(secs);
    // The studio asks for a name and number: before the photos (required), or as a step the guest can skip (optional).
    const follow = g?.followWhen === "before" && !!g?.follow?.length && n > 0 && (() => { try { return localStorage.getItem(`${store}:followed`) !== "1"; } catch { return true; } })();
    setStep(n > 0 && !out.registered && !out.noDetails && (out.needsRegister || g?.register === "optional") ? "register" : follow ? "follow" : "results");
  }, [base, store, pin, g?.register, g?.follow, stamp]);

  // After the guest gave their details: photos that were held back are fetched now.
  const registered = useCallback(async (to?: SentTo) => {
    if (!res) return;
    if (to) {
      setSentTo(to);
      try { localStorage.setItem(store, JSON.stringify({ ...JSON.parse(localStorage.getItem(store) || "{}"), sentTo: to })); } catch { /* private window */ }
    }
    if (res.waiting) { setRes({ ...res, registered: true }); return setStep("wait"); }
    if (res.needsRegister) {
      const m = await fetch(`${base}/mine${via.current ? `?a=${via.current}` : ""}`, { headers: { "x-guest-key": res.key } }).catch(() => null);
      if (m?.ok) setRes(stamp(await m.json())); else setRes({ ...res, registered: true });
    } else setRes({ ...res, registered: true });
    const follow = g?.followWhen === "before" && !!g?.follow?.length && (() => { try { return localStorage.getItem(`${store}:followed`) !== "1"; } catch { return true; } })();
    setStep(follow ? "follow" : "results");
  }, [base, res, g?.follow, store, stamp]);

  // The follow step is shown once per browser, and only when there are photos to open.
  const wantsFollow = (out: Result) => {
    if (!g?.follow?.length || g.followWhen !== "before" || !(out.count ?? out.photos.length + out.more.length)) return false;
    try { return localStorage.getItem(`${store}:followed`) !== "1"; } catch { return true; }
  };
  const afterDetails = (out: Result) => setStep(wantsFollow(out) ? "follow" : "results");

  /** Should the follow card show now? Not after a page was opened; after "Not now" only on a later visit (if the studio wants that). */
  const wantsCard = () => {
    if (!g?.follow?.length || !g.followWhen || g.followWhen === "off" || askedNow.current) return false;
    try {
      if (localStorage.getItem(`${store}:followed`) === "1") return false;
      const skipped = Number(localStorage.getItem(`${store}:followSkip`) || 0);
      if (skipped && (g.followAgain === false || skipped > visitStart.current)) return false;
    } catch { /* private window: ask once per visit */ }
    return true;
  };
  /** A moment in the guest's visit: shows the card when it is the studio's chosen one. `then` runs after (a download waits). */
  const moment = (m: FollowWhen, then?: () => void) => {
    const here = g?.followWhen === m && wantsCard();
    // The follow card first: a Book us card due at the same moment waits until it is closed.
    if (here) followOpen.current = true;
    if (m === "results" || m === "downloaded") bookMoment(m);
    if (!here) {
      then?.();
      // The follow card's moment came but it was not needed (followed before, skipped): "after the follow card" is now.
      if (g?.followWhen === m) bookMoment("afterFollow");
      return;
    }
    askedNow.current = true; followOpen.current = true;
    setAsk({ gate: then });
  };

  /** Should the Book us card slide up now? Once per visit; after "Not now" only on a later visit if the studio wants; never after booking. */
  const wantsBook = () => {
    if (!g || !g.bookWhen || g.bookWhen === "end" || bookNow.current || (!(g.bookButton && g.bookWhatsApp) && !g.reviewUrl)) return false;
    try {
      if (localStorage.getItem(`${store}:booked`) === "1") return false;
      const skipped = Number(localStorage.getItem(`${store}:bookSkip`) || 0);
      if (skipped && (!g.bookAgain || skipped > visitStart.current)) return false;
    } catch { /* private window: once per visit */ }
    return true;
  };
  function bookMoment(m: BookWhen) {
    if (g?.bookWhen !== m || !wantsBook()) return;
    bookNow.current = true;
    if (followOpen.current) { bookWaits.current = true; return; }
    setTimeout(() => setBookAsk(true), m === "afterFollow" ? 450 : 0);
  }
  const followClosed = () => {
    setAsk(null); followOpen.current = false;
    if (bookWaits.current) { bookWaits.current = false; setTimeout(() => setBookAsk(true), 450); }
    bookMoment("afterFollow");
  };
  /** Does this download have to wait for the card? (for links that must be opened in the same tap) */
  const gates = () => g?.followWhen === "download" && wantsCard();
  const followed = () => { try { localStorage.setItem(`${store}:followed`, "1"); } catch { /* private window */ } };
  const skipped = () => { try { localStorage.setItem(`${store}:followSkip`, String(Date.now())); } catch { /* private window */ } };

  // "When the photos appear": a moment after the photos are on screen.
  const nPhotos = res ? (res.count ?? res.photos.length) + res.more.length : 0;
  useEffect(() => {
    if (step !== "results" || !nPhotos) return;
    const t = setTimeout(() => {
      moment("results");
      // No follow card at a later moment (off, before the photos, or no pages): "after the follow card" is now.
      if (!g?.follow?.length || g.followWhen === "off" || g.followWhen === "before") bookMoment("afterFollow");
    }, 1600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, nPhotos]);

  if (step === "bad") return <Shell><div className="gf-step" style={{ alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center", gap: 10 }}><h1 style={{ fontSize: 24, fontWeight: 800 }}>{T("Photos not found")}</h1><p style={{ color: "#4A4658", fontSize: 16 }}>{err}</p></div></Shell>;
  if (step === "load" || !g) return <Shell><div className="gf-step" style={{ alignItems: "center", justifyContent: "center" }}><span className="gf-dots" role="status" aria-label="Loading"><i style={{ background: "#7D5CEF" }} /><i style={{ background: "#7D5CEF" }} /><i style={{ background: "#7D5CEF" }} /></span></div></Shell>;

  const all = g.link === "full";
  const start = () => {
    setNote("");
    if (g.needsPin && pin.length !== 4) return setStep("pin");
    if (all) { setStep("load"); void openAll(g, pin).then(ok => { if (!ok) setStep("land"); }); } else setStep("selfie");
  };

  return (
    <Shell>
      {step === "land" && <Landing g={g} base={base} note={note} onStart={start} onCode={() => { setNote(""); setPin(""); setStep("pin"); }} />}
      {step === "pin" && <Pin base={base} link={linkKey} value={pin} note={note} onChange={v => { setPin(v); if (note) setNote(""); }} onBack={() => setStep("land")}
        // A selfie taken before the code was asked for is used straight away.
        onDone={code => { setNote(""); if (selfie) void search(selfie, code); else if (all) void openAll(g, code).then(ok => { if (!ok) setStep("land"); }); else setStep("selfie"); }} />}
      {step === "selfie" && <Selfie title={g.title} note={note} onBack={() => setStep("land")} onShot={search} />}
      {step === "search" && <Searching selfie={selfie} count={count} />}
      {step === "register" && res && (
        <Register base={base} res={res} rules={{ name: g.askName ?? "required", phone: g.askPhone ?? "optional", email: g.askEmail ?? "optional", oneOf: g.contactOne ?? true }} studio={g.studio.name} selfie={selfie} must={!!res.needsRegister || !!res.waiting} onDone={registered} onSkip={() => afterDetails(res)} />
      )}
      {step === "wait" && <Waiting studio={g.studio.name} title={g.title} selfie={selfie} sentTo={sentTo} onRetake={() => { setNote(""); setStep("selfie"); }} />}
      {step === "follow" && res && g.follow && (
        <Follow g={g} count={res.count ?? res.photos.length} onTapped={followed}
          onFollowed={() => { followed(); setStep("results"); }} onSkip={() => { skipped(); askedNow.current = true; setStep("results"); }} />
      )}
      {step === "results" && res && (
        <Results g={g} res={res} selfie={selfie} took={took} onItsMe={itsMe} onOpen={(list, i) => { setView({ list, i }); setTimeout(() => moment("open"), 700); }} onRetake={() => { setNote(""); setStep("selfie"); }} base={base}
          gate={then => moment("download", then)} onDownloaded={() => setTimeout(() => moment("downloaded"), 900)} />
      )}
      {view && res && (() => {
        const list = view.list === "mine" ? res.photos : view.list === "maybe" ? res.maybe ?? [] : res.more;
        const p = list[view.i];
        if (!p) return null;
        const unsure = view.list === "maybe";
        return (
          <PhotoViewer count={list.length} index={view.i} onIndex={i => setView({ list: view.list, i })} onClose={() => setView(null)}
            src={facePhotoUrl(p, 1600)} srcAt={i => facePhotoUrl(list[i], 1600)} thumbAt={i => facePhotoUrl(list[i], 480)} zoomAt={i => facePhotoUrl(list[i], 2560)}
            title={unsure ? T("Is this you?") : g.title} sub={T("{a} of {b}", { a: N(view.i + 1), b: N(list.length) })}
            footer={unsure || res.downloads || g.shareButton !== false ? (
              <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                {unsure && <button type="button" className="gf-yes-big" onClick={() => {
                  itsMe(p.id);
                  // The photo moved to the guest's own photos: show the next one that might be them, or close.
                  const left = list.length - 1;
                  if (!left) setView(null); else setView({ list: "maybe", i: Math.min(view.i, left - 1) });
                }}><Ic size={18} w={2.8} d={<path d="M5 12.5l4.5 4.5L19 7.5" />} />{T("Yes, it's me")}</button>}
                {res.downloads && touch() && <SaveOne key={p.id} sheet={phoneSave()} photo={p} gate={run => moment("download", run)} onSaved={() => { counted(base, res.key, 1); setTimeout(() => moment("downloaded"), 900); }} />}
                {res.downloads && !touch() && <a href={faceSaveUrl(p)} target="_blank" rel="noreferrer"
                  onClick={e => {
                    // "When Download is pressed": the card first; the photo is saved from its button (same tap, so phones allow it).
                    if (gates()) { e.preventDefault(); const url = faceSaveUrl(p); moment("download", () => { counted(base, res.key, 1); window.open(url, "_blank", "noopener"); }); return; }
                    counted(base, res.key, 1); setTimeout(() => moment("downloaded"), 1200);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, padding: "0 26px", borderRadius: 18, background: "#7D5CEF", color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
                  <Ic d={DL} />{T("Download")}
                </a>}
                {g.shareButton !== false && <ShareButton photo={p} caption={captionFor(g)} />}
              </div>
            ) : undefined} />
        );
      })()}
      {ask && g.follow && <FollowSheet g={g} gate={ask.gate} onFollowed={followed} onSkip={skipped} onClose={followClosed} />}
      {bookAsk && <BookSheet g={g} onDone={booked => { try { localStorage.setItem(booked ? `${store}:booked` : `${store}:bookSkip`, booked ? "1" : String(Date.now())); } catch { /* private window */ } }} onClose={() => setBookAsk(false)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="gf-page"><div className="gf gf-live"><div className="gf-scene" aria-hidden="true" />{children}</div></div>;
}

async function thumbOfSelfie(dataUrl: string) {
  const img = new Image();
  await new Promise<void>(ok => { img.onload = () => ok(); img.onerror = () => ok(); img.src = dataUrl; });
  return img.naturalWidth ? shrink(img, img.naturalWidth, img.naturalHeight, 160) : "";
}
/** Counts a follow / share / book / review tap for the studio (once per guest on the server). Set by the live page. */
let track: (kind: "follow" | "share" | "book" | "review", site?: "instagram" | "facebook") => void = () => undefined;

/** Start loading the first pictures of the grid at once (during the count-up), so they are there when the grid shows. */
function warm(out: Result) {
  if (typeof window === "undefined") return;
  for (const p of [...(out.photos ?? []), ...(out.more ?? [])].slice(0, 24)) { const i = new Image(); i.referrerPolicy = "no-referrer"; i.decoding = "async"; i.src = facePhotoUrl(p, 480); }
}
/** iPhone and iPad: photos are saved through the share sheet ("Save Image"); a file download lands in Files there. */
const isApple = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
/** Save through the share sheet: iPhone and iPad only. Android's share sheet has no "Save", so Android downloads the file. */
const phoneSave = () => typeof window !== "undefined" && isApple() && !!navigator.canShare?.({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] });
/** A phone or tablet (touch screen): files are fetched here and saved, instead of Drive's own download page. */
const touch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
/** Save a file to Downloads from this page (Android, computers): one tap, no new tab. */
function saveFile(f: File) {
  const url = URL.createObjectURL(f); const a = document.createElement("a");
  a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/** One photo as a file for the share sheet. */
async function fileOf(p: FacePhoto, i = 0) {
  const r = await fetch(faceFileUrl(p)).catch(() => null);
  if (!r?.ok) return null;
  const b = await r.blob();
  return new File([b], `${(p.fileName || `photo-${i + 1}`).replace(/\.[^.]+$/, "")}.jpg`, { type: b.type || "image/jpeg" });
}

function counted(base: string, key: string, n: number) {
  fetch(`${base}/downloaded`, { method: "POST", headers: { "Content-Type": "application/json", "x-guest-key": key }, body: JSON.stringify({ count: n }), keepalive: true }).catch(() => undefined);
}

// ─── Landing ──────────────────────────────────────────────────────────────────

function Landing({ g, base, note, onStart, onCode }: { g: Open; base: string; note: string; onStart: () => void; onCode: () => void }) {
  // A gallery with a watermark: the cover comes from StuPanel with the watermark on it.
  // A cover the studio uploaded (its own picture) is used as it is.
  const cover = g.cover ? (g.cover.url ? g.cover.url : g.watermark && g.cover.id ? `${base}/photo/${g.cover.id}/1600.jpg?v=${g.watermark}` : facePhotoUrl(g.cover, 1200)) : "";
  const live = g.status === "published" && g.ready;
  // Before the photos are out: a guest can leave a selfie and a number, and is told when they are ready.
  const early = g.status === "draft" && g.ready && !!g.register && g.register !== "off";
  const open = live || early;
  const all = g.link === "full";
  const title = live && all ? T("All the photos from the event") : live ? T("Find your photos in seconds") : early ? T("Get your photos as soon as they are ready") : g.status === "closed" ? T("This gallery is closed") : T("The photos are on their way");
  const body = live ? (g.welcome || (all ? T("Open every photo. You can also take a selfie to find the ones you are in.") : T("Take one selfie. We show you every photo you are in.")))
    : early ? T("Take one selfie now and say where to send them. {studio} sends your photos to you when they are ready.", { studio: g.studio.name })
    : g.status === "closed" ? T("Please ask {studio} if you still need your photos.", { studio: g.studio.name }) : T("{studio} is still adding the photos. Please scan again a little later.", { studio: g.studio.name });
  return (
    <div className="gf-step">
      <div style={{ position: "relative", flex: "1 1 54%", minHeight: 300, overflow: "hidden", borderRadius: "0 0 40px 40px", background: "#2A2140" }}>
        {g.cover && (
          <div style={{ position: "absolute", inset: 0, ...coverZoom(g.coverFocus) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gf-kb" src={cover} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", ...coverPos(g.coverFocus, "50% 25%") }} />
          </div>
        )}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(23,21,31,.28) 0%, rgba(23,21,31,0) 30%, rgba(23,21,31,.86) 100%)" }} />
        <div className="gf-drop gf-glass" style={{ position: "absolute", top: 18, left: 18, display: "flex", alignItems: "center", gap: 10, padding: "7px 14px 7px 7px", borderRadius: 18, animationDelay: ".15s" }}>
          {g.studio.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <StudioLogo url={g.studio.logoUrl} name={g.studio.name} size={34} tone="onDark" />
            : <span style={{ width: 34, height: 34, borderRadius: 12, background: "#17151F", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{initials(g.studio.name)}</span>}
          <span style={{ fontWeight: 700, fontSize: 14 }}>{g.studio.name}</span>
        </div>
        <div style={{ position: "absolute", left: 22, right: 22, bottom: 26, color: "#fff", display: "flex", flexDirection: "column", gap: 8 }}>
          {g.eventDate && <span className="gf-rise" style={{ fontSize: 14, fontWeight: 600, opacity: .9, animationDelay: ".3s" }}>{longDate(g.eventDate)}</span>}
          <h1 className="gf-rise" style={{ fontSize: 36, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-.035em", animationDelay: ".4s", overflowWrap: "anywhere" }}>{g.title}</h1>
        </div>
      </div>
      <div style={{ flex: "1 1 46%", padding: "24px 22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="gf-rise" style={{ display: "flex", flexDirection: "column", gap: 6, animationDelay: ".6s" }}>
          <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</h2>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: "#4A4658" }}>{body}</p>
          {note && <p role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#C2304F" }}>{note}</p>}
        </div>
        <div className="gf-rise" style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, animationDelay: ".75s" }}>
          {open && (
            <button type="button" className="gf-cta gf-pulse" onClick={onStart}>
              <Ic size={22} d={<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="10.5" r="3" /><path d="M7.5 17c1-2 2.600-3 4.500-3s3.500 1 4.500 3" /></>} />
              {early ? T("Send me my photos") : all ? T("See all photos") : T("Find my photos")}
            </button>
          )}
          {/* The couple and family may have a code that opens every photo; other guests just start */}
          {live && !g.needsPin && g.hasFullCode && (
            <button type="button" onClick={onCode} style={{ height: 44, border: 0, background: "transparent", fontSize: 14, fontWeight: 700, color: "#4B32B8" }}>{T("I have a code for all photos")}</button>
          )}
          <p style={{ fontSize: 12, color: "#6B6680", textAlign: "center" }}>{T("Your selfie is used only to find your photos. The picture itself is not kept.")}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Code ─────────────────────────────────────────────────────────────────────

function Pin({ base, link, value, note, onChange, onBack, onDone }: { base: string; link: string; value: string; note: string; onChange: (v: string) => void; onBack: () => void; onDone: (code: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"" | "checking" | "ok">("");
  const [wrong, setWrong] = useState("");
  useEffect(() => { input.current?.focus(); }, []);

  // The fourth digit is checked by itself: no button to press.
  async function check(code: string) {
    setState("checking"); setWrong("");
    const r = await fetch(`${base}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: code, ...(link ? { link } : {}) }) }).catch(() => null);
    if (r?.ok) { setState("ok"); await new Promise(ok => setTimeout(ok, 350)); return onDone(code); }
    setState("");
    setWrong(r?.status === 429 ? T("Too many tries. Please wait a minute and try again.") : r?.status === 403 ? T("That code is not right. Please check it and try again.") : T("Could not check the code. Please check your internet and try again."));
    onChange("");
    setTimeout(() => input.current?.focus(), 30);
  }
  const message = wrong || note;

  return (
    <div className="gf-step" style={{ padding: "16px 22px 26px" }}>
      <button type="button" aria-label="Back" onClick={onBack} style={{ width: 46, height: 46, borderRadius: 16, border: 0, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic d={BACK} w={2.4} /></button>
      <div className="gf-rise" style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 8, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em" }}>{T("Enter the code")}</h1>
        <p style={{ fontSize: 15, color: "#4A4658" }}>{T("The 4-digit code from the studio or the couple.")}</p>
      </div>
      <label htmlFor="gf-pin" style={{ position: "absolute", left: -9999 }}>4-digit code</label>
      <div className={`gf-otp${state === "ok" ? " ok" : ""}`} style={{ marginTop: 30, position: "relative", opacity: state === "checking" ? .6 : 1 }} onClick={() => input.current?.focus()}>
        {[0, 1, 2, 3].map(i => <span key={i} className={value[i] ? "f" : ""}>{value[i] ?? ""}</span>)}
        <input id="gf-pin" ref={input} value={value} inputMode="numeric" autoComplete="one-time-code" maxLength={4} readOnly={state !== ""}
          aria-invalid={!!message} aria-describedby="gf-pin-msg"
          onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); if (wrong) setWrong(""); onChange(v); if (v.length === 4) void check(v); }}
          style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", fontSize: 16 }} />
      </div>
      <p id="gf-pin-msg" role={message ? "alert" : "status"} style={{ marginTop: 14, minHeight: 22, textAlign: "center", fontSize: 14, fontWeight: 600, color: message ? "#C2304F" : state === "ok" ? "#1F8A5B" : "#6B6680" }}>
        {message || (state === "checking" ? T("Checking…") : state === "ok" ? T("Code is right") : T("It is checked as soon as you type the fourth number."))}
      </p>
    </div>
  );
}

// ─── Name and number ─────────────────────────────────────────────────────────

function Register({ base, res, rules, studio, selfie, must, onDone, onSkip, dry }: { base: string; res: Result; rules: Rules; studio: string; selfie: string; must: boolean; onDone: (to?: SentTo) => void; onSkip: () => void; /** Preview: check the form, send nothing */ dry?: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mail, setMail] = useState("");
  /** Errors next to each field, and one for the form (one-of-two, server). */
  const [errs, setErrs] = useState<{ name?: string; phone?: string; mail?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  /** A likely typo in the email ("gmial.com"): offered once, the guest picks. */
  const [fix, setFix] = useState("");
  const [fixSeen, setFixSeen] = useState("");
  const n = res.count ?? res.photos.length;
  const waiting = !!res.waiting;
  /** Came by the all-photos link without a selfie: there is no "photos of you" number to show. */
  const noSelfie = res.selfie === false;
  const { name: nameAsk, phone: phoneAsk, email: mailAsk } = rules;
  /** WhatsApp and Email both optional, and one of the two is needed. */
  const oneOf = rules.oneOf && phoneAsk === "optional" && mailAsk === "optional";
  const opt = (a: Ask, contact = false) => (a === "optional" && !(contact && oneOf) ? ` ${T("(optional)")}` : "");

  async function send() {
    const digits = phone.replace(/[^\d+]/g, "");
    const hasName = nameAsk !== "hide" && name.trim().length > 0;
    const hasPhone = phoneAsk !== "hide" && digits.replace(/\D/g, "").length > 0, hasMail = mailAsk !== "hide" && mail.trim().length > 0;
    const e: typeof errs = {};
    if (nameAsk === "required" && name.trim().length < 2) e.name = T("Please type your name.");
    if (hasPhone && digits.replace(/\D/g, "").length < 10) e.phone = T("Please check your WhatsApp number, like 01XXXXXXXXX.");
    else if (!hasPhone && phoneAsk === "required") e.phone = T("Please give your WhatsApp number.");
    if (hasMail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.trim())) e.mail = T("Please check your email address.");
    // The link goes to this email, so a likely typo is shown once before sending.
    else if (hasMail && emailFix(mail) && fixSeen !== mail.trim()) { setFix(emailFix(mail)); setFixSeen(mail.trim()); e.mail = T("Please check your email address."); }
    else if (!hasMail && mailAsk === "required") e.mail = T("Please give your email address.");
    if (!e.phone && !e.mail && oneOf && !hasPhone && !hasMail) e.form = T("Please give your WhatsApp number or your email, or both.");
    if (!Object.keys(e).length && !hasName && !hasPhone && !hasMail) e.form = T("Please fill in at least one field.");
    setErrs(e);
    if (Object.keys(e).length) {
      // The first field with a problem gets the focus.
      const first = e.name ? "gf-name" : e.phone ? "gf-phone" : e.mail ? "gf-mail" : nameAsk !== "hide" ? "gf-name" : phoneAsk !== "hide" ? "gf-phone" : "gf-mail";
      document.getElementById(first)?.focus();
      return;
    }
    if (dry) return onDone();
    setBusy(true);
    // A local number (01…) is sent with Bangladesh's country code.
    const number = digits.startsWith("+") ? digits : digits.startsWith("01") ? `+88${digits}` : digits.startsWith("880") ? `+${digits}` : digits;
    const r = await fetch(`${base}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: res.key, ...(hasName ? { name: name.trim() } : {}), ...(hasPhone ? { phone: number } : {}), ...(hasMail ? { email: mail.trim() } : {}) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      const m = Array.isArray(d?.message) ? d.message[0] : d?.message;
      return setErrs({ form: r?.status === 429 ? T("Too many tries. Please wait a minute.") : m ? T(m) : T("Could not save. Please check your internet and try again.") });
    }
    onDone({ ...(hasMail ? { email: mail.trim().toLowerCase() } : {}), ...(hasPhone ? { phone: digits } : {}) });
  }

  const field = (bad?: string): React.CSSProperties => ({ width: "100%", height: 56, borderRadius: 18, border: `2px solid ${bad ? "#E0607A" : "transparent"}`, background: "#fff", padding: "0 18px", fontSize: 17, fontWeight: 600, color: "#17151F", outline: "none" });
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#4A4658", marginBottom: 6 };
  const errText = (id: string, m?: string) => (m ? <p id={id} role="alert" style={{ marginTop: 6, fontSize: 13.5, fontWeight: 600, color: "#C2304F" }}>{m}</p> : null);
  // Email first: with an email the photos arrive by themselves, so it is the one we ask for first.
  const emailField = mailAsk !== "hide" && (
    <div>
      <label htmlFor="gf-mail" style={label}>{T("Email address")}{opt(mailAsk, true)}</label>
      <input id="gf-mail" value={mail} onChange={e => { setMail(e.target.value); setFix(""); if (errs.mail || errs.form) setErrs({ ...errs, mail: undefined, form: undefined }); }}
        onBlur={() => { const f = emailFix(mail); if (f && fixSeen !== mail.trim()) { setFix(f); setFixSeen(mail.trim()); } }}
        type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={200} placeholder="name@example.com"
        style={field(errs.mail)} aria-invalid={!!errs.mail} aria-describedby={`gf-mail-note${errs.mail ? " gf-mail-err" : ""}`} onKeyDown={e => { if (e.key === "Enter") void send(); }} />
      {fix
        ? <button type="button" onClick={() => { setMail(fix); setFix(""); setErrs({ ...errs, mail: undefined }); }} style={{ marginTop: 8, width: "100%", minHeight: 44, padding: "8px 14px", borderRadius: 14, border: 0, background: "#FFF3E0", color: "#6B4100", fontSize: 14, textAlign: "left" }}>
            {T("Did you mean")} <b style={{ overflowWrap: "anywhere" }}>{fix}</b>? <span style={{ color: "#4B32B8", fontWeight: 700 }}>{T("Use this")}</span>
          </button>
        : errText("gf-mail-err", errs.mail)}
      {!fix && !errs.mail && <p id="gf-mail-note" style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.45, color: "#4B32B8", display: "flex", gap: 6 }}>
        <Ic size={15} w={2.2} d={<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 7l8 6 8-6" /></>} />
        <span>{T("Your private link to your photos is sent to this email. Please check it is right.")}</span>
      </p>}
    </div>
  );
  const phoneField = phoneAsk !== "hide" && (
    <div>
      <label htmlFor="gf-phone" style={label}>{T("WhatsApp number")}{opt(phoneAsk, true)}</label>
      <input id="gf-phone" value={phone} onChange={e => { setPhone(e.target.value); if (errs.phone || errs.form) setErrs({ ...errs, phone: undefined, form: undefined }); }} inputMode="tel" autoComplete="tel" maxLength={20} placeholder="01XXXXXXXXX"
        style={field(errs.phone)} aria-invalid={!!errs.phone} aria-describedby={errs.phone ? "gf-phone-err" : undefined} onKeyDown={e => { if (e.key === "Enter") void send(); }} />
      {errText("gf-phone-err", errs.phone)}
    </div>
  );
  const contactFields = <>{emailField}{phoneField}</>;
  return (
    <div className="gf-step" style={{ padding: "26px 22px 26px" }}>
      <div className="gf-rise" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        {selfie
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={selfie} alt="" style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover", boxShadow: "0 0 0 4px #fff, 0 10px 24px -10px rgba(40,28,96,.5)" }} />
          : null}
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15 }}>{waiting ? T("Where should we send your photos?") : noSelfie ? T("Almost there") : T("We found {photos} of you", { photos: P(n) })}</h1>
        <p style={{ fontSize: 15, color: "#4A4658", maxWidth: 320 }}>{waiting ? T("Your selfie is saved. {studio} sends your photos here when they are ready.", { studio }) : must ? T("Tell us who you are to see them.") : T("Add your details, and the studio can send you new photos too.")}</p>
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
        {nameAsk !== "hide" && <div>
          <label htmlFor="gf-name" style={label}>{T("Your name")}{opt(nameAsk)}</label>
          <input id="gf-name" value={name} onChange={e => { setName(e.target.value); if (errs.name || errs.form) setErrs({ ...errs, name: undefined, form: undefined }); }} autoComplete="name" maxLength={120} placeholder={T("Full name")}
            style={field(errs.name)} aria-invalid={!!errs.name} aria-describedby={errs.name ? "gf-name-err" : undefined} onKeyDown={e => { if (e.key === "Enter" && phoneAsk === "hide" && mailAsk === "hide") void send(); }} />
          {errText("gf-name-err", errs.name)}
        </div>}
        {/* WhatsApp or Email, one is enough: the two sit together under one line that says so */}
        {oneOf ? (
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <legend style={{ fontSize: 13.5, fontWeight: 700, color: "#4B32B8", marginBottom: 10, padding: 0 }}>{T("Email or WhatsApp: give one or both")}</legend>
            {contactFields}
          </fieldset>
        ) : contactFields}
        {errs.form
          ? <p id="gf-reg-err" role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#C2304F" }}>{errs.form}</p>
          : <p id="gf-reg-help" style={{ fontSize: 13, color: "#6B6680" }}>{T("Only {studio} sees this. It is used to send you your photos.", { studio })}</p>}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <button type="button" className="gf-cta" disabled={busy} onClick={send} style={{ opacity: busy ? .6 : 1 }}>{busy ? T("Saving…") : waiting ? T("Tell me when they are ready") : noSelfie ? T("See all photos") : T(n === 1 ? "See my photo" : "See my photos")}</button>
        {!must && <button type="button" onClick={onSkip} style={{ height: 48, border: 0, background: "transparent", fontSize: 15, fontWeight: 700, color: "#4A4658" }}>{T("Not now")}</button>}
      </div>
    </div>
  );
}

// ─── On the list (the photos are not out yet) ────────────────────────────────

function Waiting({ studio, title, selfie, sentTo, onRetake }: { studio: string; title: string; selfie: string; sentTo: SentTo; onRetake: () => void }) {
  const where = sentTo.email || sentTo.phone || "";
  const by = sentTo.email ? T("by email") : sentTo.phone ? T("on WhatsApp") : "";
  return (
    <div className="gf-step" style={{ padding: "22px 22px 22px", alignItems: "center", textAlign: "center" }}>
      {/* One moment: the photo goes into the envelope, the envelope goes off, a tick lands */}
      <div className="gf-mail" aria-hidden="true">
        <svg viewBox="0 0 220 150" width="220" height="150">
          <g className="gf-mail-env">
            <rect x="50" y="62" width="120" height="78" rx="12" fill="#7D5CEF" />
            <g className="gf-mail-card">
              <rect x="66" y="18" width="88" height="70" rx="8" fill="#fff" stroke="#E4DDF7" strokeWidth="2" />
              {selfie ? <image href={selfie} x="72" y="24" width="76" height="46" preserveAspectRatio="xMidYMid slice" clipPath="inset(0 round 5px)" /> : <>
                <rect x="72" y="24" width="76" height="46" rx="5" fill="#F3EEFF" />
                <circle cx="94" cy="40" r="7" fill="#FFC56B" /><path d="M76 66l20-17 14 11 12-9 22 15z" fill="#C9B8FA" />
              </>}
            </g>
            <path d="M50 74l60 40 60-40v54a12 12 0 0 1-12 12H62a12 12 0 0 1-12-12z" fill="#8B6CF2" />
            <path className="gf-mail-flap" d="M50 74a12 12 0 0 1 12-12h96a12 12 0 0 1 12 12l-60 40z" fill="#5B3FD0" />
          </g>
          <g className="gf-mail-done">
            <circle cx="110" cy="76" r="34" fill="#1F8A5B" />
            <path d="M94 77l11 11 21-23" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      </div>
      <h1 className="gf-mail-text" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15, animationDelay: "1.9s" }}>{T("You are on the list")}</h1>
      <p className="gf-mail-text" style={{ marginTop: 8, fontSize: 15.5, lineHeight: 1.5, color: "#4A4658", maxWidth: 330, animationDelay: "2.05s" }}>
        {where ? <>{T("When {studio} has your photos from {event} ready, your private link comes {by} to", { studio, event: title, by })} <b style={{ color: "#17151F", overflowWrap: "anywhere" }}>{where}</b></> : T("{studio} will send you your photos from {event} when they are ready. You can close this page now.", { studio, event: title })}
      </p>
      {/* What happens next, in order */}
      <ol className="gf-steps gf-mail-text" style={{ animationDelay: "2.2s" }} aria-label={T("What happens next")}>
        <li style={{ animationDelay: "2.3s" }}><span className="gf-dot gf-dot-ok"><Ic size={13} w={3.2} d={<path d="M5 12.5l4.5 4.5L19 7.5" />} /></span><span><b>{T("Today")}</b>{T("Your selfie is saved. You are on the list.")}</span></li>
        <li style={{ animationDelay: "2.45s" }}><span className="gf-dot">2</span><span><b>{T("In a few days")}</b>{T("{studio} edits the photos and finds the ones you are in.", { studio })}</span></li>
        <li style={{ animationDelay: "2.6s" }}><span className="gf-dot">3</span><span><b>{T("Your link arrives")}</b>{sentTo.email ? T("Check your inbox, and your spam folder too.") : T("Open it to see and save your photos. No new selfie needed.")}</span></li>
      </ol>
      <div className="gf-mail-text" style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 6, animationDelay: "2.8s" }}>
        <p style={{ fontSize: 13, color: "#6B6680" }}>{T("You can close this page now. Scanning the code again on this phone also shows your photos when they are ready.")}</p>
        <button type="button" onClick={onRetake} style={{ height: 46, border: 0, background: "transparent", fontSize: 15, fontWeight: 700, color: "#4A4658" }}>{T("Take the selfie again")}</button>
      </div>
    </div>
  );
}

/** A likely typo in a common email address ("gmial.com", "gmail.con") → the fixed address, else "". */
const MAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "live.com", "ymail.com"];
function emailFix(v: string) {
  const m = /^([^\s@]+)@([^\s@]+)$/.exec(v.trim().toLowerCase());
  if (!m) return "";
  const [, user, dom] = m;
  if (MAIL_DOMAINS.includes(dom)) return "";
  const dist = (a: string, b: string) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  let best = "", bestD = 3;
  for (const k of MAIL_DOMAINS) { const x = dist(dom, k); if (x < bestD) { best = k; bestD = x; } }
  // "gmail" with no ending, or one or two letters off a common address.
  if (!best && /^(gmail|gmal|gmial|gamil|yahoo|hotmail|outlook)$/.test(dom)) best = dom.startsWith("g") ? "gmail.com" : `${dom}.com`;
  return best ? `${user}@${best}` : "";
}

// ─── Follow the studio ───────────────────────────────────────────────────────

type Page = { site: "facebook" | "instagram"; url: string };
const SITE = { facebook: "Facebook", instagram: "Instagram" } as const;
/** "instagram.com/pickphoto" → "pickphoto" (the name shown, and the tag in the share caption). */
const handleOf = (url: string) => {
  try {
    const first = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
    // Share links and id links ("facebook.com/share/…", "profile.php?id=…") have no name to show.
    return /^(share|profile\.php|pages|people|p|reel|groups)$/i.test(first) ? "" : first;
  } catch { return ""; }
};
/** The words copied when a guest shares a photo. */
function captionFor(g: Open) {
  const ig = g.follow?.find(p => p.site === "instagram");
  const handle = ig ? handleOf(ig.url) : "";
  const t = (g.shareCaption || "").trim() || (handle ? "📸 Photo by @{handle}" : "📸 Photo by {studio}");
  return t.replace(/\{studio\}/gi, g.studio.name).replace(/\{event\}/gi, g.title).replace(/\{handle\}/gi, handle ? `@${handle}` : g.studio.name).replace(/@@/g, "@");
}

/** One page to follow: a big row that opens Instagram or Facebook (the app itself on a phone, through the normal link). */
function PageRow({ p, onOpened }: { p: Page; onOpened: () => void }) {
  const handle = handleOf(p.url);
  return (
    <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => { track("follow", p.site); onOpened(); }} className={`gf-follow gf-follow-${p.site}`}>
      <span className="gf-follow-tile" aria-hidden="true">
        <Ic size={22} w={2.2} d={<><circle cx="10" cy="8" r="3.4" /><path d="M3.8 19.5c.9-3.300 3.400-5 6.200-5s5.300 1.700 6.200 5" /><path d="M18.5 8v6M15.5 11h6" /></>} />
      </span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#17151F" }}>{T("Follow on {site}", { site: SITE[p.site] })}</span>
        {handle && <span style={{ display: "block", fontSize: 13, color: "#6B6680", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.site === "instagram" ? `@${handle}` : handle}</span>}
      </span>
      <Ic d={<path d="M9 6l6 6-6 6" />} w={2.4} />
    </a>
  );
}

/** Watches for the guest coming back from the page they opened (the app or a new tab). */
function useCameBack(onBack: () => void) {
  const away = useRef(false);
  const fired = useRef(false);
  useEffect(() => {
    const back = () => { if (away.current && document.visibilityState === "visible" && !fired.current) { fired.current = true; onBack(); } };
    document.addEventListener("visibilitychange", back); window.addEventListener("focus", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [onBack]);
  return () => {
    away.current = true;
    // A page that opened in the same window, or a blocked new tab: thank them anyway after a moment.
    setTimeout(() => { if (!fired.current) { fired.current = true; onBack(); } }, 2600);
  };
}

/** Phones: how to come back from the Instagram or Facebook app. */
function BackHint() {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return null;
  return (
    <p style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "12px 4px 0", fontSize: 13, lineHeight: 1.45, color: "#6B6680" }}>
      <Ic size={16} w={2.2} d={<><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.500 5.500 0 0 1 0 11H11" /></>} />
      <span>{T("After following, come back here with your phone's Back button. Your photos stay open.")}</span>
    </p>
  );
}

/**
 * After the photos: the studio asks for the next booking (WhatsApp, with a ready message) and for a review.
 * Comes in softly when scrolled into view.
 */
/** What the Book us card says and offers; `onTap` = a button was used (book or review). */
function BookBody({ g, onTap }: { g: Open; onTap?: (kind: "book" | "review") => void }) {
  const book = !!(g.bookButton && g.bookWhatsApp);
  const text = (g.bookText || T("Hi {studio}, I saw my photos from {event}. I would like to book you for my event.", { studio: g.studio.name, event: g.title }))
    .replace(/\{studio\}/gi, g.studio.name).replace(/\{event\}/gi, g.title);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar g={g} size={48} />
        <div style={{ minWidth: 0 }}>
          <h2 id="gf-book-t" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.25 }}>{book ? T("Planning an event?") : T("Loved your photos?")}</h2>
          <p style={{ fontSize: 14, lineHeight: 1.45, color: "#4A4658" }}>{book ? T("{studio} can photograph your day too.", { studio: g.studio.name }) : T("Tell others about {studio}.", { studio: g.studio.name })}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {book && <a className="gf-book-wa" href={`https://wa.me/${g.bookWhatsApp}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => { track("book"); onTap?.("book"); }}>
          <Ic size={20} w={2.2} d={<><path d="M20 11.5a8 8 0 0 1-11.800 7.050L4 20l1.500-4.100A8 8 0 1 1 20 11.500z" /><path d="M9 9.500c.300 1.800 1.700 3.300 3.500 3.800" /></>} />
          {T("Book on WhatsApp")}
        </a>}
        {g.reviewUrl && <a className="gf-book-review" href={g.reviewUrl} target="_blank" rel="noopener noreferrer" onClick={() => { track("review"); onTap?.("review"); }}>
          <Ic size={18} w={2.2} d={<path d="M12 3.500l2.600 5.300 5.800.800-4.200 4.100 1 5.800L12 16.800 6.800 19.500l1-5.800L3.600 9.600l5.800-.800z" />} />
          {T("Leave a review")}
        </a>}
      </div>
    </>
  );
}

/** The Book us card in the list, after the photos: rises in when scrolled to, fades away when scrolled back up. */
function BookCard({ g }: { g: Open }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.classList.add("gf-book-in"); return; }
    // In view: it rises in; scrolled back up: it fades away, and comes again next time.
    const o = new IntersectionObserver(e => setSeen(!!e[0]?.isIntersecting), { threshold: 0.3 });
    o.observe(el); return () => o.disconnect();
  }, []);
  if (!(g.bookButton && g.bookWhatsApp) && !g.reviewUrl) return null;
  return (
    <section ref={ref} className={`gf-book${seen ? " gf-book-in" : ""}`} aria-label={T("Book {studio}", { studio: g.studio.name })}>
      <BookBody g={g} />
    </section>
  );
}

/** The Book us card sliding up at the moment the studio chose; "Not now" always closes it. */
function BookSheet({ g, onDone, onClose }: { g: Open; onDone: (booked: boolean) => void; onClose: () => void }) {
  const [out, setOut] = useState(false);
  const close = useCallback(() => { setOut(true); setTimeout(onClose, 240); }, [onClose]);
  const skip = useCallback(() => { onDone(false); close(); }, [onDone, close]);
  useEffect(() => { const t = setTimeout(() => (document.querySelector(".gf-sheet") as HTMLElement | null)?.focus({ preventScroll: true }), 420); return () => clearTimeout(t); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") skip(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [skip]);
  return (
    <div className={`gf-sheet-wrap${out ? " gf-sheet-out" : ""}`} onClick={e => { if (e.target === e.currentTarget) skip(); }}>
      <div className="gf-sheet" role="dialog" aria-modal="true" aria-labelledby="gf-book-t" tabIndex={-1} style={{ outline: "none" }}>
        <span className="gf-sheet-grip" aria-hidden="true" />
        <BookBody g={g} onTap={kind => { onDone(kind === "book"); close(); }} />
        <button type="button" onClick={skip} className="gf-sheet-skip" style={{ width: "100%", marginTop: 6 }}>{T("Not now")}</button>
      </div>
    </div>
  );
}

function Avatar({ g, size = 64 }: { g: Open; size?: number }) {
  return g.studio.logoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <StudioLogo url={g.studio.logoUrl} name={g.studio.name} size={size} tone="onDark" className="gf-ava" />
    : <span className="gf-ava" style={{ width: size, height: size, fontSize: size * 0.32 }}>{initials(g.studio.name)}</span>;
}

/** The tick after following: a ring draws, a check follows. */
const Thanks = ({ studio }: { studio: string }) => (
  <div className="gf-thanks" role="status">
    <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
      <circle className="gf-thanks-ring" cx="32" cy="32" r="28" fill="none" stroke="#1F8A5B" strokeWidth="5" pathLength={1} />
      <path className="gf-thanks-tick" d="M20 33l8 8 16-17" fill="none" stroke="#1F8A5B" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
    <b style={{ fontSize: 20 }}>{T("Thank you!")}</b>
    <span style={{ fontSize: 14, color: "#4A4658" }}>{T("You will see new work from {studio}.", { studio })}</span>
  </div>
);

/**
 * The follow card: slides up over the photos at the moment the studio chose. Once per guest.
 * With `gate` (a download waiting), the card ends with the download; without, it closes by itself after the thanks.
 */
function FollowSheet({ g, gate, onFollowed, onSkip, onClose }: { g: Open; gate?: () => void; onFollowed: () => void; onSkip: () => void; onClose: () => void }) {
  const [state, setState] = useState<"ask" | "thanks">("ask");
  const [out, setOut] = useState(false);
  const must = !!gate && g.followSkip === false;
  const close = useCallback(() => { setOut(true); setTimeout(onClose, 240); }, [onClose]);
  const back = useCallback(() => {
    onFollowed(); setState("thanks");
    if (!gate) setTimeout(close, 1700);
  }, [gate, onFollowed, close]);
  const cameBack = useCameBack(back);
  // Saved the moment a page is opened: if the phone reloads this page while the guest is away, the card does not come back.
  const opened = () => { onFollowed(); cameBack(); };
  // Focus goes into the card (screen readers start there) without lighting up a button.
  useEffect(() => { const t = setTimeout(() => (document.querySelector(".gf-sheet") as HTMLElement | null)?.focus({ preventScroll: true }), 420); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !must) { if (state === "ask") onSkip(); close(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [must, state, onSkip, close]);
  const skip = () => { onSkip(); close(); gate?.(); };
  const go = () => { close(); gate?.(); };
  return (
    <div className={`gf-sheet-wrap${out ? " gf-sheet-out" : ""}`} onClick={e => { if (e.target === e.currentTarget && !must) skip(); }}>
      <div className="gf-sheet" role="dialog" aria-modal="true" aria-labelledby="gf-sheet-t" tabIndex={-1} style={{ outline: "none" }}>
        <span className="gf-sheet-grip" aria-hidden="true" />
        {state === "ask" ? <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <span className="gf-ava-ring"><Avatar g={g} /></span>
            <h2 id="gf-sheet-t" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2 }}>{g.followTitle || T("Enjoying your photos?")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: "#4A4658", maxWidth: 320 }}>{g.followText || T("Follow {studio} to see more of their work.", { studio: g.studio.name })}</p>
          </div>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {g.follow!.map(p => <PageRow key={p.site} p={p} onOpened={opened} />)}
          </div>
          <BackHint />
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
            {must
              ? <p style={{ textAlign: "center", fontSize: 13, color: "#6B6680", padding: "10px 0 2px" }}>{T("Open a page, then come back here for your download.")}</p>
              : <button type="button" onClick={skip} className="gf-sheet-skip">{gate ? T("Skip and download") : T("Not now")}</button>}
          </div>
        </> : <>
          <Thanks studio={g.studio.name} />
          {gate && <button type="button" className="gf-cta" onClick={go} style={{ marginTop: 18 }}><Ic d={DL} />{T("Download")}</button>}
        </>}
      </div>
    </div>
  );
}

/** "Before the photos": the same card as a whole screen. */
function Follow({ g, count, onFollowed, onSkip, onTapped }: { g: Open; count: number; onFollowed: () => void; onSkip: () => void; /** A page was opened: saved at once */ onTapped?: () => void }) {
  const [done, setDone] = useState(false);
  const back = useCallback(() => setDone(true), []);
  const cameBack = useCameBack(back);
  const opened = () => { onTapped?.(); cameBack(); };
  return (
    <div className="gf-step" style={{ padding: "34px 22px 26px" }}>
      <div className="gf-rise" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <span className="gf-ava-ring"><Avatar g={g} size={76} /></span>
        <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15 }}>{g.followTitle || T("One small thing first")}</h1>
        <p style={{ fontSize: 15, color: "#4A4658", maxWidth: 320 }}>{g.followText || T("{studio} took these photos. Follow their page, then open your {photos}.", { studio: g.studio.name, photos: P(count) })}</p>
      </div>
      <div className="gf-rise" style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 10, animationDelay: ".12s" }}>
        {done ? <Thanks studio={g.studio.name} /> : <>{g.follow!.map(p => <PageRow key={p.site} p={p} onOpened={opened} />)}<BackHint /></>}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 22, display: "flex", flexDirection: "column", gap: 4 }}>
        <button type="button" className="gf-cta" disabled={!done && g.followSkip === false} onClick={done ? onFollowed : onSkip} style={{ opacity: !done && g.followSkip === false ? .5 : 1 }}>
          {T(count === 1 ? "See my photo" : "See my photos")}
        </button>
        {!done && g.followSkip === false && <p style={{ textAlign: "center", fontSize: 13, color: "#6B6680", paddingTop: 6 }}>{T("Open a page first, then come back here.")}</p>}
      </div>
    </div>
  );
}

/**
 * Download on a phone: the photo is fetched when it opens, so one tap hands it to the share sheet ("Save image").
 * If the phone still asks for a fresh tap, the button turns into "Save photo" (ready) for that tap.
 */
function SaveOne({ photo, sheet, gate, onSaved }: { photo: FacePhoto; /** iPhone: through the share sheet; else a file download */ sheet: boolean; gate: (run: () => void) => void; onSaved: () => void }) {
  const [done, setDone] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"" | "getting" | "ready">("");
  const want = useRef(false);
  useEffect(() => {
    // Fetched once the photo has stayed open a moment (not for every photo swiped past).
    let on = true;
    const t = setTimeout(() => { void fileOf(photo).then(f => { if (on && f) setFile(f); }); }, 700);
    return () => { on = false; clearTimeout(t); };
  }, [photo]);
  const hand = useCallback(async (f: File) => {
    if (!sheet) { saveFile(f); setState(""); setDone(true); setTimeout(() => setDone(false), 2600); onSaved(); return; }
    try { await navigator.share({ files: [f] }); setState(""); onSaved(); }
    catch (e) { setState((e as Error).name === "AbortError" ? "" : "ready"); }
  }, [onSaved, sheet]);
  // Tapped before the photo was here: it is handed over the moment it arrives.
  useEffect(() => { if (file && want.current) { want.current = false; void hand(file); } }, [file, hand]);
  const go = () => {
    if (file) return void hand(file);
    want.current = true; setState("getting");
  };
  return (
    <button type="button" className={state === "ready" ? "gf-ready" : undefined} onClick={() => (state === "ready" ? go() : gate(go))} disabled={state === "getting"}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, padding: "0 26px", borderRadius: 18, border: 0, background: "#7D5CEF", color: "#fff", fontWeight: 700, fontSize: 16 }}>
      {state === "getting" ? <span className="gf-dots" aria-hidden="true"><i style={{ background: "#fff" }} /><i style={{ background: "#fff" }} /><i style={{ background: "#fff" }} /></span> : <Ic d={DL} />}
      {state === "getting" ? T("Getting the photo") : state === "ready" ? T("Save photo") : done ? T("Saved") : T("Download")}
    </button>
  );
}

/**
 * Share: the photo goes to the phone's share sheet (Instagram, Facebook, WhatsApp…). The caption with the studio's
 * tag is copied first, because Instagram does not take text: the guest pastes it.
 */
function ShareButton({ photo, caption }: { photo: FacePhoto; caption: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const can = typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] });
  // Fetched as soon as the photo is open, so the tap goes straight to the share sheet (phones need that).
  useEffect(() => {
    if (!can) return;
    let on = true; setFile(null);
    fetch(facePhotoUrl(photo, 1600)).then(r => (r.ok ? r.blob() : null)).then(b => { if (on && b) setFile(new File([b], `${(photo.fileName || "photo").replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" })); }).catch(() => undefined);
    return () => { on = false; };
  }, [photo, can]);
  if (!can) return null;
  async function share() {
    track("share");
    if (!file) return;
    try { await navigator.clipboard.writeText(caption); } catch { /* the share still works */ }
    setNote(T("Caption copied. Paste it when you post."));
    setTimeout(() => setNote(""), 3600);
    try { await navigator.share({ files: [file], text: caption }); } catch { /* closed the sheet */ }
  }
  return (
    <>
      <button type="button" onClick={share} disabled={!file} aria-label={T("Share")}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, padding: "0 20px", borderRadius: 18, border: 0, background: "rgba(255,255,255,.14)", color: "#fff", fontWeight: 700, fontSize: 16, opacity: file ? 1 : .55 }}>
        <Ic d={<><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>} />{T("Share")}
      </button>
      {note && <p role="status" className="gf-toast">{note}</p>}
    </>
  );
}

// ─── Selfie ───────────────────────────────────────────────────────────────────

function Selfie({ title, note, onBack, onShot }: { title: string; note: string; onBack: () => void; onShot: (image: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [live, setLive] = useState(false);
  const [denied, setDenied] = useState(false);
  const [pct, setPct] = useState(0);
  const [flash, setFlash] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let on = true;
    setLive(false); setPct(0); done.current = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then(s => {
        if (!on) return s.getTracks().forEach(t => t.stop());
        stream = s;
        if (video.current) { video.current.srcObject = s; video.current.play().then(() => setLive(true)).catch(() => setLive(true)); }
      })
      .catch(() => { if (on) setDenied(true); });
    return () => { on = false; stream?.getTracks().forEach(t => t.stop()); };
  }, [facing]);

  const shoot = useCallback(async () => {
    const v = video.current;
    if (done.current || !v || !v.videoWidth) return;
    done.current = true;
    setFlash(true);
    const image = await shrink(v, v.videoWidth, v.videoHeight);
    setTimeout(() => onShot(image), 380);
  }, [onShot]);

  // The scan: the face is checked on this phone a few times a second. The meter fills only while the face is
  // clear, centred, the right size, well lit and still; then the selfie is taken by itself. If any of that is
  // lost the meter goes back down. The guest can also press the button at any time.
  const [face, setFace] = useState<FaceState | "off" | "wait">("wait");
  useEffect(() => {
    if (!live) return;
    let on = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let p = 0;
    loadFaceCheck().then(check => {
      if (!on) return;
      timer = setInterval(() => {
        const v = video.current;
        if (!v || done.current) return;
        const state = check(v);
        // About 1.3 s of a perfect face fills it; anything else lets it fall back quickly.
        p = state === "good" ? Math.min(100, p + 12) : Math.max(0, p - 20);
        setFace(state); setPct(p);
        if (p >= 100) shoot();
      }, 150);
    }).catch(() => { if (on) setFace("off"); });
    return () => { on = false; if (timer) clearInterval(timer); };
  }, [live, shoot]);

  async function picked(f?: File) {
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      done.current = true;
      onShot(await shrink(bmp, bmp.width, bmp.height));
    } catch { alertBad(); }
  }
  const [bad, setBad] = useState("");
  const alertBad = () => setBad(T("We could not open that photo. Please pick a JPG or PNG."));
  const locked = pct >= 100;
  // A face is in the oval (even if it still needs a small fix): the mesh and the beam show only then.
  const seen = face !== "wait" && face !== "off" && face !== "none" && face !== "many";
  const ghost: React.CSSProperties = { height: 48, padding: "0 16px", borderRadius: 16, border: 0, background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 14, fontWeight: 600 };

  return (
    <div className="gf-step gf-cam">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 0", flex: "none" }}>
        <button type="button" aria-label="Back" onClick={onBack} style={{ width: 46, height: 46, borderRadius: 16, border: 0, background: "rgba(255,255,255,.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic d={BACK} w={2.4} /></button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#C9C4D8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 10px" }}>{title}</span>
        <span style={{ width: 46 }} aria-hidden="true" />
      </div>
      <div className="gf-rise" style={{ padding: "16px 28px 0", textAlign: "center", display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.12 }}>{denied ? T("Camera is off") : locked ? T("Got it") : T("Look at the camera")}</h1>
        <p style={{ fontSize: 15, minHeight: 23, fontWeight: 600, color: note || bad ? "#FF9DB0" : face === "good" ? "#3DD68C" : "#C9C4D8" }} role={note || bad ? "alert" : "status"} aria-live="polite">
          {bad || note || (denied ? T("Allow the camera in your browser, or pick a photo of your face.")
            : face === "off" ? T("Keep your face inside the oval, then press the round button.")
            : face === "wait" ? T("Keep your face inside the oval.")
            : FACE_HINT[face])}
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className={`gf-oval${locked ? " gf-lock" : ""}`}>
          <span className="gf-br tl" aria-hidden="true" /><span className="gf-br tr" aria-hidden="true" /><span className="gf-br bl" aria-hidden="true" /><span className="gf-br br" aria-hidden="true" />
          <div className="gf-ovalclip" style={{ background: "#1F1B2B" }}>
            <video ref={video} playsInline muted className={facing === "environment" ? "back" : ""} aria-label="Camera preview" />
            {live && seen && <Mesh now />}
            {live && seen && <div className="gf-beam" aria-hidden="true" />}
          </div>
          <svg viewBox="0 0 268 352" aria-hidden="true"><ellipse className="gf-wave" cx="134" cy="176" rx="130" ry="172" /><ellipse className="gf-wave w2" cx="134" cy="176" rx="130" ry="172" /><ellipse className="gf-wave w3" cx="134" cy="176" rx="130" ry="172" /><ellipse className="gf-ring" cx="134" cy="176" rx="130" ry="172" /></svg>
        </div>
      </div>
      <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, flex: "none" }}>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }} role="status" aria-live="polite">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}><span>{denied ? T("Waiting for the camera") : locked ? T("Face found") : !live ? T("Starting the camera") : face === "off" ? T("Press the button when ready") : seen ? T("Scanning your face") : T("Looking for your face")}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</span></div>
          <div className="gf-meter"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <button type="button" style={ghost} onClick={() => file.current?.click()}>{T("Use a photo")}</button>
          <button type="button" aria-label="Take the selfie now" onClick={shoot} disabled={!live} style={{ width: 72, height: 72, borderRadius: "50%", border: "5px solid #fff", background: "#7D5CEF", boxShadow: "0 0 0 6px rgba(125,92,239,.35)", opacity: live ? 1 : .4 }} />
          <button type="button" style={ghost} onClick={() => setFacing(f => (f === "user" ? "environment" : "user"))}>{T("Flip")}</button>
        </div>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => picked(e.target.files?.[0])} />
      </div>
      {flash && <div className="gf-flash" aria-hidden="true" />}
    </div>
  );
}

// ─── Searching ────────────────────────────────────────────────────────────────

function Searching({ selfie, count }: { selfie: string; count: number }) {
  return (
    <div className="gf-step" style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
      <div style={{ position: "relative" }}>
        <span className="gf-radar" aria-hidden="true" /><span className="gf-radar d2" aria-hidden="true" /><span className="gf-radar d3" aria-hidden="true" />
        <div className="gf-face">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selfie} alt="Your selfie" style={{ objectFit: "cover" }} />
          <div className="gf-beam" aria-hidden="true" />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} role="status" aria-live="polite">
        <span key={count} className="gf-count gf-bump-a">{N(count)}</span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{count === 1 ? T("photo of you so far") : T("photos of you so far")}</span>
        <span style={{ fontSize: 14, color: "#6B6680", marginTop: 6 }}>{T("Matching your face with the event photos")}</span>
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results({ g, res, selfie, base, took, onItsMe, onOpen, onRetake, gate = run => run(), onDownloaded }: { g: Open; res: Result; selfie: string; base: string; /** Seconds the search took (fresh search only) */ took?: number | null; onItsMe?: (id: string) => void; onOpen: (list: List, i: number) => void; onRetake: () => void;
  /** "When Download is pressed": the studio's card first, then `run` */ gate?: (run: () => void) => void; /** After photos were saved */ onDownloaded?: () => void }) {
  const n = res.photos.length;
  const [saving, setSaving] = useState(0);
  const frames = useRef<HTMLDivElement>(null);
  /** The all-photos link, no selfie taken: one list of every photo. */
  const noSelfie = res.selfie === false && n === 0;
  /** What "Download all" saves: the guest's own photos, or (all-photos link, no selfie) every photo when they are not too many. */
  const mainList = noSelfie ? (res.more.length <= 200 ? res.more : []) : res.photos;
  const m = mainList.length;
  const moreTitle = useMemo(() => (res.moreKind === "all" ? T("All event photos") : T("Highlights from the event")), [res.moreKind]);

  // Each file is fetched from Google Drive as a download; a short gap keeps phones from blocking them.
  /** Photos fetched and waiting for one more tap (phones: the share sheet's "Save images" needs a fresh tap). */
  const [held, setHeld] = useState<File[] | null>(null);
  const [saveNote, setSaveNote] = useState("");
  /** Saving file i of the ones fetched (Android, computers). */
  const [storing, setStoring] = useState(0);

  /** Hand the fetched photos to the phone ("Save images"), or save them one by one. */
  /** Phones and tablets: the share sheet has "Save images". A computer saves the files straight to Downloads. */
  const toSheet = (files: File[]) => isApple() && !!navigator.canShare?.({ files });

  async function give(files: File[]) {
    if (toSheet(files)) {
      try { await navigator.share({ files }); setHeld(null); setSaveNote(""); onDownloaded?.(); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; /* closed the sheet: keep them for another try */ }
    }
    // One at a time with a pause: Android drops a download that starts before the one before it was taken,
    // and may ask once to allow several downloads.
    const gap = touch() ? 1500 : 600;
    if (files.length > 1 && touch()) setSaveNote(T("If your phone asks, tap Allow to save all photos."));
    for (let i = 0; i < files.length; i++) {
      setStoring(i + 1);
      saveFile(files[i]);
      if (i < files.length - 1) await new Promise(ok => setTimeout(ok, gap));
    }
    setStoring(0);
    setHeld(null);
    if (files.length > 1) { setSaveNote(T("{photos} saved to Downloads.", { photos: P(files.length) })); setTimeout(() => setSaveNote(""), 5000); }
  }

  /** Choosing mode: a tap ticks a photo instead of opening it, and only the ticked ones are downloaded. */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const everyone = useMemo(() => [...res.photos, ...res.more.filter(m => !res.photos.some(p => p.id === m.id))], [res.photos, res.more]);
  const chosen = everyone.filter(p => picked.includes(p.id));
  const toggle = (id: string) => { setHeld(null); setSaveNote(""); setPicked(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id])); };
  const stopPicking = () => { setPicking(false); setPicked([]); setHeld(null); setSaveNote(""); };
  /** How many photos the download in hand is about (for the button's words). */
  const [total, setTotal] = useState(0);

  /** Download these photos: all of the guest's own, or the ones they ticked. */
  async function download(list: FacePhoto[]) {
    const n = list.length;
    if (held) return give(held);
    if (saving || storing || !n) return;
    setSaveNote(""); setTotal(n);
    counted(base, res.key, n);
    // Phones: the photos are fetched (several at once) and handed to the share sheet ("Save images").
    // Computers: watermarked photos are fetched and saved; originals come straight from Google Drive.
    const phone = touch();
    if (list[0]?.wm || list[0]?.file || phone) {
      const files: (File | null)[] = new Array(n).fill(null);
      let done = 0;
      for (let i = 0; i < n; i += 4) {
        await Promise.all(list.slice(i, i + 4).map(async (p, k) => {
          files[i + k] = phone ? await fileOf(p, i + k) : await fetch(faceSaveUrl(p)).then(async r => (r.ok ? new File([await r.blob()], `${(p.fileName || `photo-${i + k + 1}`).replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" }) : null)).catch(() => null);
          setSaving(++done);
        }));
      }
      setSaving(0);
      const got = files.filter((f): f is File => !!f);
      if (!got.length) return setSaveNote(T("The photos could not be downloaded. Please check your internet and try again."));
      if (got.length < n) setSaveNote(T("{photos} could not be downloaded. Open them and press Download.", { photos: P(n - got.length) }));
      if (toSheet(got)) {
        // Most phones still allow the share sheet from the same tap; if this one does not, one more tap is asked for, clearly.
        try { await navigator.share({ files: got }); onDownloaded?.(); return; }
        catch (e) { if ((e as Error).name === "AbortError") { setHeld(got); return; } setHeld(got); setSaveNote(T("Your photos are ready. Tap Save to keep them.")); return; }
      }
      await give(got); onDownloaded?.(); return;
    }
    for (let i = 0; i < n; i++) {
      setSaving(i + 1);
      const f = document.createElement("iframe");
      f.style.display = "none"; f.src = faceSaveUrl(list[i]);
      frames.current?.appendChild(f);
      await new Promise(ok => setTimeout(ok, 900));
    }
    setSaving(0);
    onDownloaded?.();
  }

  const maybe = res.maybe ?? [];
  /** "These might be you too" opened (closed by default: they are not sure). */
  const [showMaybe, setShowMaybe] = useState(false);
  const tile = (p: FacePhoto, i: number, list: List) => {
    const on = picking && picked.includes(p.id);
    return (
      <button key={p.id} type="button" className={`gf-print${picking ? " gf-pick" : ""}${on ? " gf-picked" : ""}`} onClick={() => (picking ? toggle(p.id) : onOpen(list, i))}
        aria-label={picking ? `${on ? "Take out" : "Choose"} photo ${i + 1}` : `Open photo ${i + 1}`} aria-pressed={picking ? on : undefined}
        style={{ ["--r" as string]: `${i % 2 ? 7 : -7}deg`, animationDelay: `${Math.min(i, 10) * 0.07}s`, padding: 5 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={facePhotoUrl(p, 480)} alt="" loading={i > 11 ? "lazy" : undefined} decoding="async" referrerPolicy="no-referrer" className="gf-wait"
          onLoad={e => e.currentTarget.classList.remove("gf-wait")}
          style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : "4 / 5", background: "#F1EFF6" }} />
        {picking && <span className="gf-tick" aria-hidden="true">{on && <Ic size={16} w={3.2} d={<path d="M5 12.5l4.5 4.500L19 7.500" />} />}</span>}
      </button>
    );
  };
  /** A near miss: the photo, and a "Yes, it's me" button under it. */
  const unsure = (p: FacePhoto, i: number) => (
    <div key={p.id} className="gf-maybe-tile" style={{ animationDelay: `${Math.min(i, 10) * 0.06}s` }}>
      <button type="button" onClick={() => onOpen("maybe", i)} aria-label={`Open photo ${i + 1} that might be you`} className="gf-maybe-pic">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={facePhotoUrl(p, 480)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : "4 / 5", background: "#F1EFF6" }} />
      </button>
      <button type="button" className="gf-yes" onClick={() => onItsMe?.(p.id)}><Ic size={15} w={3} d={<path d="M5 12.5l4.5 4.5L19 7.5" />} />{T("It's me")}</button>
    </div>
  );

  return (
    <div className="gf-step">
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 18px 8px", flex: "none" }}>
        {selfie
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="gf-drop" src={selfie} alt="Your selfie" style={{ width: 48, height: 48, borderRadius: "50%", boxShadow: "0 0 0 3px #fff", objectFit: "cover" }} />
          : noSelfie ? null : <span style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEE8FD", flex: "none" }} aria-hidden="true" />}
        <div className="gf-rise" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.025em" }}>{n ? T("{photos} of you", { photos: P(n) }) : noSelfie ? T("All event photos") : T("No photos of you yet")}</h1>
          <span style={{ fontSize: 13, color: "#6B6680", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{noSelfie ? `${P(res.more.length)} · ` : ""}{T("{event}, by {studio}", { event: g.title, studio: g.studio.name })}</span>
        </div>
        {picking
          ? <button type="button" onClick={() => { setHeld(null); setPicked(picked.length === everyone.length ? [] : everyone.map(p => p.id)); }} style={{ height: 44, padding: "0 14px", borderRadius: 14, border: 0, background: "#fff", color: "#4B32B8", fontSize: 13, fontWeight: 700, flex: "none" }}>{picked.length === everyone.length ? T("Clear all") : T("Choose all")}</button>
          : <button type="button" onClick={onRetake} style={{ height: 44, padding: "0 14px", borderRadius: 14, border: 0, background: "#fff", color: "#17151F", fontSize: 13, fontWeight: 700, flex: "none" }}>{noSelfie ? T("Find my photos") : T("New selfie")}</button>}
      </div>
      {picking && <p role="status" style={{ flex: "none", margin: "0 18px 8px", padding: "9px 14px", borderRadius: 14, background: "rgba(125,92,239,.14)", color: "#4B32B8", fontSize: 14, fontWeight: 700 }}>{picked.length ? T("{n} chosen. Tap more, or press Download.", { n: N(picked.length) }) : T("Tap the photos you want to download.")}</p>}
      <div className="gf-scroll">
        {n === 0 && !noSelfie && (
          <div className="gf-glass gf-rise" style={{ padding: "16px 16px", borderRadius: 22, marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <b style={{ fontSize: 16 }}>{T("We looked through every photo.")}</b>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "#4A4658" }}>{T("More photos may still be added. Open this page again later and your photos will show here by themselves. A clearer selfie also helps: face the light and take off sunglasses.")}</span>
          </div>
        )}
        {!picking && !noSelfie && took != null && (res.searched ?? 0) > 0 && (
          <p className="gf-rise gf-searched" role="status"><span className="gf-searched-dot" aria-hidden="true" />{T("Looked through {photos} in {secs} seconds", { photos: P(res.searched ?? 0), secs: took.toFixed(1) })}</p>
        )}
        <div className="gf-cols">{res.photos.map((p, i) => tile(p, i, "mine"))}</div>
        {!picking && maybe.length > 0 && (showMaybe ? (
          <section className="gf-maybe gf-rise" aria-label="Photos that might be you">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, margin: "0 2px 10px" }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800 }}>{T("These might be you too")}</h2>
                <p style={{ fontSize: 13.5, color: "#5B5670", marginTop: 2, lineHeight: 1.45 }}>{T("We are not sure about these. Tap It's me on the ones you are in, and they join your photos.")}</p>
              </div>
              <button type="button" onClick={() => setShowMaybe(false)} style={{ height: 36, padding: "0 12px", borderRadius: 12, border: 0, background: "rgba(23,21,31,.06)", fontSize: 13, fontWeight: 700, color: "#4A4658", flex: "none" }}>{T("Hide")}</button>
            </div>
            <div className="gf-cols">{maybe.map((p, i) => unsure(p, i))}</div>
          </section>
        ) : (
          <button type="button" className="gf-maybe-open gf-rise" onClick={() => setShowMaybe(true)}>
            <span className="gf-maybe-stack" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {maybe.slice(0, 3).map((p, i) => <img key={p.id} src={facePhotoUrl(p, 160)} alt="" referrerPolicy="no-referrer" style={{ ["--k" as string]: i }} />)}
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 15.5 }}>{T("Show me more photos")}</b>
              <span style={{ fontSize: 13, color: "#5B5670" }}>{T("{photos} might be you too", { photos: P(maybe.length) })}</span>
            </span>
            <Ic size={18} w={2.4} d={<path d="M9 5l7 7-7 7" />} />
          </button>
        ))}
        {res.more.length > 0 && (
          <>
            {!noSelfie && <h2 style={{ fontSize: 17, fontWeight: 800, margin: "18px 4px 10px" }}>{moreTitle}</h2>}
            <div className="gf-cols">{res.more.map((p, i) => tile(p, i, "more"))}</div>
          </>
        )}
        {/* In the list after the photos: always with "end"; with a slide-up moment only if the studio keeps it there too */}
        {!picking && (n > 0 || res.more.length > 0) && ((g.bookWhen ?? "end") === "end" || g.bookKeepCard !== false) && <BookCard g={g} />}
      </div>
      {(n > 0 || res.more.length > 0) && res.downloads && res.downloadAll !== false && (
        <div className="gf-bar gf-glass" style={{ flexDirection: "column", gap: saveNote ? 6 : 0 }}>
          {saveNote && <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: "#A82743", textAlign: "center" }}>{saveNote}</p>}
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            {picking
              ? <button type="button" onClick={stopPicking} disabled={!!saving || !!storing} style={{ height: 54, padding: "0 18px", borderRadius: 18, border: 0, background: "#fff", color: "#17151F", fontSize: 15, fontWeight: 700, flex: "none" }}>{T("Cancel")}</button>
              : !held && !saving && m > 0 && everyone.length > 1 && <button type="button" onClick={() => { setPicking(true); setSaveNote(""); }} style={{ height: 54, padding: "0 18px", borderRadius: 18, border: 0, background: "#fff", color: "#17151F", fontSize: 15, fontWeight: 700, flex: "none" }}>{T("Choose")}</button>}
            <button type="button" className={`gf-cta${held ? " gf-ready" : ""}`} onClick={() => (!picking && !m ? setPicking(true) : held ? download([]) : gate(() => void download(picking ? chosen : mainList)))} disabled={!!saving || !!storing || (picking && !chosen.length)} style={{ flex: 1, height: 54, fontSize: 16, borderRadius: 18, opacity: picking && !chosen.length ? .5 : 1 }}>
              <Ic d={DL} w={2.3} />{saving ? T("Getting {a} of {b}", { a: N(saving), b: N(total) }) : storing ? T("Saving {a} of {b}", { a: N(storing), b: N(total) }) : held ? T("Save {photos}", { photos: P(held.length) }) : picking ? (chosen.length ? T("Download {n}", { n: N(chosen.length) }) : T("Download")) : m ? T("Download all {n}", { n: N(m) }) : T("Choose photos to download")}
            </button>
          </div>
        </div>
      )}
      <div ref={frames} aria-hidden="true" />
    </div>
  );
}
