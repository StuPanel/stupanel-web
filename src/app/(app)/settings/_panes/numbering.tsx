"use client";

/**
 * Settings → Numbering: the code in front of each kind of document and where its numbers
 * start. A program's invoice always has the program's number (PRG-1007 → INV-1007).
 * Numbers already given out never change; a lower starting number can't take the counter back.
 */
import { useCallback, useEffect, useState } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { Group, NumberField, Row, TextField, useSettings } from "../_ui";

type Kind = "program" | "quote" | "receipt" | "agreement";
type Preview = {
  numbering: Record<Kind, { prefix: string; start: number }>;
  invoicePrefix: string;
  next: Record<Kind | "invoice", string>;
  counters: { job: number; quote: number; receipt: number; agreement: number };
};
const DEFAULTS: Record<Kind, string> = { program: "PRG", quote: "QT", receipt: "RCT", agreement: "AGR" };
const clean = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "").replace(/-+$/, "");

export function NumberingPane() {
  const { data, patch, studio, patchStudio } = useSettings();
  const [p, setP] = useState<Preview | null>(null);
  const load = useCallback(() => {
    apiFetch(`${API}/numbering`).then(r => (r.ok ? r.json() : null)).then(setP).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const rules = studio?.numbering ?? p?.numbering;
  async function set(kind: Kind, change: { prefix?: string; start?: number }) {
    if (!rules) return;
    const ok = await patchStudio("numbering", { ...rules, [kind]: { ...rules[kind], ...change } });
    if (ok) load();
  }
  async function setInvoiceCode(v: string) {
    if (await patch({ invoicePrefix: clean(v) || "INV" })) load();
  }

  const next = (k: Kind | "invoice") => <span className="font-semibold text-[#17151F] tabular-nums">{p?.next[k] ?? "…"}</span>;
  const counter = (k: Kind) => (p ? (k === "program" ? p.counters.job : p.counters[k]) : null);
  const codeRow = (k: Kind, label: string, hint: string) => (
    <Row id={`num-${k}`} label={`${label} code`} hint={<>{hint} Next: {next(k)}</>}>
      <TextField label={`${label} code`} value={rules?.[k].prefix ?? DEFAULTS[k]} maxLength={12} mono align="right"
        onCommit={v => set(k, { prefix: clean(v) || DEFAULTS[k] })} />
    </Row>
  );
  const startRow = (k: Kind, label: string) => (
    <Row id={`num-${k}-start`} label="Start from"
      hint={counter(k) !== null && rules && counter(k)! > rules[k].start ? `Already at ${counter(k)} — a smaller number is not used` : "The first number for new ones"}>
      <NumberField label={`${label} starting number`} value={rules?.[k].start ?? 1001} min={1} max={99999999} onCommit={v => set(k, { start: v })} />
    </Row>
  );

  return (
    <>
      <Group title="Programs and invoices"
        note={<>A program&apos;s invoice has the same number: {next("program")} → {next("invoice")}. An invoice made by hand takes the next number.</>}>
        {codeRow("program", "Program", "Letters before the number.")}
        <Row id="invoicePrefix" label="Invoice code" hint={<>Next: {next("invoice")}</>}>
          <TextField label="Invoice code" value={data.invoicePrefix ?? "INV"} maxLength={12} mono align="right" onCommit={setInvoiceCode} />
        </Row>
        {startRow("program", "Program")}
      </Group>
      <Group title="Quotations">
        {codeRow("quote", "Quote", "")}
        {startRow("quote", "Quote")}
      </Group>
      <Group title="Money receipts">
        {codeRow("receipt", "Receipt", "")}
        {startRow("receipt", "Receipt")}
      </Group>
      <Group title="Agreements" note="Numbers already given out never change. Codes can use letters, numbers and -.">
        {codeRow("agreement", "Agreement", "")}
        {startRow("agreement", "Agreement")}
      </Group>
    </>
  );
}
