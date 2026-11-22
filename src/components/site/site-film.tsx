"use client";

/**
 * A wedding film on the studio website. The poster opens a "theatre": the film grows out of the poster
 * into the middle of the screen while the page behind is blurred and darkened. The YouTube player has no
 * controls of its own; our own quiet controls appear on a tap and go away on the next tap (or by
 * themselves while the film plays). YouTube's title strip and logo are pushed outside the visible frame.
 *
 * The player is driven over postMessage (enablejsapi=1), so no YouTube script has to be loaded.
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
export function FilmTheater({ id, title, poster, posterStyle, className, big }: {
  id: string; title: string; poster?: string; posterStyle?: React.CSSProperties; className?: string; /** Home: the larger play button */ big?: boolean;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<DOMRect | null>(null);
  const src = poster || `https://i.ytimg.com/vi/${id}/${big ? "maxresdefault" : "hqdefault"}.jpg`;
  const ring = big ? 92 : 70;
  return (
    <>
      <button ref={btn} type="button" className={`film${className ? ` ${className}` : ""}`} onClick={() => btn.current && setOpen(btn.current.getBoundingClientRect())} aria-label={`Play ${title || "the wedding film"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" decoding="async" style={posterStyle} />
        {big
          ? <span className="play pcine"><span className="pring"><Svg d={P.play} size={24} /></span><span className="pf plbl">Play film</span></span>
          : <span className="play"><span className="gold" style={{ width: ring, height: ring }}><Svg d={P.play} size={22} /></span></span>}
      </button>
      {open && <Theater id={id} title={title} poster={src} from={open} back={() => btn.current?.getBoundingClientRect() ?? open} anchor={() => btn.current} onClosed={() => setOpen(null)} />}
    </>
  );
}

function Theater({ id, title, poster, from, back, anchor, onClosed }: { id: string; title: string; poster: string; from: DOMRect; back: () => DOMRect; /** The poster button (the theatre opens in the same page copy) */ anchor: () => HTMLElement | null; onClosed: () => void }) {
  // Mount inside the site's root so the theme's colours and fonts apply (only rendered after a tap, so `document` exists).
  const [host] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : ((anchor()?.closest(".sg") as HTMLElement | null) ?? document.body)));
  const shell = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [shown, setShown] = useState(false); // backdrop + card in place
  const [state, setState] = useState(-1); // YouTube: -1 not started, 0 ended, 1 playing, 2 paused, 3 buffering
  const [started, setStarted] = useState(false); // has played at least once (the cover can go)
  const [ui, setUi] = useState(true);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [needTap, setNeedTap] = useState(false); // the phone refused to start it for us: let the person tap YouTube's own button once
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);

  const cmd = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args, id: 1, channel: "widget" }), YT);
  }, []);


  // Grow out of the poster (FLIP), lock the page, Esc closes.
  useEffect(() => {
    if (!host) return;
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
  }, [host, from]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    cmd("pauseVideo");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const el = card.current;
    const to = back();
    setShown(false);
    if (el && to.width > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const now = el.getBoundingClientRect();
      el.style.transform = `translate(${to.left - now.left}px, ${to.top - now.top}px) scale(${to.width / now.width}, ${to.height / now.height})`;
      setTimeout(onClosed, 480);
    } else onClosed();
  }, [back, cmd, onClosed]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) close();
      if (e.key === " " || e.key === "k") { e.preventDefault(); cmd(state === 1 ? "pauseVideo" : "playVideo"); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close, cmd, state]);

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
      if (m.event === "onReady") { cmd("playVideo"); return; }
      const apply = (s: number) => {
        setState(prev => {
          if (prev !== s) {
            if (s === 1) poke(false); // starts or resumes: controls out of the way
            else if (hideT.current) clearTimeout(hideT.current);
          }
          return s;
        });
        if (s === 1) { setStarted(true); setNeedTap(false); }
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
    if (started) return;
    const t = setTimeout(() => setNeedTap(true), 3200);
    return () => clearTimeout(t);
  }, [started]);

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
    <div ref={shell} className={`fth${shown ? " on" : ""}${full ? " full" : ""}`} role="dialog" aria-modal="true" aria-label={title || "Wedding film"}>
      <div className="fth-bg" onClick={close} />
      <div className="fth-stage">
        <div ref={card} className="fth-card">
          <div className={`fth-v${needTap && !started ? " tap" : ""}`}>
            <iframe ref={frame} title={title || "Wedding film"} onLoad={listen}
              src={`${YT}/embed/${id}?autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
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
