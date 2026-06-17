export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* ── LEFT — Brand Panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: "linear-gradient(145deg, #0f0c29 0%, #1a1560 35%, #24243e 70%, #0f172a 100%)" }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #818cf8 0%, transparent 70%)", filter: "blur(50px)" }} />
        </div>

        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">StuPanel</span>
          </div>
        </div>

        {/* Headline + Cards */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-8">
          <div className="mb-10">
            <h1 className="text-[2.6rem] font-bold text-white leading-[1.15] mb-3">
              Run your Studio<br />smarter, faster.
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-xs">
              Complete management for Photography, Wedding & Event Studios.
            </p>
          </div>

          {/* Scattered floating cards */}
          <div className="relative h-72">

            {/* Card 1 — top left */}
            <div className="absolute top-0 left-0 bg-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3 w-[220px]"
              style={{ animation: "floatA 5s ease-in-out infinite" }}>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-sm leading-none">New Booking</p>
                <p className="text-slate-400 text-xs mt-1">Wedding shoot · Sat 2pm</p>
              </div>
            </div>

            {/* Card 2 — top right, slightly lower */}
            <div className="absolute top-6 right-0 bg-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3 w-[225px]"
              style={{ animation: "floatB 4.5s ease-in-out infinite" }}>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-sm leading-none">Payment Received</p>
                <p className="text-emerald-600 text-xs mt-1 font-medium">+$750 · Karim & Sara</p>
              </div>
            </div>

            {/* Card 3 — middle, slight overlap */}
            <div className="absolute top-[38%] left-12 bg-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3 w-[235px]"
              style={{ animation: "floatC 5.5s ease-in-out infinite" }}>
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-sm leading-none">Photos Delivered</p>
                <p className="text-slate-400 text-xs mt-1">247 photos · Rahman Family</p>
              </div>
            </div>

            {/* Card 4 — bottom right */}
            <div className="absolute bottom-0 right-4 bg-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3 w-[215px]"
              style={{ animation: "floatA 6s ease-in-out infinite 1s" }}>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-sm leading-none">Reminder Sent</p>
                <p className="text-slate-400 text-xs mt-1">3 clients auto-notified</p>
              </div>
            </div>

          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <div className="bg-white/[0.07] backdrop-blur border border-white/10 rounded-2xl p-5">
            <div className="flex gap-1 mb-2">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>
            <p className="text-white/80 text-sm leading-relaxed italic">
              "StuPanel transformed how we manage our studio. Program tracking, payments, and client delivery — all in one place."
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                RA
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Rafiq Ahmed</p>
                <p className="text-slate-400 text-xs">RA Photography, Dhaka</p>
              </div>
            </div>
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
          @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
          @keyframes floatC { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        `}</style>
      </div>

      {/* ── RIGHT — Form Panel ── */}
      <div className="flex-1 flex flex-col bg-slate-50">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span className="font-bold text-slate-900">StuPanel</span>
          </div>
          {/* Desktop logo */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">StuPanel</span>
          </div>

          {/* Trust badge */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
            <div className="flex -space-x-1.5">
              {["bg-indigo-400","bg-violet-400","bg-pink-400","bg-emerald-400"].map((c,i) => (
                <div key={i} className={`w-5 h-5 rounded-full border-2 border-white ${c} flex items-center justify-center text-white text-[8px] font-bold`}>
                  {["R","S","A","M"][i]}
                </div>
              ))}
            </div>
            <span className="text-xs text-slate-600 font-medium">500+ studios trust us</span>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 pb-8">
          <div className="w-full max-w-[400px]">
            {/* Card wrapper */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              {children}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
