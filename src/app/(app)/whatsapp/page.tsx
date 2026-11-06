"use client";

/** Owners manage WhatsApp templates in Settings; managers with Chat access still use this page. */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { WhatsAppTemplates } from "@/components/whatsapp/templates-manager";

export default function WhatsAppPage() {
  const { user } = useAuth();
  const router = useRouter();
  const owner = user?.role === "owner";
  useEffect(() => { if (owner) router.replace("/settings?pane=whatsapp"); }, [owner, router]);
  if (!user || owner) return null;
  return <WhatsAppTemplates />;
}
