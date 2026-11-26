"use client";
/**
 * "Install StuPanel on this device" (Faisal 26-NOV-2026): the app on the home screen / desktop with its own icon
 * and window, like an installed app. Chrome, Edge and Samsung Internet offer it through the browser (we keep the
 * offer and show our own button); on an iPhone it is Share → Add to Home Screen. Hidden once it is installed.
 */
import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { FormGroup } from "@/components/ui/form-kit";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
// The browser offers it once, soon after the page opens: kept here so the button works whenever it is shown.
let offer: InstallEvent | null = null;
const waiting = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); offer = e as InstallEvent; waiting.forEach(f => f()); });
  window.addEventListener("appinstalled", () => { offer = null; waiting.forEach(f => f()); });
}

export function InstallApp() {
  const [state, setState] = useState<"none" | "can" | "ios" | "done" | "other">("none");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const look = () => {
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setState(standalone ? "done" : offer ? "can" : ios ? "ios" : "other");
    };
    const id = setTimeout(look, 0);
    waiting.add(look);
    return () => { clearTimeout(id); waiting.delete(look); };
  }, []);

  const install = async () => {
    if (!offer) return;
    const e = offer;
    await e.prompt();
    const { outcome } = await e.userChoice;
    offer = null;
    if (outcome === "accepted") { setState("done"); setMsg("Installed. Open StuPanel from its own icon."); }
    else { setState("other"); setMsg("Not installed. You can do it later from the browser's menu: Install app."); }
  };

  if (state === "none" || (state === "done" && !msg)) return null;
  return (
    <FormGroup title="Install StuPanel" note="StuPanel opens from its own icon in its own window, like an app. It is the same StuPanel: nothing to update by hand.">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="w-10 h-10 rounded-[12px] bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><Smartphone className="w-5 h-5" aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[#17151F]">Put StuPanel on this device</p>
          <p className="text-[13px] text-[#6B6680] mt-0.5">On your phone&apos;s home screen or your computer&apos;s desktop.</p>
        </div>
        {state === "can" && (
          <button type="button" onClick={install} className="h-11 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[14px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0"><Download className="w-4 h-4" />Install</button>
        )}
      </div>
      {state === "ios" && <p className="px-4 py-3 text-[13px] text-[#4A4658] bg-[#F5F3FA]">On an iPhone or iPad: open StuPanel in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</p>}
      {state === "other" && !msg && <p className="px-4 py-3 text-[13px] text-[#4A4658] bg-[#F5F3FA]">Open the browser&apos;s menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>. In Chrome on a computer there is also an install icon at the right end of the address bar.</p>}
      {msg && <p role="status" className="px-4 py-3 text-[13px] text-[#1E5E3A]">{msg}</p>}
    </FormGroup>
  );
}
