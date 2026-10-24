/**
 * One StuPanel colour for every studio (DESIGN_SYSTEM). Studios no longer pick
 * their own theme colour — they only upload a logo.
 */
export const BRAND = "#7D5CEF";

/**
 * Only show logos that are real https links (uploaded files). Old relative
 * paths and anything else return null so we fall back to the studio initial
 * instead of a broken image.
 */
export function safeLogo(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  return /^https:\/\//i.test(u) ? u : null;
}
