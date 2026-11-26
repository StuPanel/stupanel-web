"use client";
/**
 * "Notifications on this phone": one switch per device (My account for the owner and managers, My profile for
 * members). Says plainly when the browser can't do it, when the person blocked it, and what an iPhone needs.
 */
import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { FormGroup } from "@/components/ui/form-kit";
import { pushOff, pushOn, pushState, pushTest, type PushState } from "@/lib/push";
import { cn } from "@/lib/utils";

export function PushSwitch({ what }: { /** "new enquiries, messages and payments" */ what: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  useEffect(() => { let live = true; void pushState().then(s => { if (live) setState(s); }); return () => { live = false; }; }, []);

  const flip = async () => {
    if (busy || !state) return;
    setBusy(true); setMsg(null);
    if (state === "on") { setState(await pushOff()); setMsg({ text: "Notifications are off on this device." }); }
    else {
      const r = await pushOn();
      setState(r.state);
      if (r.ok) setMsg({ text: "Notifications are on. Press “Send a test” to see one." });
      else if (r.state === "blocked") setMsg(null);
      else setMsg({ text: r.error ?? "Notifications were not allowed.", bad: true });
    }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setMsg(null);
    const n = await pushTest().catch(() => 0);
    setMsg(n ? { text: "Sent. It should show on this device in a moment." } : { text: "Nothing could be sent. Switch notifications off and on again.", bad: true });
    setBusy(false);
  };

  const on = state === "on";
  const can = state === "on" || state === "off";
  return (
    <FormGroup title="Notifications on this device" note="Each phone or computer has its own switch. Signing out switches it off on that device.">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="w-10 h-10 rounded-[12px] bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><BellRing className="w-5 h-5" aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[#17151F]">Tell me on this device</p>
          <p className="text-[13px] text-[#6B6680] mt-0.5">About {what}, even when StuPanel is closed.</p>
        </div>
        {state === null || busy ? <Loader2 className="w-5 h-5 animate-spin text-[#8A8597] flex-shrink-0" aria-label="Working" />
          : can && (
            <button type="button" role="switch" aria-checked={on} aria-label="Notifications on this device" onClick={flip}
              className={cn("relative w-[51px] h-[31px] rounded-full transition-colors flex-shrink-0", on ? "bg-[#7D5CEF]" : "bg-[#E4E0EC]")}>
              <span className={cn("absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-transform", on && "translate-x-[20px]")} />
            </button>
          )}
      </div>
      {state === "blocked" && <p className="px-4 py-3 text-[13px] text-[#7A5410] bg-[#FFF8EA]">Notifications are blocked for StuPanel in this browser. Open the browser&apos;s site settings (the lock icon beside the address), allow Notifications, then come back here.</p>}
      {state === "ios-install" && <p className="px-4 py-3 text-[13px] text-[#4A4658] bg-[#F5F3FA]">On an iPhone or iPad: open StuPanel in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Open StuPanel from that icon and switch notifications on here.</p>}
      {state === "unsupported" && <p className="px-4 py-3 text-[13px] text-[#4A4658] bg-[#F5F3FA]">This browser can&apos;t show notifications. Use Chrome, Edge, Firefox or Safari.</p>}
      {on && (
        <div className="px-4 py-3">
          <button type="button" onClick={test} disabled={busy} className="h-10 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold text-[#4A4658] disabled:opacity-60">Send a test</button>
        </div>
      )}
      {msg && <p role="status" className={cn("px-4 py-3 text-[13px]", msg.bad ? "text-[#C2304F]" : "text-[#1E5E3A]")}>{msg.text}</p>}
    </FormGroup>
  );
}
