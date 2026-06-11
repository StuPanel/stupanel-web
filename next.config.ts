import type { NextConfig } from "next";

const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline + unsafe-eval for client-side hydration
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.r2.cloudflarestorage.com https://lh3.googleusercontent.com https://drive.google.com https://ssl.gstatic.com",
  "connect-src 'self' https://api.stupanel.com https://*.supabase.co https://*.r2.cloudflarestorage.com https://accounts.google.com https://www.googleapis.com https://drive.google.com",
  "frame-src https://accounts.google.com https://drive.google.com",
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
    ];
  },
};

export default nextConfig;
