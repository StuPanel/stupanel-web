"use client";

/**
 * One program, two ways:
 *  • ProgramCard — the card in the list: the cover (or the date), the name, where it is, money.
 *  • ProgramPage — the cover, then one part at a time in tabs: Overview · Files · Album · Music · Payment.
 *    On a computer the cover, the next step and the summary stay on the left; the tab fills the right.
 */
import { Corrections } from "./portal-corrections";
import { SideBadge, cleanSide } from "@/lib/coverage-side";
import { ArrowLeft, CheckCircle, RotateCcw, ChevronRight, ExternalLink, FileSignature, Images, MapPin, MessageCircle, Music2, Package, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { waLink } from "@/lib/portal-session";
import type { ClientGalleryCard } from "@/lib/photos";
import type { ClientMusic } from "@/lib/music";
import { PortalPhotos } from "./portal-photos";
import { PortalMusic } from "./portal-music";
import { DeliverySection } from "./portal-delivery";
import { Cover } from "./portal-cover";
import { FilesSoon, Gallery, LinkList, LockedFiles } from "./portal-gallery";
import { CARD, NextStep } from "./portal-todo";
import {
  INV_STATUS, STEPS, deliveryStatus, dueOf, money, programName, stepOf,
  type PortalBooking, type PortalContract, type PortalInvoice, type PortalPayment, type PortalRefund, type Studio, type Todo,
} from "./portal-data";
import { DocRow, PaymentBar, RowList, StatusChip } from "./portal-ui";

export type ProgramTab = "overview" | "files" | "album" | "music" | "payment";

export const dateRange = (b: PortalBooking) => {
  if (!b.eventDate) return "Date to be set";
  const end = b.eventEndDate && b.eventEndDate.slice(0, 10) !== b.eventDate.slice(0, 10) ? b.eventEndDate : null;
  return end ? `${fmtDate(b.eventDate)} – ${fmtDate(end)}` : fmtDate(b.eventDate);
};
const dayNames = (b: PortalBooking) => (b.days ?? []).map(d => d.name).filter(Boolean);

// ─── Card in the list ────────────────────────────────────────────────────────

export function ProgramCard({ b, todos, studio, onOpen }: { b: PortalBooking; todos: Todo[]; studio: string; onOpen: () => void }) {
  const due = dueOf(b);
  const ds = deliveryStatus(b);
  const days = dayNames(b);
  const money_ = Number(b.grandTotal) > 0 && ds !== "cancelled"
    ? (due > 0 ? <span className="font-bold text-[#B42347] tabular-nums">{money(due, b.currency)} due</span>
      : <span className="font-bold text-[#1F8A5B] inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Paid</span>)
    : null;
  const body = (
    <div className="px-4 py-3.5 flex items-center gap-3">
      <span className="flex-1 min-w-0">
        <span className="block text-[15.5px] font-bold text-[#17151F] truncate">{programName(b)}</span>
        <span className="block text-[12.5px] text-[#6B6680] truncate tabular-nums">{dateRange(b)}{days.length ? ` · ${days.join(", ")}` : ""}</span>
      </span>
      <span className="flex flex-col items-end gap-0.5 text-[12.5px] flex-shrink-0">
        {money_}
        {todos.length > 0 && <span className="text-[#5B3FD0] font-semibold">{todos.length} to do</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-[#9A95A8] flex-shrink-0" />
    </div>
  );
  return (
    <button type="button" onClick={onOpen} className={cn(CARD, "w-full text-left overflow-hidden transition-transform hover:-translate-y-0.5 active:scale-[.995]")}>
      {b.cover || ds === "ready" || ds === "delivered" ? (
        <Cover cover={b.cover} studio={studio} dim="none" className="h-[120px] sm:h-[140px]">
          <span className="absolute left-3 bottom-3"><StatusChip status={ds} /></span>
        </Cover>
      ) : (
        <div className="px-4 pt-3.5 -mb-1.5 flex items-center gap-2"><StatusChip status={ds} /></div>
      )}
      {body}
    </button>
  );
}

// ─── The program page ────────────────────────────────────────────────────────

export function ProgramPage({
  b, token, brand, studio, todos, invoices, payments, refunds = [], contracts, photos, music, tab, open, onTab, onBack, onChanged, onTodo,
}: {
  b: PortalBooking; token: string; brand: string; studio: Studio; todos: Todo[];
  invoices: PortalInvoice[]; payments: PortalPayment[]; refunds?: PortalRefund[]; contracts: PortalContract[];
  photos: ClientGalleryCard[]; music?: ClientMusic;
  tab: ProgramTab;
  /** Open this straight away (from the to-do list): "photos:<galleryId>" or "music". */
  open?: string;
  onTab: (t: ProgramTab) => void; onBack: () => void; onChanged: () => void; onTodo: (t: Todo) => void;
}) {
  const due = dueOf(b);
  const ds = deliveryStatus(b);
  const cancelled = ds === "cancelled";
  const hasMoney = Number(b.grandTotal) > 0 || invoices.length > 0 || payments.length > 0;
  const kinds = new Set(todos.map(t => t.kind));
  const tabs: { id: ProgramTab; label: string; dot?: boolean }[] = [
    { id: "overview", label: "Overview" },
    ...(!cancelled ? [{ id: "files" as const, label: "Files", dot: !!b.delivery?.fullyPaid && (b.delivery.driveFiles?.length ?? 0) > 0 }] : []),
    ...(photos.length ? [{ id: "album" as const, label: "Album", dot: kinds.has("photos") }] : []),
    ...(music ? [{ id: "music" as const, label: "Music", dot: kinds.has("music") }] : []),
    ...(hasMoney ? [{ id: "payment" as const, label: "Payment", dot: due > 0 && !cancelled }] : []),
  ];
  const current = tabs.some(t => t.id === tab) ? tab : "overview";
  const photosOpen = open?.startsWith("photos:") ? open.slice(7) : undefined;
  const studioName = studio.name;

  const summary = (
    <Summary b={b} due={due} cancelled={cancelled} photos={photos} music={music} contracts={contracts} onTab={onTab} hasMoney={hasMoney} />
  );

  return (
    <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8 lg:items-start">
      <aside className="space-y-4 lg:sticky lg:top-24">
        <button type="button" onClick={onBack} className="h-10 pl-2 pr-3.5 -ml-1 rounded-full text-[13.5px] font-semibold text-[#4A4658] hover:bg-white/70 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />All programs
        </button>
        {/* The Files tab opens with its own large cover, so the small one steps aside there. */}
        <Cover cover={b.cover} studio={studioName} className={cn("h-[230px] sm:h-[260px] lg:h-[300px] rounded-[26px]", current === "files" && b.delivery && "hidden")}>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <StatusChip status={ds} />
            <h1 className="mt-2 text-[25px] sm:text-[28px] font-extrabold tracking-[-0.02em] leading-tight">{programName(b)}</h1>
            <p className="mt-0.5 text-[13px] text-white/85 tabular-nums">
              {dateRange(b)}{b.eventLocation ? <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {b.eventLocation}</> : null}
            </p>
          </div>
        </Cover>
        <div className="hidden lg:block space-y-4">
          {todos.length > 0 && <NextStep todos={todos} onTodo={onTodo} showProgram={false} />}
          {summary}
        </div>
      </aside>

      <div className="mt-4 lg:mt-14 min-w-0">
        <nav aria-label="Program sections" className="sticky top-16 lg:static z-20 -mx-3 px-3 sm:mx-0 sm:px-0 py-2.5 lg:py-0 lg:mb-5 bg-white/75 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {tabs.map(t => {
              const on = t.id === current;
              return (
                <button key={t.id} type="button" onClick={() => onTab(t.id)} aria-current={on ? "page" : undefined}
                  className={cn("h-10 px-4 rounded-full text-[13.5px] font-bold whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0 border transition-colors",
                    on ? "bg-[#17151F] border-[#17151F] text-white" : "bg-white border-[#E6E4EA] text-[#17151F] hover:border-[#CFCBD8]")}>
                  {t.label}
                  {t.dot && !on && <span className="w-1.5 h-1.5 rounded-full bg-[#7D5CEF]" aria-label="something new" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-3 lg:mt-0 space-y-4">
          {current === "overview" && (
            <>
              <div className="lg:hidden space-y-4">
                {todos.length > 0 && <NextStep todos={todos} onTodo={onTodo} showProgram={false} />}
                {summary}
              </div>
              <Days b={b} />
              {cancelled && <p className={cn(CARD, "p-4 text-[14px] text-[#4A4658]")}>This program was cancelled.</p>}
            </>
          )}

          {current === "files" && <Files b={b} due={due} token={token} brand={brand} studio={studio} />}

          {current === "album" && (
            <section className={cn(CARD, "p-3 sm:p-4")} aria-label="Album photos">
              <PortalPhotos token={token} galleries={photos} brand={brand} onChanged={onChanged} autoOpen={photosOpen} />
            </section>
          )}

          {current === "music" && music && (
            <section className={cn(CARD, "p-3 sm:p-4")} aria-label="Music">
              <PortalMusic token={token} music={music} brand={brand} onChanged={onChanged} autoOpen={open === "music"} />
            </section>
          )}

          {current === "payment" && (
            <Payment b={b} due={due} cancelled={cancelled} studio={studio} invoices={invoices} payments={payments} refunds={refunds} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Parts ───────────────────────────────────────────────────────────────────

/** Where the program is (four steps) and one line for each part; a line opens its tab. */
function Summary({ b, due, cancelled, photos, music, contracts, hasMoney, onTab }: {
  b: PortalBooking; due: number; cancelled: boolean; photos: ClientGalleryCard[]; music?: ClientMusic;
  contracts: PortalContract[]; hasMoney: boolean; onTab: (t: ProgramTab) => void;
}) {
  const step = stepOf(b);
  const d = b.delivery;
  const waiting = (d?.preview ?? []).reduce((s, g) => s + g.count, 0);
  const files = !d ? (b.deliveryLink ? "Ready — open the link" : "They show here when they are ready")
    : !d.fullyPaid ? `${waiting ? `${waiting} files` : "Ready"} · open after payment`
    : `${(d.driveFiles?.length ?? 0) + d.r2Files.length || d.links.length} ready to see and download`;
  const g = photos[0];
  const album = g ? (g.status === "open" ? (g.picked ? "Choosing — finish when you are ready" : "Choose the photos for your album") : "Sent to the studio") : "";
  const songs = music ? (music.status === "open" ? (music.counts.total ? `${music.counts.total} chosen — finish when you are ready` : "Choose songs for your videos") : "Sent to the studio") : "";
  const rows: { key: string; icon: React.ElementType; name: string; sub: string; tone?: string; tab?: ProgramTab; href?: string }[] = [
    ...(!cancelled ? [{ key: "f", icon: Package, name: "Files", sub: files, tab: "files" as const }] : []),
    ...(g ? [{ key: "a", icon: Images, name: "Album photos", sub: album, tone: g.status === "open" ? "text-[#5B3FD0]" : undefined, tab: "album" as const }] : []),
    ...(music ? [{ key: "m", icon: Music2, name: "Music", sub: songs, tone: music.status === "open" ? "text-[#5B3FD0]" : undefined, tab: "music" as const }] : []),
    ...(hasMoney ? [{
      key: "p", icon: Receipt, name: "Payment", tab: "payment" as const,
      sub: cancelled ? "Cancelled" : due > 0 ? `${money(b.paidAmount, b.currency)} paid · ${money(due, b.currency)} left` : "Fully paid",
      tone: !cancelled && due > 0 ? "text-[#B42347]" : "text-[#1F8A5B]",
    }] : []),
    ...contracts.map(c => ({
      key: `c${c.id}`, icon: FileSignature, name: c.title || "Agreement", href: `/c/${c.publicToken}`,
      sub: c.status === "signed" ? `Signed${c.signedAt ? ` ${fmtDate(c.signedAt)}` : ""}` : "Please read and sign",
      tone: c.status === "signed" ? "text-[#1F8A5B]" : "text-[#9A5B00]",
    })),
  ];
  return (
    <section className={cn(CARD, "overflow-hidden")} aria-label="This program">
      {step >= 0 && (
        <div className="px-4 pt-4 pb-3" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          <div className="grid grid-cols-4 gap-1.5">
            {STEPS.map((s, i) => (
              <span key={s} className="flex flex-col gap-1.5">
                <span className={cn("h-1 rounded-full", i <= step ? "bg-[#17151F]" : "bg-[#E2DFE8]")} />
                <span className={cn("text-[11.5px] font-semibold", i <= step ? "text-[#17151F]" : "text-[#8A8599]")}>{s}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <ul className={cn("px-4", step >= 0 && "border-t border-[#F0EEF3]")}>
        {rows.map((r, i) => {
          const inner = (
            <>
              <r.icon className="w-5 h-5 text-[#3A3647] flex-shrink-0" strokeWidth={1.8} />
              <span className="flex-1 min-w-0">
                <span className="block text-[14.5px] font-bold text-[#17151F]">{r.name}</span>
                <span className={cn("block text-[12.5px] truncate", r.tone ?? "text-[#6B6680]")}>{r.sub}</span>
              </span>
              {r.href ? <ExternalLink className="w-4 h-4 text-[#9A95A8]" /> : <ChevronRight className="w-4 h-4 text-[#9A95A8]" />}
            </>
          );
          const cls = cn("w-full min-h-[60px] flex items-center gap-3 text-left", i < rows.length - 1 && "border-b border-[#F0EEF3]");
          return (
            <li key={r.key}>
              {r.href
                ? <a href={r.href} className={cls}>{inner}</a>
                : <button type="button" onClick={() => r.tab && onTab(r.tab)} className={cls}>{inner}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Days({ b }: { b: PortalBooking }) {
  const days = b.days ?? [];
  if (!days.length) return null;
  return (
    <section aria-labelledby="days">
      <h2 id="days" className="px-1 mb-2 text-[14px] font-bold text-[#17151F]">{days.length > 1 ? `Your days · ${days.length}` : "Your day"}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {days.map((d, i) => (
          <div key={i} className={cn(CARD, "px-4 py-3")}>
            <p className="text-[12px] font-semibold text-[#6B6680] tabular-nums">{d.date ? fmtDate(d.date) : "Date to be set"}</p>
            <p className="text-[15px] font-bold text-[#17151F] truncate">{d.name || `Day ${i + 1}`}</p>
            {d.location && <p className="text-[12.5px] text-[#6B6680] truncate">{d.location}</p>}
            {cleanSide(d.side) && cleanSide(d.side) !== cleanSide(b.coverageSide) && <p className="mt-1"><SideBadge side={d.side} /></p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Files({ b, due, token, brand, studio }: { b: PortalBooking; due: number; token: string; brand: string; studio: Studio }) {
  const d = b.delivery;
  if (!d) {
    if (b.deliveryLink) {
      return (
        <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer"
          className="h-12 rounded-2xl bg-[#17151F] text-white text-[14.5px] font-bold flex items-center justify-center gap-2">
          <ExternalLink className="w-4 h-4" />Open your photos and videos
        </a>
      );
    }
    return <FilesSoon b={b} studio={studio} />;
  }
  if (!d.fullyPaid) return <LockedFiles b={b} studio={studio} due={due} />;
  const drive = d.driveFiles ?? [];
  return (
    <div className="space-y-4">
      {d.note && <p className={cn(CARD, "px-4 py-3 text-[13.5px] text-[#4A4658]")}>{d.note}</p>}
      {drive.length > 0 && <Gallery b={b} files={drive} token={token} studio={studio} />}
      <LinkList links={d.links} main={drive.length === 0 && d.r2Files.length === 0} />
      {(d.r2Files.length > 0 || (drive.length === 0 && d.driveFolderUrl)) && (
        <DeliverySection delivery={{ ...d, driveFiles: [], links: [] }} dueAmount={0} currency={b.currency} brand={brand} token={token} bookingId={b.id}
          studio={studio} programName={programName(b)} hidePay />
      )}
      {b.corrections && b.corrections.items.length > 0 && <Corrections b={b} token={token} studio={studio} />}
    </div>
  );
}

function Payment({ b, due, cancelled, studio, invoices, payments, refunds }: {
  b: PortalBooking; due: number; cancelled: boolean; studio: Studio; invoices: PortalInvoice[]; payments: PortalPayment[]; refunds: PortalRefund[];
}) {
  const ways = [studio.bkashNumber && { label: "bKash", n: studio.bkashNumber }, studio.nagadNumber && { label: "Nagad", n: studio.nagadNumber }].filter(Boolean) as { label: string; n: string }[];
  const told = waLink(studio.phone, `Hi ${studio.name}, I've paid ${money(due, b.currency)} for ${programName(b)}.`);
  return (
    <div className="space-y-4">
      {Number(b.grandTotal) > 0 && (
        <section className={cn(CARD, "p-4 sm:p-5")} aria-label="Payment">
          <PaymentBar grandTotal={b.grandTotal} paidAmount={b.paidAmount} currency={b.currency} />
          {due > 0 && !cancelled && (ways.length > 0 || told) && (
            <div className="mt-4 pt-4 border-t border-[#F0EEF3] space-y-3">
              {ways.length > 0 && (
                <p className="text-[13.5px] text-[#33303F]">Pay by {ways.map((w, i) => <span key={w.label}>{i > 0 && " or "}<b>{w.label}</b> <span className="tabular-nums">{w.n}</span></span>)}</p>
              )}
              {told && (
                <a href={told} target="_blank" rel="noopener noreferrer"
                  className="h-12 rounded-2xl bg-[#17151F] hover:bg-[#2A2733] text-white text-[14.5px] font-bold flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4" />I&apos;ve paid — tell {studio.name}
                </a>
              )}
            </div>
          )}
        </section>
      )}
      {(invoices.length > 0 || payments.length > 0 || refunds.length > 0) && (
        <section className={cn(CARD, "overflow-hidden")} aria-label="Invoices and receipts">
          <RowList>
            {invoices.map(inv => (
              <DocRow key={inv.id} href={`/inv/${inv.publicToken}`} icon={Receipt} title={inv.invoiceNumber}
                sub={inv.dueDate && Number(inv.balanceDue) > 0 && inv.status !== "void" ? `Pay by ${fmtDate(inv.dueDate)}` : fmtDate(inv.issueDate)}
                amount={money(inv.grandTotal, inv.currency)}
                amountSub={inv.status === "void" ? <span className="text-[#8A8599] font-semibold">Cancelled</span>
                  : Number(inv.balanceDue) > 0 ? <span className="text-[#B42347] font-semibold">{money(inv.balanceDue, inv.currency)} due</span>
                  : <span className="text-[#1F8A5B] font-semibold">Paid</span>}
                chip={INV_STATUS[inv.status]} />
            ))}
            {payments.map(p => (
              <DocRow key={p.id} icon={CheckCircle} tone="green" title={`${money(p.amount, p.currency)} received`}
                sub={<>{fmtDate(p.paymentDate)}{p.paymentMethod ? <span className="capitalize"> · {p.paymentMethod.replace(/_/g, " ")}</span> : null}{p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}</>} />
            ))}
            {refunds.map(r => (
              <DocRow key={r.id} icon={RotateCcw} title={`${money(r.amount, b.currency)} given back to you`} sub={fmtDate(r.refundDate)} />
            ))}
          </RowList>
        </section>
      )}
    </div>
  );
}
