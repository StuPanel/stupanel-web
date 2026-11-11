"use client";

/**
 * Studio side of expense claims: costs a team member paid from their own pocket for a program.
 * Approve (the amount can change, with a reason) → it is added to that member's bill on the program:
 * they are owed it, and the program's profit goes down. Decline needs a reason. Undo takes it back.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bus, Check, ChevronRight, FileImage, Loader2, Package, Printer, ReceiptText, RotateCcw, Utensils, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { Avatar } from "@/components/ui/profile-kit";
import { Chip, Empty, Section, card, linkBtn } from "@/components/ui/profile-page";
import { inputCls } from "@/components/ui/form-kit";

export type Claim = {
  id: string; bookingId: string; userId: string; category: string; amount: number; approvedAmount: number | null;
  spentOn: string | null; note: string | null; receiptUrl: string | null; status: "pending" | "approved" | "rejected";
  reviewNote: string | null; reviewedAt: string | null; createdAt: string;
  memberName?: string; memberAvatar?: string | null;
  program?: { id: string; bookingNumber: string; eventName: string | null; status: string };
};

export const CLAIM_CATS: { v: string; l: string; icon: React.ElementType }[] = [
  { v: "transport", l: "Transport", icon: Bus },
  { v: "food", l: "Food", icon: Utensils },
  { v: "rental", l: "Rented gear", icon: Package },
  { v: "printing", l: "Printing", icon: Printer },
  { v: "other", l: "Other", icon: ReceiptText },
];
export const catLabel = (v: string) => CLAIM_CATS.find(c => c.v === v)?.l ?? "Cost";
export const catIcon = (v: string) => CLAIM_CATS.find(c => c.v === v)?.icon ?? ReceiptText;
export const CLAIM_STATUS: Record<Claim["status"], { label: string; tone: "amber" | "green" | "red" }> = {
  pending: { label: "Waiting", tone: "amber" }, approved: { label: "Approved", tone: "green" }, rejected: { label: "Declined", tone: "red" },
};
const money = (n: string) => Number(n.replace(/,/g, ""));

/** One cost, with Approve / Decline for a waiting one and Undo for an approved one. */
export function ClaimCard({ c, showProgram, onDone }: { c: Claim; showProgram?: boolean; onDone: (c: Claim) => void }) {
  const [mode, setMode] = useState<"" | "decline" | "change">("");
  const [amount, setAmount] = useState(String(c.amount));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const Icon = catIcon(c.category);
  const st = CLAIM_STATUS[c.status];
  const changed = mode === "change" && Math.abs(money(amount) - c.amount) > 0.009;

  async function act(path: "approve" | "reject" | "undo", body?: unknown) {
    setBusy(path);
    try {
      const r = await apiFetch(`${API}/expense-claims/${c.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || "Couldn't save", { error: true }); return; }
      setMode(""); setNote("");
      notify(path === "approve" ? `Added to ${c.memberName ?? "their"} bill` : path === "reject" ? "Declined — they will see why" : "Taken back off the bill");
      onDone(d as Claim);
    } catch { notify("Couldn't save — check your internet", { error: true }); }
    finally { setBusy(""); }
  }
  async function undo() {
    if (!(await askConfirm({ title: "Undo this approval?", message: `${formatCurrency(c.approvedAmount ?? c.amount)} comes off ${c.memberName ?? "the member"}'s bill and the cost waits again.`, confirmLabel: "Undo approval" }))) return;
    act("undo");
  }

  return (
    <div className={cn(card, "p-4", c.status === "pending" && "ring-1 ring-[#F3D9A6]")}>
      <div className="flex items-start gap-3">
        <Avatar name={c.memberName ?? "?"} src={c.memberAvatar} size={38} />
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-semibold text-[#17151F] truncate">{c.memberName ?? "Team member"}</p>
          <p className="text-[12.5px] text-[#6B6680] truncate flex items-center gap-1">
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />{catLabel(c.category)}{c.spentOn ? ` · ${fmtDate(c.spentOn)}` : ""}
            {showProgram && c.program ? <> · <Link href={`/programs/${c.program.id}?tab=money`} className="font-semibold text-[#5B3FD0] hover:underline truncate">{c.program.eventName || c.program.bookingNumber}</Link></> : null}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[16px] font-extrabold text-[#17151F] tabular-nums">{formatCurrency(c.approvedAmount ?? c.amount)}</p>
          {c.approvedAmount != null && c.approvedAmount !== c.amount && <p className="text-[11.5px] text-[#8A8599] line-through tabular-nums">{formatCurrency(c.amount)}</p>}
          <Chip tone={st.tone}>{st.label}</Chip>
        </div>
      </div>
      {c.note && <p className="mt-2 text-[13.5px] text-[#33303F] whitespace-pre-wrap break-words">{c.note}</p>}
      {c.receiptUrl && (
        <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] p-1.5 pr-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.receiptUrl} alt="Receipt" className="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
          <span className="text-[12.5px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1"><FileImage className="w-3.5 h-3.5" />Receipt</span>
        </a>
      )}
      {c.reviewNote && c.status !== "pending" && <p className="mt-2 text-[12.5px] text-[#6B6680]">Your answer: {c.reviewNote}</p>}

      {c.status === "pending" && (
        <div className="mt-3 space-y-2">
          {mode === "change" && (
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
              <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount to approve" className={cn(inputCls, "tabular-nums")} />
              <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} aria-label="Why the amount is different" placeholder="Why the amount is different" className={inputCls} />
            </div>
          )}
          {mode === "decline" && (
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} aria-label="Why it is declined" placeholder="Why — the member will see this" className={inputCls} />
          )}
          <div className="grid grid-cols-2 sm:flex gap-2">
            {mode === "" && <>
              <button type="button" onClick={() => { setMode("change"); setAmount(String(c.amount)); }} className="col-span-2 sm:mr-auto h-10 px-4 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[13px] font-semibold">Change amount</button>
              <button type="button" disabled={!!busy} onClick={() => setMode("decline")} className="h-10 px-4 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><X className="w-4 h-4" />Decline</button>
              <button type="button" disabled={!!busy} onClick={() => act("approve")} className="h-10 px-4 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Approve {formatCurrency(c.amount)}
              </button>
            </>}
            {mode === "change" && <>
              <button type="button" onClick={() => setMode("")} className="sm:mr-auto h-10 px-4 rounded-full bg-[#F1EFF6] text-[#17151F] text-[13px] font-semibold">Back</button>
              <button type="button" disabled={!!busy || !(money(amount) > 0) || (changed && !note.trim())} onClick={() => act("approve", { amount: money(amount), note: note.trim() || undefined })}
                className="h-10 px-4 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Approve {money(amount) > 0 ? formatCurrency(money(amount)) : ""}
              </button>
            </>}
            {mode === "decline" && <>
              <button type="button" onClick={() => setMode("")} className="sm:mr-auto h-10 px-4 rounded-full bg-[#F1EFF6] text-[#17151F] text-[13px] font-semibold">Back</button>
              <button type="button" disabled={!!busy || !note.trim()} onClick={() => act("reject", { note: note.trim() })}
                className="h-10 px-4 rounded-full bg-[#C2304F] hover:bg-[#A82843] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                {busy === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}Decline
              </button>
            </>}
          </div>
          {mode === "" && <p className="text-[12px] text-[#6B6680]">Approve adds it to {c.memberName?.split(" ")[0] ?? "their"} bill on this program — you owe it to them, and the program&apos;s profit goes down.</p>}
          {changed && !note.trim() && <p className="text-[12px] text-[#7A4800]">Write why the amount is different — they will see it.</p>}
        </div>
      )}
      {c.status === "approved" && (
        <button type="button" disabled={!!busy} onClick={undo} className="mt-2 text-[12.5px] font-semibold text-[#6B6680] hover:text-[#17151F] inline-flex items-center gap-1">
          {busy === "undo" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Undo approval
        </button>
      )}
    </div>
  );
}

/** Program page: every cost the team claimed on this program. */
export function ProgramTeamCosts({ bookingId, onChanged }: { bookingId: string; onChanged: () => void }) {
  const [list, setList] = useState<Claim[] | null>(null);
  const load = useCallback(() => {
    apiFetch(`${API}/expense-claims?bookingId=${bookingId}`).then(r => (r.ok ? r.json() : [])).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  }, [bookingId]);
  useEffect(() => { load(); }, [load]);
  if (!list) return null;
  const waiting = list.filter(c => c.status === "pending");
  const rest = list.filter(c => c.status !== "pending");
  const approved = list.filter(c => c.status === "approved").reduce((s, c) => s + (c.approvedAmount ?? c.amount), 0);
  return (
    <Section title={`Costs paid by the team${waiting.length ? ` · ${waiting.length} to check` : ""}`}
      action={approved > 0 ? <span className="text-[12.5px] text-[#6B6680]">Approved {formatCurrency(approved)}</span> : undefined}>
      {list.length === 0 ? (
        <Empty icon={ReceiptText} title="No costs from the team" text="When someone pays transport or other costs for this program, they add it in their panel and it shows here to approve." />
      ) : (
        <div className="space-y-3">
          {[...waiting, ...rest].map(c => <ClaimCard key={c.id} c={c} onDone={() => { load(); onChanged(); }} />)}
        </div>
      )}
    </Section>
  );
}

/** "N costs to check" — for the Team page and the dashboard. */
export function useWaitingCosts() {
  const [n, setN] = useState(0);
  useEffect(() => {
    apiFetch(`${API}/expense-claims/count`).then(r => (r.ok ? r.json() : null)).then(d => setN(Number(d?.pending ?? 0))).catch(() => {});
  }, []);
  return n;
}

export function WaitingCostsLink({ n }: { n: number }) {
  if (!n) return null;
  return (
    <Link href="/team/costs" className="flex items-center gap-3 rounded-[16px] bg-[#FFF3E0] hover:bg-[#FCEBD0] px-4 py-3 mb-5 text-[#7A4800]">
      <ReceiptText className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 text-[14px]"><b>{n} cost{n === 1 ? "" : "s"}</b> from the team to check</span>
      <span className={cn(linkBtn, "!text-[#7A4800]")}>Check<ChevronRight className="w-3.5 h-3.5" /></span>
    </Link>
  );
}
