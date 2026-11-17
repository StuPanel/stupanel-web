"use client";

/**
 * Keep a new form half-filled, like New program: while someone types, the form is saved on the server
 * as their own draft (one per person, studio and kind — on any device). Closing asks
 * "Keep editing / Save as draft / Discard"; saving it for real deletes the draft.
 *
 * Use: const d = useFormDraft("quote", snapshot, { enabled: !isEdit });
 *  - put `{...d.guard}` on the drawer element (it then asks by itself, not the general "Discard?" question)
 *  - call `d.requestClose(onClose)` from Back / ✕ / Cancel / the dimmed area
 *  - call `await d.drop()` after the real save
 *  - `loadDraft(kind)` gets a kept draft (data + when) to offer "Continue"
 */
import { useEffect, useRef, useState } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { askLeave, notify } from "@/components/feedback";
import { fmtDate } from "@/lib/format";

export type DraftKind = "program" | "quote" | "invoice";
export type KeptDraft<T> = { data: T; when: string };

export async function loadDraft<T = Record<string, unknown>>(kind: DraftKind): Promise<KeptDraft<T> | null> {
  const d = await apiFetch(`${API}/drafts/${kind}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!d?.data) return null;
  const when = d.updatedAt ? `${fmtDate(d.updatedAt)}, ${new Date(d.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "";
  return { data: d.data as T, when };
}

export async function deleteDraft(kind: DraftKind) {
  const r = await apiFetch(`${API}/drafts/${kind}`, { method: "DELETE" }).catch(() => null);
  return !!r?.ok;
}

export function useFormDraft(kind: DraftKind, snapshot: string, opts: { enabled: boolean; what: string }) {
  // `base` = the form at the person's first touch: anything the app filled in before that is not a change.
  const [base, setBase] = useState<string | null>(null);
  const dirty = base !== null && base !== snapshot;
  const write = useRef<Promise<boolean>>(Promise.resolve(true));
  const latest = useRef(snapshot);
  useEffect(() => { latest.current = snapshot; }, [snapshot]);

  function save(text: string): Promise<boolean> {
    write.current = write.current.then(() =>
      apiFetch(`${API}/drafts/${kind}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: JSON.parse(text) }) })
        .then(r => r.ok).catch(() => false));
    return write.current;
  }
  async function drop() {
    await write.current;
    await apiFetch(`${API}/drafts/${kind}`, { method: "DELETE" }).catch(() => null);
  }

  // Saved by itself a moment after the last change.
  useEffect(() => {
    if (!opts.enabled || !dirty) return;
    const id = setTimeout(() => { void save(snapshot); }, 1200);
    return () => clearTimeout(id);
  }, [opts.enabled, dirty, snapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  const touch = () => { if (base === null) setBase(latest.current); };

  /** Back, ✕, Cancel, the dimmed area: ask before the work is lost. */
  async function requestClose(onClose: () => void, busy = false) {
    if (busy) return;
    if (!dirty) { onClose(); return; }
    const answer = await askLeave(opts.enabled ? { draft: true, what: opts.what } : undefined);
    if (answer === "stay") return;
    if (opts.enabled) {
      if (answer === "draft") {
        if (!(await save(latest.current))) { notify("Couldn't save the draft. Check your connection and try again.", { error: true }); return; }
        notify("Saved as a draft");
      } else await drop();
    }
    onClose();
  }

  /** Start counting changes from now (e.g. after a kept draft was put back into the form). */
  const reset = () => setBase(null);

  return {
    dirty, drop, requestClose, reset,
    guard: { "data-sp-own-guard": dirty ? "dirty" : "", onPointerDownCapture: touch, onKeyDownCapture: touch },
  };
}
