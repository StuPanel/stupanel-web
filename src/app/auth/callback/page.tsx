"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setAccessTokenCookie } from "@/lib/auth-cookie";

function CallbackHandler() {
  const params = useSearchParams();

  useEffect(() => {
    // Team "login as studio" passes the token in the #hash (never sent to any server)
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const pick = (k: string) => hash.get(k) ?? params.get(k);
    const token = pick("token");
    const onboarding = pick("onboarding");
    const isNewUser = pick("isNewUser");
    const role = pick("role") ?? "owner";
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      window.location.href = "/login?error=google_failed";
      return;
    }

    localStorage.setItem("access_token", token);
    localStorage.setItem("user_role", role);
    setAccessTokenCookie(token);

    if (role === "staff") {
      window.location.href = "/member/dashboard";
      return;
    }

    // New Google user → collect password, phone, company name first
    if (isNewUser === "true") {
      window.location.href = "/complete-profile";
      return;
    }

    if (onboarding === "true") {
      window.location.href = "/onboarding";
    } else {
      window.location.href = "/dashboard";
    }
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
        <p className="text-slate-600 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
