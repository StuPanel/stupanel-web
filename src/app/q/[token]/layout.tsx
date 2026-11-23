import type { Metadata } from "next";
import { linkMeta } from "@/lib/link-card";

/** The tab title and the preview card in WhatsApp / Facebook: the studio's name and logo only. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return linkMeta("quote", token, "Your quotation", "Your quotation from {studio}. Open it to see the details.");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
