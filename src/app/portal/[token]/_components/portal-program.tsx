"use client";

/**
 * One program, two ways:
 *  • ProgramCard — the short card in the list (date, name, where it is, money, things to do).
 *  • ProgramPage — everything for that program in the order it happens:
 *    days → payment → agreement → photo choosing → music → files.
 */
import {
  ArrowLeft, CalendarDays, CheckCircle, ChevronRight, CreditCard, FileSignature, Image as ImageIcon, Images, MapPin,
  MessageCircle, Music2, Package, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { CARD_SHADOW, DateBox, Tile } from "@/components/ui/apple";
import { waLink } from "@/lib/portal-session";
import type { ClientGalleryCard } from "@/lib/photos";
import type { ClientMusic } from "@/lib/music";
import { PortalPhotos } from "./portal-photos";
import { PortalMusic } from "./portal-music";
import { DeliverySection } from "./portal-delivery";
import {
  INV_STATUS, deliveryStatus, dueOf, money, programName, stepOf,
  type PortalBooking, type PortalContract, type PortalInvoice, type PortalPayment, type Studio, type Todo,
} from "./portal-data";
import { DocRow, PaymentBar, RowList, Section, StatusChip, Steps } from "./portal-ui";
import { TodoList } from "./portal-todo";

const dateRange = (b: PortalBooking) => {
  if (!b.eventDate) return "Date to be set";
  const end = b.eventEndDate && b.eventEndDate.slice(0, 10) !== b.eventDate.slice(0, 10) ? b.eventEndDate : null;
  return end ? `${fmtDate(b.eventDate)} – ${fmtDate(end)}` : fmtDate(b.eventDate);
};

// ─── Card in the list ────────────────────────────────────────────────────────

export function ProgramCard({ b, todos, brand, onOpen }: { b: PortalBooking; todos: Todo[]; brand: string; onOpen: () => void }) {
  const due = dueOf(b);
  const ds = deliveryStatus(b);
  const days = (b.days ?? []).map(d => d.name).filter(Boolean);
  return (
    <button type="button" onClick={onOpen}
      className={cn("w-full text-left bg-white rounded-[22px] p-4 sm:p-5 transition-transform hover:-translate-y-0.5 active:scale-[.995]", CARD_SHADOW)}>
      <div className="flex items-start gap-3.5">
        <DateBox date={b.eventDate} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 min-w-0 text-[16px] font-extrabold tracking-[-0.01em] text-[#17151F] leading-snug">{programName(b)}</h3>
            <StatusChip status={ds} />
          </div>
          <p className="mt-0.5 text-[12.5px] text-[#6B6680] tabular-nums">{dateRange(b)}{days.length > 1 ? ` · ${days.join(", ")}` : ""}</p>
          {b.eventLocation && <p className="mt-0.5 text-[12.5px] text-[#6B6680] flex items-center gap-1 min-w-0"><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{b.eventLocation}</span></p>}
        </div>
      </div>
      {ds !== "cancelled" && <div className="mt-3.5"><Steps step={stepOf(b)} brand={brand} /></div>}
      <div className="mt-3.5 flex items-center gap-2 text-[13px]">
        {todos.length > 0
          ? <span className="h-7 px-2.5 rounded-full bg-[#FFF3E0] text-[#9A5B00] font-bold inline-flex items-center">{todos.length} thing{todos.length > 1 ? "s" : ""} to do</span>
          : <span className="text-[#6B6680]">{b.bookingNumber}</span>}
        <span className="flex-1" />
        {Number(b.grandTotal) > 0 && (due > 0
          ? <span className="font-bold text-[#C2304F] tabular-nums">{money(due, b.currency)} due</span>
          : <span className="font-bold text-[#1F8A5B] inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Paid</span>)}
        <ChevronRight className="w-4 h-4 text-[#B5B0C4]" />
      </div>
    </button>
  );
}

// ─── The program page ────────────────────────────────────────────────────────

export function ProgramPage({
  b, token, brand, studio, todos, invoices, payments, contracts, photos, music, open, onBack, onChanged, onTodo,
}: {
  b: PortalBooking; token: string; brand: string; studio: Studio; todos: Todo[];
  invoices: PortalInvoice[]; payments: PortalPayment[]; contracts: PortalContract[];
  photos: ClientGalleryCard[]; music?: ClientMusic;
  /** Open this part straight away (from the to-do list): "photos:<galleryId>" or "music". */
  open?: string;
  onBack: () => void; onChanged: () => void; onTodo: (t: Todo) => void;
}) {
  const due = dueOf(b);
  const ds = deliveryStatus(b);
  const days = b.days ?? [];
  const ways = [studio.bkashNumber && { label: "bKash", n: studio.bkashNumber }, studio.nagadNumber && { label: "Nagad", n: studio.nagadNumber }].filter(Boolean) as { label: string; n: string }[];
  const paidMsg = waLink(studio.phone, `Hi ${studio.name}, I've paid ${money(due, b.currency)} for ${programName(b)}.`);
  const photosOpen = open?.startsWith("photos:") ? open.slice(7) : undefined;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="h-9 pl-2 pr-3.5 -ml-1 rounded-full text-[13.5px] font-semibold text-[#4A4658] hover:bg-white/70 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" />All programs
      </button>

      {/* Hero */}
      <section className={cn("bg-white rounded-[24px] p-5 sm:p-6", CARD_SHADOW)}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{programName(b)}</h1>
            <p className="mt-1 text-[13.5px] text-[#6B6680] flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1 tabular-nums"><CalendarDays className="w-3.5 h-3.5" />{dateRange(b)}</span>
              {b.eventLocation && <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 flex-shrink-0" />{b.eventLocation}</span>}
            </p>
            <p className="mt-0.5 text-[12px] text-[#8A8599]">{b.bookingNumber}</p>
          </div>
          <StatusChip status={ds} />
        </div>
        {ds !== "cancelled" && <div className="mt-5"><Steps step={stepOf(b)} full brand={brand} /></div>}
      </section>

      {todos.length > 0 && <TodoList todos={todos} onTodo={onTodo} title="To do for this program" />}

      {/* Days */}
      {days.length > 0 && (
        <Section title={days.length > 1 ? `Your days (${days.length})` : "Your day"} icon={CalendarDays} color="deep">
          <RowList>
            {days.map((d, i) => (
              <li key={i} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{d.name || `Day ${i + 1}`}</span>
                  {d.location && <span className="block text-[12.5px] text-[#6B6680] truncate">{d.location}</span>}
                </span>
                <span className="text-[13px] font-semibold text-[#33303F] tabular-nums flex-shrink-0">{d.date ? fmtDate(d.date) : "Date to be set"}</span>
              </li>
            ))}
          </RowList>
        </Section>
      )}

      {/* Payment */}
      {(Number(b.grandTotal) > 0 || invoices.length > 0 || payments.length > 0) && (
        <Section id="part-money" title="Payment" icon={CreditCard} color={due > 0 ? "red" : "green"}>
          <div className="px-4 sm:px-5 pb-4">
            <PaymentBar grandTotal={b.grandTotal} paidAmount={b.paidAmount} currency={b.currency} />
            {due > 0 && ds !== "cancelled" && (ways.length > 0 || paidMsg) && (
              <div className="mt-3 rounded-2xl bg-[#F7F5FB] p-3.5 space-y-2.5">
                {ways.length > 0 && (
                  <p className="text-[13px] text-[#33303F]">Pay by {ways.map((w, i) => <span key={w.label}>{i > 0 && " or "}<b>{w.label}</b> <span className="tabular-nums">{w.n}</span></span>)}</p>
                )}
                {paidMsg && (
                  <a href={paidMsg} target="_blank" rel="noopener noreferrer"
                    className="h-10 rounded-full text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90" style={{ backgroundColor: brand }}>
                    <MessageCircle className="w-4 h-4" />I&apos;ve paid — tell {studio.name}
                  </a>
                )}
              </div>
            )}
          </div>
          {(invoices.length > 0 || payments.length > 0) && (
            <RowList>
              {invoices.map(inv => (
                <DocRow key={inv.id} href={`/inv/${inv.publicToken}`} icon={Receipt} color="orchid" title={`Invoice ${inv.invoiceNumber}`}
                  sub={inv.dueDate && Number(inv.balanceDue) > 0 ? `Pay by ${fmtDate(inv.dueDate)}` : fmtDate(inv.issueDate)}
                  amount={money(inv.grandTotal, inv.currency)}
                  amountSub={Number(inv.balanceDue) > 0 ? <span className="text-[#C2304F] font-semibold">{money(inv.balanceDue, inv.currency)} due</span> : <span className="text-[#1F8A5B] font-semibold">Paid</span>}
                  chip={INV_STATUS[inv.status]} />
              ))}
              {payments.map(p => (
                <DocRow key={p.id} icon={CheckCircle} color="green" title={`${money(p.amount, p.currency)} received`}
                  sub={<>{fmtDate(p.paymentDate)}{p.paymentMethod ? <span className="capitalize"> · {p.paymentMethod.replace(/_/g, " ")}</span> : null}{p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}</>} />
              ))}
            </RowList>
          )}
        </Section>
      )}

      {/* Agreement */}
      {contracts.length > 0 && (
        <Section title={contracts.length > 1 ? "Agreements" : "Agreement"} icon={FileSignature} color="ink">
          <RowList>
            {contracts.map(x => (
              <DocRow key={x.id} href={`/c/${x.publicToken}`} newTab={false} icon={FileSignature} color="ink" title={x.title} sub={x.contractNumber}
                amountSub={x.status === "signed"
                  ? <span className="text-[#1F8A5B] font-semibold">Signed{x.signedAt ? ` ${fmtDate(x.signedAt)}` : ""}</span>
                  : <span className="text-[#9A5B00] font-semibold">Please sign</span>} />
            ))}
          </RowList>
        </Section>
      )}

      {/* Photo choosing */}
      {photos.length > 0 && (
        <Section id="part-photos" title="Album photos" icon={Images} color="violet">
          <div className="pt-1"><PortalPhotos token={token} galleries={photos} brand={brand} onChanged={onChanged} autoOpen={photosOpen} /></div>
        </Section>
      )}

      {/* Music */}
      {music && (
        <Section id="part-music" title="Music" icon={Music2} color="orchid">
          <div className="pt-1"><PortalMusic token={token} music={music} brand={brand} onChanged={onChanged} autoOpen={open === "music"} /></div>
        </Section>
      )}

      {/* Files */}
      {ds !== "cancelled" && (
        <Section id="part-files" title="Your files" icon={Package} color="teal">
          <div className="px-4 sm:px-5 pb-5">
            {b.delivery ? (
              <DeliverySection delivery={b.delivery} dueAmount={due} currency={b.currency} brand={brand} token={token} bookingId={b.id}
                studio={studio} programName={programName(b)} hidePay />
            ) : b.deliveryLink ? (
              <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer"
                className="h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" />Open your photos & videos
              </a>
            ) : (
              <div className="rounded-2xl bg-[#F7F5FB] px-4 py-4 flex items-center gap-3">
                <Tile icon={Package} color="ink" size={32} />
                <p className="text-[13.5px] text-[#4A4658] leading-relaxed">Your photos and videos will show here when they are ready.</p>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
