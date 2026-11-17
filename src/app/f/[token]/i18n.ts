/**
 * Words on the guest page. StuPanel is international, so the page is in English only.
 * T fills the {name} blanks; N and P write numbers and photo counts.
 */
export const N = (n: number | string) => String(n);
/** "3 photos". */
export const P = (n: number) => `${n} photo${n === 1 ? "" : "s"}`;
/** The sentence with its {name} blanks filled from `v`. */
export function T(s: string, v?: Record<string, string | number>) {
  let out = s;
  if (v) for (const k of Object.keys(v)) out = out.split(`{${k}}`).join(String(v[k]));
  return out;
}
