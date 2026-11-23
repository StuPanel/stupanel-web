import type { Metadata } from "next";
import { linkMeta } from "@/lib/link-card";

/** The tab title and the preview card in WhatsApp / Facebook: the studio's name and logo only. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return linkMeta("contract", token, "Your agreement", "Your agreement from {studio}. Open it to read and sign.");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
