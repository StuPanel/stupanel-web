"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AtSign, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const role = localStorage.getItem("user_role");
    if (role === "staff") { router.replace("/member/dashboard"); return; }
    router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: identifier.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg: string = data.message || "Login failed. Please try again.";
        // Email not verified — redirect to check-email page
        if (msg.includes("EMAIL_NOT_VERIFIED")) {
          window.location.href = `/check-email?email=${encodeURIComponent(identifier.trim())}`;
          return;
        }
        setError(msg.replace("EMAIL_NOT_VERIFIED: ", ""));
        return;
      }

      // Super admin → separate token + redirect to admin panel
      if (data.user.isSuperAdmin) {
        // sessionStorage clears on browser close — safer than localStorage for admin token
        sessionStorage.setItem("admin_token", data.accessToken);
        sessionStorage.setItem("admin_name", `${data.user.firstName} ${data.user.lastName ?? ""}`.trim());
        window.location.href = "/admin/dashboard";
        return;
      }

      localStorage.setItem("access_token", data.accessToken);
      localStorage.setItem("user_role", data.user.role);

      // Role-based redirect
      if (data.user.role === "staff") {
        window.location.href = "/member/dashboard";
      } else if (!data.company.onboardingCompleted) {
        window.location.href = "/onboarding";
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="text-slate-500 mt-1 text-sm">Sign in to your StuPanel account</p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="identifier" className="text-slate-700 text-sm font-medium">
            Email or Username
          </Label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="identifier"
              type="text"
              placeholder="Enter your email or username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              className="pl-10 h-11 bg-white border-slate-200 focus:border-indigo-400"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11 bg-white border-slate-200 focus:border-indigo-400"
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" disabled={loading}
          className={cn("w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm mt-2", loading && "opacity-80")}>
          {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Signing in...</span> : "Sign In"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400 font-medium">or continue with</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      <button
        type="button"
        onClick={() => { window.location.href = `${process.env.NEXT_PUBLIC_API_URL?.replace('/v1', '') || 'http://localhost:3001'}/v1/auth/google`; }}
        className="w-full h-11 flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-700 text-sm font-medium shadow-sm">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z"/>
        </svg>
        Continue with Google
      </button>

      <p className="text-center text-sm text-slate-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">Start for free</Link>
      </p>
    </div>
  );
}
