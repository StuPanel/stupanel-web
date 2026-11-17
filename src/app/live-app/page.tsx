"use client";

/**
 * StuPanel Live — download and set-up page (public, so a studio can send it to its photographers).
 * Until the app is on Google Play it is downloaded from here. The version comes from /downloads/live.json.
 */
import { useEffect, useState } from "react";
import { Camera, Check, Download, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";
import { PublicShell } from "@/components/public/public-shell";

type Info = { versionName: string; versionCode: number; url: string; sizeMb: number; date: string };

const STEPS: { title: string; text: string }[] = [
  { title: "Download the app", text: "Tap Download on your Android phone. iPhone is not supported yet." },
  { title: "Install it", text: "Open the downloaded file. If the phone asks, allow installing apps from your browser or Files. If Google Play Protect warns that it doesn't know the app, tap More details → Install anyway. This message goes away once StuPanel Live is on Google Play." },
  { title: "Sign in", text: "Continue with Google (or your StuPanel email and password). The studio owner, managers and the program's team can send photos." },
  { title: "Choose the event and the camera folder", text: "Pick the event's Face Search gallery, then the folder your camera app saves to (see below). Choose which folder in the gallery the photos go to, then Start Live." },
  { title: "Shoot", text: "Every new photo goes to the gallery by itself, also with the screen off. Guests who scanned the QR get their photos within seconds." },
];

const CAMERAS: { name: string; app: string; how: string }[] = [
  { name: "Sony (A7C, A7 IV, A7R, A1, FX3…)", app: "Transfer & Tagging (Sony)", how: "In the app, set it to receive photos by FTP; on the camera, turn on FTP Transfer to the phone. Then choose the app's folder in StuPanel Live." },
  { name: "Canon (R5, R6, R8, R10…)", app: "Canon Camera Connect", how: "Turn on Auto transfer (Send images to smartphone after shooting). Choose the Pictures / Canon folder in StuPanel Live." },
  { name: "Nikon (Z5, Z6, Z8, Z9, Zf…)", app: "Nikon SnapBridge", how: "Turn on Auto link and send JPEGs after shooting. Choose the DCIM / SnapBridge folder in StuPanel Live." },
  { name: "Phone camera", app: "The phone's own camera", how: "Choose DCIM / Camera in StuPanel Live." },
];

export default function LiveAppPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [android, setAndroid] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/downloads/live.json", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => (d ? setInfo(d) : setFailed(true))).catch(() => setFailed(true));
    const t = setTimeout(() => setAndroid(/android/i.test(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <PublicShell sub="StuPanel Live" width="max-w-[760px]">
      <div className="rounded-[28px] bg-white p-6 sm:p-8" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-start gap-4">
          <span className="w-14 h-14 rounded-2xl bg-[#17151F] text-white flex items-center justify-center flex-shrink-0"><Camera className="w-7 h-7" /></span>
          <div className="min-w-0">
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-tight text-[#17151F]">StuPanel Live</h1>
            <p className="mt-1 text-[15px] text-[#4A4658]">Photos from your camera reach the guests while you are still shooting. For Android phones.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <a href={info?.url ?? "/downloads/stupanel-live.apk"} download
            className={cn("h-12 px-6 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2", !info && !failed && "opacity-60 pointer-events-none")}>
            {!info && !failed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Download for Android
          </a>
          {info && <p className="text-[13px] text-[#6B6680]">Version {info.versionName} · {info.sizeMb} MB · {info.date}</p>}
        </div>
        {android === false && (
          <p className="mt-4 rounded-2xl bg-[#F5F3FA] px-4 py-3 text-[13.5px] text-[#4A4658] flex gap-2.5"><Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#5B3FD0]" />Open this page on the Android phone you shoot with, or send the link to it.</p>
        )}
      </div>

      <section className="mt-6 rounded-[28px] bg-white p-6 sm:p-8" style={{ boxShadow: CARD_SHADOW }}>
        <h2 className="text-[18px] font-bold text-[#17151F]">Set it up once</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((x, i) => (
            <li key={x.title} className="flex gap-3.5">
              <span className="w-8 h-8 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[14px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
              <div className="min-w-0 pt-1">
                <p className="text-[15px] font-semibold text-[#17151F]">{x.title}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-[#4A4658]">{x.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-2xl bg-[#FFF3E0] px-4 py-3 text-[13.5px] text-[#6B4100] flex gap-2.5"><ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />The &quot;Play Protect&quot; warning appears because the app is not on Google Play yet. It is StuPanel&apos;s own app.</p>
      </section>

      <section className="mt-6 rounded-[28px] bg-white p-6 sm:p-8" style={{ boxShadow: CARD_SHADOW }}>
        <h2 className="text-[18px] font-bold text-[#17151F]">Connect your camera</h2>
        <p className="mt-1 text-[14px] text-[#6B6680]">Your camera maker&apos;s app puts each photo on the phone; StuPanel Live sends it on. Shoot RAW + JPEG: only the JPEG is sent.</p>
        <div className="mt-4 grid gap-3">
          {CAMERAS.map(c => (
            <div key={c.name} className="rounded-2xl bg-[#F7F5FB] p-4">
              <p className="text-[15px] font-semibold text-[#17151F]">{c.name}</p>
              <p className="mt-0.5 text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />{c.app}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#4A4658]">{c.how}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
