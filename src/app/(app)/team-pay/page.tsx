"use client";

/** Team pay: salary slips and the costs the team paid for programs, in one place. Pay for programs is paid from each program. */
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banknote, ReceiptText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/apple";
import { SalaryView } from "@/components/team-pay/salary-view";
import { TeamCostsView } from "@/components/team-pay/team-costs-view";

const TABS = [
  { id: "salary", label: "Salary", icon: Banknote },
  { id: "costs", label: "Team costs", icon: ReceiptText },
] as const;
type Tab = (typeof TABS)[number]["id"];

function TeamPay() {
  const router = useRouter();
  const q = useSearchParams();
  const tab: Tab = q.get("tab") === "costs" ? "costs" : "salary";
  return (
    <div>
      <PageHeader icon={Wallet} color="green" title="Team pay" sub="Salary for your team and the costs they paid for programs. Pay for a program is paid from that program." />
      <div role="tablist" aria-label="Team pay" className="bg-white rounded-[20px] p-1.5 grid grid-cols-2 gap-1 mb-5 shadow-[0_1px_2px_rgba(22,18,40,.06)] max-w-md">
        {TABS.map(t => {
          const on = t.id === tab;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on}
              onClick={() => router.replace(t.id === "salary" ? "/team-pay" : "/team-pay?tab=costs", { scroll: false })}
              className={cn("min-h-[44px] rounded-[14px] flex items-center justify-center gap-2 px-2 text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
                on ? "bg-[#EEE8FD] text-[#4B32B8]" : "text-[#4A4658] hover:bg-[#F5F3FA] hover:text-[#17151F]")}>
              <t.icon className="w-[18px] h-[18px]" />{t.label}
            </button>
          );
        })}
      </div>
      {tab === "salary" ? <SalaryView /> : <TeamCostsView />}
    </div>
  );
}

export default function TeamPayPage() {
  return <Suspense fallback={null}><TeamPay /></Suspense>;
}
