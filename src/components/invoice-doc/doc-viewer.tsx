"use client";

/**
 * Public page frame for an invoice / quotation / receipt:
 * the document (fitted to the screen), and Download PDF, Print, WhatsApp.
 * Print and PDF use the studio's paper size.
 */
import { useRef, useState } from "react";
import { Download, Loader2, MessageCircle, Printer } from "lucide-react";
import { PAPER, type InvoiceDesign } from "./design";
import { InvoiceDocument, type DocData } from "./invoice-document";
import { DesignFonts, ScaledDocument } from "./scaled";

export function DocViewer({ data, design, fileName, shareText, extra }: {
  data: DocData; design: InvoiceDesign; fileName: string; shareText: string; extra?: React.ReactNode;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const paper = PAPER[design.paper];

  async function downloadPdf() {
    const el = printRef.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    setBusy(true);
    try {
      await document.fonts?.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      const wPt = paper.w * 0.75; // px → pt
      const fullH = canvas.height / 2 * 0.75;
      const pageH = paper.h ? paper.h * 0.75 : fullH;
      const pdf = new jsPDF({ unit: "pt", format: [wPt, Math.max(pageH, 10)], orientation: "portrait" });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      // Long documents continue on more pages.
      let y = 0;
      for (let page = 0; y < fullH - 1; page++) {
        if (page > 0) pdf.addPage([wPt, pageH], "portrait");
        pdf.addImage(img, "JPEG", 0, -y, wPt, fullH);
        y += pageH;
      }
      pdf.save(`${fileName}.pdf`);
    } catch {
      window.print();
    } finally { setBusy(false); }
  }

  function whatsapp() {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${window.location.href}`)}`;
    window.open(url, "_blank", "noopener");
  }

  const btn = "h-11 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-[0_1px_2px_rgba(22,18,40,.08)]";
  return (
    <>
      <DesignFonts fonts={[design.font]} />
      <style>{`
        @media print {
          @page { size: ${paper.mm}; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; }
          .doc-screen { display: none !important; }
          .doc-print { display: block !important; position: static !important; left: 0 !important; }
          .doc-print > div { box-shadow: none !important; }
        }
      `}</style>

      <div className="doc-screen min-h-screen bg-[#ECE9F2] py-6 px-3 sm:py-10">
        <div className="mx-auto" style={{ maxWidth: Math.min(paper.w, 860) }}>
          <div className="flex flex-wrap gap-2 justify-center mb-5">
            <button type="button" onClick={downloadPdf} disabled={busy} className={`${btn} bg-[#17151F] text-white`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Download PDF
            </button>
            <button type="button" onClick={() => window.print()} className={`${btn} bg-white text-[#17151F]`}><Printer className="w-4 h-4" />Print</button>
            <button type="button" onClick={whatsapp} className={`${btn} bg-[#25D366] text-white`}><MessageCircle className="w-4 h-4" />WhatsApp</button>
          </div>
          <ScaledDocument data={data} design={design} />
          {extra && <div className="mt-6">{extra}</div>}
          <p className="text-center text-[11px] text-[#8A8599] mt-8">Made with StuPanel</p>
        </div>
      </div>

      {/* Full-size copy used for print and PDF */}
      <div ref={printRef} className="doc-print" aria-hidden style={{ position: "fixed", left: -100000, top: 0 }}>
        <InvoiceDocument data={data} design={design} />
      </div>
    </>
  );
}
