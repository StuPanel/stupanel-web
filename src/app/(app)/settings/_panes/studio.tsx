"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Loader2, Plus, Trash2, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";
import { StudioLogo } from "@/components/studio-logo";
import { BRAND, safeLogo } from "@/lib/brand";
import { Group, Row, Select, TextArea, TextField, useSettings, useSynced } from "../_ui";

const CURRENCIES = [
  { value: "BDT", label: "৳ BDT — Taka" },
  { value: "USD", label: "$ USD — US Dollar" },
  { value: "INR", label: "₹ INR — Indian Rupee" },
  { value: "GBP", label: "£ GBP — British Pound" },
  { value: "EUR", label: "€ EUR — Euro" },
  { value: "AED", label: "AED — UAE Dirham" },
];

const TIMEZONES = [
  { value: "Asia/Dhaka", label: "Dhaka (GMT+6)" },
  { value: "Asia/Kolkata", label: "Kolkata (GMT+5:30)" },
  { value: "Asia/Karachi", label: "Karachi (GMT+5)" },
  { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
  { value: "Europe/London", label: "London (GMT+0)" },
  { value: "America/New_York", label: "New York (GMT−5)" },
];

// ─── General ──────────────────────────────────────────────────────────────────
export function GeneralPane() {
  const { data, patch } = useSettings();
  const save = (k: string) => async (v: string) => {
    if (k === "name" && !v) { notify("Studio name can't be empty", { error: true }); return; }
    const ok = await patch({ [k]: v });
    if (ok && k === "name") window.dispatchEvent(new CustomEvent("branding-updated", { detail: { companyName: v } }));
  };
  return (
    <>
      <Group title="Studio">
        <Row id="name" label="Studio name"><TextField label="Studio name" value={data.name ?? ""} onCommit={save("name")} placeholder="My Photography Studio" /></Row>
        <Row id="phone" label="Phone" hint="Clients use this to call or WhatsApp you"><TextField label="Phone" type="tel" value={data.phone ?? ""} onCommit={save("phone")} placeholder="01XXXXXXXXX" /></Row>
        <Row id="website" label="Website"><TextField label="Website" type="url" value={data.website ?? ""} onCommit={save("website")} placeholder="https://yourstudio.com" /></Row>
      </Group>

      <Group title="Location">
        <Row id="address" label="Address" stack><TextArea label="Address" rows={2} value={data.address ?? ""} onCommit={save("address")} placeholder="House, road, area…" /></Row>
        <Row id="city" label="City"><TextField label="City" value={data.city ?? ""} onCommit={save("city")} placeholder="Dhaka" /></Row>
        <Row id="state" label="State / Division" hint="Optional"><TextField label="State or division" value={data.state ?? ""} onCommit={save("state")} placeholder="Dhaka Division" /></Row>
        <Row id="country" label="Country"><TextField label="Country" value={data.country ?? ""} onCommit={save("country")} placeholder="Bangladesh" /></Row>
      </Group>

      <Group title="Region" note="Currency is used on new quotes, invoices and reports. Old documents keep their currency.">
        <Row id="currency" label="Currency"><Select label="Currency" value={data.currency ?? "BDT"} options={CURRENCIES} onChange={v => patch({ currency: v })} /></Row>
        <Row id="timezone" label="Time zone" hint="Used for dates, reminders and reports"><Select label="Time zone" value={data.timezone ?? "Asia/Dhaka"} options={TIMEZONES} onChange={v => patch({ timezone: v })} /></Row>
      </Group>
    </>
  );
}

// ─── Branding ─────────────────────────────────────────────────────────────────
// Upload-only logo that saves right away. Every studio uses the one StuPanel colour.
export function BrandingPane() {
  const { data, patch } = useSettings();
  const [logoUrl, setLogoUrl] = useState<string>(safeLogo(data.logoUrl) ?? "");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { notify("Please choose a JPG, PNG or WebP image", { error: true }); return; }
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) setCropSrc(ev.target.result as string); };
    reader.readAsDataURL(file);
  }

  async function setLogo(url: string | null) {
    const ok = await patch({ logoUrl: url ?? "" });
    if (!ok) return false;
    setLogoUrl(url ?? "");
    window.dispatchEvent(new CustomEvent("branding-updated", { detail: { logoUrl: url } }));
    return true;
  }

  async function onCropSave(blob: Blob) {
    setCropSrc(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", blob, "logo.jpg");
      const res = await apiFetch(`${API}/companies/logo`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Upload failed");
      const { url } = await res.json();
      await setLogo(url);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Upload failed", { error: true });
    } finally { setBusy(false); }
  }

  async function onRemove() {
    if (!(await askConfirm({ title: "Remove logo?", message: "Your studio's first letter will be shown instead.", confirmLabel: "Remove", danger: true }))) return;
    setBusy(true);
    try { await setLogo(null); } finally { setBusy(false); }
  }

  const name = data.name || "Studio Name";

  return (
    <>
      {cropSrc && <LogoCropModal src={cropSrc} onSave={onCropSave} onClose={() => setCropSrc(null)} />}
      <Group title="Logo" note="JPG, PNG or WebP. A square logo looks best. It saves as soon as you upload it.">
        <div id="set-logo" className="sp-set-row px-4 sm:px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4 scroll-mt-28">
          <div className="relative w-fit">
            <StudioLogo url={logoUrl} name={data.name} size={84} className="rounded-[22px]" />
            {busy && (
              <div className="absolute inset-0 rounded-[22px] bg-white/80 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#17151F]">Studio logo</p>
            <p className="text-xs text-[#6B6680] mt-0.5">Shown on quotes, invoices, emails, the client portal and the app.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2">
                <Upload className="w-4 h-4" />{logoUrl ? "Change logo" : "Upload logo"}
              </button>
              {logoUrl && (
                <button type="button" disabled={busy} onClick={onRemove}
                  className="h-10 px-4 rounded-full bg-[#FDECEF] hover:opacity-90 text-[#C2304F] text-sm font-semibold inline-flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Group>

      <Group title="Where your logo appears">
        <div id="set-logo-preview" className="sp-set-row p-4 sm:p-5 grid gap-3 scroll-mt-28">
          <Preview label="Invoice & quote">
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <StudioLogo url={logoUrl} name={data.name} size={44} />
                <div className="min-w-0">
                  <p className="font-extrabold text-[#17151F] text-sm truncate">{name}</p>
                  <p className="text-xs text-[#6B6680]">{data.city || "Dhaka"} · {data.country || "Bangladesh"}</p>
                </div>
              </div>
              <p className="font-extrabold text-sm" style={{ color: BRAND }}>INVOICE</p>
            </div>
          </Preview>
          <Preview label="Client portal">
            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: BRAND }}>
              <StudioLogo url={logoUrl} name={data.name} size={38} tone="onDark" />
              <div><p className="font-bold text-white text-sm">{name}</p><p className="text-xs text-white/75">Client Portal</p></div>
            </div>
          </Preview>
          <Preview label="App sidebar">
            <div className="flex items-center gap-3 p-3 bg-[#F5F3FA]">
              <StudioLogo url={logoUrl} name={data.name} size={38} />
              <div className="min-w-0"><p className="text-sm font-semibold text-[#17151F] truncate">{name}</p><p className="text-xs text-[#6B6680]">Studio workspace</p></div>
            </div>
          </Preview>
        </div>
      </Group>
    </>
  );
}

function Preview({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#6B6680] mb-1.5">{label}</p>
      <div className="rounded-[16px] border border-[#E3DFEC] overflow-hidden bg-white">{children}</div>
    </div>
  );
}

// ─── Logo crop (round guide, drag + zoom) ────────────────────────────────────
const CD = 280; // on-screen size
const CO = 400; // saved size

function LogoCropModal({ src, onSave, onClose }: { src: string; onSave: (b: Blob) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const minRef = useRef(1);
  const [scale, setScaleS] = useState(1);
  const [offset, setOffsetS] = useState({ x: 0, y: 0 });
  const [minScale, setMinScale] = useState(1);
  const [exporting, setExporting] = useState(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const applyScale = (s: number) => { scaleRef.current = s; setScaleS(s); };
  const applyOffset = (o: { x: number; y: number }) => { offsetRef.current = o; setOffsetS(o); };

  const redraw = useCallback(() => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, CD, CD);
    ctx.drawImage(img, offsetRef.current.x, offsetRef.current.y, img.width * scaleRef.current, img.height * scaleRef.current);
  }, []);
  useEffect(() => { redraw(); }, [scale, offset, redraw]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const s = Math.max(CD / image.width, CD / image.height);
      imgRef.current = image; minRef.current = s; setMinScale(s);
      applyScale(s);
      applyOffset({ x: (CD - image.width * s) / 2, y: (CD - image.height * s) / 2 });
    };
    image.src = src;
  }, [src]);

  function clamp(x: number, y: number, sc: number) {
    const img = imgRef.current;
    if (!img) return { x, y };
    return { x: Math.min(0, Math.max(CD - img.width * sc, x)), y: Math.min(0, Math.max(CD - img.height * sc, y)) };
  }
  function zoomTo(next: number) {
    if (!imgRef.current) return;
    const s = Math.min(4, Math.max(minRef.current, next));
    const cur = scaleRef.current;
    if (Math.abs(s - cur) < 0.001) return;
    const r = s / cur, c = CD / 2, { x, y } = offsetRef.current;
    applyScale(s);
    applyOffset(clamp(c - (c - x) * r, c - (c - y) * r, s));
  }
  function exportCrop() {
    const img = imgRef.current;
    if (!img) return;
    setExporting(true);
    const out = document.createElement("canvas");
    out.width = CO; out.height = CO;
    const r = CO / CD, { x, y } = offsetRef.current, sc = scaleRef.current;
    out.getContext("2d")!.drawImage(img, x * r, y * r, img.width * sc * r, img.height * sc * r);
    const tryQ = (q: number) => out.toBlob(b => {
      if (!b) { setExporting(false); return; }
      if (b.size > 600 * 1024 && q > 0.25) tryQ(q - 0.08);
      else { setExporting(false); onSave(b); }
    }, "image/jpeg", q);
    tryQ(0.9);
  }

  return (
    <>
      <div className="sp-backdrop z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Position your logo" className="sp-modal pointer-events-auto w-full max-w-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#17151F] text-lg">Position your logo</h2>
              <p className="text-sm text-[#6B6680]">Drag to move · scroll or use the slider to zoom</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative mx-auto mt-5 overflow-hidden rounded-[20px]" style={{ width: CD, height: CD }}>
            <canvas ref={canvasRef} width={CD} height={CD} className="block cursor-grab active:cursor-grabbing touch-none select-none"
              onPointerDown={e => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerMove={e => {
                if (!dragging.current) return;
                const dx = e.clientX - lastPos.current.x, dy = e.clientY - lastPos.current.y;
                lastPos.current = { x: e.clientX, y: e.clientY };
                applyOffset(clamp(offsetRef.current.x + dx, offsetRef.current.y + dy, scaleRef.current));
              }}
              onPointerUp={() => { dragging.current = false; }} onPointerLeave={() => { dragging.current = false; }}
              onWheel={e => zoomTo(scaleRef.current + (e.deltaY < 0 ? 0.08 : -0.08))} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle ${CD / 2 - 12}px at center, transparent 99%, rgba(23,21,31,.55) 100%)` }} />
            <div className="absolute pointer-events-none rounded-full border-2 border-white/80" style={{ inset: 12 }} />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={() => zoomTo(scaleRef.current - 0.15)} aria-label="Zoom out" className="w-9 h-9 rounded-full bg-[#F5F3FA] flex items-center justify-center"><ZoomOut className="w-4 h-4 text-[#4A4658]" /></button>
            <input type="range" aria-label="Zoom" min={Math.round(minScale * 100)} max={400} value={Math.round(scale * 100)}
              onChange={e => zoomTo(Number(e.target.value) / 100)} className="flex-1 accent-[#7D5CEF]" />
            <button onClick={() => zoomTo(scaleRef.current + 0.15)} aria-label="Zoom in" className="w-9 h-9 rounded-full bg-[#F5F3FA] flex items-center justify-center"><ZoomIn className="w-4 h-4 text-[#4A4658]" /></button>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold hover:bg-[#EEEBF4]">Cancel</button>
            <button onClick={exportCrop} disabled={exporting}
              className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
              {exporting && <Loader2 className="w-4 h-4 animate-spin" />}Use this
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Social & links ───────────────────────────────────────────────────────────
const SOCIAL = [
  { key: "facebookUrl", label: "Facebook", ph: "https://facebook.com/yourstudio" },
  { key: "instagramUrl", label: "Instagram", ph: "https://instagram.com/yourstudio" },
  { key: "youtubeUrl", label: "YouTube", ph: "https://youtube.com/@yourstudio" },
  { key: "tiktokUrl", label: "TikTok", ph: "https://tiktok.com/@yourstudio" },
];

export function OnlinePane() {
  const { data, patch } = useSettings();
  const [links, setLinks] = useState<{ label: string; url: string }[]>(Array.isArray(data.otherLinks) ? data.otherLinks : []);
  const saveLinks = (next: { label: string; url: string }[]) => {
    setLinks(next);
    patch({ otherLinks: next.filter(l => l.label.trim() || l.url.trim()) });
  };

  return (
    <>
      <Group title="Social profiles" note="Shown on client pages and at the bottom of quotes. Your website is in General.">
        {SOCIAL.map(s => (
          <Row key={s.key} id={s.key} label={s.label}>
            <TextField label={s.label} type="url" value={data[s.key] ?? ""} placeholder={s.ph} onCommit={v => patch({ [s.key]: v })} />
          </Row>
        ))}
      </Group>

      <Group title="Other links" note="For example your portfolio or a booking form.">
        <div id="set-otherLinks" className="sp-set-row scroll-mt-28">
          {links.map((l, i) => (
            <div key={i} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row gap-2 sm:items-center border-b border-[#EEEBF4]">
              <LinkInput label="Link name" value={l.label} placeholder="Portfolio" className="sm:w-40"
                onCommit={v => saveLinks(links.map((x, j) => j === i ? { ...x, label: v } : x))} />
              <div className="relative flex-1">
                <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680]" />
                <LinkInput label="Link address" value={l.url} placeholder="https://…" className="w-full pl-10"
                  onCommit={v => saveLinks(links.map((x, j) => j === i ? { ...x, url: v } : x))} />
              </div>
              <button type="button" aria-label="Remove link" onClick={() => saveLinks(links.filter((_, j) => j !== i))}
                className="self-end sm:self-auto w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setLinks(p => [...p, { label: "", url: "" }])}
            className="w-full px-4 sm:px-5 py-3.5 flex items-center gap-2 text-sm font-semibold text-[#5B3FD0] hover:bg-[#F7F4FE]">
            <Plus className="w-4 h-4" /> Add link
          </button>
        </div>
      </Group>
    </>
  );
}

function LinkInput({ value, onCommit, label, placeholder, className }: {
  value: string; onCommit: (v: string) => void; label: string; placeholder: string; className?: string;
}) {
  const [v, setV] = useSynced(value);
  return (
    <input aria-label={label} value={v} placeholder={placeholder} onChange={e => setV(e.target.value)}
      onBlur={() => { if (v.trim() !== value) onCommit(v.trim()); }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`h-10 rounded-full bg-[#F5F3FA] px-4 text-sm text-[#17151F] placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40 ${className ?? ""}`} />
  );
}
