"use client";

/**
 * Pick a program to record money for: search by client, phone, program name or code.
 * Programs that still owe money come first (oldest program first: those most need collecting);
 * fully paid ones are below, and cancelled programs are left out (they can't take a payment).
 * Programs beyond the first page are found by searching (the server looks through all of them).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PickProgram {
  id: string; bookingNumber: string; eventName?: string; grandTotal: number; paidAmount: number; currency: string;
  clientName?: string; clientPhone?: string; eventDate?: string | null; status?: string;
}

/** Shape a /bookings list row for the picker. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPickProgram(b: any): PickProgram {
  const paid = Array.isArray(b.payments) ? b.payments.reduce((s: number, p: { amount: unknown }) => s + Number(p.amount || 0), 0) : Number(b.paidAmount ?? 0);
  return {
    id: b.id, bookingNumber: b.bookingNumber, eventName: b.eventName, grandTotal: Number(b.grandTotal), paidAmount: Number(b.paidAmount ?? paid),
    currency: b.currency, clientName: [b.client?.firstName, b.client?.lastName].filter(Boolean).join(" ") || undefined,
    clientPhone: b.client?.phone ?? undefined, eventDate: b.eventDate ?? null, status: b.status,
  };
}

const due = (p: PickProgram) => Math.max(0, p.grandTotal - p.paidAmount);
const words = (p: PickProgram) => [p.clientName, p.clientPhone, p.eventName, p.bookingNumber].filter(Boolean).join(" ").toLowerCase();

export function ProgramPicker({ programs, value, onChange, id, disabled }: {
  programs: PickProgram[]; value: string; onChange: (p: PickProgram) => void; id?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PickProgram[]>([]);
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo(() => {
    const m = new Map<string, PickProgram>();
    for (const p of [...programs, ...found]) if (!m.has(p.id)) m.set(p.id, p);
    return [...m.values()];
  }, [programs, found]);
  const selected = all.find(p => p.id === value);

  // Search the server too, so programs beyond the first page are found.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      setSearching(true);
      apiFetch(`${API}/bookings?limit=30&search=${encodeURIComponent(term)}`).then(r => (r.ok ? r.json() : null))
        .then(d => setFound((d?.data ?? []).map(toPickProgram)))
        .catch(() => {}).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = all.filter(p => p.status !== "cancelled" && (!term || term.split(/\s+/).every(w => words(p).includes(w))));
    const time = (p: PickProgram) => (p.eventDate ? new Date(p.eventDate).getTime() : Number.MAX_SAFE_INTEGER);
    const owing = rows.filter(p => due(p) > 0).sort((a, b) => time(a) - time(b));
    const paid = rows.filter(p => due(p) === 0).sort((a, b) => time(b) - time(a));
    return { owing, paid };
  }, [all, q]);

  function pick(p: PickProgram) { onChange(p); setOpen(false); setQ(""); }

  const row = (p: PickProgram) => {
    const d = due(p);
    const on = p.id === value;
    return (
      <li key={p.id}>
        <button type="button" onClick={() => pick(p)} aria-pressed={on}
          className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-left transition-colors",
            on ? "bg-[#EEE8FD]" : "hover:bg-[#F5F3FA]")}>
          <span className="w-9 h-9 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[14px] font-extrabold flex items-center justify-center flex-shrink-0">
            {(p.clientName || p.eventName || "?").charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-bold text-[#17151F] truncate">{p.clientName || p.eventName || "No name"}</span>
            <span className="block text-[12.5px] text-[#6B6680] truncate">
              {[p.eventName && p.eventName !== p.clientName ? p.eventName : null, p.eventDate ? fmtDate(p.eventDate) : null, p.bookingNumber].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="text-right flex-shrink-0">
            {d > 0
              ? <><span className="block text-[13.5px] font-bold text-[#C2304F] tabular-nums">{formatCurrency(d, p.currency)}</span><span className="block text-[11.5px] text-[#6B6680]">still to pay</span></>
              : <span className="text-[12px] font-bold text-[#1F8A5B] bg-[#E7F5EE] px-2 py-0.5 rounded-full">Paid</span>}
          </span>
          {on && <Check className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />}
        </button>
      </li>
    );
  };

  return (
    <div>
      <button type="button" id={id} disabled={disabled} onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={cn("w-full min-h-[48px] flex items-center gap-3 px-4 py-2 rounded-[14px] bg-[#F5F3FA] text-left transition-colors hover:bg-[#EEEBF4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0]/40 disabled:opacity-60",
          open && "ring-2 ring-[#7D5CEF]/40")}>
        {selected ? (
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-bold text-[#17151F] truncate">{selected.clientName || selected.eventName || selected.bookingNumber}</span>
            <span className="block text-[12.5px] text-[#6B6680] truncate">{[selected.eventName && selected.eventName !== selected.clientName ? selected.eventName : null, selected.eventDate ? fmtDate(selected.eventDate) : null, selected.bookingNumber].filter(Boolean).join(" · ")}</span>
          </span>
        ) : <span className="flex-1 text-[14.5px] text-[#8A8599]">Choose a program…</span>}
        <ChevronDown className={cn("w-4 h-4 text-[#6B6680] transition-transform flex-shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2 rounded-[18px] bg-white shadow-[0_1px_2px_rgba(22,18,40,.05),0_12px_32px_-12px_rgba(22,18,40,.25)] ring-1 ring-[#EEEBF4] p-2">
          <label className="flex items-center gap-2 h-11 px-3 rounded-[12px] bg-[#F5F3FA] focus-within:ring-2 focus-within:ring-[#7D5CEF]/40">
            <Search className="w-4 h-4 text-[#8A8599] flex-shrink-0" />
            {/* The box shows focus with its ring (focus-within); the global outline is turned off here, inline, because it is outside the CSS layers. */}
            <input ref={input} value={q} onChange={e => setQ(e.target.value)} aria-label="Find a program"
              placeholder="Client name, phone or program code"
              className="flex-1 min-w-0 bg-transparent text-[15px] text-[#17151F] placeholder:text-[#9893A8]" style={{ outline: "none" }} />
            {searching && <Loader2 className="w-4 h-4 animate-spin text-[#7D5CEF]" />}
            {q && !searching && <button type="button" onClick={() => setQ("")} aria-label="Clear" className="p-1 rounded-full hover:bg-[#EEEBF4]"><X className="w-4 h-4 text-[#6B6680]" /></button>}
          </label>
          <div className="mt-2 max-h-[340px] overflow-y-auto overscroll-contain">
            {list.owing.length === 0 && list.paid.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13.5px] text-[#6B6680]">{q.trim() ? "No program matches. Try the client's phone or the program code." : "No programs yet."}</p>
            ) : (
              <>
                {list.owing.length > 0 && <p className="px-3 pt-1 pb-1 text-[12px] font-bold text-[#6B6680]">Still to pay · {list.owing.length}</p>}
                <ul className="space-y-0.5">{list.owing.map(row)}</ul>
                {list.paid.length > 0 && <p className="px-3 pt-3 pb-1 text-[12px] font-bold text-[#6B6680]">Fully paid · {list.paid.length}</p>}
                <ul className="space-y-0.5">{list.paid.map(row)}</ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
