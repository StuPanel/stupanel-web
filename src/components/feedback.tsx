"use client";

/**
 * App-wide toasts and confirm dialogs in the StuPanel style (DESIGN_SYSTEM §6),
 * replacing the browser's grey alert() / confirm() boxes.
 *
 *   notify("Saved")                       → white pill toast, top centre, 2.6s
 *   notify("Delete failed", { error: true })
 *   if (!(await askConfirm({ message: "Delete this?", danger: true }))) return;
 *
 * <FeedbackHost /> is mounted once in the root layout.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

type Toast = { id: number; text: string; error: boolean };
type Ask = {
  title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean;
  resolve: (ok: boolean) => void;
};

let pushToast: ((t: Toast) => void) | null = null;
let pushAsk: ((a: Ask) => void) | null = null;
let seq = 0;

export function notify(text: string, opts?: { error?: boolean }) {
  const t = { id: ++seq, text, error: !!opts?.error };
  if (pushToast) pushToast(t);
  else if (typeof window !== "undefined") window.alert(text); // host not mounted yet
}

export function askConfirm(opts: Omit<Ask, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    if (pushAsk) pushAsk({ ...opts, resolve });
    else resolve(typeof window !== "undefined" ? window.confirm(opts.message) : false);
  });
}

export function FeedbackHost() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    pushToast = (t) => setToast(t);
    pushAsk = (a) => setAsk(a);
    return () => { pushToast = null; pushAsk = null; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  function close(ok: boolean) {
    ask?.resolve(ok);
    setAsk(null);
  }

  return (
    <>
      {toast && (
        <div key={toast.id} role="status" className={`sp-toast ${toast.error ? "sp-toast--err" : ""}`}>
          {toast.error ? <X /> : <Check />}
          <span className="text-sm font-semibold">{toast.text}</span>
        </div>
      )}

      {ask && (
        <>
          <div className="sp-backdrop z-[90]" onClick={() => close(false)} />
          <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none">
            <div role="alertdialog" aria-modal="true" className="sp-modal pointer-events-auto w-full max-w-sm p-6 text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${ask.danger ? "bg-[#FDECEF]" : "bg-[#EEE8FD]"}`}>
                <AlertTriangle className={`w-7 h-7 ${ask.danger ? "text-[#C2304F]" : "text-[#5B3FD0]"}`} />
              </div>
              <h3 className="font-bold text-[#17151F] text-lg">{ask.title ?? "Are you sure?"}</h3>
              <p className="text-[#6B6680] text-sm mt-2 whitespace-pre-line">{ask.message}</p>
              <div className="flex gap-3 mt-6">
                <button autoFocus onClick={() => close(false)}
                  className="flex-1 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold hover:bg-[#EEEBF4] transition-colors">
                  {ask.cancelLabel ?? "Cancel"}
                </button>
                <button onClick={() => close(true)}
                  className={`flex-1 h-11 rounded-full text-white text-sm font-semibold transition-colors ${ask.danger ? "bg-[#C2304F] hover:opacity-90" : "bg-[#7D5CEF] hover:bg-[#6143CF]"}`}>
                  {ask.confirmLabel ?? (ask.danger ? "Delete" : "Confirm")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
