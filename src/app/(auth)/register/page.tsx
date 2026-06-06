"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Mail, Lock, User, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { code: "BD", dial: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "IN", dial: "+91",  flag: "🇮🇳", name: "India" },
  { code: "PK", dial: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "LK", dial: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "NP", dial: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "GB", dial: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "US", dial: "+1",   flag: "🇺🇸", name: "United States" },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "SA", dial: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "MY", dial: "+60",  flag: "🇲🇾", name: "Malaysia" },
];

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8 characters", ok: password.length >= 8 },
    { label: "Uppercase", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
  ];
  const strength = checks.filter(c => c.ok).length;
  const barColors = ["bg-slate-200", "bg-red-400", "bg-orange-400", "bg-emerald-500"];
  const labels = ["", "Weak", "Fair", "Strong"];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className={cn("h-1 flex-1 rounded-full transition-all", i < strength ? barColors[strength] : "bg-slate-200")} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {checks.map(c => (
            <span key={c.label} className={cn("text-[10px] flex items-center gap-0.5", c.ok ? "text-emerald-600" : "text-slate-400")}>
              <CheckCircle2 className="w-2.5 h-2.5" />{c.label}
            </span>
          ))}
        </div>
        <span className={cn("text-[10px] font-medium",
          strength === 1 ? "text-red-500" : strength === 2 ? "text-orange-500" : strength === 3 ? "text-emerald-600" : ""
        )}>{labels[strength]}</span>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [dialCode, setDialCode] = useState("+880");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          phone: form.phone ? `${dialCode}${form.phone.replace(/^0/, "")}` : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Registration failed."); return; }
      localStorage.setItem("access_token", data.accessToken);
      window.location.href = "/onboarding";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const selected = COUNTRIES.find(c => c.dial === dialCode) ?? COUNTRIES[0];

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
        <p className="text-slate-500 mt-1 text-sm">14-day free trial · No credit card required</p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Studio name */}
        <div className="space-y-1.5">
          <Label htmlFor="companyName" className="text-slate-700 text-sm font-medium">Studio / Company Name</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input id="companyName" placeholder="e.g. Faisal Photography"
              value={form.companyName} onChange={set("companyName")}
              className="pl-10 h-11 bg-white border-slate-200 focus:border-indigo-400" required />
          </div>
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-slate-700 text-sm font-medium">First Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input id="firstName" placeholder="Faisal"
                value={form.firstName} onChange={set("firstName")}
                className="pl-10 h-11 bg-white border-slate-200 focus:border-indigo-400" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName" className="text-slate-700 text-sm font-medium">Last Name</Label>
            <Input id="lastName" placeholder="Ahmed"
              value={form.lastName} onChange={set("lastName")}
              className="h-11 bg-white border-slate-200 focus:border-indigo-400" required />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-slate-700 text-sm font-medium">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input id="email" type="email" placeholder="you@studio.com"
              value={form.email} onChange={set("email")}
              className="pl-10 h-11 bg-white border-slate-200 focus:border-indigo-400" required />
          </div>
        </div>

        {/* Phone with country code */}
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-slate-700 text-sm font-medium">
            Phone Number
            <span className="text-slate-400 font-normal ml-1">(for WhatsApp notifications)</span>
          </Label>
          <div className="flex h-11 rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-colors">
            {/* Country code selector */}
            <div className="relative flex-shrink-0">
              <select
                value={dialCode}
                onChange={e => setDialCode(e.target.value)}
                className="h-full pl-3 pr-7 bg-slate-50 border-r border-slate-200 text-sm text-slate-700 appearance-none cursor-pointer focus:outline-none font-medium"
                style={{ minWidth: "88px" }}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.dial}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              {/* Dropdown arrow */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {/* Number input */}
            <input
              id="phone"
              type="tel"
              placeholder="1XXXXXXXXX"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, "") }))}
              className="flex-1 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input id="password" type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={form.password} onChange={set("password")}
              className="pl-10 pr-10 h-11 bg-white border-slate-200 focus:border-indigo-400"
              minLength={8} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrength password={form.password} />
        </div>

        <p className="text-xs text-slate-400 pt-1">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="text-indigo-600 hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>.
        </p>

        <Button type="submit" disabled={loading}
          className={cn("w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm", loading && "opacity-80 cursor-not-allowed")}>
          {loading ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Creating account...</span>
          ) : "Create Free Account"}
        </Button>
      </form>

      <div className="flex items-center gap-3 mt-5">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400 font-medium">or</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      <button type="button"
        className="w-full mt-4 h-11 flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-700 text-sm font-medium shadow-sm">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <p className="text-center text-sm text-slate-500 mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
