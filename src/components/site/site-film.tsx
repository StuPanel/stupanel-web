"use client";

/**
 * A wedding film on the studio website. The poster opens a "theatre": the film grows out of the poster
 * into the middle of the screen while the page behind is blurred and darkened. The YouTube player has no
 * controls of its own; our own quiet controls appear on a tap and go away on the next tap (or by
 * themselves while the film plays). YouTube's title strip and logo are pushed outside the visible frame.
 *
 * The player is driven over postMessage (enablejsapi=1), so no YouTube script has to be loaded.
 *
 * Fast start: the player is loaded before the tap (the Home film when it comes near the screen, other films when
 * the pointer or finger reaches the poster), paused and hidden; the tap only shows it and presses play.
 * Picture: the player is laid out at 1920 × 1080 and scaled down to fit, so YouTube picks HD (1080p) when the
 * connection allows (YouTube has no setting to force a quality).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const YT = "https://www.youtube-nocookie.com";
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};
const Svg = ({ d, size = 22, fill = true }: { d: string; size?: number; fill?: boolean }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const P = {
  play: "M7 4.5v15l13-7.5z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  close: "M6 6l12 12M18 6L6 18",
  vol: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  mute: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  small: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  again: "M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5",
};

/** Poster + theatre. `className` goes on the poster button (e.g. "cine rv" on Home). */
/** YouTube's picture of a film: 0 = its cover, 1–3 = a moment about ¼, ½, ¾ in. `hd` = the 1280 px one (not every film has it). */
export const ytPicture = (id: string, frame = 0, hd = true) =>
  `https://i.ytimg.com/vi/${id}/${hd ? "maxres" : "hq"}${frame ? frame : "default"}.jpg`;

export function FilmTheater({ id, title, poster, posterStyle, className, big, frame }: {
  id: string; title: string; poster?: string; posterStyle?: React.CSSProperties; className?: string; /** Home: the larger play button */ big?: boolean;
  /** No own poster: which picture from the film (0 = YouTube's cover, 1–3 = a moment) */ frame?: number;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<DOMRect | null>(null);
  /** The player is loaded (hidden) before the tap. */
  const [warm, setWarm] = useState(false);
  // Big picture first; films without one get YouTube's grey 120 px stand-in, so fall back to the 480 px picture.
  const [lowRes, setLowRes] = useState(false);
  const src = poster || ytPicture(id, frame ?? 0, !lowRes);
  const ring = big ? 92 : 70;
  // The Home film: load the player when it comes near the screen (after the page itself has loaded).
  useEffect(() => {
    if (!big || warm || !btn.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setWarm(true); io.disconnect(); } }, { rootMargin: "600px 0px" });
    io.observe(btn.current);
    return () => io.disconnect();
  }, [big, warm]);
  const heat = () => setWarm(true);
  return (
    <>
      <button ref={btn} type="button" className={`film${className ? ` ${className}` : ""}`} onPointerEnter={heat} onTouchStart={heat} onFocus={heat}
        onClick={() => { setWarm(true); if (btn.current) setOpen(btn.current.getBoundingClientRect()); }} aria-label={`Play ${title || "the wedding film"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" decoding="async" style={posterStyle}
          onLoad={e => { if (!poster && !lowRes && e.currentTarget.naturalWidth <= 120) setLowRes(true); }} onError={() => { if (!poster && !lowRes) setLowRes(true); }} />
        {big
          ? <span className="play pcine"><span className="pring"><Svg d={P.play} size={24} /></span><span className="pf plbl">Play film</span></span>
          : <span className="play"><span className="gold" style={{ width: ring, height: ring }}><Svg d={P.play} size={22} /></span></span>}
      </button>
      {(warm || open) && <Theater id={id} title={title} poster={src} from={open} back={() => btn.current?.getBoundingClientRect() ?? open ?? new DOMRect()} anchor={() => btn.current} onClosed={() => setOpen(null)} />}
    </>
  );
}

function Theater({ id, title, poster, from, back, anchor, onClosed }: { id: string; title: string; poster: string; /** Where it opens from; null = loaded but hidden */ from: DOMRect | null; back: () => DOMRect; /** The poster button (the theatre opens in the same page copy) */ anchor: () => HTMLElement | null; onClosed: () => void }) {
  // Mount inside the site's root so the theme's colours and fonts apply (only rendered after a tap, so `document` exists).
  const [host] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : ((anchor()?.closest(".sg") as HTMLElement | null) ?? document.body)));
  const shell = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [shown, setShown] = useState(false); // backdrop + card in place
  const [state, setState] = useState(-1); // YouTube: -1 not started, 0 ended, 1 playing, 2 paused, 3 buffering
  const [started, setStarted] = useState(false); // has played at least once (the cover can go)
  const startT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (startT.current) clearTimeout(startT.current); }, []);
  const [ui, setUi] = useState(true);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [needTap, setNeedTap] = useState(false); // the phone refused to start it for us: let the person tap YouTube's own button once
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);
  /** The player has told us it is ready (it may be, long before the tap). */
  const ready = useRef(false);
  const isOpen = !!from;
  /** Opened straight away (not loaded ahead): start by itself. Kept fixed so the player's address never changes. */
  const [auto] = useState(() => (from ? 1 : 0));
  const openRef = useRef(isOpen);
  useEffect(() => { openRef.current = isOpen; }, [isOpen]);

  const cmd = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args, id: 1, channel: "widget" }), YT);
  }, []);


  // Grow out of the poster (FLIP), lock the page, start the film (it is usually loaded already).
  useEffect(() => {
    if (!host || !from) return;
    closing.current = false;
    if (ready.current) cmd("playVideo");
    const el = card.current;
    if (el) {
      const to = el.getBoundingClientRect();
      el.style.transition = "none";
      el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
      el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = "";
        el.style.transform = "";
        setShown(true);
      });
    }
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [host, from, cmd]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    cmd("pauseVideo");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const el = card.current;
    const to = back();
    setShown(false);
    setUi(true);
    if (el && to.width > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const now = el.getBoundingClientRect();
      el.style.transform = `translate(${to.left - now.left}px, ${to.top - now.top}px) scale(${to.width / now.width}, ${to.height / now.height})`;
      setTimeout(onClosed, 480);
    } else onClosed();
  }, [back, cmd, onClosed]);

  useEffect(() => {
    if (!isOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) close();
      if (e.key === " " || e.key === "k") { e.preventDefault(); cmd(state === 1 ? "pauseVideo" : "playVideo"); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close, cmd, state, isOpen]);

  // While it plays, the controls fade away by themselves.
  const poke = useCallback((show = true) => {
    if (hideT.current) clearTimeout(hideT.current);
    setUi(show);
    if (show) hideT.current = setTimeout(() => setUi(false), 2600);
  }, []);

  // Messages from the player.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      let m: { event?: string; info?: unknown };
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.event === "onReady") { ready.current = true; if (openRef.current) cmd("playVideo"); return; }
      const apply = (s: number) => {
        setState(prev => {
          if (prev !== s) {
            if (s === 1) poke(false); // starts or resumes: controls out of the way
            else if (hideT.current) clearTimeout(hideT.current);
          }
          return s;
        });
        // YouTube flashes its own pause sign for about a second when a film starts (Chrome draws a thin line through
        // the middle of the picture while it shows), so the poster stays over it for that second.
        if (s === 1) { setNeedTap(false); if (!startT.current) startT.current = setTimeout(() => setStarted(true), 1100); }
      };
      if (m.event === "onStateChange" && typeof m.info === "number") apply(m.info);
      if (m.event === "infoDelivery" && m.info && typeof m.info === "object") {
        const i = m.info as { playerState?: number; currentTime?: number; duration?: number; muted?: boolean };
        if (typeof i.playerState === "number") apply(i.playerState);
        if (typeof i.currentTime === "number") setTime(i.currentTime);
        if (typeof i.duration === "number" && i.duration > 0) setDur(i.duration);
        if (typeof i.muted === "boolean") setMuted(i.muted);
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [cmd, poke]);

  // Ask the player to talk to us (repeat until it answers; the first message can arrive before it is ready).
  const listen = () => {
    let n = 0;
    const t = setInterval(() => {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YT);
      if (++n > 12) clearInterval(t);
    }, 250);
  };

  // Some phones (iPhone) do not let a page start a film with sound: after a moment, let the tap go to YouTube.
  useEffect(() => {
    if (started || !isOpen) return;
    const t = setTimeout(() => setNeedTap(true), 3200);
    return () => clearTimeout(t);
  }, [started, isOpen]);

  // The player is laid out at 1920 px wide and scaled to the card, so YouTube serves HD.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => el.style.setProperty("--k", String(el.clientWidth / 1920)));
    ro.observe(el);
    el.style.setProperty("--k", String(el.clientWidth / 1920));
    return () => ro.disconnect();
  }, [host]);

  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await shell.current?.requestFullscreen();
        try { await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape"); } catch { /* not allowed */ }
      }
    } catch { /* not supported */ }
  };

  const playing = state === 1 || state === 3;
  /** Controls show whenever the film is not running, and on a tap while it runs. */
  const barOn = state === 1 ? ui : true;
  const ended = state === 0;
  const seek = (v: number) => { setTime(v); cmd("seekTo", [v, true]); poke(true); };
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  if (!host) return null;
  return createPortal(
    <div ref={shell} className={`fth${shown ? " on" : ""}${full ? " full" : ""}${isOpen ? "" : " idle"}`} role="dialog" aria-modal="true" aria-hidden={!isOpen} aria-label={title || "Wedding film"}>
      <div className="fth-bg" onClick={close} />
      <div className="fth-stage">
        <div ref={card} className="fth-card">
          <div ref={box} className={`fth-v${needTap && !started ? " tap" : ""}`}>
            <div className="fth-hd">
              <iframe ref={frame} title={title || "Wedding film"} onLoad={listen} tabIndex={isOpen ? 0 : -1}
                src={`${YT}/embed/${id}?autoplay=${auto}&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&enablejsapi=1&vq=hd1080&origin=${encodeURIComponent(origin)}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
            </div>
          </div>
          {/* The poster stays over the player until the film really runs, and comes back at the end. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`fth-cover${started && !ended ? " gone" : ""}${needTap && !started ? " tap" : ""}`} src={poster} alt="" />
          {!started && !needTap && <span className="fth-spin" aria-label="Loading" />}
          {/* One tap: controls in. Next tap: out. */}
          {!(needTap && !started) && (
            <button type="button" className="fth-tap" aria-label={barOn ? "Hide the controls" : "Show the controls"} onClick={() => (ended ? (cmd("seekTo", [0, true]), cmd("playVideo")) : state === 1 ? poke(!ui) : undefined)} />
          )}
          {(ended || (state === 2 && started)) && (
            <button type="button" className="fth-big" onClick={() => { if (ended) cmd("seekTo", [0, true]); cmd("playVideo"); }} aria-label={ended ? "Play again" : "Play"}>
              <Svg d={ended ? P.again : P.play} size={30} fill={!ended} />
            </button>
          )}
          <div className={`fth-bar${barOn && started ? " on" : ""}`}>
            <button type="button" onClick={() => { cmd(playing ? "pauseVideo" : "playVideo"); poke(true); }} aria-label={playing ? "Pause" : "Play"}><Svg d={playing ? P.pause : P.play} /></button>
            <span className="fth-t">{fmt(time)}</span>
            <input type="range" min={0} max={Math.max(1, dur)} step={0.5} value={Math.min(time, dur || time)} onChange={e => seek(Number(e.target.value))} aria-label="Position in the film"
              style={{ ["--p" as string]: `${dur ? (time / dur) * 100 : 0}%` }} />
            <span className="fth-t">{fmt(dur)}</span>
            <button type="button" onClick={() => { cmd(muted ? "unMute" : "mute"); setMuted(!muted); poke(true); }} aria-label={muted ? "Sound on" : "Sound off"}><Svg d={muted ? P.mute : P.vol} fill={false} /></button>
            <button type="button" onClick={() => { toggleFull(); poke(true); }} aria-label={full ? "Leave full screen" : "Full screen"}><Svg d={full ? P.small : P.full} fill={false} /></button>
          </div>
        </div>
        {title && <p className="fth-title pf">{title}</p>}
      </div>
      <button type="button" className="fth-x" onClick={close} aria-label="Close the film"><Svg d={P.close} fill={false} /></button>
    </div>,
    host,
  );
}
