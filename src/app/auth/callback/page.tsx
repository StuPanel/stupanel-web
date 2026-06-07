"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    const onboarding = params.get("onboarding");
    const isSuperAdmin = params.get("isSuperAdmin");

    if (!token) {
      window.location.href = "/login?error=google_failed";
      return;
    }

    if (isSuperAdmin === "true") {
      localStorage.setItem("admin_token", token);
      window.location.href = "/admin/dashboard";
      return;
    }

    localStorage.setItem("access_token", token);

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
