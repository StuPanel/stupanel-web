import type { NextConfig } from "next";

const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline + unsafe-eval for client-side hydration
  // connect.facebook.net / googletagmanager.com: a studio website's own Facebook Pixel and Google Analytics.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://connect.facebook.net https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://api.stupanel.com https://*.supabase.co https://*.r2.cloudflarestorage.com https://lh3.googleusercontent.com https://drive.google.com https://ssl.gstatic.com https://i.ytimg.com https://www.facebook.com https://*.google-analytics.com https://www.googletagmanager.com",
  "connect-src 'self' https://api.stupanel.com https://*.ingest.de.sentry.io https://lh3.googleusercontent.com wss://api.stupanel.com https://*.supabase.co https://*.r2.cloudflarestorage.com https://accounts.google.com https://www.googleapis.com https://drive.google.com https://www.facebook.com https://connect.facebook.net https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-src 'self' https://accounts.google.com https://drive.google.com https://drive.usercontent.google.com https://docs.google.com https://www.youtube-nocookie.com https://www.googletagmanager.com",
  "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,

  compress: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // AI Face Search guest page: the guest takes a selfie with the camera. Our own Settings shows it
      // in a phone frame as a preview, so StuPanel itself (and nobody else) may frame it.
      {
        source: "/f/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: `${CSP}; frame-ancestors 'self'` },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // Photo selection "Client preview": shown inside StuPanel in a phone / computer frame.
      {
        source: "/s/preview/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `${CSP}; frame-ancestors 'self'` },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // Studio websites: the Website editor shows the draft in a phone frame, so StuPanel itself may frame them.
      {
        source: "/site/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `${CSP}; frame-ancestors 'self'` },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
