"use client";

/**
 * One invoice / quotation / money receipt, drawn in the studio's chosen design.
 * Used by Settings → Invoice designer (live preview) and the public client pages.
 * Plain inline styles so it looks the same on screen, in print and in the PDF.
 */
import type { CSSProperties, ReactNode } from "react";
import { BN_FONT, FONTS, HAND_FONT, PAPER, colorsOf, type InvoiceDesign, type SectionKey } from "./design";
import { amountInWords } from "./words";

export interface DocStudio {
  name: string; logoUrl?: string | null; phone?: string | null; email?: string | null;
  address?: string | null; city?: string | null; website?: string | null;
  bankName?: string | null; bankBranch?: string | null; bankAccountName?: string | null; bankAccountNumber?: string | null;
  bkashNumber?: string | null; nagadNumber?: string | null; rocketNumber?: string | null;
}
export interface DocData {
  kind: "invoice" | "quotation" | "receipt";
  number: string;
  issueDate: string;
  dueDate?: string | null;
  state?: string;
  currency: string;
  studio: DocStudio;
  client: { name: string; phone?: string | null; email?: string | null; address?: string | null };
  programName?: string | null;
  programRef?: string | null;
  eventDays?: { label: string; date?: string | null; place?: string | null }[];
  items: { name: string; description?: string | null; qty: number; rate: number; total: number }[];
  subtotal: number; discount: number; taxLabel?: string; taxPercent?: number; taxAmount: number;
  total: number; paid: number; due: number;
  payments?: { date: string; amount: number; method?: string | null; receiptNumber?: string | null }[];
  terms?: string | null;
  note?: string | null;
  receipt?: {
    amount: number; method: string; trxId?: string | null; account?: string | null;
    paidSoFar: number; dueAfter: number; forText?: string | null; voided?: boolean;
  };
}

const SYM: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€", GBP: "£", INR: "₹" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function docDate(d?: string | null) {
  if (!d) return "";
  const x = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return isNaN(x.getTime()) ? "" : `${String(x.getDate()).padStart(2, "0")} ${MON[x.getMonth()]} ${x.getFullYear()}`;
}
const METHOD: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", mobile_banking: "Mobile banking", credit_card: "Card", debit_card: "Card", cheque: "Cheque", online_gateway: "Online", other: "Other" };
export const methodLabel = (m?: string | null) => (m ? METHOD[m] ?? m : "");

/** Mix a hex colour with white (amount 0–1). */
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}
function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? "#17151F" : "#FFFFFF";
}

const STATE_STAMP: Record<string, string> = { paid: "PAID", overdue: "OVERDUE", cancelled: "CANCELLED", partly_paid: "PARTLY PAID" };

export function InvoiceDocument({ data, design, className, style }: { data: DocData; design: InvoiceDesign; className?: string; style?: CSSProperties }) {
  const paper = PAPER[design.paper];
  const pos = design.paper === "pos80";
  const small = design.paper === "a5" || pos;
  const { primary, secondary } = colorsOf(design);
  const font = FONTS.find(f => f.id === design.font) ?? FONTS[0];
  const T = design.template;
  const money = (n: number) => `${SYM[data.currency] ?? data.currency + " "}${Math.round(n * 100) / 100 === Math.round(n) ? Math.round(n).toLocaleString("en-IN") : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const isReceipt = data.kind === "receipt";
  const isQuote = data.kind === "quotation";
  const title = isReceipt ? "MONEY RECEIPT" : isQuote ? "QUOTATION" : "INVOICE";

  const ink = "#1D1B24", soft = "#6B6680", line = "#E6E2EE";
  const head: CSSProperties = { fontFamily: `'${font.head}', '${BN_FONT}', sans-serif`, fontWeight: font.headWeight };
  const fs = pos ? 10 : small ? 11 : 12.5;
  const gap = pos ? 10 : small ? 16 : 24;

  const pageBg = T === "botanical" ? secondary : "#FFFFFF";
  const headerDark = T === "bold";
  const headText = headerDark ? readableOn(primary) : ink;

  // ── Pieces ────────────────────────────────────────────────────────────────
  const logoImg = data.studio.logoUrl && /^https:\/\//.test(data.studio.logoUrl)
    ? <img src={data.studio.logoUrl} alt="" crossOrigin="anonymous" style={{ height: pos ? Math.min(design.logo.size, 48) : small ? design.logo.size * 0.75 : design.logo.size, maxWidth: pos ? 160 : 260, objectFit: "contain", display: "block" }} />
    : null;
  const studioName = design.logo.showName || !logoImg
    ? <div style={{ ...head, fontSize: pos ? 13 : small ? 15 : 19, color: headText, lineHeight: 1.2 }}>{data.studio.name}</div>
    : null;
  const studioContact = (
    <div style={{ fontSize: fs - 1.5, color: headerDark ? tint(primary, 0.55) : soft, lineHeight: 1.5, marginTop: 2 }}>
      {[data.studio.address, data.studio.city].filter(Boolean).join(", ")}
      {(data.studio.phone || data.studio.email) && <div>{[data.studio.phone, data.studio.email].filter(Boolean).join(" · ")}</div>}
    </div>
  );
  const brand = (align: "left" | "center" | "right") => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", textAlign: align, gap: 6 }}>
      {logoImg}{studioName}{!pos && studioContact}
    </div>
  );
  const titleColor = headerDark ? secondary : primary;
  const titleBlock = (align: "left" | "right" | "center") => (
    <div style={{ textAlign: align }}>
      <div style={{ ...head, fontSize: pos ? 15 : small ? 22 : 30, color: titleColor, letterSpacing: T === "minimal" ? "0.38em" : T === "bold" ? "0.04em" : "0.06em", lineHeight: 1.1 }}>{title}</div>
      <div style={{ fontSize: fs, color: headerDark ? tint(primary, 0.6) : soft, marginTop: 6, fontFeatureSettings: "'tnum'" }}>
        <div><b style={{ color: headText }}>No.</b> {data.number}</div>
        <div>Date: {docDate(data.issueDate)}</div>
        {!isQuote && !isReceipt && data.dueDate && <div>Pay by: {docDate(data.dueDate)}</div>}
      </div>
    </div>
  );

  let header: ReactNode;
  const lp = design.logo.position;
  if (pos) {
    header = <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>{logoImg}{studioName}{studioContact}<div style={{ marginTop: 8 }}>{titleBlock("center")}</div></div>;
  } else if (lp === "center") {
    header = <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: gap * 0.6 }}>{brand("center")}{titleBlock("center")}</div>;
  } else if (lp === "title") {
    header = (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{logoImg}{titleBlock("left")}</div>
        <div style={{ textAlign: "right" }}>{studioName}{studioContact}</div>
      </div>
    );
  } else {
    const left = lp === "left";
    header = (
      <div style={{ display: "flex", flexDirection: left ? "row" : "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap }}>
        {brand(left ? "left" : "right")}{titleBlock(left ? "right" : "left")}
      </div>
    );
  }

  const label: CSSProperties = { fontSize: fs - 2, letterSpacing: "0.12em", textTransform: "uppercase", color: T === "minimal" ? soft : primary, fontWeight: 700, marginBottom: 6 };
  const box = (t: string, children: ReactNode) => <div><div style={label}>{t}</div>{children}</div>;

  const clientBlock = (
    <div style={{ display: "grid", gridTemplateColumns: pos ? "1fr" : "1.2fr 1fr", gap }}>
      {box(isReceipt ? "Received from" : "Bill to", (
        <div style={{ fontSize: fs, lineHeight: 1.55 }}>
          <div style={{ ...head, fontWeight: 700, fontSize: fs + 2 }}>{data.client.name}</div>
          {data.client.phone && <div>{data.client.phone}</div>}
          {data.client.email && <div>{data.client.email}</div>}
          {data.client.address && <div>{data.client.address}</div>}
        </div>
      ))}
      {(data.programName || data.programRef) && box("Program", (
        <div style={{ fontSize: fs, lineHeight: 1.55 }}>
          {data.programName && <div style={{ fontWeight: 600 }}>{data.programName}</div>}
          {data.programRef && <div style={{ color: soft }}>Ref. {data.programRef}</div>}
        </div>
      ))}
    </div>
  );

  const eventDays = (data.eventDays?.length ?? 0) > 0 && box("Event days", (
    <div style={{ fontSize: fs, borderTop: `1px solid ${line}` }}>
      {data.eventDays!.map((d, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: `1px solid ${line}` }}>
          <span style={{ width: pos ? 70 : 110, fontWeight: 600 }}>{docDate(d.date) || "—"}</span>
          <span style={{ flex: 1 }}>{d.label}{d.place ? <span style={{ color: soft }}> · {d.place}</span> : null}</span>
        </div>
      ))}
    </div>
  ));

  const th: CSSProperties = { padding: pos ? "5px 4px" : "9px 10px", fontSize: fs - 1.5, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, textAlign: "left" };
  const td: CSSProperties = { padding: pos ? "5px 4px" : "10px", fontSize: fs, verticalAlign: "top", borderBottom: `1px solid ${line}` };
  const thBg: CSSProperties =
    T === "minimal" ? { background: "transparent", color: soft, borderBottom: `1.5px solid ${ink}` }
      : T === "botanical" ? { background: primary, color: readableOn(primary) }
        : { background: primary, color: readableOn(primary) };
  const cols = design.columns;
  const itemsTable = (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFeatureSettings: "'tnum'" }}>
      <thead>
        <tr style={thBg}>
          {cols.no && !pos && <th style={{ ...th, width: 34, borderRadius: T === "botanical" ? "8px 0 0 8px" : 0 }}>No</th>}
          <th style={{ ...th, borderRadius: T === "botanical" && (!cols.no || pos) ? "8px 0 0 8px" : 0 }}>Description</th>
          {cols.qty && <th style={{ ...th, textAlign: "center", width: pos ? 28 : 54 }}>Qty</th>}
          {cols.rate && !pos && <th style={{ ...th, textAlign: "right", width: 110 }}>Rate</th>}
          <th style={{ ...th, textAlign: "right", width: pos ? 70 : 120, borderRadius: T === "botanical" ? "0 8px 8px 0" : 0 }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it, i) => (
          <tr key={i}>
            {cols.no && !pos && <td style={{ ...td, color: soft }}>{String(i + 1).padStart(2, "0")}</td>}
            <td style={td}><div style={{ fontWeight: 600 }}>{it.name}</div>{it.description && <div style={{ color: soft, fontSize: fs - 1 }}>{it.description}</div>}</td>
            {cols.qty && <td style={{ ...td, textAlign: "center" }}>{it.qty}</td>}
            {cols.rate && !pos && <td style={{ ...td, textAlign: "right" }}>{money(it.rate)}</td>}
            <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(it.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const tRow = (l: string, v: string, strong?: boolean, color?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: strong ? fs + 1 : fs, fontWeight: strong ? 700 : 400, color }}>
      <span>{l}</span><span style={{ fontFeatureSettings: "'tnum'" }}>{v}</span>
    </div>
  );
  const bigTotal = T === "bold" || T === "twotone";
  const stamp = (data.receipt?.voided ? "VOID" : !isQuote && !isReceipt && data.state ? STATE_STAMP[data.state] : null);
  const stampColor = stamp === "PAID" ? "#1F8A5B" : stamp === "PARTLY PAID" ? "#A35A00" : "#C2304F";
  const stampEl = stamp && (
    <div aria-hidden style={{ alignSelf: "center", transform: "rotate(-12deg)", border: `3px solid ${stampColor}`, color: stampColor, opacity: 0.6, padding: pos ? "2px 8px" : "4px 14px", borderRadius: 8, ...head, fontSize: pos ? 13 : small ? 18 : 24, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{stamp}</div>
  );
  const totals = (
    <div style={{ display: "flex", flexDirection: pos ? "column" : "row", justifyContent: stampEl && !pos ? "space-between" : "flex-end", alignItems: pos ? "center" : "stretch", gap: 12 }}>
      {stampEl && !pos && <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>{stampEl}</div>}
      <div style={{ width: pos ? "100%" : small ? "60%" : "45%" }}>
        {tRow("Subtotal", money(data.subtotal))}
        {data.discount > 0 && tRow("Discount", `− ${money(data.discount)}`)}
        {data.taxAmount > 0 && tRow(`${data.taxLabel || "VAT"}${data.taxPercent ? ` (${data.taxPercent}%)` : ""}`, money(data.taxAmount))}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6,
          padding: bigTotal ? (pos ? "6px 8px" : "10px 14px") : "8px 0",
          background: T === "bold" ? primary : T === "twotone" ? secondary : T === "botanical" ? tint(primary, 0.85) : "transparent",
          color: T === "bold" ? secondary : T === "twotone" ? readableOn(secondary) : ink,
          borderTop: T === "minimal" ? `1.5px solid ${ink}` : "none",
          paddingLeft: T === "botanical" ? 12 : undefined, paddingRight: T === "botanical" ? 12 : undefined,
          borderRadius: T === "botanical" ? 8 : 0,
        }}>
          <span style={{ ...head, fontSize: fs + 1 }}>Total</span>
          <span style={{ ...head, fontSize: pos ? fs + 3 : fs + 7, fontFeatureSettings: "'tnum'" }}>{money(data.total)}</span>
        </div>
        {!isQuote && <>
          {tRow("Paid", money(data.paid), false, "#1F8A5B")}
          {tRow("Due", money(data.due), true, data.due > 0 ? "#C2304F" : "#1F8A5B")}
        </>}
      </div>
      {stampEl && pos && stampEl}
    </div>
  );

  const payments = !isQuote && (data.payments?.length ?? 0) > 0 && box("Payments received", (
    <div style={{ fontSize: fs, borderTop: `1px solid ${line}` }}>
      {data.payments!.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: `1px solid ${line}`, fontFeatureSettings: "'tnum'" }}>
          <span style={{ width: pos ? 70 : 110 }}>{docDate(p.date)}</span>
          <span style={{ flex: 1, color: soft }}>{[p.receiptNumber, methodLabel(p.method)].filter(Boolean).join(" · ")}</span>
          <span style={{ fontWeight: 600 }}>{money(p.amount)}</span>
        </div>
      ))}
    </div>
  ));

  const s = data.studio;
  const payLines = [
    s.bkashNumber && `bKash: ${s.bkashNumber}`,
    s.nagadNumber && `Nagad: ${s.nagadNumber}`,
    s.rocketNumber && `Rocket: ${s.rocketNumber}`,
    s.bankAccountNumber && `${s.bankName ?? "Bank"}${s.bankBranch ? `, ${s.bankBranch}` : ""} — A/C ${s.bankAccountNumber}${s.bankAccountName ? ` (${s.bankAccountName})` : ""}`,
  ].filter(Boolean) as string[];
  const paymentInfo = !isReceipt && payLines.length > 0 && box("How to pay", <div style={{ fontSize: fs, lineHeight: 1.6 }}>{payLines.map((l, i) => <div key={i}>{l}</div>)}</div>);
  const terms = data.terms && box("Terms & conditions", <div style={{ fontSize: fs - 1, color: soft, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{data.terms}</div>);
  const note = data.note && box("Note", <div style={{ fontSize: fs, whiteSpace: "pre-wrap" }}>{data.note}</div>);

  const sig = design.signature;
  const hasSig = sig.imageUrl || sig.name;
  const signature = hasSig && (
    <div style={{ display: "flex", justifyContent: pos ? "center" : "flex-end" }}>
      <div style={{ textAlign: "center", minWidth: pos ? 140 : 190 }}>
        {sig.imageUrl && /^https:\/\//.test(sig.imageUrl) && <img src={sig.imageUrl} alt="" crossOrigin="anonymous" style={{ height: pos ? 40 : 56, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto" }} />}
        {!sig.imageUrl && sig.name && sig.handwritten && <div style={{ fontFamily: `'${HAND_FONT}', cursive`, fontSize: pos ? 24 : 34, color: primary, lineHeight: 1.1 }}>{sig.name}</div>}
        <div style={{ borderTop: `1px solid ${ink}`, marginTop: 4, paddingTop: 4, fontSize: fs - 1 }}>
          <div style={{ fontWeight: 600 }}>{sig.name || s.name}</div>
          {sig.title && <div style={{ color: soft }}>{sig.title}</div>}
        </div>
      </div>
    </div>
  );
  const thanks = design.thanksText && (
    <div style={{ textAlign: "center", ...head, fontSize: fs + 3, color: primary, fontStyle: T === "botanical" || T === "minimal" ? "italic" : "normal" }}>{design.thanksText}</div>
  );
  const footerBits = [s.phone, s.email, s.website].filter(Boolean).join("  ·  ");
  const footer = (footerBits || design.footerText) && (
    <div style={{ textAlign: "center", fontSize: fs - 1.5, color: soft, borderTop: `1px solid ${line}`, paddingTop: 8 }}>
      {design.footerText && <div style={{ marginBottom: 2 }}>{design.footerText}</div>}
      {footerBits}
    </div>
  );

  // Receipt body replaces items + totals.
  const receiptBody = data.receipt && (
    <div style={{ display: "flex", flexDirection: "column", gap: gap * 0.7 }}>
      <div style={{ background: tint(primary, 0.92), border: `1px solid ${tint(primary, 0.75)}`, borderRadius: 10, padding: pos ? 10 : 18, textAlign: "center" }}>
        <div style={{ fontSize: fs - 1, color: soft, textTransform: "uppercase", letterSpacing: "0.12em" }}>Amount received</div>
        <div style={{ ...head, fontSize: pos ? 22 : 34, color: primary, fontFeatureSettings: "'tnum'" }}>{money(data.receipt.amount)}</div>
        <div style={{ fontSize: fs, fontStyle: "italic" }}>{amountInWords(data.receipt.amount, data.currency)}</div>
      </div>
      <div style={{ fontSize: fs, lineHeight: 1.9 }}>
        {[
          ["Paid by", methodLabel(data.receipt.method)],
          data.receipt.trxId ? ["Transaction / Ref", data.receipt.trxId] : null,
          data.receipt.account ? ["Received in", data.receipt.account] : null,
          data.receipt.forText ? ["For", data.receipt.forText] : null,
          ["Total bill", money(data.total)],
          ["Paid so far", money(data.receipt.paidSoFar)],
          ["Still due", money(data.receipt.dueAfter)],
        ].filter(Boolean).map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px dashed ${line}` }}>
            <span style={{ color: soft }}>{r![0]}</span><span style={{ fontWeight: 600, fontFeatureSettings: "'tnum'" }}>{r![1]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const pieces: Record<SectionKey, ReactNode> = {
    client: clientBlock,
    eventDays: isReceipt ? null : eventDays,
    items: isReceipt ? receiptBody : itemsTable,
    totals: isReceipt ? null : totals,
    payments: isReceipt ? null : payments,
    paymentInfo, terms: isReceipt ? null : terms, note, signature, thanks, footer,
  };
  const body = design.sections.filter(x => x.on || (isReceipt && x.key === "items")).map(x => x.key).filter(k => pieces[k]).map(k => <div key={k} style={k === "footer" ? { marginTop: "auto" } : undefined}>{pieces[k]}</div>);
  if (isReceipt && !design.sections.find(x => x.key === "items")) body.unshift(<div key="r">{receiptBody}</div>);

  // ── Template frames ───────────────────────────────────────────────────────
  const P = paper.pad;
  const band = T === "bold" || T === "minimal";
  const headerWrap: CSSProperties = band
    ? { background: T === "bold" ? primary : secondary, color: headText, marginTop: -P, marginLeft: -P, marginRight: -P, paddingTop: P * 0.8, paddingBottom: P * 0.8, paddingLeft: P, paddingRight: P, position: "relative" }
    : { paddingTop: T === "twotone" && !pos ? P * 0.4 : 0, position: "relative" };

  const leaf = (rot: number, posStyle: CSSProperties) => (
    <svg viewBox="0 0 120 120" width={pos ? 60 : small ? 90 : 130} height={pos ? 60 : small ? 90 : 130} style={{ position: "absolute", opacity: 0.22, transform: `rotate(${rot}deg)`, ...posStyle }} aria-hidden>
      <path d="M10 110 C 30 60, 60 30, 112 10" stroke={primary} strokeWidth="2.5" fill="none" />
      {[0.2, 0.38, 0.56, 0.74].map((t, i) => {
        const x = 10 + t * 100, y = 110 - t * 100;
        return <g key={i}>
          <path d={`M${x} ${y} q -18 -4 -24 -22 q 18 2 24 22z`} fill={primary} />
          <path d={`M${x} ${y} q 4 18 22 24 q -2 -18 -22 -24z`} fill={primary} />
        </g>;
      })}
    </svg>
  );

  return (
    <div className={className} style={{
      width: paper.w, minHeight: (isReceipt ? null : paper.h) ?? undefined, background: pageBg, color: ink, position: "relative", overflow: "hidden",
      fontFamily: `'${font.body}', '${BN_FONT}', system-ui, sans-serif`, fontSize: fs, lineHeight: 1.45,
      boxSizing: "border-box", padding: P, display: "flex", flexDirection: "column",
      ...style,
    }}>
      {T === "twotone" && !pos && <>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: primary }} />
        <div style={{ position: "absolute", top: 14, left: 0, width: "38%", height: 6, background: secondary }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 14, background: primary }} />
        <div style={{ position: "absolute", bottom: 14, right: 0, width: "38%", height: 6, background: secondary }} />
      </>}
      {T === "botanical" && <>{leaf(0, { top: -10, right: -10 })}{leaf(180, { bottom: -10, left: -10 })}</>}
      {T === "bold" && !pos && (
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: "38%", textAlign: "center", ...head, fontSize: small ? 220 : 340, color: primary, opacity: 0.035, pointerEvents: "none", lineHeight: 1 }}>
          {(s.name || "S").trim().charAt(0).toUpperCase()}
        </div>
      )}

      <div style={headerWrap}>{header}</div>
      <div style={{ display: "flex", flexDirection: "column", gap, marginTop: gap, position: "relative", flex: 1 }}>
        {body}
      </div>
    </div>
  );
}
