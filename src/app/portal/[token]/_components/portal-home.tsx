"use client";

/**
 * The portal's main views: Home (to do + coming up), Programs (upcoming / done),
 * Money (what is paid and due, per program, with invoices, receipts and quotes),
 * and the navigation (top tabs on a computer, a bottom bar on a phone).
 */
import { CalendarDays, CheckCircle, CreditCard, FileText, Home, MessageCircle, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { CARD_SHADOW, EmptyState, StatCard } from "@/components/ui/apple";
import {
  INV_STATUS, QUOTE_STATUS, dueOf, isUpcoming, money, programName, quoteOpen, todosFor,
  type PortalBooking, type PortalData, type Todo,
} from "./portal-data";
import { ProgramCard } from "./portal-program";
import { AllDone, TodoList } from "./portal-todo";
import { DocRow, RowList, Section } from "./portal-ui";

export type View = "home" | "programs" | "money" | "chat";

const byDate = (dir: 1 | -1) => (a: PortalBooking, b: PortalBooking) => {
  if (!a.eventDate) return 1;
  if (!b.eventDate) return -1;
  return dir * a.eventDate.localeCompare(b.eventDate);
};

function ProgramList({ title, list, todos, brand, onOpen }: { title: string; list: PortalBooking[]; todos: Todo[]; brand: string; onOpen: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <section>
      <h2 className="px-1 mb-2.5 text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">{title} <span className="text-[#B5B0C4]">· {list.length}</span></h2>
      <div className="space-y-3">
        {list.map(b => <ProgramCard key={b.id} b={b} todos={todosFor(todos, b.id)} brand={brand} onOpen={() => onOpen(b.id)} />)}
      </div>
    </section>
  );
}

// ─── Home ────────────────────────────────────────────────────────────────────

export function HomeView({ data, todos, brand, onTodo, onOpen, onView }: {
  data: PortalData; todos: Todo[]; brand: string;
  onTodo: (t: Todo) => void; onOpen: (id: string) => void; onView: (v: View) => void;
}) {
  const upcoming = data.bookings.filter(isUpcoming).sort(byDate(1));
  const past = data.bookings.filter(b => !isUpcoming(b));
  const totalDue = data.bookings.reduce((s, b) => s + dueOf(b), 0);
  const c = data.company.currency;
  return (
    <div className="space-y-6">
      {todos.length > 0 ? <TodoList todos={todos} onTodo={onTodo} title="What you need to do" /> : <AllDone />}

      {upcoming.length > 0
        ? <ProgramList title="Coming up" list={upcoming.slice(0, 3)} todos={todos} brand={brand} onOpen={onOpen} />
        : data.bookings.length === 0 && <EmptyState icon={CalendarDays} title="No programs yet" text="Your programs with the studio will show here." />}

      {(upcoming.length > 3 || past.length > 0) && (
        <button type="button" onClick={() => onView("programs")}
          className={cn("w-full h-12 rounded-[18px] bg-white text-[14px] font-semibold text-[#17151F] hover:bg-[#F7F5FB] inline-flex items-center justify-center gap-2", CARD_SHADOW)}>
          <CalendarDays className="w-4 h-4" />See all {data.bookings.length} programs
        </button>
      )}

      {totalDue > 0 && (
        <button type="button" onClick={() => onView("money")}
          className={cn("w-full bg-white rounded-[22px] p-4 sm:p-5 flex items-center gap-3 text-left hover:bg-[#FDFCFE]", CARD_SHADOW)}>
          <span className="w-10 h-10 rounded-full bg-[#FDECEF] flex items-center justify-center flex-shrink-0"><CreditCard className="w-5 h-5 text-[#C2304F]" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] text-[#6B6680]">Still to pay, all programs</span>
            <span className="block text-[20px] font-extrabold text-[#17151F] tabular-nums">{money(totalDue, c)}</span>
          </span>
          <span className="text-[13px] font-semibold text-[#5B3FD0]">See money</span>
        </button>
      )}
    </div>
  );
}

// ─── All programs ────────────────────────────────────────────────────────────

export function ProgramsView({ data, todos, brand, onOpen }: { data: PortalData; todos: Todo[]; brand: string; onOpen: (id: string) => void }) {
  const upcoming = data.bookings.filter(isUpcoming).sort(byDate(1));
  const past = data.bookings.filter(b => !isUpcoming(b)).sort(byDate(-1));
  if (!data.bookings.length) return <EmptyState icon={CalendarDays} title="No programs yet" text="Your programs with the studio will show here." />;
  return (
    <div className="space-y-7">
      <ProgramList title="Coming up" list={upcoming} todos={todos} brand={brand} onOpen={onOpen} />
      <ProgramList title="Done" list={past} todos={todos} brand={brand} onOpen={onOpen} />
    </div>
  );
}

// ─── Money ───────────────────────────────────────────────────────────────────

export function MoneyView({ data, onOpen }: { data: PortalData; onOpen: (id: string, part?: string) => void }) {
  const c = data.company.currency;
  const live = data.bookings.filter(b => b.deliveryStatus !== "cancelled" && Number(b.grandTotal) > 0);
  const totalDue = live.reduce((s, b) => s + dueOf(b), 0);
  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount), 0);
  const name = new Map(data.bookings.map(b => [b.id, programName(b)]));
  const showInv = data.company.portalShowInvoices !== false;
  const showPay = data.company.portalShowPayments !== false;
  const showQuotes = data.company.portalShowQuotes !== false;
  const waiting = data.quotes.filter(quoteOpen);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Wallet} color="green" label="You've paid" value={money(totalPaid, c)} />
        <StatCard icon={CreditCard} color={totalDue > 0 ? "red" : "green"} label="Still to pay" value={money(totalDue, c)} />
      </div>

      {showQuotes && waiting.length > 0 && (
        <Section title="Quotes waiting for you" icon={FileText} color="deep">
          <RowList>
            {waiting.map(q => (
              <DocRow key={q.id} href={`/q/${q.publicToken}`} icon={FileText} color="deep" title={q.quoteNumber}
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
                <DocRow key={b.id} onClick={() => onOpen(b.id, "money")} icon={CalendarDays} color="violet" title={programName(b)}
                  sub={`${b.eventDate ? fmtDate(b.eventDate) : "Date to be set"} · ${money(b.grandTotal, b.currency)} total`}
                  amountSub={due > 0 ? <span className="text-[#C2304F] font-bold text-[13px]">{money(due, b.currency)} due</span> : <span className="text-[#1F8A5B] font-bold text-[13px] inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Paid</span>} />
              );
            })}
          </RowList>
        </Section>
      )}

      {showInv && data.invoices.length > 0 && (
        <Section title="Invoices" icon={Receipt} color="orchid">
          <RowList>
            {data.invoices.map(inv => (
              <DocRow key={inv.id} href={`/inv/${inv.publicToken}`} icon={Receipt} color="orchid" title={inv.invoiceNumber}
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
          {data.payments.length === 0
            ? <p className="px-4 sm:px-5 pb-4 text-[13.5px] text-[#6B6680]">Every payment the studio records shows here.</p>
            : (
              <RowList>
                {data.payments.map(p => (
                  <DocRow key={p.id} icon={CheckCircle} color="green" title={money(p.amount, p.currency)}
                    sub={[fmtDate(p.paymentDate), p.bookingId ? name.get(p.bookingId) : null, p.paymentMethod?.replace(/_/g, " ")].filter(Boolean).join(" · ")} />
                ))}
              </RowList>
            )}
        </Section>
      )}
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
                className={cn("h-16 flex flex-col items-center justify-center gap-1 text-[11.5px] font-semibold relative", on ? "text-[#5B3FD0]" : "text-[#6B6680]")}>
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
