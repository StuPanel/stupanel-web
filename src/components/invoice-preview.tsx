"use client";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface InvoiceCompany {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  primaryColor?: string;
  invoiceHeaderStyle?: string;   // "dark" | "brand" | "light"
  invoiceShowPayment?: boolean;
  invoiceShowLogo?: boolean;
  invoiceShowSignature?: boolean;
  invoiceSignatureText?: string;
  invoiceFooter?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bkashNumber?: string;
  nagadNumber?: string;
}

export interface InvoicePreviewItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePreviewData {
  company: InvoiceCompany;
  invoiceNumber: string;
  status?: string;
  issueDate: string;
  dueDate?: string;
  currency?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  bookingName?: string;
  bookingRef?: string;
  bookingDate?: string;
  items: InvoicePreviewItem[];
  subtotal: number;
  discountAmount?: number;
  taxLabel?: string;
  taxPercent?: number;
  taxAmount?: number;
  grandTotal: number;
  paidAmount?: number;
  balanceDue?: number;
  notes?: string;
  termsConditions?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2,'0')} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

function sym(cur = "BDT"): string {
  const map: Record<string,string> = { BDT:"৳", USD:"$", EUR:"€", GBP:"£", INR:"₹", AED:"AED " };
  return map[cur] ?? (cur + " ");
}

function money(n: number, s: string): string {
  return `${s}${Number(n).toLocaleString()}`;
}

const STATUS_LABEL: Record<string,string> = {
  draft:"Draft", sent:"Sent", viewed:"Viewed",
  paid:"PAID", partially_paid:"Part. Paid", overdue:"OVERDUE", void:"VOID",
};

// ─── Component ────────────────────────────────────────────────────────────────
export function InvoicePreview({ data }: { data: InvoicePreviewData }) {
  const {
    company, invoiceNumber, status, issueDate, dueDate, currency = "BDT",
    clientName, clientPhone, clientEmail,
    bookingName, bookingRef, bookingDate,
    items, subtotal, discountAmount = 0, taxLabel = "VAT",
    taxPercent = 0, taxAmount = 0, grandTotal,
    paidAmount = 0, balanceDue = 0, notes, termsConditions,
  } = data;

  const s = sym(currency);
  const accent = company.primaryColor || "#4F46E5";
  const style  = company.invoiceHeaderStyle || "dark";

  const headerBg   = style === "brand" ? accent : style === "light" ? "#F8FAFC" : "#0F172A";
  const headerText = style === "light" ? "#0F172A" : "#FFFFFF";
  const subText    = style === "light" ? "#475569" : "rgba(255,255,255,0.65)";
  const bodyBg     = "#FFFFFF";

  const showPayment   = company.invoiceShowPayment   !== false;
  const showLogo      = company.invoiceShowLogo      !== false;
  const showSignature = company.invoiceShowSignature !== false;
  const sigText       = company.invoiceSignatureText || "Thank you for your business!";
  const hasBank       = showPayment && !!(company.bankName || company.bkashNumber || company.nagadNumber);

  const statusLabel = status ? (STATUS_LABEL[status] ?? status) : "";
  const isPaid      = status === "paid";

  // Cell style helpers (inline because this prints)
  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: "9px 14px", verticalAlign: "top", ...extra,
  });

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", backgroundColor: bodyBg, width: "100%" }}>
      {/* Dancing Script for signature */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');`}</style>

      {/* ── HEADER ── */}
      <div style={{ backgroundColor: headerBg, padding: "28px 36px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        {/* Left: logo + company */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {showLogo && company.logoUrl ? (
            <img src={company.logoUrl} alt="logo"
              style={{ width: 52, height: 52, objectFit: "contain", borderRadius: 10, padding: 4,
                backgroundColor: style === "light" ? "#E2E8F0" : "rgba(255,255,255,0.15)" }} />
          ) : (
            <div style={{ width: 46, height: 46, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: style === "light" ? "#E2E8F0" : "rgba(255,255,255,0.2)" }}>
              <span style={{ color: style === "light" ? accent : "#fff", fontSize: 20, fontWeight: 900 }}>
                {company.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p style={{ margin: 0, color: headerText, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{company.name}</p>
            {company.address && <p style={{ margin: "3px 0 0", color: subText, fontSize: 11 }}>{company.address}{company.city ? `, ${company.city}` : ""}</p>}
            {company.phone  && <p style={{ margin: "2px 0 0", color: subText, fontSize: 11 }}>{company.phone}</p>}
            {company.email  && <p style={{ margin: "1px 0 0", color: subText, fontSize: 11 }}>{company.email}</p>}
          </div>
        </div>

        {/* Right: INVOICE title */}
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, color: headerText, fontSize: 30, fontWeight: 900, letterSpacing: 5, textTransform: "uppercase" }}>Invoice</p>
          <p style={{ margin: "6px 0 0", color: subText, fontSize: 12, fontFamily: "monospace", letterSpacing: 1 }}>{invoiceNumber}</p>
          {statusLabel && (
            <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 99,
              fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              backgroundColor: isPaid ? "#10B981" : "rgba(255,255,255,0.18)", color: "#fff" }}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── ACCENT STRIP ── */}
      <div style={{ height: 3, backgroundColor: accent }} />

      {/* ── INVOICE META ── */}
      <div style={{ backgroundColor: accent + "0D", padding: "10px 36px", display: "flex", justifyContent: "flex-end", gap: 28, borderBottom: "1px solid #F1F5F9" }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Invoice No</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#1E293B", fontFamily: "monospace" }}>{invoiceNumber}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Issue Date</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#1E293B" }}>{fmt(issueDate)}</p>
        </div>
        {dueDate && (
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Due Date</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#EF4444" }}>{fmt(dueDate)}</p>
          </div>
        )}
      </div>

      {/* ── BILL TO + BOOKING ── */}
      <div style={{ padding: "20px 36px", display: "grid", gridTemplateColumns: bookingName ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Bill To</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{clientName || "—"}</p>
          {clientPhone && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>📞 {clientPhone}</p>}
          {clientEmail && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>✉ {clientEmail}</p>}
        </div>
        {bookingName && (
          <div style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Program / Event</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{bookingName}</p>
            {bookingRef  && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>{bookingRef}</p>}
            {bookingDate && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>📅 {fmt(bookingDate)}</p>}
          </div>
        )}
      </div>

      {/* ── ITEMS TABLE ── */}
      <div style={{ padding: "0 36px 20px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: headerBg }}>
              <th style={{ ...cell({ width: 36, textAlign: "left",   color: headerText, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }) }}>No.</th>
              <th style={{ ...cell({ textAlign: "left",              color: headerText, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }) }}>Description</th>
              <th style={{ ...cell({ width: 44, textAlign: "center", color: headerText, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }) }}>Qty</th>
              <th style={{ ...cell({ width: 100, textAlign: "right", color: headerText, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }) }}>Unit Price</th>
              <th style={{ ...cell({ width: 100, textAlign: "right", color: headerText, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }) }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(items.length ? items : [{ name: "—", quantity: 1, unitPrice: 0, total: 0 }]).map((item, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ ...cell({ color: "#CBD5E1", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }) }}>
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td style={cell()}>
                  <p style={{ margin: 0, fontWeight: 600, color: "#1E293B" }}>{item.name}</p>
                  {item.description && <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94A3B8" }}>{item.description}</p>}
                </td>
                <td style={{ ...cell({ textAlign: "center", color: "#475569" }) }}>{item.quantity}</td>
                <td style={{ ...cell({ textAlign: "right", color: "#475569", fontFamily: "monospace" }) }}>{money(Number(item.unitPrice), s)}</td>
                <td style={{ ...cell({ textAlign: "right", fontWeight: 700, color: "#1E293B", fontFamily: "monospace" }) }}>{money(Number(item.total), s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PAYMENT INFO + TOTALS ── */}
      <div style={{ padding: "0 36px 24px", display: "grid", gridTemplateColumns: hasBank ? "1fr auto" : "1fr auto", gap: 24, alignItems: "start" }}>
        {/* Payment info */}
        <div>
          {hasBank && (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Payment Information</p>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.9 }}>
                {company.bankName && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#1E293B" }}>Bank Transfer</p>
                    <p style={{ margin: 0 }}>{company.bankName}{company.bankBranch ? ` · ${company.bankBranch}` : ""}</p>
                    {company.bankAccountName   && <p style={{ margin: 0 }}>Account: {company.bankAccountName}</p>}
                    {company.bankAccountNumber && <p style={{ margin: 0, fontFamily: "monospace" }}>No: {company.bankAccountNumber}</p>}
                  </div>
                )}
                {(company.bkashNumber || company.nagadNumber) && (
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#1E293B" }}>Mobile Banking</p>
                    {company.bkashNumber && <p style={{ margin: 0 }}><span style={{ color: "#EC4899", fontWeight: 600 }}>bKash: </span>{company.bkashNumber}</p>}
                    {company.nagadNumber && <p style={{ margin: 0 }}><span style={{ color: "#F97316", fontWeight: 600 }}>Nagad: </span>{company.nagadNumber}</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Totals block */}
        <div style={{ minWidth: 220, borderRadius: 10, overflow: "hidden", border: "1px solid #F1F5F9" }}>
          <div style={{ padding: "9px 16px", display: "flex", justifyContent: "space-between", gap: 24, fontSize: 12, color: "#64748B", borderBottom: "1px solid #F1F5F9", backgroundColor: "#F8FAFC" }}>
            <span>Subtotal</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{money(Number(subtotal), s)}</span>
          </div>
          {Number(discountAmount) > 0 && (
            <div style={{ padding: "9px 16px", display: "flex", justifyContent: "space-between", gap: 24, fontSize: 12, color: "#10B981", borderBottom: "1px solid #F1F5F9", backgroundColor: "#F8FAFC" }}>
              <span>Discount</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>−{money(Number(discountAmount), s)}</span>
            </div>
          )}
          {Number(taxAmount) > 0 && (
            <div style={{ padding: "9px 16px", display: "flex", justifyContent: "space-between", gap: 24, fontSize: 12, color: "#64748B", borderBottom: "1px solid #F1F5F9", backgroundColor: "#F8FAFC" }}>
              <span>{taxLabel} ({taxPercent}%)</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>+{money(Number(taxAmount), s)}</span>
            </div>
          )}
          {/* Grand Total row */}
          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", gap: 24, fontSize: 14, fontWeight: 900, backgroundColor: headerBg, color: headerText }}>
            <span>TOTAL</span>
            <span style={{ fontFamily: "monospace" }}>{money(Number(grandTotal), s)}</span>
          </div>
          {Number(paidAmount) > 0 && (
            <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", gap: 24, fontSize: 12, color: "#10B981", borderTop: "1px solid #D1FAE5" }}>
              <span>Paid</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>−{money(Number(paidAmount), s)}</span>
            </div>
          )}
          {Number(balanceDue) > 0 && (
            <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", gap: 24, fontSize: 12, color: "#EF4444", fontWeight: 700, borderTop: "1px solid #FEE2E2" }}>
              <span>Balance Due</span>
              <span style={{ fontFamily: "monospace" }}>{money(Number(balanceDue), s)}</span>
            </div>
          )}
          {isPaid && (
            <div style={{ padding: "8px 16px", textAlign: "center", color: "#10B981", fontSize: 12, fontWeight: 700, borderTop: "1px solid #D1FAE5" }}>
              ✓ Fully Paid
            </div>
          )}
        </div>
      </div>

      {/* ── NOTES ── */}
      {notes && (
        <div style={{ padding: "0 36px 16px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Notes</p>
          <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.7, whiteSpace: "pre-line" }}>{notes}</p>
        </div>
      )}

      {/* ── TERMS ── */}
      {termsConditions && (
        <div style={{ padding: "0 36px 16px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Terms & Conditions</p>
          <p style={{ margin: 0, fontSize: 10, color: "#94A3B8", lineHeight: 1.7, whiteSpace: "pre-line" }}>{termsConditions}</p>
        </div>
      )}

      {/* ── THANK YOU SIGNATURE ── */}
      {showSignature && (
        <div style={{ padding: "20px 36px 24px", textAlign: "center", borderTop: "1px solid #F1F5F9", marginTop: 4 }}>
          <p style={{ margin: 0, fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontSize: 38, color: "#1E293B", fontWeight: 700, lineHeight: 1.2 }}>
            {sigText}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 9, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>
            {company.name}
          </p>
        </div>
      )}

      {/* ── FOOTER BAR ── */}
      {(company.phone || company.email || company.invoiceFooter) && (
        <div style={{ backgroundColor: headerBg, padding: "14px 36px", display: "flex", justifyContent: "center", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
          {company.phone && (
            <span style={{ color: headerText, opacity: 0.7, fontSize: 11 }}>📞 {company.phone}</span>
          )}
          {company.email && (
            <span style={{ color: headerText, opacity: 0.7, fontSize: 11 }}>✉ {company.email}</span>
          )}
          {company.invoiceFooter && (
            <span style={{ color: headerText, opacity: 0.7, fontSize: 11 }}>• {company.invoiceFooter}</span>
          )}
        </div>
      )}
    </div>
  );
}
