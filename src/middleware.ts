import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/programs",
  "/clients",
  "/bookings",
  "/payments",
  "/invoices",
  "/quotes",
  "/team",
  "/packages",
  "/delivery",
  "/calendar",
  "/chat",
  "/checklist",
  "/equipment",
  "/salary",
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
  "/portal",
  "/inv",
  "/q",
  "/track",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // Admin routes — require login at minimum; superadmin check is page-level
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
