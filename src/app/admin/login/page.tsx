"use client";

import { useEffect } from "react";
import { loginPath } from "@/lib/platform-api";

/** Old super-admin login is gone — the team signs in at admin.stupanel.com/login. */
export default function AdminLoginRedirect() {
  useEffect(() => { window.location.replace(loginPath()); }, []);
  return <div className="min-h-screen bg-slate-950" />;
}
