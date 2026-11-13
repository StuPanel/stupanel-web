"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AtSign, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { StudioList } from "@/components/studio-list";
import { NewPasswordStep } from "@/components/new-password-step";
import { enterSession, isChoice, rememberAfterLogin, postPublic, saveSession, type Session, type StudioCard, type StudioChoice } from "@/lib/studio-session";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/dashboard";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Google sign-in problems come back as ?error=… (e.g. "This Google account has no StuPanel account").
  const [error, setError] = useState(() => searchParams.get("error") ?? "");
  // Works in several studios → pick one; a password the studio set → choose their own.
  const [choice, setChoice] = useState<StudioChoice | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [newPass, setNewPass] = useState<Session | null>(null);

  /** A session for one studio: set your own password first if the studio chose it. */
  function open(d: Session) {
    if (d.user.mustChangePassword) { saveSession(d); setNewPass(d); return; }
    enterSession(d, redirectTo);
  }

  async function pick(st: StudioCard) {
    if (!choice) return;
    setPicking(st.userId); setError("");
    const r = await postPublic<Session>("/auth/choose-studio", { ticket: choice.ticket, userId: st.userId });
    if (!r.ok) { setPicking(null); setError(r.error); if (/log in again/i.test(r.error)) setChoice(null); return; }
    open(r.data);
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || searchParams.get("from")?.startsWith("/invite/")) return;
    const role = localStorage.getItem("user_role");
    if (role === "staff") { router.replace("/member/dashboard"); return; }
    router.replace("/dashboard");
  }, [router, searchParams]);

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
        const raw = data.message;
        const msg: string = Array.isArray(raw) ? raw[0] : (raw || "Login failed. Please try again.");
        // Email not verified — redirect to check-email page
        if (msg.includes("EMAIL_NOT_VERIFIED")) {
          window.location.href = `/check-email?email=${encodeURIComponent(identifier.trim())}`;
          return;
        }
        setError(msg.replace("EMAIL_NOT_VERIFIED: ", ""));
        return;
      }

      if (isChoice(data)) { setChoice(data); return; }
      open(data as Session);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (newPass) {
    return <NewPasswordStep currentPassword={password} onDone={() => enterSession(newPass, redirectTo)} />;
  }

  if (choice) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#17151F]">Choose a studio</h2>
          <p className="text-[#6B6680] mt-1 text-sm">You work with {choice.studios.length} studios. You can switch any time from the studio name.</p>
        </div>
        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</div>}
        <StudioList studios={choice.studios} busyId={picking} onPick={pick} />
        {choice.invites.length > 0 && (
          <p className="mt-4 text-[13px] text-[#6B6680]">You also have {choice.invites.length === 1 ? "an invite" : `${choice.invites.length} invites`} from {choice.invites.map(i => i.name).join(", ")}. Open a studio, then answer it from the studio name.</p>
        )}
        <button type="button" onClick={() => { setChoice(null); setPassword(""); }} className="mt-6 text-sm font-semibold text-[#7D5CEF] hover:text-[#5B3FD0]">← Use another account</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#17151F]">Welcome back</h2>
        <p className="text-[#6B6680] mt-1 text-sm">Sign in to your StuPanel account</p>
      </div>

      {!error && searchParams.get("reason") === "idle" && (
        <div role="status" className="mb-5 px-4 py-3 rounded-lg bg-[#F4F0FE] border border-[#DDD3FA] text-[#4A2FB3] text-sm">
          You were signed out because StuPanel wasn&apos;t used for a while. Sign in to continue.
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="identifier" className="text-[#33303F] text-sm font-medium">
            Email or Username
          </Label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599]" />
            <Input
              id="identifier"
              type="text"
              placeholder="Enter your email or username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              className="pl-10 h-11 bg-white border-[#E4E0EC] focus:border-indigo-400"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[#33303F] text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599]" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11 bg-white border-[#E4E0EC] focus:border-indigo-400"
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8599] hover:text-[#4A4658]">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-[#7D5CEF] hover:text-[#5B3FD0] font-medium">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" disabled={loading}
          className={cn("w-full h-11 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm mt-2", loading && "opacity-80")}>
          {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Signing in...</span> : "Sign In"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-[#F1EFF6]" />
        <span className="text-xs text-[#8A8599] font-medium">or continue with</span>
        <div className="flex-1 h-px bg-[#F1EFF6]" />
      </div>

      <button
        type="button"
        onClick={() => { rememberAfterLogin(searchParams.get("from")); window.location.href = `${process.env.NEXT_PUBLIC_API_URL?.replace('/v1', '') || 'http://localhost:3001'}/v1/auth/google`; }}
        className="w-full h-11 flex items-center justify-center gap-3 rounded-lg border border-[#E4E0EC] bg-white hover:bg-[#F7F5FB] transition-colors text-[#33303F] text-sm font-medium shadow-sm">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z"/>
        </svg>
        Continue with Google
      </button>

      <p className="text-center text-sm text-[#6B6680] mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#7D5CEF] hover:text-[#5B3FD0] font-semibold">Start for free</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
