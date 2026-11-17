"use client";

/**
 * StuPanel Live — download and set-up page (public, so a studio can send it to its photographers).
 * Until the app is on Google Play it is downloaded from here. The version comes from /downloads/live.json.
 * Each step is short and shows a small picture of what the phone looks like at that moment.
 */
import { useEffect, useState } from "react";
import { Camera, Check, ChevronDown, Download, FolderOpen, Loader2, LogIn, Play, ShieldCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";
import { PublicShell } from "@/components/public/public-shell";

type Info = { versionName: string; versionCode: number; url: string; sizeMb: number; date: string };

// ─── Small phone pictures (what the person sees at each step) ────────────────

function Phone({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div aria-hidden className={cn("w-[150px] h-[220px] rounded-[26px] border-[5px] border-[#17151F] overflow-hidden flex-shrink-0 relative", dark ? "bg-[#17151F]" : "bg-[#FAF4EB]")}>
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-[#17151F]/80" />
      <div className="h-full pt-5 px-2.5 pb-2.5 flex flex-col">{children}</div>
    </div>
  );
}
const Tap = ({ className }: { className?: string }) => <span className={cn("absolute w-7 h-7 rounded-full bg-[#7D5CEF]/35 ring-4 ring-[#7D5CEF]/25 animate-pulse", className)} />;

function PicDownload() {
  return (
    <Phone>
      <p className="text-[9px] font-bold text-[#17151F]">StuPanel Live</p>
      <p className="text-[7.5px] text-[#6B6680] mt-0.5">app.stupanel.com/live-app</p>
      <div className="relative mt-4 h-8 rounded-full bg-[#7D5CEF] text-white text-[8.5px] font-bold flex items-center justify-center gap-1"><Download className="w-3 h-3" />Download<Tap className="-right-1 -bottom-2" /></div>
      <div className="mt-auto rounded-xl bg-white p-2 shadow">
        <p className="text-[7.5px] font-bold text-[#17151F]">stupanel-live.apk</p>
        <p className="text-[7px] text-[#1F8A5B]">Download complete · Open</p>
      </div>
    </Phone>
  );
}
function PicInstall() {
  return (
    <Phone dark>
      <div className="mt-6 rounded-2xl bg-[#2A2733] p-2.5 text-white">
        <p className="text-[7px] text-white/60 text-center">Google Play Protect</p>
        <p className="text-[9px] font-bold text-center mt-1 leading-tight">App blocked to protect your device</p>
        <div className="relative mt-2 text-[7.5px] text-white/80 flex items-center gap-1">More details <ChevronDown className="w-2.5 h-2.5" /><Tap className="left-5 -top-2" /></div>
        <div className="relative mt-2 h-6 rounded-full border border-white/40 text-[7.5px] font-bold flex items-center justify-center">Install anyway<Tap className="-right-2 -top-1" /></div>
      </div>
    </Phone>
  );
}
function PicSignIn() {
  return (
    <Phone>
      <div className="mx-auto mt-3 w-9 h-9 rounded-xl bg-[#17151F] text-white flex items-center justify-center"><Camera className="w-4 h-4" /></div>
      <p className="text-center text-[9px] font-extrabold mt-1.5">StuPanel <span className="text-[#7D5CEF]">Live</span></p>
      <div className="relative mt-4 h-7 rounded-full bg-white border border-[#E4E0EC] text-[8px] font-bold flex items-center justify-center">Continue with Google<Tap className="-right-1 -bottom-2" /></div>
      <p className="text-center text-[7px] text-[#8A8599] mt-2">or email + password</p>
    </Phone>
  );
}
function PicEvent() {
  return (
    <Phone>
      <p className="text-[9.5px] font-extrabold leading-tight">Which event are you shooting?</p>
      <div className="relative mt-2.5 rounded-xl bg-white ring-2 ring-[#7D5CEF] p-1.5 flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#F6C46B] to-[#E46A86]" />
        <span className="flex-1 min-w-0"><span className="block text-[7.5px] font-bold truncate">Wedding — Holud</span><span className="block text-[6.5px] text-[#6B6680]">Today</span></span>
        <Tap className="-right-1 -bottom-2" />
      </div>
      <div className="mt-1.5 rounded-xl bg-white p-1.5 flex items-center gap-1.5 opacity-70">
        <span className="w-6 h-6 rounded-lg bg-[#EEE8FD]" /><span className="text-[7.5px] font-semibold">Reception</span>
      </div>
    </Phone>
  );
}
function PicFolder() {
  return (
    <Phone>
      <p className="text-[8.5px] font-bold">Where do your photos come from?</p>
      <div className="relative mt-2 rounded-xl bg-white p-1.5 flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-lg bg-[#17151F] text-white flex items-center justify-center"><FolderOpen className="w-3 h-3" /></span>
        <span className="text-[7.5px] font-bold">Choose the camera folder</span>
        <Tap className="-right-1 -bottom-2" />
      </div>
      <div className="mt-2 rounded-xl bg-[#17151F] p-1.5 text-[7px] text-white/80 leading-snug">DCIM › <b className="text-white">Camera</b><br /><span className="text-[#C9B8FF] font-bold">USE THIS FOLDER</span> → ALLOW</div>
    </Phone>
  );
}
function PicLive() {
  return (
    <Phone dark>
      <span className="self-start h-4 px-1.5 rounded-full bg-[#1F8A5B]/30 text-[#7BE0AE] text-[7px] font-bold inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />Live</span>
      <p className="text-center text-white/70 text-[7.5px] mt-4">Photos sent</p>
      <p className="text-center text-white text-[34px] font-extrabold leading-none">24</p>
      <div className="mt-auto relative h-7 rounded-full bg-[#7D5CEF] text-white text-[8.5px] font-bold flex items-center justify-center gap-1"><Play className="w-3 h-3" fill="currentColor" />Start Live<Tap className="-right-1 -top-2" /></div>
    </Phone>
  );
}

const STEPS: { title: string; lines: string[]; pic: React.ReactNode; icon: React.ElementType }[] = [
  { title: "Download", icon: Download, pic: <PicDownload />, lines: ["Open this page on your Android phone.", "Tap Download for Android.", "When it finishes, tap Open."] },
  { title: "Install", icon: ShieldCheck, pic: <PicInstall />, lines: ["If the phone asks, allow installing from your browser (Settings → Allow from this source), then go back.", "Google may say \"App blocked\" because the app is not on Google Play yet. Tap More details → Install anyway.", "It is StuPanel's own app — this message goes away once it is on Google Play."] },
  { title: "Sign in", icon: LogIn, pic: <PicSignIn />, lines: ["Open StuPanel Live.", "Tap Continue with Google, sign in, then tap Continue to the app.", "Or use your StuPanel email and password."] },
  { title: "Choose the event", icon: Smartphone, pic: <PicEvent />, lines: ["Today's events are at the top.", "Tap the event you are shooting.", "Don't see it? The studio must make its Face Search gallery first."] },
  { title: "Choose the camera folder", icon: FolderOpen, pic: <PicFolder />, lines: ["Tap Choose the camera folder.", "Open the folder your camera app saves to (see Connect your camera below).", "Tap Use this folder → Allow. You do this only once."] },
  { title: "Start Live and shoot", icon: Play, pic: <PicLive />, lines: ["Tap Start Live.", "Lock the phone and put it in your pocket — it keeps sending.", "Every new photo reaches the guests within seconds."] },
];

const CAMERAS: { id: string; name: string; app: string; folder: string; steps: string[] }[] = [
  { id: "sony", name: "Sony", app: "Transfer & Tagging", folder: "the Transfer & Tagging folder", steps: ["Install Sony's Transfer & Tagging app on the phone.", "In the app, turn on receiving photos from the camera (FTP).", "On the camera: Network → FTP Transfer → on, and pick the phone.", "In StuPanel Live, choose the folder Transfer & Tagging saves to."] },
  { id: "canon", name: "Canon", app: "Camera Connect", folder: "Pictures › Canon", steps: ["Install Canon Camera Connect and pair the camera.", "On the camera: Send to smartphone after shot → on (JPEG).", "In StuPanel Live, choose Pictures › Canon (or the folder Camera Connect saves to)."] },
  { id: "nikon", name: "Nikon", app: "SnapBridge", folder: "DCIM › SnapBridge", steps: ["Install Nikon SnapBridge and pair the camera.", "Turn on Auto link, and send photos while shooting (JPEG).", "In StuPanel Live, choose DCIM › SnapBridge."] },
  { id: "phone", name: "Phone", app: "The phone's own camera", folder: "DCIM › Camera", steps: ["Nothing to install.", "In StuPanel Live, choose DCIM › Camera.", "Good for a first try."] },
];

export default function LiveAppPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [android, setAndroid] = useState<boolean | null>(null);
  const [cam, setCam] = useState("sony");

  useEffect(() => {
    fetch("/downloads/live.json", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => (d ? setInfo(d) : setFailed(true))).catch(() => setFailed(true));
    const t = setTimeout(() => setAndroid(/android/i.test(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);
  const c = CAMERAS.find(x => x.id === cam) ?? CAMERAS[0];

  return (
    <PublicShell sub="StuPanel Live" width="max-w-[860px]">
      {/* Download */}
      <div className="rounded-[28px] bg-[#17151F] text-white p-6 sm:p-8" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-start gap-4">
          <span className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0"><Camera className="w-7 h-7" /></span>
          <div className="min-w-0">
            <h1 className="text-[26px] sm:text-[32px] font-bold leading-tight">StuPanel Live</h1>
            <p className="mt-1 text-[15px] text-white/75">Your camera&apos;s photos reach the guests while you are still shooting.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <a href={info?.url ?? "/downloads/stupanel-live.apk"} download
            className={cn("h-13 min-h-[52px] px-7 rounded-full bg-[#7D5CEF] text-white text-[16px] font-bold inline-flex items-center justify-center gap-2", !info && !failed && "opacity-60 pointer-events-none")}>
            {!info && !failed ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}Download for Android
          </a>
          {info && <p className="text-[13px] text-white/60">Version {info.versionName} · {info.sizeMb} MB · {info.date}</p>}
        </div>
        {android === false && (
          <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-[13.5px] text-white/85 flex gap-2.5"><Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" /><span className="min-w-0">You are on a computer. Open <b className="font-semibold [overflow-wrap:anywhere]">app.stupanel.com/live-app</b> on the Android phone you shoot with. iPhone is not supported yet.</span></p>
        )}
      </div>

      {/* Steps */}
      <h2 className="mt-9 mb-1 px-1 text-[22px] font-bold text-[#17151F]">Set it up in 6 steps</h2>
      <p className="px-1 text-[14px] text-[#6B6680]">Once per phone. About 3 minutes.</p>
      <ol className="mt-4 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-[24px] bg-white p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:items-center" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-[#7D5CEF] text-white text-[17px] font-extrabold flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
                <h3 className="text-[18px] font-bold text-[#17151F]">{s.title}</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {s.lines.map(l => (
                  <li key={l} className="flex gap-2.5 text-[15px] leading-relaxed text-[#33303F]"><Check className="w-4 h-4 mt-1 flex-shrink-0 text-[#1F8A5B]" strokeWidth={3} />{l}</li>
                ))}
              </ul>
            </div>
            <div className="self-center">{s.pic}</div>
          </li>
        ))}
      </ol>

      {/* Camera */}
      <section className="mt-9 rounded-[28px] bg-white p-5 sm:p-8" style={{ boxShadow: CARD_SHADOW }}>
        <h2 className="text-[22px] font-bold text-[#17151F]">Connect your camera</h2>
        <p className="mt-1 text-[14px] text-[#6B6680]">Your camera&apos;s app puts each photo on the phone; StuPanel Live sends it on. Shoot RAW + JPEG — only the JPEG is sent.</p>
        <div role="tablist" aria-label="Camera" className="mt-5 inline-flex max-w-full overflow-x-auto [scrollbar-width:none] gap-1 p-1 rounded-full bg-[#F5F3FA]">
          {CAMERAS.map(x => (
            <button key={x.id} type="button" role="tab" aria-selected={cam === x.id} onClick={() => setCam(x.id)}
              className={cn("h-10 px-4 rounded-full text-[14px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors", cam === x.id ? "bg-[#17151F] text-white" : "text-[#4A4658] hover:text-[#17151F]")}>{x.name}</button>
          ))}
        </div>
        <div className="mt-5 grid sm:grid-cols-[1fr_auto] gap-5 items-start">
          <ol className="space-y-3">
            {c.steps.map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
                <p className="pt-0.5 text-[15px] leading-relaxed text-[#33303F]">{t}</p>
              </li>
            ))}
          </ol>
          <div className="rounded-2xl bg-[#F7F5FB] px-4 py-3 min-w-[200px]">
            <p className="text-[12px] font-semibold text-[#6B6680]">App on the phone</p>
            <p className="text-[15px] font-bold text-[#17151F]">{c.app}</p>
            <p className="mt-2 text-[12px] font-semibold text-[#6B6680]">Folder to choose in StuPanel Live</p>
            <p className="text-[15px] font-bold text-[#5B3FD0]">{c.folder}</p>
          </div>
        </div>
      </section>

      <p className="mt-6 mb-2 text-center text-[13px] text-[#6B6680]">Stuck? Ask your studio — they can see your phone in the gallery&apos;s Live tab.</p>
    </PublicShell>
  );
}
