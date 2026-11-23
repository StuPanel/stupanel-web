"use client";

/**
 * Website editor building blocks: a section with an icon, a plain sentence on what it changes and where it
 * shows on the website, so a studio sees at a glance what each box does.
 */
import { CARD_SHADOW } from "@/components/ui/apple";
import { cn } from "@/lib/utils";

type Icon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const TONE: Record<string, [string, string]> = {
  violet: ["#EEE8FD", "#5B3FD0"], blue: ["#E3EEF9", "#1F5C99"], green: ["#E2F4EA", "#1F8A5B"], rose: ["#FBE7EC", "#B4294A"],
  amber: ["#FCF0DE", "#9A5B0B"], teal: ["#DFF3F1", "#13756B"], slate: ["#EEEBF4", "#4A4658"],
};

/** One part of the editor: icon, title, what it does, where it shows; the boxes sit in a white card below. */
export function Sec({ icon: I, tone = "violet", title, help, where, right, children, className, bare }: {
  icon: Icon; tone?: keyof typeof TONE; title: React.ReactNode; help?: React.ReactNode; /** Where on the website it shows */ where?: string;
  right?: React.ReactNode; children: React.ReactNode; className?: string; /** Children draw their own card */ bare?: boolean;
}) {
  const [bg, fg] = TONE[tone] ?? TONE.violet;
  return (
    <section className={cn("ed-sec mb-6", className)}>
      <header className="flex items-start gap-3 px-1 mb-2.5">
        <span className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: bg, color: fg }}><I className="w-[18px] h-[18px]" aria-hidden /></span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-[#17151F] leading-tight flex items-center gap-2 flex-wrap">
            {title}
            {where && <span className="inline-flex items-center h-5 px-2 rounded-full bg-white border border-[#E9E5F2] text-[11px] font-semibold text-[#6B6680]">On: {where}</span>}
          </h3>
          {help && <p className="text-[12.5px] text-[#6B6680] mt-1 leading-relaxed">{help}</p>}
        </div>
        {right}
      </header>
      {bare ? children : <div className={cn("bg-white rounded-[20px] divide-y divide-[#EEEBF4] overflow-hidden", CARD_SHADOW)}>{children}</div>}
    </section>
  );
}

/** The line at the top of a tab: what this tab is for, in one sentence. */
export function TabIntro({ icon: I, title, text }: { icon: Icon; title: string; text: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-[20px] px-4 py-3.5 flex items-start gap-3 bg-gradient-to-br from-[#F3EEFF] via-white to-white border border-[#ECE6FB]">
      <span className="w-10 h-10 rounded-[12px] bg-[#7D5CEF] text-white flex items-center justify-center flex-shrink-0 shadow-[0_8px_18px_-8px_rgba(125,92,239,.9)]"><I className="w-5 h-5" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-[16px] font-extrabold tracking-[-0.01em] text-[#17151F]">{title}</p>
        <p className="text-[13px] text-[#4A4658] mt-0.5 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
