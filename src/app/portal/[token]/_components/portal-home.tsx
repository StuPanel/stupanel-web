"use client";

/**
 * The portal's main views: Home (to do + coming up), Programs (upcoming / done),
 * Money (what is paid and due, per program, with invoices, receipts and quotes),
 * and the navigation (top tabs on a computer, a bottom bar on a phone).
 */
import { CalendarDays, CheckCircle, CreditCard, FileText, Home, MessageCircle, Receipt, RotateCcw, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { EmptyState, StatCard } from "@/components/ui/apple";
import {
  INV_STATUS, QUOTE_STATUS, deliveryStatus, dueOf, isUpcoming, money, programName, quoteOpen, todosFor,
  type PortalBooking, type PortalData, type Todo,
} from "./portal-data";
import { ProgramCard } from "./portal-program";
import { AllDone, CARD, NextStep } from "./portal-todo";
import { DocRow, RowList, Section } from "./portal-ui";

export type View = "home" | "programs" | "money" | "chat";

const byDate = (dir: 1 | -1) => (a: PortalBooking, b: PortalBooking) => {
  if (!a.eventDate) return 1;
  if (!b.eventDate) return -1;
  return dir * a.eventDate.localeCompare(b.eventDate);
};

function ProgramList({ title, list, todos, studio, onOpen }: { title: string; list: PortalBooking[]; todos: Todo[]; studio: string; onOpen: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <section aria-label={title}>
      <h2 className="px-1 mb-2.5 text-[15px] font-extrabold text-[#17151F]">{title} <span className="font-semibold text-[#8A8599]">· {list.length}</span></h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {list.map(b => <ProgramCard key={b.id} b={b} todos={todosFor(todos, b.id)} studio={studio} onOpen={() => onOpen(b.id)} />)}
      </div>
    </section>
  );
}

/** Nothing more is coming for this program: delivered, or cancelled. */
const isFinished = (b: PortalBooking) => ["delivered", "cancelled"].includes(deliveryStatus(b));

// ─── Home ────────────────────────────────────────────────────────────────────

export function HomeView({ data, todos, onTodo, onOpen, onView }: {
  data: PortalData; todos: Todo[];
  onTodo: (t: Todo) => void; onOpen: (id: string) => void; onView: (v: View) => void;
}) {
  const upcoming = data.bookings.filter(isUpcoming).sort(byDate(1));
  const after = data.bookings.filter(b => !isUpcoming(b)).sort(byDate(-1));
  // The event is over, but the studio is still working on it (editing, files not delivered yet).
  const working = after.filter(b => !isFinished(b));
  // Programs that still need the client come first: files to collect, photos to choose…
  const busy = new Set(todos.map(t => t.bookingId).filter(Boolean));
  // …then the ones still being edited, then what is coming up.
  const shown = [...after.filter(b => busy.has(b.id)), ...working.filter(b => !busy.has(b.id)), ...upcoming].slice(0, 4);
  const live = data.bookings.filter(b => deliveryStatus(b) !== "cancelled" && Number(b.grandTotal) > 0);
  const totalDue = live.reduce((s, b) => s + dueOf(b), 0);
  const totalAll = live.reduce((s, b) => s + Number(b.grandTotal), 0);
  const c = data.company.currency;
  const studio = data.company.name;
  const paidAll = totalAll - totalDue;
  const list = shown.length ? shown : after.slice(0, 2);
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
    <div className="space-y-6">
      {todos.length > 0 ? <NextStep todos={todos} onTodo={onTodo} /> : <AllDone />}

      {data.bookings.length === 0
        ? <EmptyState icon={CalendarDays} title="No programs yet" text="Your programs with the studio will show here." />
        : (
          <section aria-label="Your programs">
            <div className="px-1 mb-2.5 flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold text-[#17151F]">Your programs</h2>
              {data.bookings.length > shown.length && (
                <button type="button" onClick={() => onView("programs")} className="text-[13px] font-semibold text-[#5B3FD0] hover:underline">All {data.bookings.length}</button>
              )}
            </div>
            {/* One program fills the row; more sit two side by side. */}
            <div className={cn("grid gap-3 items-start", list.length > 1 && "sm:grid-cols-2")}>
              {list.map(b => <ProgramCard key={b.id} b={b} todos={todosFor(todos, b.id)} studio={studio} onOpen={() => onOpen(b.id)} />)}
            </div>
          </section>
        )}

      {totalAll > 0 && (
        <button type="button" onClick={() => onView("money")}
          className="lg:hidden w-full px-1 flex items-center justify-between gap-3 text-[13.5px] text-[#6B6680] hover:text-[#17151F]">
          <span className="tabular-nums">Paid {money(totalAll - totalDue, c)} of {money(totalAll, c)}{totalDue > 0 && <> · <b className="text-[#B42347]">{money(totalDue, c)} left</b></>}</span>
          <span className="font-semibold text-[#17151F]">Money ›</span>
        </button>
      )}
    </div>

    {/* Computer: money and the studio's contact sit beside the programs, so the page is not half empty. */}
    <aside className="hidden lg:block space-y-4 sticky top-24">
      {totalAll > 0 && (
        <section aria-label="Money" className={cn(CARD, "p-5")}>
          <p className="text-[12.5px] font-semibold text-[#6B6680]">{totalDue > 0 ? "Still to pay" : "Money"}</p>
          <p className={cn("mt-1 text-[28px] font-extrabold tracking-[-0.02em] tabular-nums leading-none", totalDue > 0 ? "text-[#B42347]" : "text-[#1F8A5B]")}>{totalDue > 0 ? money(totalDue, c) : "All paid"}</p>
          <div className="mt-4 h-1.5 rounded-full bg-[#F0EEF3] overflow-hidden"><div className="h-full rounded-full bg-[#1F8A5B]" style={{ width: `${Math.min(100, Math.round((paidAll / totalAll) * 100))}%` }} /></div>
          <p className="mt-2 flex justify-between text-[13px] text-[#6B6680] tabular-nums"><span>Paid <b className="text-[#1F8A5B]">{money(paidAll, c)}</b></span><span>of <b className="text-[#17151F]">{money(totalAll, c)}</b></span></p>
          <button type="button" onClick={() => onView("money")} className="mt-4 w-full h-11 rounded-2xl bg-[#F3F3F1] hover:bg-[#ECEAF0] text-[14px] font-bold text-[#17151F]">See payments and invoices</button>
        </section>
      )}
      <section aria-label={studio} className={cn(CARD, "p-5")}>
        <p className="text-[12.5px] font-semibold text-[#6B6680]">Your studio</p>
        <p className="mt-1 text-[17px] font-extrabold text-[#17151F]">{studio}</p>
        {data.company.phone && <p className="mt-0.5 text-[13.5px] text-[#6B6680] tabular-nums">{data.company.phone}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.company.phone && <a href={`tel:${data.company.phone}`} className="h-11 rounded-2xl bg-[#F3F3F1] hover:bg-[#ECEAF0] text-[14px] font-bold text-[#17151F] inline-flex items-center justify-center">Call</a>}
          {data.company.portalShowMessages !== false && <button type="button" onClick={() => onView("chat")} className={cn("h-11 rounded-2xl bg-[#17151F] hover:bg-[#2A2733] text-white text-[14px] font-bold", !data.company.phone && "col-span-2")}>Message</button>}
        </div>
      </section>
    </aside>
    </div>
  );
}

// ─── All programs ────────────────────────────────────────────────────────────

export function ProgramsView({ data, todos, onOpen }: { data: PortalData; todos: Todo[]; onOpen: (id: string) => void }) {
  const upcoming = data.bookings.filter(isUpcoming).sort(byDate(1));
  const after = data.bookings.filter(b => !isUpcoming(b)).sort(byDate(-1));
  const working = after.filter(b => !isFinished(b));
  const past = after.filter(isFinished);
  const studio = data.company.name;
  if (!data.bookings.length) return <EmptyState icon={CalendarDays} title="No programs yet" text="Your programs with the studio will show here." />;
  return (
    <div className="space-y-7">
      <ProgramList title="Coming up" list={upcoming} todos={todos} studio={studio} onOpen={onOpen} />
      <ProgramList title="Being prepared" list={working} todos={todos} studio={studio} onOpen={onOpen} />
      <ProgramList title="Done" list={past} todos={todos} studio={studio} onOpen={onOpen} />
    </div>
  );
}

// ─── Money ───────────────────────────────────────────────────────────────────

export function MoneyView({ data, onOpen }: { data: PortalData; onOpen: (id: string, part?: string) => void }) {
  const c = data.company.currency;
  const live = data.bookings.filter(b => deliveryStatus(b) !== "cancelled" && Number(b.grandTotal) > 0);
  const totalDue = live.reduce((s, b) => s + dueOf(b), 0);
  const refunds = data.refunds ?? [];
  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount), 0) - refunds.reduce((s, r) => s + Number(r.amount), 0);
  const name = new Map(data.bookings.map(b => [b.id, programName(b)]));
  const showInv = data.company.portalShowInvoices !== false;
  const showPay = data.company.portalShowPayments !== false;
  const showQuotes = data.company.portalShowQuotes !== false;
  const waiting = data.quotes.filter(quoteOpen);
  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
      <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Wallet} color="green" label="You've paid" value={money(totalPaid, c)} />
        <StatCard icon={CreditCard} color={totalDue > 0 ? "red" : "green"} label="Still to pay" value={money(totalDue, c)} />
      </div>

      {showQuotes && waiting.length > 0 && (
        <Section title="Quotes waiting for you" icon={FileText} color="deep">
          <RowList>
            {waiting.map(q => (
              <DocRow key={q.id} href={`/q/${q.publicToken}`} icon={FileText} title={q.quoteNumber}
                sub={q.validUntil ? `Valid until ${fmtDate(q.validUntil)}` : fmtDate(q.createdAt)} amount={money(q.grandTotal, q.currency)} chip={QUOTE_STATUS[q.status]} />
            ))}
          </RowList>
        </Section>
      )}

      {live.length > 0 && (
        <Section title="By program" icon={CalendarDays} color="violet">
          <RowList>
            {live.map(b => {
              const due = dueOf(b);
              return (
                <DocRow key={b.id} onClick={() => onOpen(b.id, "money")} icon={CalendarDays} title={programName(b)}
                  sub={`${b.eventDate ? fmtDate(b.eventDate) : "Date to be set"} · ${money(b.grandTotal, b.currency)} total`}
                  amountSub={due > 0 ? <span className="text-[#C2304F] font-bold text-[13px]">{money(due, b.currency)} due</span> : <span className="text-[#1F8A5B] font-bold text-[13px] inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Paid</span>} />
              );
            })}
          </RowList>
        </Section>
      )}

      </div>
      <div className="space-y-4">
      {showInv && data.invoices.length > 0 && (
        <Section title="Invoices" icon={Receipt} color="orchid">
          <RowList>
            {data.invoices.map(inv => (
              <DocRow key={inv.id} href={`/inv/${inv.publicToken}`} icon={Receipt} title={inv.invoiceNumber}
                sub={[inv.bookingId ? name.get(inv.bookingId) : null, inv.dueDate && Number(inv.balanceDue) > 0 ? `Pay by ${fmtDate(inv.dueDate)}` : fmtDate(inv.issueDate)].filter(Boolean).join(" · ")}
                amount={money(inv.grandTotal, inv.currency)}
                amountSub={Number(inv.balanceDue) > 0 ? <span className="text-[#C2304F] font-semibold">{money(inv.balanceDue, inv.currency)} due</span> : <span className="text-[#1F8A5B] font-semibold">Paid</span>}
                chip={INV_STATUS[inv.status]} />
            ))}
          </RowList>
        </Section>
      )}

      {showPay && (
        <Section title="Payments received" icon={CheckCircle} color="green">
          {data.payments.length === 0 && refunds.length === 0
            ? <p className="px-4 sm:px-5 pb-4 text-[13.5px] text-[#6B6680]">Every payment the studio records shows here.</p>
            : (
              <RowList>
                {data.payments.map(p => (
                  <DocRow key={p.id} icon={CheckCircle} tone="green" title={money(p.amount, p.currency)}
                    sub={[fmtDate(p.paymentDate), p.bookingId ? name.get(p.bookingId) : null, p.paymentMethod ? p.paymentMethod.replace(/_/g, " ").replace(/^./, ch => ch.toUpperCase()) : null].filter(Boolean).join(" · ")} />
                ))}
                {refunds.map(r => (
                  <DocRow key={r.id} icon={RotateCcw} title={`${money(r.amount, c)} given back to you`}
                    sub={[fmtDate(r.refundDate), name.get(r.bookingId)].filter(Boolean).join(" · ")} />
                ))}
              </RowList>
            )}
        </Section>
      )}
      </div>
    </div>
  );
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "programs", label: "Programs", icon: CalendarDays },
  { id: "money", label: "Money", icon: Wallet },
  { id: "chat", label: "Chat", icon: MessageCircle },
];

export function PortalNav({ view, onView, chat, badge }: { view: View | null; onView: (v: View) => void; chat: boolean; badge: number }) {
  const items = NAV.filter(n => n.id !== "chat" || chat);
  return (
    <>
      {/* Computer: tabs under the greeting */}
      <nav aria-label="Portal" className="hidden sm:flex gap-1.5 mb-5">
        {items.map(n => {
          const on = n.id === view;
          return (
            <button key={n.id} type="button" onClick={() => onView(n.id)} aria-current={on ? "page" : undefined}
              className={cn("h-10 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-2 transition-colors",
                on ? "bg-[#17151F] text-white" : "bg-white/80 text-[#33303F] hover:bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)]")}>
              <n.icon className="w-4 h-4" />{n.label}
              {n.id === "home" && badge > 0 && <span className={cn("h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center", on ? "bg-white text-[#17151F]" : "bg-[#C2304F] text-white")}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      {/* Phone: bar at the bottom */}
      <nav aria-label="Portal" className="sm:hidden fixed bottom-0 inset-x-0 z-40 sp-topbar border-t border-white/60 pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(n => {
            const on = n.id === view;
            return (
              <button key={n.id} type="button" onClick={() => onView(n.id)} aria-current={on ? "page" : undefined}
                className={cn("h-16 flex flex-col items-center justify-center gap-1 text-[11.5px] font-semibold relative", on ? "text-[#17151F]" : "text-[#8A8599]")}>
                <span className="relative">
                  <n.icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.4 : 2} />
                  {n.id === "home" && badge > 0 && <span className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 rounded-full bg-[#C2304F] text-white text-[10px] font-bold inline-flex items-center justify-center">{badge}</span>}
                </span>
                {n.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
