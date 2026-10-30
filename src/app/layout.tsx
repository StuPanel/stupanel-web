import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { FeedbackHost } from "@/components/feedback";

// Fonts are kept in the repo (src/app/fonts, OFL licence) so builds never
// depend on downloading from Google Fonts.
const jakarta = localFont({
  variable: "--font-jakarta",
  src: [{ path: "./fonts/plus-jakarta-sans-latin-wght-normal.woff2", weight: "200 800", style: "normal" }],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [{ path: "./fonts/geist-mono-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "StuPanel — Studio Management Software",
    template: "%s | StuPanel",
  },
  description:
    "StuPanel is an all-in-one studio management platform for Photography, Wedding & Event Studios. Manage bookings, invoices, clients, team, and deliveries — all in one place.",
  keywords: [
    "studio management software",
    "photography studio software",
    "wedding studio management",
    "event studio software",
    "Bangladesh photography software",
    "studio booking software",
  ],
  authors: [{ name: "StuPanel" }],
  creator: "StuPanel",
  metadataBase: new URL("https://www.stupanel.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.stupanel.com",
    siteName: "StuPanel",
    title: "StuPanel — Studio Management Software",
    description:
      "All-in-one studio management platform for Photography, Wedding & Event Studios.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "StuPanel — Studio Management Software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StuPanel — Studio Management Software",
    description: "All-in-one studio management for Photography & Event Studios.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} h-full`}>
      <body className="h-full bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
        <FeedbackHost />
      </body>
    </html>
  );
}
