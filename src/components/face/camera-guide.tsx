"use client";
/**
 * "Connect your camera" (Faisal 27-NOV-2026): a step-by-step guide for StuPanel Live, one camera at a time,
 * so anyone can set it up without help. Pick the camera, answer one or two questions (how the camera and phone
 * share a network, which menu the camera has), then follow numbered steps in three parts: on the phone, on the
 * camera, start Live. Each step can be ticked; ticks are kept in this browser so a half-done set-up can go on.
 *
 * Sony was set up and tested live with an A7C on 27-NOV (camera FTP → Sony Transfer & Tagging → StuPanel Live).
 * Other cameras get the same kind of guide one by one; until then they show "Guide coming soon".
 */
import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ChevronDown, Lightbulb, RotateCcw, Smartphone, Wifi, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Net = "wifi" | "hotspot";
type Menu = "old" | "new";
type Step = { title: string; lines: React.ReactNode[]; note?: React.ReactNode };
type Part = { id: "phone" | "camera" | "live"; title: string; icon: React.ElementType; steps: Step[] };

const CAMS: { id: string; name: string; ready: boolean; sub: string }[] = [
  { id: "sony", name: "Sony", ready: true, sub: "Alpha with FTP" },
  { id: "phone", name: "Phone camera", ready: true, sub: "No camera needed" },
  { id: "laptop", name: "Laptop", ready: true, sub: "Any camera, from a folder" },
  { id: "canon", name: "Canon", ready: false, sub: "Guide coming soon" },
  { id: "nikon", name: "Nikon", ready: false, sub: "Guide coming soon" },
];

const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-[#17151F]">{children}</b>;
const Path = ({ items }: { items: string[] }) => (
  <span className="inline-flex flex-wrap items-center gap-1 align-middle">
    {items.map((t, i) => (
      <span key={i} className="inline-flex items-center gap-1">
        {i > 0 && <span className="text-[#8A8599]" aria-hidden="true">›</span>}
        <span className="px-1.5 py-0.5 rounded-md bg-[#F1EEF8] text-[#2D2A38] text-[13.5px] font-semibold whitespace-nowrap">{t}</span>
      </span>
    ))}
  </span>
);
const Val = ({ name, value }: { name: string; value: string }) => (
  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
    <span className="px-1.5 py-0.5 rounded-md bg-[#F1EEF8] text-[#2D2A38] text-[13.5px] font-semibold">{name}</span>
    <span className="text-[#8A8599]" aria-hidden="true">→</span>
    <span className="px-1.5 py-0.5 rounded-md bg-[#E7F5EE] text-[#176B47] text-[13.5px] font-bold">{value}</span>
  </span>
);

function sonyParts(net: Net, menu: Menu): Part[] {
  const wifi = net === "wifi";
  const phone: Step[] = [
    {
      title: "Install two apps",
      lines: [<>From Play Store: <B>Transfer &amp; Tagging</B> (by Sony).</>, <><B>StuPanel Live</B>, from the download page (your studio sends the link).</>],
    },
    wifi
      ? { title: "Join the Wi-Fi", lines: [<>Connect the phone to the venue&apos;s Wi-Fi (or the pocket router you brought).</>, <>The camera will join the <B>same</B> Wi-Fi. Mobile data is not needed.</>] }
      : {
          title: "Turn on the hotspot",
          lines: [<>Turn on <B>mobile data</B>: the photos go to the internet through it.</>, <>Turn on the phone&apos;s <B>hotspot</B>. Note its name and password; the camera joins it.</>],
          note: <>Samsung: the hotspot&apos;s <B>Wi-Fi sharing</B> option (on some models) shares the venue Wi-Fi instead of mobile data.</>,
        },
    {
      title: "Open the receiving screen",
      lines: [
        <>Open Transfer &amp; Tagging: <Path items={["☰ Menu", "Import Guide", wifi ? "Wi-Fi" : "Personal Hotspot"]} /></>,
        <>The screen shows <B>Host name</B> (like 192.168.1.5), <B>Port</B>, <B>User</B> and <B>Password</B>. Keep it open: the camera needs them.</>,
      ],
    },
  ];
  const join: Step = {
    title: wifi ? "Join the same Wi-Fi" : "Join the phone's hotspot",
    lines: [
      <><Path items={["MENU", "Network", menu === "old" ? "Wi-Fi Settings" : "Wi-Fi", "Access Point Set."]} /></>,
      <>Choose {wifi ? "the same Wi-Fi as the phone" : "the phone's hotspot"}, type the password, then <B>OK</B>.</>,
      <>On the next screen leave <B>IP Address Setting: Auto</B> and <B>Priority Connection: Off</B>, press <B>OK</B>. The camera says <B>Registered.</B></>,
    ],
  };
  const camera: Step[] = menu === "old"
    ? [
        join,
        { title: "Turn on FTP", lines: [<><Path items={["MENU", "Network", "FTP Transfer Func."]} /></>, <Val key="f" name="FTP Function" value="On" />] },
        {
          title: "Type in the phone's details",
          lines: [
            <><Path items={["Server Setting", "Server 1", "Destination Settings"]} /></>,
            <><B>Host Name</B> and <B>Port</B>: exactly as on the phone. <Val name="Secure Protocol" value="Off" /></>,
            <><Path items={["User Info Settings"]} />: the <B>User</B> and <B>Password</B> from the phone. Then <B>OK</B>.</>,
          ],
        },
        {
          title: "Send each photo as you shoot",
          lines: [<Val key="a" name="Auto Trans When Shot" value="On" />, <Val key="b" name="RAW+J Trans. Trgt." value="JPEG only" />, <Val key="c" name="FTP Power Save" value="Off" />],
        },
      ]
    : [
        join,
        { title: "Turn on FTP", lines: [<><Path items={["MENU", "Network", "Transfer/Remote", "FTP Transfer Func."]} /></>, <Val key="f" name="FTP Function" value="On" />, <Val key="c" name="FTP Connect Method" value="Wi-Fi" />] },
        {
          title: "Give the camera the phone's details",
          lines: [
            <>Easiest: pair the camera with the phone by <B>Bluetooth</B> (camera <Path items={["Network", "Bluetooth", "Pairing"]} />), then tap <B>Write to the camera</B> in Transfer &amp; Tagging.</>,
            <>Or by hand: <Path items={["Server Setting", "Server 1"]} />, type <B>Host Name</B>, <B>Port</B>, <B>User</B>, <B>Password</B> from the phone. <Val name="Secure Protocol" value="Off" /></>,
          ],
        },
        {
          title: "Send each photo as you shoot",
          lines: [<Val key="a" name="Auto FTP Transfer" value="On" />, <Val key="b" name="RAW+J Trans. Trgt." value="JPEG only" />, <Val key="c" name="FTP Power Save" value="Off" />],
        },
      ];
  camera.push({
    title: "Shoot RAW + JPEG",
    lines: [<>Set the file format to <B>RAW &amp; JPEG</B> (or JPEG). <B>RAW alone is not sent</B>: Face Search reads JPEG.</>, <>JPEG size <B>M</B> sends faster and is plenty for finding faces.</>],
  });
  const live: Step[] = [
    { title: "Sign in and choose the event", lines: [<>Open StuPanel Live, sign in, tap the event you are shooting.</>] },
    {
      title: "Choose the camera folder",
      lines: [<>Tap <B>Choose the camera folder</B> and pick <Path items={["DCIM", "Transfer & Tagging"]} />, then <B>Use this folder</B> → <B>Allow</B>.</>, <>Want the guests to get the full-size file? Turn <B>Smaller copy</B> off.</>],
    },
    {
      title: "Start Live and take a test photo",
      lines: [<>Tap <B>Start Live</B>, then take one photo.</>, <>It shows in Transfer &amp; Tagging, then in StuPanel Live&apos;s <B>Just sent</B>, and in the gallery about 15 seconds later.</>],
    },
  ];
  return [
    { id: "phone", title: "On the phone", icon: Smartphone, steps: phone },
    { id: "camera", title: "On the camera", icon: Camera, steps: camera },
    { id: "live", title: "Start Live", icon: Wifi, steps: live },
  ];
}

const PHONE_PARTS: Part[] = [
  { id: "phone", title: "On the phone", icon: Smartphone, steps: [{ title: "Install StuPanel Live", lines: [<>From the download page (your studio sends the link). Nothing else to install.</>] }] },
  {
    id: "live", title: "Start Live", icon: Wifi, steps: [
      { title: "Sign in and choose the event", lines: [<>Open StuPanel Live, sign in, tap the event.</>] },
      { title: "Choose the camera folder", lines: [<>Pick <Path items={["DCIM", "Camera"]} />, then <B>Use this folder</B> → <B>Allow</B>.</>] },
      { title: "Start Live and shoot", lines: [<>Tap <B>Start Live</B> and take photos with the phone&apos;s camera. Good for a first try.</>] },
    ],
  },
];

const LAPTOP_PARTS: Part[] = [
  {
    id: "phone", title: "On the laptop", icon: Smartphone, steps: [
      { title: "Open the event in Chrome", lines: [<>On the laptop, open StuPanel in <B>Chrome</B> or <B>Edge</B>: <Path items={["AI Face Search", "your event", "Live"]} />.</>, <>Connect the laptop to the venue Wi-Fi or the phone&apos;s hotspot.</>] },
      { title: "Make a folder for live photos", lines: [<>For example <B>Desktop › Live</B>. Only JPEG files are sent; RAW is skipped.</>] },
    ],
  },
  {
    id: "camera", title: "Get photos into the folder", icon: Camera, steps: [
      {
        title: "Choose one way",
        lines: [
          <><B>Camera on a cable</B> (instant): the camera maker&apos;s free tethering software saves each shot into the folder: Sony <B>Imaging Edge Desktop › Remote</B>, Canon <B>EOS Utility</B>, Nikon <B>NX Tether</B>. Set it to save JPEG (or RAW + JPEG) into your Live folder.</>,
          <><B>Card copies</B>: every 20–30 minutes copy the new photos from the card into the folder.</>,
          <><B>Lightroom</B>: pick and edit, then <B>Export</B> JPEGs into the folder. Guests get only your best, edited photos.</>,
        ],
      },
    ],
  },
  {
    id: "live", title: "Start Live", icon: Wifi, steps: [
      { title: "Choose the folder and start", lines: [<>In the Live tab, <B>Send from this computer</B> › <B>Choose folder</B> › pick your Live folder › <B>Allow</B>.</>, <>Tap <B>Start sending</B>. Tick <B>Also send the photos already in this folder</B> if they should go too.</>] },
      { title: "Keep the tab open", lines: [<>New photos go within seconds. Keep the tab open and the laptop awake (plugged in, sleep off).</>, <>No internet for a while? Photos wait and go when it is back.</>] },
    ],
  },
];

const SONY_TIPS: { q: string; a: React.ReactNode }[] = [
  { q: "The camera says it can't connect", a: <>Check the phone and camera are on the same Wi-Fi, Transfer &amp; Tagging&apos;s receiving screen is open, and Host name / Port match. Some hotel and hall Wi-Fi does not let devices talk to each other: use the phone&apos;s hotspot or a pocket router instead.</> },
  { q: "Photos reach the phone but not the gallery", a: <>Open StuPanel Live: is it <B>Live</B>, and is the folder <B>DCIM › Transfer &amp; Tagging</B>? With weak internet the photos wait and go by themselves when it comes back; none are lost.</> },
  { q: "Nothing is sent when I shoot RAW", a: <>That&apos;s expected. Shoot RAW + JPEG: the RAW stays on the card, the JPEG goes live.</> },
  { q: "It stops after a while", a: <>Set <B>FTP Power Save: Off</B> on the camera, and turn battery saving off for Transfer &amp; Tagging and StuPanel Live on the phone. A hotspot also switches off when nothing uses it for a while.</> },
];

function useTicks(key: string) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    const id = setTimeout(() => { try { setDone(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setDone([]); } }, 0);
    return () => clearTimeout(id);
  }, [key]);
  const put = (next: string[]) => { setDone(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ticks are a convenience */ } };
  return { done, toggle: (id: string) => put(done.includes(id) ? done.filter(x => x !== id) : [...done, id]), reset: () => put([]) };
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; t: string; sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-[#4A4658] mb-2">{label}</legend>
      <div className="grid sm:grid-cols-2 gap-2">
        {options.map(o => (
          <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
            className={cn("text-left rounded-[14px] px-3.5 py-2.5 border transition-colors", value === o.v ? "border-[#7D5CEF] bg-[#F4F0FF]" : "border-[#E4E0EC] bg-white hover:border-[#C9BCF5]")}>
            <span className="block text-[14px] font-semibold text-[#17151F]">{o.t}</span>
            {o.sub && <span className="block text-[12.5px] text-[#6B6680] mt-0.5">{o.sub}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function CameraGuide({ compact }: { /** Inside a side sheet: a little tighter */ compact?: boolean }) {
  const [cam, setCam] = useState("sony");
  const [net, setNet] = useState<Net>("wifi");
  const [menu, setMenu] = useState<Menu>("old");
  const [open, setOpen] = useState<string | null>(null);
  const parts = useMemo(() => (cam === "sony" ? sonyParts(net, menu) : cam === "phone" ? PHONE_PARTS : cam === "laptop" ? LAPTOP_PARTS : []), [cam, net, menu]);
  const ticks = useTicks(`live-guide:${cam}:${cam === "sony" ? `${net}:${menu}` : ""}`);
  const all = parts.flatMap(p => p.steps.map(s => `${p.id}:${s.title}`));
  const doneCount = all.filter(x => ticks.done.includes(x)).length;
  // Steps are numbered straight through the three parts.
  const first = parts.map((_, i) => parts.slice(0, i).reduce((a, p) => a + p.steps.length, 0));

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      {/* Camera */}
      <div role="radiogroup" aria-label="Your camera" className={cn("grid grid-cols-2 gap-2", compact ? "sm:grid-cols-3" : "sm:grid-cols-5")}>
        {CAMS.map(c => (
          <button key={c.id} type="button" role="radio" aria-checked={cam === c.id} disabled={!c.ready} onClick={() => setCam(c.id)}
            className={cn("text-left rounded-[16px] px-3.5 py-3 border transition-colors disabled:cursor-not-allowed",
              cam === c.id ? "border-[#17151F] bg-[#17151F] text-white" : c.ready ? "border-[#E4E0EC] bg-white hover:border-[#B9B2CB]" : "border-dashed border-[#E4E0EC] bg-[#FAF9FC] text-[#8A8599]")}>
            <span className="block text-[15px] font-bold">{c.name}</span>
            <span className={cn("block text-[12px] mt-0.5", cam === c.id ? "text-white/70" : "text-[#8A8599]")}>{c.sub}</span>
          </button>
        ))}
      </div>

      {cam === "sony" && (
        <div className="rounded-[18px] bg-[#FAF9FC] border border-[#EEEBF4] p-4 space-y-4">
          <Choice label="How do the camera and phone connect?" value={net} onChange={setNet} options={[
            { v: "wifi", t: "Venue Wi-Fi", sub: "Both join the same Wi-Fi. No mobile data needed." },
            { v: "hotspot", t: "Phone's hotspot", sub: "The camera joins the phone. Mobile data must be on." },
          ]} />
          <Choice label="Your camera's menu" value={menu} onChange={setMenu} options={[
            { v: "old", t: "Tabs with numbered pages", sub: "A7 III, A7C, A7R IV, A9, A9 II" },
            { v: "new", t: "Menu with a list on the left", sub: "A7 IV, A7C II, A7R V, A1, A9 III, FX3" },
          ]} />
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-[#EEEBF4] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={doneCount} aria-label="Steps done">
          <div className="h-full rounded-full bg-[#1F8A5B] transition-[width] duration-300" style={{ width: `${all.length ? (doneCount / all.length) * 100 : 0}%` }} />
        </div>
        <span className="text-[13px] font-semibold text-[#4A4658] tabular-nums whitespace-nowrap">{doneCount} of {all.length} done</span>
        {doneCount > 0 && <button type="button" onClick={ticks.reset} className="h-9 px-3 rounded-full text-[13px] font-semibold text-[#6B6680] hover:bg-[#F5F3FA] inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Start over</button>}
      </div>

      {/* Steps */}
      {parts.map((part, pi) => (
        <section key={part.id} aria-labelledby={`g-${part.id}`}>
          <h3 id={`g-${part.id}`} className="flex items-center gap-2 text-[15px] font-bold text-[#17151F] mb-2">
            <span className="w-8 h-8 rounded-[10px] bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center"><part.icon className="w-4 h-4" aria-hidden="true" /></span>
            {part.title}
          </h3>
          <ol className="rounded-[18px] bg-white border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
            {part.steps.map((s, si) => {
              const n = first[pi] + si + 1;
              const id = `${part.id}:${s.title}`;
              const ok = ticks.done.includes(id);
              return (
                <li key={id} className={cn("flex gap-3 px-4 py-3.5", ok && "bg-[#F6FBF8]")}>
                  <button type="button" onClick={() => ticks.toggle(id)} aria-pressed={ok} aria-label={ok ? `Step ${n} done. Tap to undo` : `Mark step ${n} done`}
                    className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[15px] font-extrabold tabular-nums transition-colors",
                      ok ? "bg-[#1F8A5B] text-white" : "bg-[#7D5CEF] text-white hover:bg-[#6143CF]")}>
                    {ok ? <Check className="w-4 h-4" strokeWidth={3} /> : n}
                  </button>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className={cn("text-[15.5px] font-bold", ok ? "text-[#176B47]" : "text-[#17151F]")}>{s.title}</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {s.lines.map((l, i) => <li key={i} className="text-[14.5px] leading-relaxed text-[#3A3647]">{l}</li>)}
                    </ul>
                    {s.note && <p className="mt-2 text-[13px] text-[#6B6680] flex gap-1.5"><Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#B7791F]" aria-hidden="true" /><span>{s.note}</span></p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {cam === "sony" && (
        <section aria-labelledby="g-help">
          <h3 id="g-help" className="text-[15px] font-bold text-[#17151F] mb-2">If something doesn&apos;t work</h3>
          <div className="rounded-[18px] bg-white border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
            {SONY_TIPS.map(t => (
              <div key={t.q}>
                <button type="button" aria-expanded={open === t.q} onClick={() => setOpen(open === t.q ? null : t.q)}
                  className="w-full min-h-[48px] px-4 py-3 flex items-center gap-3 text-left text-[14.5px] font-semibold text-[#17151F] hover:bg-[#FAF9FC]">
                  <span className="flex-1">{t.q}</span><ChevronDown className={cn("w-4 h-4 text-[#8A8599] transition-transform", open === t.q && "rotate-180")} aria-hidden="true" />
                </button>
                {open === t.q && <p className="px-4 pb-3.5 -mt-1 text-[14px] leading-relaxed text-[#4A4658]">{t.a}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[12.5px] text-[#8A8599]">Menu names can differ a little between camera models.</p>
        </section>
      )}
    </div>
  );
}

/** The guide in a side sheet (the gallery's Live tab). */
export function CameraGuideSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = old; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Connect your camera">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#17151F]/40 backdrop-blur-[2px] cursor-default" />
      <div className="relative w-full max-w-[600px] h-full bg-[#F5F3FA] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-[#EEEBF4]">
          <div>
            <h2 className="text-[18px] font-bold text-[#17151F]">Connect your camera</h2>
            <p className="text-[13px] text-[#6B6680]">Step by step. Tick each step as you go.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full hover:bg-[#F5F3FA] text-[#6B6680] flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5"><CameraGuide compact /></div>
      </div>
    </div>
  );
}
