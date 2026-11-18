"use client";

/** Settings → Plan & Billing: the plan page is its own page; this opens it. */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Group, Row } from "../_ui";

export function BillingPane() {
  return (
    <Group title="Plan" note="Also in your account menu (bottom left), with the days left.">
      <Row id="billing-open" label="Plan & billing" hint="Your plan, days left, choosing a plan, and paying by bKash, Nagad or Rocket">
        <Link href="/billing" className="h-10 pl-4 pr-3 rounded-full bg-[#7D5CEF] hover:bg-[#6E4FE6] text-white text-[13px] font-semibold inline-flex items-center gap-1">
          Open<ChevronRight className="w-4 h-4" />
        </Link>
      </Row>
    </Group>
  );
}
