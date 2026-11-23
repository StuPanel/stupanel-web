import { NextRequest, NextResponse } from "next/server";
import { SITE_ROOT, SITE_SUBDOMAINS, siteFromHost } from "@/lib/site-url";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/programs",
  "/clients",
  "/leads",
  "/music",
  "/photo-selection",
  "/face-search",
  "/bookings",
  "/payments",
  "/invoices",
  "/quotes",
  "/contracts",
  "/team",
  "/packages",
  "/delivery",
  "/calendar",
  "/chat",
  "/checklist",
  "/equipment",
  "/salary",
  "/team-pay",
  "/accounts",
  "/statement",
  "/expenses",
  "/reports",
  "/settings",
  "/account",
  "/notifications",
  "/whatsapp",
  "/support",
  "/member",
];

// Routes that require super admin
const ADMIN_PREFIXES = ["/admin"];

// Apex/marketing hostnames — the app itself only lives on APP_HOST now
const MARKETING_HOSTS = ["stupanel.com", "www.stupanel.com"];
const APP_HOST = "app.stupanel.com";

// StuPanel Admin (our own team) lives on its own subdomain
const ADMIN_HOST = "admin.stupanel.com";
const ADMIN_AUTH_PAGES: Record<string, string> = {
  "/login": "/platform/login",
  "/reset-password": "/platform/reset-password",
  "/invite": "/platform/invite",
};

// Public routes (never redirect)
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/check-email",
  "/verify-email",
  "/auth/callback",
  "/complete-profile",
  "/choose-studio",
  "/invite/",
  "/portal",
  "/inv/",
  "/q/",
  "/c/",
  "/w/",
  "/g/",
  "/f/",
  "/r/",
  "/site/",
  "/track",
  "/former-studio/",
  "/trial-feedback",
  "/undo-email-change",
  "/ownership",
  "/lost-email",
];

/**
 * A studio's own domain (pickphoto.com) → its website address. Asked from the API and kept here for 5 minutes
 * (1 minute when no website uses the domain), so a visit doesn't wait on the API each time.
 */
const hostCache = new Map<string, { slug: string | null; until: number }>();
async function siteForDomain(host: string): Promise<string | null> {
  const hit = hostCache.get(host);
  if (hit && hit.until > Date.now()) return hit.slug;
  let slug: string | null = null;
  try {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
    const res = await fetch(`${api}/public/site/-/host/${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) slug = ((await res.json()) as { slug?: string }).slug ?? null;
    else if (res.status !== 404) return hit?.slug ?? null; // API trouble: keep the last answer, don't cache
  } catch {
    return hit?.slug ?? null;
  }
  if (hostCache.size > 5000) hostCache.clear();
  hostCache.set(host, { slug, until: Date.now() + (slug ? 300_000 : 60_000) });
  return slug;
}
/** Hosts that are StuPanel itself or a preview, never a studio's own domain. */
const isOwnHost = (h: string) => h === SITE_ROOT || h.endsWith(`.${SITE_ROOT}`) || h.endsWith(".vercel.app") || h === "localhost" || h.startsWith("localhost:") || /^[\d.:]+$/.test(h) || h.startsWith("127.0.0.1");

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // <address>.stupanel.com is a studio's website: served by /site/<address>/… without changing the address bar.
  const site = siteFromHost(host);
  if (site) {
    if (pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === "/favicon.ico") return NextResponse.next();
    // A link written the old way (/site/<address>/…) on the subdomain: back to the short form.
    const old = pathname.match(/^\/site\/[a-z0-9-]+(\/.*)?$/);
    if (old) return NextResponse.redirect(new URL(`${old[1] || "/"}${search}`, request.url), 308);
    const headers = new Headers(request.headers);
    headers.delete("x-site-domain");
    headers.set("x-site-host", site);
    return NextResponse.rewrite(new URL(`/site/${site}${pathname === "/" ? "" : pathname}${search}`, request.url), { request: { headers } });
  }

  // The studio's own domain: the same website, under the domain.
  const bare = host.toLowerCase().split(":")[0];
  if (bare && !isOwnHost(bare)) {
    if (pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === "/favicon.ico") return NextResponse.next();
    const slug = await siteForDomain(bare);
    if (!slug) return new NextResponse("This website is not set up yet.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    const old = pathname.match(/^\/site\/[a-z0-9-]+(\/.*)?$/);
    if (old) return NextResponse.redirect(new URL(`${old[1] || "/"}${search}`, request.url), 308);
    const headers = new Headers(request.headers);
    headers.set("x-site-host", slug);
    headers.set("x-site-domain", bare);
    return NextResponse.rewrite(new URL(`/site/${slug}${pathname === "/" ? "" : pathname}${search}`, request.url), { request: { headers } });
  }

  // StuPanel's own robots.txt / sitemap.xml (studio websites got their own above).
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return NextResponse.next();

  // app.stupanel.com/site/<address>/… → <address>.stupanel.com/… (the studio's own preview stays on the app).
  if (SITE_SUBDOMAINS && host === APP_HOST && pathname.startsWith("/site/") && !request.nextUrl.searchParams.has("preview")) {
    const m = pathname.match(/^\/site\/([a-z0-9-]{1,40})(\/.*)?$/);
    if (m) return NextResponse.redirect(`https://${m[1]}.${SITE_ROOT}${m[2] ?? "/"}${search}`, 308);
  }

  // stupanel.com / www.stupanel.com is marketing-only now — send every app route to app.stupanel.com.
  // Explicit hostname allowlist (not "doesn't start with app.") so localhost and Vercel preview URLs are untouched.
  if (MARKETING_HOSTS.includes(host)) {
    const target = pathname === "/" ? `https://${APP_HOST}/login` : `https://${APP_HOST}${pathname}${search}`;
    return NextResponse.redirect(target, 307);
  }

  // admin.stupanel.com: only the team sign-in pages and the admin panel
  if (host === ADMIN_HOST) {
    if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) return NextResponse.next();
    const auth = ADMIN_AUTH_PAGES[pathname];
    if (auth) return NextResponse.rewrite(new URL(`${auth}${search}`, request.url));
    if (pathname === "/account") return NextResponse.redirect(new URL("/admin/account", request.url));
    if (pathname.startsWith("/admin") || pathname.startsWith("/platform")) {
      const res = NextResponse.next();
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // The team panel lives only on admin.stupanel.com now
  if (host === APP_HOST && (pathname.startsWith("/admin") || pathname.startsWith("/platform"))) {
    const toAdmin: Record<string, string> = {
      "/platform/login": "/login", "/platform/reset-password": "/reset-password", "/platform/invite": "/invite", "/admin/login": "/login",
    };
    return NextResponse.redirect(`https://${ADMIN_HOST}${toAdmin[pathname] ?? pathname}${search}`, 308);
  }

  // Allow public routes through
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and API routes through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // static files (favicon, etc.)
  ) {
    return NextResponse.next();
  }

  // access_token is set as a client cookie by the frontend after login
  const accessToken = request.cookies.get("access_token")?.value;

  const isAuthenticated = !!accessToken;

  // Admin routes — admin auth lives in sessionStorage (admin_token), which middleware
  // (server-side) cannot read at all. The real gate is the client-side check in
  // admin/layout.tsx; just let the request through here.
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protected routes — redirect to login if no token
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
