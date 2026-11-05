"use client";

/** A client's account statement, in the studio's invoice colours and fonts. */
import { BN_FONT, FONTS, PAPER, colorsOf, type InvoiceDesign } from "./design";
import { docDate, type DocStudio } from "./invoice-document";

export interface StatementData {
  studio: DocStudio;
  client: { firstName: string; lastName?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  from: string | null; to: string | null;
  opening: number; closing: number;
  totals: { billed: number; paid: number };
  rows: { date: string; kind: "invoice" | "payment"; ref: string; text: string; debit: number; credit: number; balance: number }[];
  currency: string;
}

const SYM: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€", GBP: "£", INR: "₹" };

export function StatementDocument({ data, design }: { data: StatementData; design: InvoiceDesign }) {
  const paper = PAPER[design.paper === "pos80" ? "a4" : design.paper];
  const { primary } = colorsOf(design);
  const font = FONTS.find(f => f.id === design.font) ?? FONTS[0];
  const head = { fontFamily: `'${font.head}', '${BN_FONT}', sans-serif`, fontWeight: font.headWeight };
  const money = (n: number) => `${SYM[data.currency] ?? ""}${Math.round(n).toLocaleString("en-IN")}`;
  const ink = "#1D1B24", soft = "#6B6680", line = "#E6E2EE";
  const fs = design.paper === "a5" ? 10.5 : 12;
  const name = `${data.client.firstName} ${data.client.lastName ?? ""}`.trim();
  const period = data.from || data.to ? `${data.from ? docDate(data.from) : "Start"} – ${data.to ? docDate(data.to) : "Today"}` : "All time";
  const th: React.CSSProperties = { padding: "8px 8px", fontSize: fs - 1.5, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left", background: primary, color: "#fff" };
  const td: React.CSSProperties = { padding: "7px 8px", fontSize: fs, borderBottom: `1px solid ${line}`, fontFeatureSettings: "'tnum'" };
  const logo = data.studio.logoUrl && /^https:\/\//.test(data.studio.logoUrl) ? data.studio.logoUrl : null;

  return (
    <div style={{ width: paper.w, minHeight: paper.h ?? undefined, padding: paper.pad, boxSizing: "border-box", background: "#fff", color: ink, fontFamily: `'${font.body}', '${BN_FONT}', system-ui, sans-serif`, fontSize: fs }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, borderBottom: `3px solid ${primary}`, paddingBottom: 16 }}>
        <div>
          {logo && <img src={logo} alt="" crossOrigin="anonymous" style={{ height: Math.min(design.logo.size, 64), objectFit: "contain", display: "block", marginBottom: 6 }} />}
          <div style={{ ...head, fontSize: 17 }}>{data.studio.name}</div>
          <div style={{ color: soft, fontSize: fs - 1 }}>{[data.studio.phone, data.studio.email].filter(Boolean).join(" · ")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...head, fontSize: 24, color: primary, letterSpacing: "0.04em" }}>STATEMENT</div>
          <div style={{ color: soft }}>{period}</div>
          <div style={{ color: soft }}>Made on {docDate(new Date().toISOString())}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, margin: "18px 0" }}>
        <div>
          <div style={{ fontSize: fs - 2, letterSpacing: "0.12em", textTransform: "uppercase", color: primary, fontWeight: 700 }}>Client</div>
          <div style={{ ...head, fontWeight: 700, fontSize: fs + 2 }}>{name}</div>
          {data.client.phone && <div>{data.client.phone}</div>}
          {data.client.email && <div>{data.client.email}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 16px", alignContent: "start", fontFeatureSettings: "'tnum'" }}>
          <span style={{ color: soft }}>Opening balance</span><b style={{ textAlign: "right" }}>{money(data.opening)}</b>
          <span style={{ color: soft }}>Billed</span><b style={{ textAlign: "right" }}>{money(data.totals.billed)}</b>
          <span style={{ color: soft }}>Paid</span><b style={{ textAlign: "right", color: "#1F8A5B" }}>{money(data.totals.paid)}</b>
          <span style={{ ...head, fontSize: fs + 1 }}>Balance due</span><b style={{ textAlign: "right", fontSize: fs + 2, color: data.closing > 0 ? "#C2304F" : "#1F8A5B" }}>{money(data.closing)}</b>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 92 }}>Date</th>
            <th style={th}>Details</th>
            <th style={{ ...th, width: 86 }}>Ref.</th>
            <th style={{ ...th, textAlign: "right", width: 92 }}>Billed</th>
            <th style={{ ...th, textAlign: "right", width: 92 }}>Paid</th>
            <th style={{ ...th, textAlign: "right", width: 100 }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {(data.from) && (
            <tr><td style={td}>{docDate(data.from)}</td><td style={{ ...td, color: soft }} colSpan={4}>Opening balance</td><td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(data.opening)}</td></tr>
          )}
          {data.rows.map((r, i) => (
            <tr key={i}>
              <td style={td}>{docDate(r.date)}</td>
              <td style={td}>{r.text}</td>
              <td style={{ ...td, color: soft }}>{r.ref}</td>
              <td style={{ ...td, textAlign: "right" }}>{r.debit ? money(r.debit) : ""}</td>
              <td style={{ ...td, textAlign: "right", color: "#1F8A5B" }}>{r.credit ? money(r.credit) : ""}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(r.balance)}</td>
            </tr>
          ))}
          {data.rows.length === 0 && <tr><td style={{ ...td, color: soft, textAlign: "center" }} colSpan={6}>Nothing in this period.</td></tr>}
        </tbody>
      </table>

      {design.thanksText && <div style={{ textAlign: "center", marginTop: 28, ...head, color: primary, fontSize: fs + 2 }}>{design.thanksText}</div>}
    </div>
  );
}
