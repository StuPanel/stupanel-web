import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your album",
  description: "Look through your album, write on any page and approve it.",
  robots: { index: false, follow: false },
};

export default function AlbumProofLayout({ children }: { children: React.ReactNode }) {
  return children;
}
