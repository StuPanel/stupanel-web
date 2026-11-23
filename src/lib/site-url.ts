/**
 * Where a studio's website lives. With subdomains on: https://<address>.stupanel.com (Cloudflare `*` record,
 * proxied, + `*.stupanel.com` on Vercel). The old app.stupanel.com/site/<address> links send visitors there.
 */
export const SITE_ROOT = "stupanel.com";
/** Turned on once <address>.stupanel.com was checked live. */
export const SITE_SUBDOMAINS = true;
/** Hosts of StuPanel itself — never a studio website. */
export const NOT_SITE_HOSTS = new Set(["app", "admin", "www", "api", "tagstockai", "send", "mail", "status", "docs", "help", "blog"]);

/** The studio address in a host like pickphoto.stupanel.com, or null. */
export function siteFromHost(host: string): string | null {
  const h = host.toLowerCase().split(":")[0];
  if (!h.endsWith(`.${SITE_ROOT}`)) return null;
  const sub = h.slice(0, -(SITE_ROOT.length + 1));
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(sub) && !NOT_SITE_HOSTS.has(sub) ? sub : null;
}

/** The public link of a studio website (path like "/packages"). */
export function siteUrl(slug: string, path = "", origin = "https://app.stupanel.com") {
  return SITE_SUBDOMAINS ? `https://${slug}.${SITE_ROOT}${path}` : `${origin}/site/${slug}${path}`;
}
