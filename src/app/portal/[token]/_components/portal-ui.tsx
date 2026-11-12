"use client";

/** Small building blocks for the client portal: status chip, steps, payment bar, sections and rows. */
import { Check, CheckCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Tile } from "@/components/ui/apple";
import { STATUS_CHIP, STEPS, money, num, sym } from "./portal-data";

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_CHIP[status] ?? STATUS_CHIP.booked;
  return <span className={cn("h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center flex-shrink-0 whitespace-nowrap", s.color)}>{s.label}</span>;
}

/** Booked → Event day → Editing → Files ready. `full` shows the labels under the dots. */
export function Steps({ step, full, brand }: { step: number; full?: boolean; brand: string }) {
  if (step < 0) return null;
  return (
    <div aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < step || (i === step && i === STEPS.length - 1);
          const now = i === step && !done;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <span className={cn("rounded-full flex items-center justify-center flex-shrink-0 transition-colors", full ? "w-7 h-7" : "w-4 h-4",
                done ? "text-white" : now ? "bg-white border-2" : "bg-[#EEEBF4]")}
                style={done ? { backgroundColor: brand } : now ? { borderColor: brand } : undefined}>
                {done && <Check className={full ? "w-4 h-4" : "w-2.5 h-2.5"} strokeWidth={3} />}
                {now && <span className={cn("rounded-full", full ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} style={{ backgroundColor: brand }} />}
              </span>
              {i < STEPS.length - 1 && <span className="flex-1 h-[3px] mx-1 rounded-full" style={{ backgroundColor: i < step ? brand : "#EEEBF4" }} />}
            </div>
          );
        })}
      </div>
      {full && (
        <div className="mt-2 grid grid-cols-4 text-[11.5px] sm:text-[12px] font-semibold">
          {STEPS.map((label, i) => (
            <span key={label} className={cn(i === 0 ? "text-left" : i === STEPS.length - 1 ? "text-right" : "text-center",
              i <= step ? "text-[#17151F]" : "text-[#8A8599]")}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PaymentBar({ grandTotal, paidAmount, currency }: { grandTotal: number; paidAmount: number; currency: string }) {
  const gt = Number(grandTotal), paid = Number(paidAmount);
  const bal = Math.max(0, gt - paid);
  const pct = gt > 0 ? Math.min(100, (paid / gt) * 100) : 0;
  const fullyPaid = bal <= 0 && gt > 0;
  if (gt === 0) return null;
  const cs = sym(currency);
  return (
    <div>
      <div className="h-2 bg-[#F1EFF6] rounded-full overflow-hidden" role="progressbar" aria-label="Paid so far" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: fullyPaid ? "#1F8A5B" : "linear-gradient(90deg,#8E72F2,#5B3FD0)" }} />
      </div>
      <div className="flex items-center justify-between gap-3 mt-2 text-[13px]">
        <span className="text-[#6B6680]">
          <span className="font-semibold text-[#17151F] tabular-nums">{cs}{num(gt)}</span> total
          {paid > 0 && <> · <span className="text-[#1F8A5B] font-semibold tabular-nums">{cs}{num(paid)}</span> paid</>}
        </span>
        {fullyPaid
          ? <span className="inline-flex items-center gap-1 font-bold text-[#1F8A5B]"><CheckCircle className="w-3.5 h-3.5" />Fully paid</span>
          : <span className="font-bold text-[#C2304F] tabular-nums">{money(bal, currency)} due</span>}
      </div>
    </div>
  );
}

/** A titled white card. */
export function Section({ id, title, icon, color, right, children, className }: {
  id?: string; title: string; icon?: React.ElementType; color?: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={cn("bg-white rounded-[22px] overflow-hidden scroll-mt-24", CARD_SHADOW, className)}>
      <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center gap-2.5">
        {icon && color && <Tile icon={icon} color={color} size={28} />}
        <h2 className="flex-1 min-w-0 text-[15px] font-extrabold tracking-[-0.01em] text-[#17151F]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** A row in a list card (invoice, payment, quote, agreement). Links open in a new tab. */
export function DocRow({ href, onClick, icon, color, title, sub, amount, amountSub, chip, newTab = true }: {
  href?: string; onClick?: () => void; icon: React.ElementType; color: "deep" | "orchid" | "green" | "ink" | "violet" | "teal" | "blue" | "red";
  title: React.ReactNode; sub?: React.ReactNode; amount?: string; amountSub?: React.ReactNode; chip?: { label: string; color: string }; newTab?: boolean;
}) {
  const inner = (
    <>
      <Tile icon={icon} color={color} size={38} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{title}</span>
        {sub && <span className="block text-[12.5px] text-[#6B6680] leading-snug sm:truncate">{sub}</span>}
      </span>
      {(amount || amountSub) && (
        <span className="text-right flex-shrink-0">
          {amount && <span className="block text-[14.5px] font-extrabold text-[#17151F] tabular-nums">{amount}</span>}
          {amountSub && <span className="block text-[12px] tabular-nums">{amountSub}</span>}
        </span>
      )}
      {chip && <span className={cn("hidden sm:inline-flex h-6 px-2.5 rounded-full text-[12px] font-bold items-center flex-shrink-0 whitespace-nowrap", chip.color)}>{chip.label}</span>}
      {(href || onClick) && <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />}
    </>
  );
  const cls = "w-full flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[64px] text-left";
  if (href) return <li><a href={href} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={cn(cls, "hover:bg-[#F7F5FB] transition-colors")}>{inner}</a></li>;
  if (onClick) return <li><button type="button" onClick={onClick} className={cn(cls, "hover:bg-[#F7F5FB] transition-colors")}>{inner}</button></li>;
  return <li className={cls}>{inner}</li>;
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-[#EEEBF4] border-t border-[#F2EFF8]">{children}</ul>;
}
