"use client";

/**
 * "Why didn't you continue?" — the link in the trial email. One tap on a reason saves it; "Too expensive" turns on
 * the 20% first-month offer at once (shown here). No login: the link itself is signed.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Gift, Loader2, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

const REASONS: [string, string][] = [
  ["price", "দাম বেশি মনে হয়েছে"],
  ["no_time", "ঠিকমতো দেখার সময় পাইনি"],
  ["missing", "যা দরকার সেটা নেই"],
  ["other_software", "অন্য software বা খাতা ব্যবহার করি"],
  ["not_now", "এখন কাজ কম, পরে দেখব"],
  ["other", "অন্য কারণ"],
];
type Info = { studio: string; given: string | null; offer: { percent: number; until: string } | null };
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

function Feedback() {
  const t = useSearchParams().get("t") ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [bad, setBad] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/public/trial-feedback?t=${encodeURIComponent(t)}`).then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Info) => { setInfo(d); if (d.given) setReason(d.given); })
      .catch(() => setBad(true));
  }, [t]);

  async function send() {
    if (!reason) return setError("একটা কারণ বেছে নিন।");
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/public/trial-feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, reason, note: note.trim() || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError((Array.isArray(d.message) ? d.message[0] : d.message) || "পাঠানো যায়নি, আবার চেষ্টা করুন।");
      setInfo(d); setDone(true);
    } catch { setError("Internet সংযোগ দেখে আবার চেষ্টা করুন।"); }
    finally { setBusy(false); }
  }

  if (bad) return <p className="text-center text-[15px] text-[#4A4658]">এই link-টা আর কাজ করছে না।</p>;
  if (!info) return <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" />;

  if (done) {
    return (
      <div className="text-center">
        <span className="w-14 h-14 rounded-full bg-[#E9F5EF] text-[#1F8A5B] inline-flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></span>
        <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">ধন্যবাদ!</h1>
        <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">আপনার মতামত আমরা পড়ব এবং StuPanel আরো ভালো করতে কাজে লাগাব।</p>
        {info.offer && (
          <div className="mt-6 rounded-2xl border border-[#CDEBDB] bg-[#F1FAF5] p-4 text-left flex gap-3">
            <Gift className="w-5 h-5 text-[#1F8A5B] flex-shrink-0 mt-0.5" />
            <p className="text-[14.5px] text-[#1F6B47] leading-relaxed"><b>আপনার জন্য প্রথম মাসে {info.offer.percent}% কম</b> — {day(info.offer.until)} পর্যন্ত। StuPanel-এ login করে Plan &amp; billing-এ কম দামটাই দেখবেন।</p>
          </div>
        )}
        <Link href="/login" className="mt-6 inline-flex h-12 px-6 rounded-full bg-[#17151F] text-white text-[15px] font-semibold items-center justify-center">StuPanel খুলুন</Link>
      </div>
    );
  }

  return (
    <div>
      <span className="w-14 h-14 rounded-full bg-[#F1EDFB] text-[#5B3FD0] inline-flex items-center justify-center"><MessageSquareText className="w-7 h-7" /></span>
      <h1 className="mt-4 text-[24px] font-bold text-[#17151F] leading-snug">StuPanel continue করলেন না কেন?</h1>
      <p className="mt-2 text-[14.5px] text-[#4A4658] leading-relaxed"><b className="break-words">{info.studio}</b> — একটা কারণ বেছে দিন, এতেই আমাদের অনেক উপকার হবে।</p>
      <div className="mt-5 grid gap-2" role="radiogroup" aria-label="কারণ">
        {REASONS.map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={reason === v} onClick={() => setReason(v)}
            className={cn("min-h-[48px] px-4 rounded-[14px] border-2 text-left text-[15px] font-medium transition-colors",
              reason === v ? "border-[#7D5CEF] bg-[#F5F3FA] text-[#17151F]" : "border-[#ECE9F2] text-[#4A4658] hover:bg-[#F7F5FB]")}>{label}</button>
        ))}
      </div>
      <label className="block mt-4">
        <span className="text-[13px] font-semibold text-[#4A4658]">আর কিছু বলতে চাইলে (না লিখলেও চলবে)</span>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000}
          className="mt-1.5 w-full rounded-[14px] border border-[#E3DFEC] px-3.5 py-2.5 text-[15px] text-[#17151F] outline-none focus:border-[#7D5CEF] focus:ring-2 focus:ring-[#7D5CEF]/20" />
      </label>
      {error && <p role="alert" className="mt-3 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-[13.5px] px-4 py-3">{error}</p>}
      <button type="button" onClick={() => void send()} disabled={busy}
        className="mt-5 w-full h-12 rounded-full bg-[#17151F] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}পাঠান
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <div className="w-full max-w-md mx-auto">
      <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" />}><Feedback /></Suspense>
    </div>
  );
}
