import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
