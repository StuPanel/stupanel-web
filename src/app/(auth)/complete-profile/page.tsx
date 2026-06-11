"use client";

import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Phone, Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL as API } from "@/lib/api";


export default function CompleteProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // Redirect if not logged in; pre-fill company name from /auth/me
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    apiFetch(`${API}/auth/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.company?.name) {
          setForm(prev => ({ ...prev, companyName: data.company.name }));
        }
      })
      .catch(() => {})
      .finally(() => setFetchingUser(false));
  }, [router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.companyName.trim()) { setError("Studio name is required."); return; }
    if (form.password && form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (form.password && form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const body: Record<string, string> = { companyName: form.companyName.trim() };
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.password) body.password = form.password;

      const res = await apiFetch(`${API}/auth/complete-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Something went wrong.");
      }

      window.location.href = "/onboarding";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (fetchingUser) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-7">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <CheckCircle className="w-6 h-6 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Almost done!</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Confirm your studio details to finish setting up your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Company Name */}
        <div className="space-y-1.5">
          <Label className="text-slate-700 text-sm font-medium">Studio / Company Name *</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={form.companyName}
              onChange={set("companyName")}
              placeholder="e.g. Faisal Photography"
              className="pl-10 h-11 border-slate-200"
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="text-slate-700 text-sm font-medium">
            Phone <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+880 1234 567890"
              className="pl-10 h-11 border-slate-200"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label className="text-slate-700 text-sm font-medium">
            Set Password <span className="text-slate-400 font-normal">(optional — lets you login with email later)</span>
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              placeholder="Min. 6 characters"
              className="pl-10 pr-10 h-11 border-slate-200"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {form.password && (
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-sm font-medium">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Repeat password"
                className="pl-10 pr-10 h-11 border-slate-200"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <Button type="submit" disabled={loading}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold mt-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : "Continue to Setup"}
        </Button>

        <button type="button" onClick={() => { window.location.href = "/onboarding"; }}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors pt-1">
          Skip for now
        </button>
      </form>
    </>
  );
}
