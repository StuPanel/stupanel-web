"use client";

/**
 * Member panel: money I paid from my own pocket for a program (transport, food…).
 * I add it → the studio approves (maybe a different amount, with a reason) or declines →
 * once approved it is part of my bill on that program and the studio owes it to me.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, Edit3, FileImage, Loader2, Plus, ReceiptText, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency, currencySymbol, currencyPad } from "@/lib/format";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { Field, FormDrawer, inputCls } from "@/components/ui/form-kit";
import { Chip, Empty, Section, card, linkBtn, softBtn } from "@/components/ui/profile-page";
import { CLAIM_CATS, CLAIM_STATUS, CatIcon, catLabel, type Claim } from "@/components/team-costs";
import { todayStr } from "@/lib/member-prefs";

/** Shrink a phone photo of a receipt: longest side 1600 px, JPG, kept under ~400 KB. */
async function smallReceipt(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That file isn't a picture we can read")); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let q = 0.82, blob: Blob | null = null;
    do { blob = await new Promise<Blob | null>(ok => c.toBlob(ok, "image/jpeg", q)); q -= 0.1; } while (blob && blob.size > 400 * 1024 && q > 0.35);
    if (!blob) throw new Error("Couldn't prepare the photo");
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

type Form = { id?: string; category: string; amount: string; spentOn: string; note: string; file: File | null; fileUrl?: string; receiptUrl: string | null; dropReceipt: boolean; status?: Claim["status"] };
const empty = (): Form => ({ category: "transport", amount: "", spentOn: todayStr(), note: "", file: null, receiptUrl: null, dropReceipt: false });

/** My costs on one program (with "Add a cost"), or on all programs when `bookingId` is not given. */
export function MyCosts({ bookingId, title = "Costs I paid", canAdd = true, onChanged }: { bookingId?: string; title?: string; canAdd?: boolean; onChanged?: () => void }) {
  const [list, setList] = useState<Claim[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    apiFetch(`${API}/member/claims${bookingId ? `?bookingId=${bookingId}` : ""}`).then(r => (r.ok ? r.json() : null)).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  }, [bookingId]);
  useEffect(() => { load(); }, [load]);
  if (!list) return null;
  if (!bookingId && list.length === 0) return null; // overview: nothing to show

  const open = (c?: Claim) => setForm(c ? { id: c.id, category: c.category, amount: String(c.amount), spentOn: c.spentOn ?? "", note: c.note ?? "", file: null, receiptUrl: c.receiptUrl, dropReceipt: false, status: c.status } : empty());
  const set = (p: Partial<Form>) => setForm(f => (f ? { ...f, ...p } : f));

  async function save() {
    if (!form || !bookingId && !form.id) return;
    const amount = Number(form.amount.replace(/,/g, ""));
    if (!(amount > 0)) { notify("Write the amount you paid", { error: true }); return; }
    if (form.category === "other" && !form.note.trim()) { notify("Write what the money was for", { error: true }); return; }
    setBusy(true);
    try {
      const body = { category: form.category, amount, spentOn: form.spentOn || null, note: form.note.trim() || null, ...(form.id ? {} : { bookingId }) };
      const r = await apiFetch(`${API}/member/claims${form.id ? `/${form.id}` : ""}`, { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d?.message) ? d.message[0] : d?.message || "Couldn't save", { error: true }); return; }
      const id = (d as Claim).id;
      if (form.file) {
        const fd = new FormData();
        fd.append("file", await smallReceipt(form.file), "receipt.jpg");
        const u = await apiFetch(`${API}/member/claims/${id}/receipt`, { method: "POST", body: fd });
        if (!u.ok) notify("Saved, but the receipt photo didn't upload — try adding it again", { error: true });
      } else if (form.dropReceipt && form.receiptUrl) {
        await apiFetch(`${API}/member/claims/${id}/receipt`, { method: "DELETE" });
      }
      notify(form.id ? (form.status === "rejected" ? "Sent again to the studio" : "Saved") : "Sent to the studio");
      setForm(null); load(); onChanged?.();
    } catch (e) {
      notify(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Couldn't save — check your internet", { error: true });
    } finally { setBusy(false); }
  }
  async function remove(c: Claim) {
    if (!(await askConfirm({ title: "Delete this cost?", message: `${catLabel(c.category)} · ${formatCurrency(c.amount)} — the studio will not see it any more.`, confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/member/claims/${c.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't delete", { error: true }); return; }
    load(); onChanged?.();
  }

  const waiting = list.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const approved = list.filter(c => c.status === "approved").reduce((s, c) => s + (c.approvedAmount ?? c.amount), 0);
  const preview = form?.fileUrl ?? (form && !form.dropReceipt ? form.receiptUrl : null);

  return (
    <Section title={title} action={bookingId && canAdd && list.length > 0 ? <button type="button" onClick={() => open()} className={linkBtn}><Plus className="w-3.5 h-3.5" />Add a cost</button> : undefined}>
      {list.length === 0 ? (
        <Empty icon={ReceiptText} title="Paid something for this program?" text="Transport, food, rented gear… Add it here. When the studio approves, it is added to what is due to you.">
          {canAdd && <button type="button" onClick={() => open()} className={softBtn}><Plus className="w-4 h-4" />Add a cost</button>}
        </Empty>
      ) : (
        <>
          <div className="space-y-2.5">
            {list.map(c => {
              const st = CLAIM_STATUS[c.status];
              const editable = c.status !== "approved";
              return (
                <div key={c.id} className={cn(card, "p-4")}>
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-[12px] bg-[#F5F3FA] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><CatIcon v={c.category} className="w-[18px] h-[18px]" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-semibold text-[#17151F] truncate">{catLabel(c.category)}{c.note ? ` · ${c.note}` : ""}</p>
                      <p className="text-[12.5px] text-[#6B6680] truncate">
                        {c.spentOn ? fmtDate(c.spentOn) : `Added ${fmtDate(c.createdAt)}`}
                        {!bookingId && c.program ? <> · <Link href={`/member/programs/${c.program.id}?tab=pay`} className="font-semibold text-[#5B3FD0] hover:underline">{c.program.eventName || c.program.bookingNumber}</Link></> : null}
                        {c.receiptUrl ? " · receipt added" : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[15.5px] font-extrabold text-[#17151F] tabular-nums">{formatCurrency(c.approvedAmount ?? c.amount)}</p>
                      {c.approvedAmount != null && c.approvedAmount !== c.amount && <p className="text-[11.5px] text-[#8A8599] line-through tabular-nums">{formatCurrency(c.amount)}</p>}
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </div>
                  </div>
                  {c.reviewNote && <p className={cn("mt-2 rounded-[12px] px-3 py-2 text-[13px]", c.status === "rejected" ? "bg-[#FDECEF] text-[#9C2340]" : "bg-[#F7F5FB] text-[#4A4658]")}>Studio: {c.reviewNote}</p>}
                  {editable && (
                    <div className="flex gap-4 mt-2.5">
                      <button type="button" onClick={() => open(c)} className={linkBtn}><Edit3 className="w-3.5 h-3.5" />{c.status === "rejected" ? "Fix and send again" : "Change"}</button>
                      <button type="button" onClick={() => remove(c)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#C2304F] hover:text-[#9C2340]"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {(waiting > 0 || approved > 0) && (
            <p className="px-1 mt-2 text-[12.5px] text-[#6B6680]">
              {[approved > 0 ? `Approved ${formatCurrency(approved)} — added to your bill` : "", waiting > 0 ? `waiting ${formatCurrency(waiting)}` : ""].filter(Boolean).join(" · ")}
            </p>
          )}
        </>
      )}

      <FormDrawer open={!!form} onClose={() => { if (!busy) setForm(null); }} icon={ReceiptText} color="violet"
        title={form?.id ? (form.status === "rejected" ? "Fix and send again" : "Change cost") : "Add a cost"} sub="Money you paid for this program"
        footer={<>
          <button type="button" onClick={() => setForm(null)} disabled={busy} className="h-12 px-6 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[15px] font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={busy} className="flex-1 h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-50 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}{form?.id && form.status !== "rejected" ? "Save" : "Send to studio"}
          </button>
        </>}>
        {form && (
          <>
            <div className={cn(card, "p-4 mb-4")}>
              <p className="text-[13px] font-bold text-[#4A4658] mb-2">What for?</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What for">
                {CLAIM_CATS.map(cat => { const on = form.category === cat.v; const I = cat.icon; return (
                  <button key={cat.v} type="button" role="radio" aria-checked={on} onClick={() => set({ category: cat.v })}
                    className={cn("h-10 px-3.5 rounded-full text-[13.5px] font-semibold inline-flex items-center gap-1.5", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
                    {on ? <Check className="w-3.5 h-3.5" /> : <I className="w-3.5 h-3.5" />}{cat.l}
                  </button>
                ); })}
              </div>
            </div>
            <div className={cn(card, "divide-y divide-[#EEEBF4] mb-4")}>
              <div className="grid grid-cols-2">
                <Field label="Amount" required>{id => (
                  <span className="relative block">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{currencySymbol().trim()}</span>
                    <input id={id} inputMode="decimal" value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder="500" style={{ paddingLeft: currencyPad() }} className={cn(inputCls, "tabular-nums")} />
                  </span>
                )}</Field>
                <Field label="Date">{id => <input id={id} type="date" max={todayStr()} value={form.spentOn} onChange={e => set({ spentOn: e.target.value })} className={inputCls} />}</Field>
              </div>
              <Field label={form.category === "other" ? "What was it for?" : "Note (optional)"} required={form.category === "other"} hint="e.g. CNG Feni → Dhaka and back">
                {id => <input id={id} value={form.note} maxLength={300} onChange={e => set({ note: e.target.value })} className={inputCls} />}
              </Field>
            </div>
            <div className={cn(card, "p-4")}>
              <p className="text-[13px] font-bold text-[#4A4658] mb-2">Receipt photo <span className="font-normal text-[#8A8599]">(optional)</span></p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (fileRef.current) fileRef.current.value = ""; if (f) set({ file: f, fileUrl: URL.createObjectURL(f), dropReceipt: false }); }} />
              {preview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Receipt" className="w-16 h-16 rounded-[12px] object-cover bg-[#F5F3FA]" />
                  <button type="button" onClick={() => fileRef.current?.click()} className={linkBtn}><Camera className="w-3.5 h-3.5" />Change</button>
                  <button type="button" onClick={() => set({ file: null, fileUrl: undefined, dropReceipt: true })} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#C2304F]"><Trash2 className="w-3.5 h-3.5" />Remove</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className={softBtn}><FileImage className="w-4 h-4" />Add a photo</button>
              )}
              <p className="text-[12px] text-[#6B6680] mt-2">Helps the studio approve faster. It is made small before upload.</p>
            </div>
            <p className="px-1 mt-3 text-xs text-[#6B6680] leading-relaxed">The studio checks it. When approved, it is added to your bill on this program and it is due to you. You can change or delete it until then.</p>
          </>
        )}
      </FormDrawer>
    </Section>
  );
}
