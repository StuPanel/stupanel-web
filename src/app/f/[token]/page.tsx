"use client";

/**
 * AI Face Search — the guest page behind the QR. Landing → (code) → selfie scan → searching → your photos.
 * The selfie is made small here and sent once; the server keeps only its face data. The guest's key stays
 * in this browser, so coming back shows the photos again (and any new ones) without another selfie.
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL as API } from "@/lib/api";
import { PhotoViewer } from "@/components/photo-viewer";
import { faceDownloadUrl, facePhotoUrl, type Cover, type FacePhoto } from "@/lib/face";
import { FACE_HINT, loadFaceCheck, type FaceState } from "@/lib/face-check";
import "./guest.css";

type Open = { title: string; status: "draft" | "published" | "closed"; eventDate: string | null; studio: { name: string; logoUrl: string | null }; cover: Cover; needsPin: boolean; welcome: string; downloads: boolean; ready: boolean; register?: "off" | "optional" | "required"; follow?: { site: "facebook" | "instagram"; url: string }[] };
type Result = { key: string; registered: boolean; /** Photos are held back until the guest gives their details */ needsRegister?: boolean; count?: number; photos: FacePhoto[]; more: FacePhoto[]; moreKind: "all" | "highlights"; downloads: boolean };
type Step = "load" | "bad" | "land" | "pin" | "selfie" | "search" | "register" | "follow" | "results";

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

export default function GuestFacePage({ params }: { params: Promise<{ token: string }> }) {
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
  const [view, setView] = useState<{ list: "mine" | "more"; i: number } | null>(null);

  // ── open ──
  useEffect(() => {
    let on = true;
    (async () => {
      const r = await fetch(base).catch(() => null);
      if (!on) return;
      if (!r?.ok) { setErr("This link is not working. Please ask the studio for a new one."); return setStep("bad"); }
      const d: Open = await r.json();
      setG(d);
      // Came back in the same browser: show the photos again without a selfie.
      let saved: { key?: string; selfie?: string } = {};
      try { saved = JSON.parse(localStorage.getItem(store) || "{}"); } catch { /* private window */ }
      if (saved.key && d.status === "published") {
        const m = await fetch(`${base}/mine`, { headers: { "x-guest-key": saved.key } }).catch(() => null);
        if (on && m?.ok) { const out: Result = await m.json(); setSelfie(saved.selfie || ""); setRes(out);
          let followed = false; try { followed = localStorage.getItem(`${store}:followed`) === "1"; } catch { /* private window */ }
          return setStep(out.needsRegister ? "register" : d.follow?.length && (out.count ?? out.photos.length) && !followed ? "follow" : "results"); }
      }
      if (on) setStep("land");
    })();
    return () => { on = false; };
  }, [base, store]);

  // ── search ──
  const search = useCallback(async (image: string) => {
    setSelfie(image); setStep("search"); setCount(0); setNote("");
    let key: string | undefined;
    try { key = JSON.parse(localStorage.getItem(store) || "{}").key; } catch { /* private window */ }
    const started = Date.now();
    const r = await fetch(`${base}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: image.split(",")[1], ...(key ? { key } : {}), ...(pin ? { pin } : {}) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) {
      const code = d?.code;
      setNote(r?.status === 429 ? "Too many tries. Please wait a minute and try again." : (Array.isArray(d?.message) ? d.message[0] : d?.message) || "Something went wrong. Please check your internet and try again.");
      return setStep(code === "WRONG_PIN" ? "pin" : r?.status === 403 ? "land" : "selfie");
    }
    const out = d as Result;
    try { localStorage.setItem(store, JSON.stringify({ key: out.key, selfie: await thumbOfSelfie(image) })); } catch { /* private window */ }
    // Let the search screen be seen for a moment, then count up to the number found.
    await new Promise(ok => setTimeout(ok, Math.max(0, 1400 - (Date.now() - started))));
    const n = out.count ?? out.photos.length;
    for (let i = 1; i <= n; i++) { setCount(i); await new Promise(ok => setTimeout(ok, Math.max(40, Math.min(160, 1400 / n)))); }
    await new Promise(ok => setTimeout(ok, n ? 500 : 200));
    setRes(out);
    // The studio asks for a name and number: before the photos (required), or as a step the guest can skip (optional).
    const follow = !!g?.follow?.length && n > 0 && (() => { try { return localStorage.getItem(`${store}:followed`) !== "1"; } catch { return true; } })();
    setStep(n > 0 && !out.registered && (out.needsRegister || g?.register === "optional") ? "register" : follow ? "follow" : "results");
  }, [base, store, pin, g?.register, g?.follow]);

  // After the guest gave their details: photos that were held back are fetched now.
  const registered = useCallback(async () => {
    if (!res) return;
    if (res.needsRegister) {
      const m = await fetch(`${base}/mine`, { headers: { "x-guest-key": res.key } }).catch(() => null);
      if (m?.ok) setRes(await m.json()); else setRes({ ...res, registered: true });
    } else setRes({ ...res, registered: true });
    const follow = !!g?.follow?.length && (() => { try { return localStorage.getItem(`${store}:followed`) !== "1"; } catch { return true; } })();
    setStep(follow ? "follow" : "results");
  }, [base, res, g?.follow, store]);

  // The follow step is shown once per browser, and only when there are photos to open.
  const wantsFollow = (out: Result) => {
    if (!g?.follow?.length || !(out.count ?? out.photos.length)) return false;
    try { return localStorage.getItem(`${store}:followed`) !== "1"; } catch { return true; }
  };
  const afterDetails = (out: Result) => setStep(wantsFollow(out) ? "follow" : "results");

  if (step === "bad") return <Shell><div className="gf-step" style={{ alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center", gap: 10 }}><h1 style={{ fontSize: 24, fontWeight: 800 }}>Photos not found</h1><p style={{ color: "#4A4658", fontSize: 16 }}>{err}</p></div></Shell>;
  if (step === "load" || !g) return <Shell><div className="gf-step" style={{ alignItems: "center", justifyContent: "center" }}><span className="gf-dots" role="status" aria-label="Loading"><i style={{ background: "#7D5CEF" }} /><i style={{ background: "#7D5CEF" }} /><i style={{ background: "#7D5CEF" }} /></span></div></Shell>;

  const start = () => { setNote(""); setStep(g.needsPin && pin.length !== 4 ? "pin" : "selfie"); };

  return (
    <Shell>
      {step === "land" && <Landing g={g} note={note} onStart={start} />}
      {step === "pin" && <Pin value={pin} note={note} onChange={setPin} onBack={() => setStep("land")} onDone={() => { setNote(""); setStep("selfie"); }} />}
      {step === "selfie" && <Selfie title={g.title} note={note} onBack={() => setStep("land")} onShot={search} />}
      {step === "search" && <Searching selfie={selfie} count={count} />}
      {step === "register" && res && (
        <Register base={base} res={res} studio={g.studio.name} selfie={selfie} must={!!res.needsRegister} onDone={registered} onSkip={() => afterDetails(res)} />
      )}
      {step === "follow" && res && g.follow && (
        <Follow studio={g.studio.name} pages={g.follow} count={res.count ?? res.photos.length}
          onDone={() => { try { localStorage.setItem(`${store}:followed`, "1"); } catch { /* private window */ } setStep("results"); }} />
      )}
      {step === "results" && res && (
        <Results g={g} res={res} selfie={selfie} onOpen={(list, i) => setView({ list, i })} onRetake={() => { setNote(""); setStep("selfie"); }} base={base} />
      )}
      {view && res && (() => {
        const list = view.list === "mine" ? res.photos : res.more;
        const p = list[view.i];
        if (!p) return null;
        return (
          <PhotoViewer count={list.length} index={view.i} onIndex={i => setView({ list: view.list, i })} onClose={() => setView(null)}
            src={facePhotoUrl(p, 1600)} srcAt={i => facePhotoUrl(list[i], 1600)} thumbAt={i => facePhotoUrl(list[i], 480)} zoomAt={i => facePhotoUrl(list[i], 2560)}
            title={g.title} sub={`${view.i + 1} of ${list.length}`}
            footer={res.downloads ? (
              <a href={faceDownloadUrl(p.driveFileId)} onClick={() => counted(base, res.key, 1)} target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, padding: "0 26px", borderRadius: 18, background: "#7D5CEF", color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
                <Ic d={DL} />Download
              </a>
            ) : undefined} />
        );
      })()}
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
function counted(base: string, key: string, n: number) {
  fetch(`${base}/downloaded`, { method: "POST", headers: { "Content-Type": "application/json", "x-guest-key": key }, body: JSON.stringify({ count: n }), keepalive: true }).catch(() => undefined);
}

// ─── Landing ──────────────────────────────────────────────────────────────────

function Landing({ g, note, onStart }: { g: Open; note: string; onStart: () => void }) {
  const open = g.status === "published" && g.ready;
  const title = open ? "Find your photos in seconds" : g.status === "closed" ? "This gallery is closed" : "The photos are on their way";
  const body = open ? (g.welcome || "Take one selfie. We show you every photo you are in.") : g.status === "closed" ? `Please ask ${g.studio.name} if you still need your photos.` : `${g.studio.name} is still adding the photos. Please scan again a little later.`;
  return (
    <div className="gf-step">
      <div style={{ position: "relative", flex: "1 1 54%", minHeight: 300, overflow: "hidden", borderRadius: "0 0 40px 40px", background: "#2A2140" }}>
        {g.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="gf-kb" src={facePhotoUrl(g.cover, 1200)} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectPosition: "50% 25%" }} />
        )}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(23,21,31,.28) 0%, rgba(23,21,31,0) 30%, rgba(23,21,31,.86) 100%)" }} />
        <div className="gf-drop gf-glass" style={{ position: "absolute", top: 18, left: 18, display: "flex", alignItems: "center", gap: 10, padding: "7px 14px 7px 7px", borderRadius: 18, animationDelay: ".15s" }}>
          {g.studio.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={g.studio.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: 12 }} />
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
              Find my photos
            </button>
          )}
          <p style={{ fontSize: 12, color: "#6B6680", textAlign: "center" }}>Your selfie is used only to find your photos. The picture itself is not kept.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Code ─────────────────────────────────────────────────────────────────────

function Pin({ value, note, onChange, onBack, onDone }: { value: string; note: string; onChange: (v: string) => void; onBack: () => void; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  return (
    <div className="gf-step" style={{ padding: "16px 22px 26px" }}>
      <button type="button" aria-label="Back" onClick={onBack} style={{ width: 46, height: 46, borderRadius: 16, border: 0, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic d={BACK} w={2.4} /></button>
      <div className="gf-rise" style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 8, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em" }}>Enter the code</h1>
        <p style={{ fontSize: 15, color: "#4A4658" }}>The 4-digit code from the studio or the couple.</p>
      </div>
      <label htmlFor="gf-pin" style={{ position: "absolute", left: -9999 }}>4-digit code</label>
      <div className={`gf-otp${value.length === 4 ? " ok" : ""}`} style={{ marginTop: 30, position: "relative" }} onClick={() => input.current?.focus()}>
        {[0, 1, 2, 3].map(i => <span key={i} className={value[i] ? "f" : ""}>{value[i] ?? ""}</span>)}
        <input id="gf-pin" ref={input} value={value} inputMode="numeric" autoComplete="one-time-code" maxLength={4}
          onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", fontSize: 16 }} />
      </div>
      {note && <p role="alert" style={{ marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 600, color: "#C2304F" }}>{note}</p>}
      <button type="button" className="gf-cta" disabled={value.length !== 4} onClick={onDone} style={{ marginTop: "auto", opacity: value.length === 4 ? 1 : .5 }}>Continue</button>
    </div>
  );
}

// ─── Name and number ─────────────────────────────────────────────────────────

function Register({ base, res, studio, selfie, must, onDone, onSkip }: { base: string; res: Result; studio: string; selfie: string; must: boolean; onDone: () => void; onSkip: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const n = res.count ?? res.photos.length;

  async function send() {
    const digits = phone.replace(/[^\d+]/g, "");
    if (name.trim().length < 2) return setErr("Please type your name.");
    if (digits.replace(/\D/g, "").length < 10) return setErr("Please type your WhatsApp number, like 01712345678.");
    setErr(""); setBusy(true);
    // A local number (01…) is sent with Bangladesh's country code.
    const value = digits.startsWith("+") ? digits : digits.startsWith("01") ? `+88${digits}` : digits.startsWith("880") ? `+${digits}` : digits;
    const r = await fetch(`${base}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: res.key, name: name.trim(), channel: "whatsapp", value }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setErr(r?.status === 429 ? "Too many tries. Please wait a minute." : (Array.isArray(d?.message) ? d.message[0] : d?.message) || "Could not save. Please check your internet and try again.");
    onDone();
  }

  const field: React.CSSProperties = { width: "100%", height: 56, borderRadius: 18, border: "2px solid transparent", background: "#fff", padding: "0 18px", fontSize: 17, fontWeight: 600, color: "#17151F", outline: "none" };
  return (
    <div className="gf-step" style={{ padding: "26px 22px 26px" }}>
      <div className="gf-rise" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        {selfie
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={selfie} alt="" style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover", boxShadow: "0 0 0 4px #fff, 0 10px 24px -10px rgba(40,28,96,.5)" }} />
          : null}
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15 }}>We found {n} photo{n === 1 ? "" : "s"} of you</h1>
        <p style={{ fontSize: 15, color: "#4A4658", maxWidth: 320 }}>{must ? "Tell us who you are to see them." : "Add your name and number, and the studio can send you new photos too."}</p>
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor="gf-name" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#4A4658", marginBottom: 6 }}>Your name</label>
          <input id="gf-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Nadia Rahman" style={field} />
        </div>
        <div>
          <label htmlFor="gf-phone" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#4A4658", marginBottom: 6 }}>WhatsApp number</label>
          <input id="gf-phone" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={20} placeholder="01712345678" style={field}
            aria-describedby={err ? "gf-reg-err" : "gf-reg-help"} onKeyDown={e => { if (e.key === "Enter") void send(); }} />
        </div>
        {err ? <p id="gf-reg-err" role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#C2304F" }}>{err}</p>
          : <p id="gf-reg-help" style={{ fontSize: 13, color: "#6B6680" }}>Only {studio} sees this. It is used to send you your photos.</p>}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <button type="button" className="gf-cta" disabled={busy} onClick={send} style={{ opacity: busy ? .6 : 1 }}>{busy ? "Saving…" : `See my ${n === 1 ? "photo" : "photos"}`}</button>
        {!must && <button type="button" onClick={onSkip} style={{ height: 48, border: 0, background: "transparent", fontSize: 15, fontWeight: 700, color: "#4A4658" }}>Not now</button>}
      </div>
    </div>
  );
}

// ─── Follow the studio ───────────────────────────────────────────────────────

function Follow({ studio, pages, count, onDone }: { studio: string; pages: { site: "facebook" | "instagram"; url: string }[]; count: number; onDone: () => void }) {
  const [opened, setOpened] = useState(false);
  const NAME = { facebook: "Facebook", instagram: "Instagram" } as const;
  const TINT = { facebook: "#1877F2", instagram: "#C13584" } as const;
  return (
    <div className="gf-step" style={{ padding: "40px 22px 26px" }}>
      <div className="gf-rise" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15 }}>One small thing first</h1>
        <p style={{ fontSize: 15, color: "#4A4658", maxWidth: 320 }}>{studio} took these photos. Follow their page, then open your {count} photo{count === 1 ? "" : "s"}.</p>
      </div>
      <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 12 }}>
        {pages.map(p => (
          <a key={p.site} href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}
            style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 68, padding: "0 18px", borderRadius: 20, background: "#fff", color: "#17151F", textDecoration: "none", boxShadow: "0 10px 26px -18px rgba(40,28,96,.5)" }}>
            <span aria-hidden style={{ width: 40, height: 40, borderRadius: 13, background: TINT[p.site], flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>Follow on {NAME[p.site]}</span>
              <span style={{ display: "block", fontSize: 13, color: "#6B6680" }}>Opens in a new tab</span>
            </span>
            <Ic d={<path d="M9 6l6 6-6 6" />} w={2.4} />
          </a>
        ))}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" className="gf-cta" disabled={!opened} onClick={onDone} style={{ opacity: opened ? 1 : .5 }}>See my {count === 1 ? "photo" : "photos"}</button>
        {!opened && <p style={{ textAlign: "center", fontSize: 13, color: "#6B6680" }}>Open a page first, then come back here.</p>}
      </div>
    </div>
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
  const alertBad = () => setBad("We could not open that photo. Please pick a JPG or PNG.");
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
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.12 }}>{denied ? "Camera is off" : locked ? "Got it" : "Look at the camera"}</h1>
        <p style={{ fontSize: 15, minHeight: 23, fontWeight: 600, color: note || bad ? "#FF9DB0" : face === "good" ? "#3DD68C" : "#C9C4D8" }} role={note || bad ? "alert" : "status"} aria-live="polite">
          {bad || note || (denied ? "Allow the camera in your browser, or pick a photo of your face."
            : face === "off" ? "Keep your face inside the oval, then press the round button."
            : face === "wait" ? "Keep your face inside the oval."
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}><span>{denied ? "Waiting for the camera" : locked ? "Face found" : !live ? "Starting the camera" : face === "off" ? "Press the button when ready" : seen ? "Scanning your face" : "Looking for your face"}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</span></div>
          <div className="gf-meter"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <button type="button" style={ghost} onClick={() => file.current?.click()}>Use a photo</button>
          <button type="button" aria-label="Take the selfie now" onClick={shoot} disabled={!live} style={{ width: 72, height: 72, borderRadius: "50%", border: "5px solid #fff", background: "#7D5CEF", boxShadow: "0 0 0 6px rgba(125,92,239,.35)", opacity: live ? 1 : .4 }} />
          <button type="button" style={ghost} onClick={() => setFacing(f => (f === "user" ? "environment" : "user"))}>Flip</button>
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
        <span key={count} className="gf-count gf-bump-a">{count}</span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{count === 1 ? "photo of you so far" : "photos of you so far"}</span>
        <span style={{ fontSize: 14, color: "#6B6680", marginTop: 6 }}>Matching your face with the event photos</span>
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results({ g, res, selfie, base, onOpen, onRetake }: { g: Open; res: Result; selfie: string; base: string; onOpen: (list: "mine" | "more", i: number) => void; onRetake: () => void }) {
  const n = res.photos.length;
  const [saving, setSaving] = useState(0);
  const frames = useRef<HTMLDivElement>(null);
  const moreTitle = useMemo(() => (res.moreKind === "all" ? "All event photos" : "Highlights from the event"), [res.moreKind]);

  // Each file is fetched from Google Drive as a download; a short gap keeps phones from blocking them.
  async function downloadAll() {
    if (saving || !n) return;
    counted(base, res.key, n);
    for (let i = 0; i < n; i++) {
      setSaving(i + 1);
      const f = document.createElement("iframe");
      f.style.display = "none"; f.src = faceDownloadUrl(res.photos[i].driveFileId);
      frames.current?.appendChild(f);
      await new Promise(ok => setTimeout(ok, 900));
    }
    setSaving(0);
  }

  const tile = (p: FacePhoto, i: number, list: "mine" | "more") => (
    <button key={p.id} type="button" className="gf-print" onClick={() => onOpen(list, i)} aria-label={`Open photo ${i + 1}`}
      style={{ ["--r" as string]: `${i % 2 ? 7 : -7}deg`, animationDelay: `${Math.min(i, 10) * 0.07}s`, padding: 5 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={facePhotoUrl(p, 480)} alt="" loading={i > 5 ? "lazy" : undefined} referrerPolicy="no-referrer"
        style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : "4 / 5", background: "#F1EFF6" }} />
    </button>
  );

  return (
    <div className="gf-step">
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 18px 8px", flex: "none" }}>
        {selfie
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="gf-drop" src={selfie} alt="Your selfie" style={{ width: 48, height: 48, borderRadius: "50%", boxShadow: "0 0 0 3px #fff", objectFit: "cover" }} />
          : <span style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEE8FD", flex: "none" }} aria-hidden="true" />}
        <div className="gf-rise" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.025em" }}>{n ? `${n} photo${n === 1 ? "" : "s"} of you` : "No photos of you yet"}</h1>
          <span style={{ fontSize: 13, color: "#6B6680", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}, by {g.studio.name}</span>
        </div>
        <button type="button" onClick={onRetake} style={{ height: 44, padding: "0 14px", borderRadius: 14, border: 0, background: "#fff", color: "#17151F", fontSize: 13, fontWeight: 700, flex: "none" }}>New selfie</button>
      </div>
      <div className="gf-scroll">
        {n === 0 && (
          <div className="gf-glass gf-rise" style={{ padding: "16px 16px", borderRadius: 22, marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <b style={{ fontSize: 16 }}>We looked through every photo.</b>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "#4A4658" }}>More photos may still be added. Open this page again later and your photos will show here by themselves. A clearer selfie also helps: face the light and take off sunglasses.</span>
          </div>
        )}
        <div className="gf-cols">{res.photos.map((p, i) => tile(p, i, "mine"))}</div>
        {res.more.length > 0 && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "18px 4px 10px" }}>{moreTitle}</h2>
            <div className="gf-cols">{res.more.map((p, i) => tile(p, i, "more"))}</div>
          </>
        )}
      </div>
      {n > 0 && res.downloads && (
        <div className="gf-bar gf-glass">
          <button type="button" className="gf-cta" onClick={downloadAll} disabled={!!saving} style={{ flex: 1, height: 54, fontSize: 16, borderRadius: 18 }}>
            <Ic d={DL} w={2.3} />{saving ? `Saving ${saving} of ${n}` : `Download all ${n}`}
          </button>
        </div>
      )}
      <div ref={frames} aria-hidden="true" />
    </div>
  );
}
