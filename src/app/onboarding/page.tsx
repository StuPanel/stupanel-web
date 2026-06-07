"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, Building2, MapPin, Globe, Check,
  ChevronRight, ChevronLeft, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STUDIO_TYPES = [
  { id: "wedding",    icon: "💍", label: "Wedding Studio",    desc: "Wedding & engagement photography" },
  { id: "portrait",  icon: "🎭", label: "Portrait Studio",   desc: "Portraits, family & headshots" },
  { id: "corporate", icon: "🏢", label: "Corporate",         desc: "Events, conferences & branding" },
  { id: "video",     icon: "🎬", label: "Video Production",  desc: "Films, reels & documentaries" },
  { id: "mixed",     icon: "📷", label: "Mixed / General",   desc: "Multiple photography services" },
];

const CURRENCIES = [
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
];

const STEPS = ["Studio Type", "Basic Info", "Done!"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
  }, [router]);

  const [studioType, setStudioType] = useState("");
  const [info, setInfo] = useState({
    city: "",
    country: "Bangladesh",
    currency: "BDT",
    website: "",
  });

  function setInfoField(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setInfo(prev => ({ ...prev, [key]: e.target.value }));
  }

  async function finish() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/companies/onboarding`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ studioType, ...info }),
      });
    } catch { /* non-blocking */ }
    setStep(2);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">StuPanel</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                i < step ? "text-emerald-600" : i === step ? "text-indigo-600" : "text-slate-400"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  i < step ? "bg-emerald-500 border-emerald-500 text-white" :
                  i === step ? "bg-indigo-600 border-indigo-600 text-white" :
                  "bg-white border-slate-300 text-slate-400"
                )}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("w-8 h-px", i < step ? "bg-emerald-300" : "bg-slate-200")} />
              )}
            </div>
          ))}
        </div>

        <button onClick={() => router.push("/dashboard")}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
          Skip for now
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">

          {/* ── STEP 0: Studio Type ── */}
          {step === 0 && (
            <div>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900">What type of studio do you run?</h1>
                <p className="text-slate-500 mt-1.5 text-sm">We&apos;ll personalize StuPanel for your needs.</p>
              </div>

              <div className="grid gap-3">
                {STUDIO_TYPES.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => setStudioType(t.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                      studioType === t.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}>
                    <span className="text-2xl">{t.icon}</span>
                    <div className="flex-1">
                      <p className={cn("font-semibold text-sm", studioType === t.id ? "text-indigo-700" : "text-slate-900")}>
                        {t.label}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{t.desc}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      studioType === t.id ? "border-indigo-500 bg-indigo-500" : "border-slate-300"
                    )}>
                      {studioType === t.id && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                ))}
              </div>

              <Button onClick={() => setStep(1)} disabled={!studioType}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold mt-6 gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ── STEP 1: Basic Info ── */}
          {step === 1 && (
            <div>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Almost there!</h1>
                <p className="text-slate-500 mt-1.5 text-sm">A few more details to set up your studio.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                {/* City */}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm font-medium">City / Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="e.g. Dhaka"
                      value={info.city} onChange={setInfoField("city")}
                      className="pl-10 h-11 bg-white border-slate-200 focus:border-indigo-400" />
                  </div>
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm font-medium">Currency</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <select value={info.currency} onChange={setInfoField("currency")}
                      className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer">
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.symbol} {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm font-medium">
                    Studio Website
                    <span className="text-slate-400 font-normal ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="https://yourstudio.com"
                      value={info.website} onChange={setInfoField("website")}
                      className="pl-10 h-11 bg-white border-slate-200 focus:border-indigo-400" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(0)}
                  className="h-11 gap-2 border-slate-200 text-slate-600">
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <Button onClick={finish} disabled={loading}
                  className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</>
                    : <>Finish Setup <ChevronRight className="w-4 h-4" /></>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Done ── */}
          {step === 2 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">You&apos;re all set!</h1>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                Your studio is ready. Let&apos;s go to your dashboard.
              </p>

              {/* Feature highlights */}
              <div className="grid grid-cols-3 gap-3 my-8">
                {[
                  { icon: "📋", label: "Programs" },
                  { icon: "💰", label: "Payments" },
                  { icon: "📸", label: "Delivery" },
                ].map(f => (
                  <div key={f.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                    <div className="text-2xl mb-1">{f.icon}</div>
                    <p className="text-slate-700 text-sm font-medium">{f.label}</p>
                  </div>
                ))}
              </div>

              <Button onClick={() => router.push("/dashboard")}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base gap-2">
                Go to Dashboard <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
