import Image from "next/image";
import { CalendarCheck, Wallet, Images, UsersRound } from "lucide-react";

const features = [
  { icon: CalendarCheck, title: "Programs & calendar", text: "Every booking, date and team assignment in one place." },
  { icon: Wallet, title: "Payments & invoices", text: "Track advances and dues, send invoices in seconds." },
  { icon: Images, title: "Client portal & delivery", text: "Clients see progress and get their photos when paid." },
  { icon: UsersRound, title: "Team & salary", text: "Assign photographers, track work and pay." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── LEFT — Brand panel (desktop) ── */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[52%] relative overflow-hidden flex-col justify-between p-12 m-3 rounded-[28px]"
        style={{ background: "linear-gradient(150deg, #16141D 0%, #2A1F5C 45%, #5B3FD0 100%)" }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, #7D5CEF 0%, transparent 65%)", filter: "blur(40px)" }} />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, #B29DF8 0%, transparent 65%)", filter: "blur(50px)" }} />
        </div>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "26px 26px" }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/brand/stupanel-icon-128.png" alt="StuPanel" width={44} height={44} priority />
          <span className="text-white font-extrabold text-2xl tracking-tight">StuPanel</span>
        </div>

        {/* Headline + features */}
        <div className="relative z-10 max-w-md">
          <div className="relative w-40 h-28 mb-8 auth-float">
            <Image src="/brand/stupanel-icon-256.png" alt="" fill sizes="160px" className="object-contain drop-shadow-[0_20px_40px_rgba(125,92,239,0.55)]" priority />
          </div>
          <h1 className="text-[2.5rem] font-extrabold text-white leading-[1.1] tracking-tight">
            Your whole studio,<br />in one calm place.
          </h1>
          <p className="text-[#CFC2F8] text-base leading-relaxed mt-3">
            Studio management for photography, wedding &amp; event studios in Bangladesh.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <li key={f.title}
                className="rounded-2xl bg-white/[0.07] border border-white/10 backdrop-blur-sm p-4 auth-rise"
                style={{ animationDelay: `${120 + i * 90}ms` }}>
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                  <f.icon className="w-[18px] h-[18px] text-[#CFC2F8]" />
                </div>
                <p className="text-white text-sm font-semibold">{f.title}</p>
                <p className="text-white/60 text-xs leading-relaxed mt-1">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-white/40 text-xs">© {new Date().getFullYear()} StuPanel</p>

        <style>{`
          @keyframes authFloat { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
          @keyframes authRise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
          .auth-float { animation: authFloat 6s cubic-bezier(.45,0,.55,1) infinite; }
          .auth-rise { opacity:0; animation: authRise .6s cubic-bezier(.2,.8,.2,1) forwards; }
          @media (prefers-reduced-motion: reduce) { .auth-float, .auth-rise { animation: none; opacity: 1; } }
        `}</style>
      </div>

      {/* ── RIGHT — Form panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar (mobile shows brand) */}
        <div className="flex items-center px-5 sm:px-8 pt-5 pb-2 lg:hidden">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/stupanel-icon-128.png" alt="StuPanel" width={36} height={36} priority />
            <span className="font-extrabold text-lg tracking-tight text-slate-900">StuPanel</span>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
          <div className="w-full max-w-[420px]">
            <div className="bg-white rounded-3xl shadow-[0_20px_60px_-30px_rgba(91,63,208,0.35)] border border-slate-200/80 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {children}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
