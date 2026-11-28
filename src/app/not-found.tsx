import Link from "next/link";
import { Compass } from "lucide-react";

/** A link that leads nowhere (Faisal 28-NOV-2026: the old page did not look like StuPanel). */
export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-12"
      style={{ background: "radial-gradient(80% 60% at 10% 0%, #FDE7C8 0%, transparent 60%), radial-gradient(70% 60% at 100% 100%, #F6D3E0 0%, transparent 60%), #FBF6F0" }}>
      <div className="w-full max-w-[420px] rounded-[28px] bg-white/90 p-8 text-center shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(40,28,96,.06),0_24px_60px_-24px_rgba(40,28,96,.35)]">
        <span className="mx-auto w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#8F6BFF] to-[#5B3FD0] text-white flex items-center justify-center shadow-[0_12px_26px_-10px_rgba(91,63,208,.7)]" aria-hidden>
          <Compass className="w-8 h-8" />
        </span>
        <h1 className="mt-5 text-[24px] font-bold text-[#17151F]">This page isn&apos;t here</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5B5670]">The link may be old, or the page has moved. Everything you need is one tap away.</p>
        <div className="mt-7 flex flex-col gap-2.5">
          <Link href="/dashboard" className="h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold inline-flex items-center justify-center">Go to Dashboard</Link>
          <Link href="/programs" className="h-12 rounded-full bg-[#F5F3FA] text-[#17151F] text-[15px] font-semibold inline-flex items-center justify-center">Open Programs</Link>
        </div>
        <p className="mt-6 text-[13px] text-[#6B6680]">Error 404</p>
      </div>
    </main>
  );
}
