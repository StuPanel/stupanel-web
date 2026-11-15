"use client";

import { managerStartsInMember } from "@/components/layout/panel-switch";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    if (!token) { router.replace("/login"); return; }
    if (role === "staff" || managerStartsInMember()) { router.replace("/member/dashboard"); return; }
    router.replace("/dashboard");
  }, [router]);

  return null;
}
