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
import { jumpToField } from "@/lib/jump-to-field";

type Toast = { id: number; text: string; error: boolean };
type Ask = {
  title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean;
  /** A third, red choice under the buttons (e.g. "Delete forever"). */
  extraLabel?: string;
  resolve: (ok: boolean | "extra") => void;
};

type Prompt = {
  title: string; message?: string; value: string; placeholder?: string; confirmLabel?: string;
  /** Picks to choose from (e.g. existing folders); typing a new one is allowed too. */
  suggestions?: string[];
  resolve: (v: string | null) => void;
};

let pushToast: ((t: Toast) => void) | null = null;
let pushPrompt: ((p: Prompt) => void) | null = null;
let pushAsk: ((a: Ask) => void) | null = null;
let seq = 0;

export function notify(text: string, opts?: { error?: boolean }) {
  const t = { id: ++seq, text, error: !!opts?.error };
  if (t.error) jumpToField(undefined, { toMessage: false }); // an empty required field in the open form, if any
  if (pushToast) pushToast(t);
  else if (typeof window !== "undefined") window.alert(text); // host not mounted yet
}

export function askConfirm(opts: Omit<Ask, "resolve" | "extraLabel">): Promise<boolean> {
  return new Promise((resolve) => {
    if (pushAsk) pushAsk({ ...opts, resolve: (v) => resolve(v === true) });
    else resolve(typeof window !== "undefined" ? window.confirm(opts.message) : false);
  });
}

/**
 * Deleting a Google Drive file/folder from StuPanel: "Move to trash" (can be restored in Drive
 * for 30 days) or "Delete forever" (asks once more). Returns null when cancelled.
 */
export async function askDriveDelete(what: string): Promise<"trash" | "forever" | null> {
  const first = await new Promise<boolean | "extra">((resolve) => {
    if (pushAsk) pushAsk({
      title: `Delete ${what}?`,
      message: "It moves to Google Drive's trash — you can restore it there for 30 days.",
      confirmLabel: "Move to trash", danger: true, extraLabel: "Delete forever", resolve,
    });
    else resolve(typeof window !== "undefined" && window.confirm(`Delete ${what}?`));
  });
  if (first === true) return "trash";
  if (first !== "extra") return null;
  const sure = await askConfirm({
    title: "Delete forever?",
    message: `${what} will be removed from Google Drive for good. This can't be undone.`,
    confirmLabel: "Delete forever", danger: true,
  });
  return sure ? "forever" : null;
}

/** Ask for a short text (a new name, a folder). Returns null when cancelled. */
export function askText(opts: Omit<Prompt, "resolve">): Promise<string | null> {
  return new Promise((resolve) => {
    if (pushPrompt) pushPrompt({ ...opts, resolve });
    else resolve(typeof window !== "undefined" ? window.prompt(opts.title, opts.value) : null);
  });
}

export function FeedbackHost() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    pushToast = (t) => setToast(t);
    pushAsk = (a) => setAsk(a);
    pushPrompt = (p) => { setText(p.value); setPrompt(p); };
    return () => { pushToast = null; pushAsk = null; pushPrompt = null; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  function closePrompt(v: string | null) {
    prompt?.resolve(v);
    setPrompt(null);
  }

  function close(ok: boolean | "extra") {
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

      {prompt && (
        <>
          <div className="sp-backdrop z-[90]" onClick={() => closePrompt(null)} />
          <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none">
            <form role="dialog" aria-modal="true" className="sp-modal pointer-events-auto w-full max-w-sm p-6"
              onSubmit={e => { e.preventDefault(); closePrompt(text); }}
              onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); closePrompt(null); } }}>
              <h3 className="font-bold text-[#17151F] text-lg">{prompt.title}</h3>
              {prompt.message && <p className="text-[#6B6680] text-sm mt-1.5">{prompt.message}</p>}
              <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={prompt.placeholder}
                onFocus={e => { const dot = e.target.value.lastIndexOf("."); e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length); }}
                className="mt-4 w-full h-11 px-3 rounded-xl bg-[#F5F3FA] text-[#17151F] text-sm outline-none focus:ring-2 focus:ring-[#7D5CEF]/40" />
              {!!prompt.suggestions?.length && (
                <div className="mt-2 max-h-40 overflow-y-auto flex flex-wrap gap-1.5">
                  {prompt.suggestions.map(sug => (
                    <button key={sug} type="button" onClick={() => setText(sug)}
                      className={`h-7 px-2.5 rounded-full text-[12px] font-semibold border ${text === sug ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE]"}`}>
                      {sug || "Main folder"}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => closePrompt(null)}
                  className="flex-1 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold hover:bg-[#EEEBF4] transition-colors">Cancel</button>
                <button type="submit"
                  className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold transition-colors">{prompt.confirmLabel ?? "Save"}</button>
              </div>
            </form>
          </div>
        </>
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
              {ask.extraLabel && (
                <button onClick={() => close("extra")}
                  className="mt-3 h-9 px-4 rounded-full text-[13px] font-semibold text-[#C2304F] hover:bg-[#FDECEF] transition-colors">
                  {ask.extraLabel}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
