"use client";

import { useEffect, useRef, useState } from "react";
import { PAPER, fontHref, type InvoiceDesign } from "./design";
import { InvoiceDocument, type DocData } from "./invoice-document";

/** Loads the Google fonts a design needs (once per set). */
export function DesignFonts({ fonts }: { fonts: InvoiceDesign["font"][] }) {
  const href = fontHref(fonts);
  useEffect(() => {
    if (document.querySelector(`link[data-inv-fonts="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.dataset.invFonts = href;
    document.head.appendChild(l);
  }, [href]);
  return null;
}

/** The document scaled down to fit the box it sits in (never up). */
export function ScaledDocument({ data, design, maxScale = 1, shadow = true }: { data: DocData; design: InvoiceDesign; maxScale?: number; shadow?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const doc = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [h, setH] = useState(0);
  const [left, setLeft] = useState(0);
  const w = PAPER[design.paper].w;

  useEffect(() => {
    const el = box.current, d = doc.current;
    if (!el || !d) return;
    const fit = () => {
      const sc = Math.min(maxScale, el.clientWidth / w);
      setScale(sc);
      setH(d.offsetHeight * sc);
      setLeft(Math.max(0, (el.clientWidth - w * sc) / 2));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el); ro.observe(d);
    return () => ro.disconnect();
  }, [w, maxScale]);

  return (
    <div ref={box} style={{ width: "100%", height: h || undefined, position: "relative" }}>
      <div ref={doc} style={{ width: w, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left, top: 0, boxShadow: shadow ? "0 10px 40px rgba(22,18,40,.14), 0 1px 3px rgba(22,18,40,.08)" : undefined }}>
        <InvoiceDocument data={data} design={design} />
      </div>
    </div>
  );
}
