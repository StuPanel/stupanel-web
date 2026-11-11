/**
 * When a form can't be saved, take the person to the thing that needs fixing:
 * scroll it into view, flash a red ring around it and put the cursor in it.
 *
 *   setError("Write the phone number."); jumpToField("phone");
 *
 * Mark the spot with `data-field="phone"` (the shared <Field name="phone"> does it).
 * With no name (or no match) it goes to the first empty required field in the open
 * form, and if there is none, to the form's error message — so the message is seen.
 */

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly]), [role="radio"], [role="checkbox"], button:not([disabled])';

/** The form the person is looking at: the top-most open dialog, else the page. */
function scope(): ParentNode {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))
    .filter(d => d.offsetParent !== null || d.getClientRects().length > 0);
  return dialogs[dialogs.length - 1] ?? document;
}

const isEmpty = (el: Element) => {
  const c = el.matches("input, select, textarea") ? el : el.querySelector("input:not([type=hidden]), select, textarea");
  return !!c && !String((c as HTMLInputElement).value ?? "").trim();
};

function find(name?: string): HTMLElement | null {
  const root = scope();
  if (name) {
    const hit = root.querySelector<HTMLElement>(`[data-field="${CSS.escape(name)}"]`)
      ?? document.querySelector<HTMLElement>(`[data-field="${CSS.escape(name)}"]`);
    if (hit) return hit;
  }
  const empty = Array.from(root.querySelectorAll<HTMLElement>("[data-required]")).find(isEmpty);
  return empty ?? null;
}

let lit: { el: HTMLElement; timer: number } | null = null;
function flash(el: HTMLElement) {
  if (lit) { window.clearTimeout(lit.timer); lit.el.classList.remove("sp-attn"); } // one at a time
  el.classList.remove("sp-attn");
  void el.offsetWidth; // restart the animation
  el.classList.add("sp-attn");
  lit = { el, timer: window.setTimeout(() => { el.classList.remove("sp-attn"); lit = null; }, 2400) };
}

function go(el: HTMLElement, focus: boolean) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  flash(el);
  if (!focus) return;
  // Inside a bigger block, prefer the empty required box; else the first thing you can type in.
  const emptyReq = Array.from(el.querySelectorAll<HTMLElement>("[data-required]")).find(isEmpty);
  const f = el.matches(FOCUSABLE) ? el
    : (emptyReq?.querySelector<HTMLElement>(FOCUSABLE) ?? el.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]):not([readonly]), select, textarea') ?? el.querySelector<HTMLElement>(FOCUSABLE));
  // Wait for the smooth scroll to start, so focusing doesn't jump the page.
  window.setTimeout(() => f?.focus({ preventScroll: true }), 350);
}

/**
 * Take the person to the field that needs fixing. Runs after the next paint, so it works
 * right after a setState that shows the field or the message.
 * Returns nothing; safe to call when nothing matches.
 */
export function jumpToField(name?: string, opts: { focus?: boolean; toMessage?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const { focus = true, toMessage = true } = opts;
  window.requestAnimationFrame(() => window.setTimeout(() => {
    const el = find(name);
    if (el) { go(el, focus); return; }
    if (!toMessage) return;
    const msg = scope().querySelector<HTMLElement>('[role="alert"]');
    if (msg) go(msg, false);
  }, 30));
}
