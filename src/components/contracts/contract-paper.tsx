"use client";

/**
 * The agreement as the client sees it: one clean sheet — studio, title, parties, days, fees,
 * numbered sections and the two signatures. Used for the live preview while writing and on the signing page.
 */
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/format";
import { StudioLogo } from "@/components/studio-logo";
import {
  balanceLabel, fieldValues, fillText, fmtDay, fmtDayTime,
  type ContractDetails, type ContractSection, type ContractSignature, type ContractStudio,
} from "@/lib/contracts";

export const SIGN_FONT = '"Snell Roundhand","Segoe Script","Apple Chancery","Brush Script MT",cursive';

function Table({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="rounded-[14px] border border-[#E9E5F1] divide-y divide-[#E9E5F1] overflow-hidden">
      {rows.map(([l, v]) => (
        <div key={l} className="flex gap-4 px-4 py-2.5 text-[14px]">
          <dt className="w-[38%] flex-shrink-0 text-[#6B6680]">{l}</dt>
          <dd className="flex-1 min-w-0 font-medium text-[#17151F] break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
const Missing = ({ children }: { children: React.ReactNode }) => <span className="text-[#A29DB3] font-normal">[{children}]</span>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-[15px] font-bold text-[#17151F] mt-7 mb-2.5">{children}</h2>;

export function ContractPaper({ studio, clientName, title, number, details, sections, madeOn, signature, children, className }: {
  studio: ContractStudio; clientName: string; title: string; number?: string | null;
  details: ContractDetails; sections: ContractSection[]; madeOn?: string | null;
  signature?: ContractSignature | null;
  /** The signing form (client's page) goes where the client's signature will be. */
  children?: React.ReactNode; className?: string;
}) {
  const values = fieldValues(details, studio.name, clientName, madeOn);
  const cur = details.currency || undefined;
  const balance = Math.max(0, details.total - details.advance);
  const contact = [studio.phone, studio.email].filter(Boolean).join(" · ");

  return (
    <article className={cn("bg-white text-[#17151F] rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_18px_50px_-20px_rgba(22,18,40,.25)] print:shadow-none print:rounded-none", className)}>
      <header className="flex items-center gap-3.5 px-6 sm:px-10 pt-7 pb-5 border-b border-[#E9E5F1]">
        <StudioLogo url={studio.logoUrl} name={studio.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold tracking-[-0.01em] truncate">{studio.name}</p>
          {(contact || studio.address) && <p className="text-[12.5px] text-[#6B6680] truncate">{contact || studio.address}</p>}
        </div>
        {number && <p className="text-[11.5px] text-[#9893A8] text-right flex-shrink-0">Agreement<br /><span className="font-semibold text-[#4A4658] tabular-nums">{number}</span></p>}
      </header>

      <div className="px-6 sm:px-10 py-7">
        <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-[-0.02em] leading-tight">{title || "Agreement"}</h1>
        <p className="text-[14px] text-[#6B6680] mt-2">
          Made on {values.today} between <strong className="text-[#17151F]">{studio.name}</strong> and <strong className="text-[#17151F]">{clientName || <Missing>Client name</Missing>}</strong>.
        </p>

        {details.events.length > 0 && (
          <>
            <H>{details.events.length > 1 ? "Event days" : "Event"}</H>
            <div className="rounded-[14px] border border-[#E9E5F1] divide-y divide-[#E9E5F1] overflow-hidden">
              {details.events.map((e, i) => (
                <div key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5 text-[14px]">
                  <span className="font-semibold min-w-[110px]">{e.name || "Event"}</span>
                  <span className="text-[#4A4658] tabular-nums">{fmtDay(e.date) || <Missing>Date</Missing>}</span>
                  {e.venue && <span className="text-[#6B6680] flex-1 min-w-[140px]">{e.venue}</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {(details.packageName || details.showFees) && (
          <>
            <H>{details.showFees ? "Package and payment" : "Package"}</H>
            <Table rows={[
              ...(details.packageName ? [["Package", details.packageName] as [string, React.ReactNode]] : []),
              ...(details.showFees ? [
                ["Total", details.total > 0 ? fmtMoney(details.total, cur) : <Missing>Total</Missing>],
                ["Advance to confirm", details.advance > 0 ? fmtMoney(details.advance, cur) : "—"],
                ["Balance", details.total > 0 ? <>{fmtMoney(balance, cur)} <span className="text-[#6B6680] font-normal">· {balanceLabel(details.balanceDue).toLowerCase()}</span></> : "—"],
              ] as [string, React.ReactNode][] : []),
            ]} />
          </>
        )}

        {sections.map((s, i) => (
          <section key={i} className="break-inside-avoid">
            <H>{i + 1}. {s.title || "Terms"}</H>
            {s.text.split("\n").filter(l => l.trim()).map((line, j) => (
              <p key={j} className="text-[14px] leading-[1.7] text-[#33303F] mb-2">
                {fillText(line, values).map((p, k) => p.missing ? <span key={k} className="text-[#A29DB3]">{p.text}</span> : <span key={k}>{p.text}</span>)}
              </p>
            ))}
          </section>
        ))}
      </div>

      <footer className="px-6 sm:px-10 py-7 border-t border-[#E9E5F1] bg-[#FBFAFD] rounded-b-[20px] print:bg-white break-inside-avoid">
        <h2 className="text-[15px] font-bold mb-4">Signatures</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="h-[72px] flex items-end pb-1 border-b border-[#17151F]">
              <span className="text-[30px] leading-none text-[#17151F] truncate" style={{ fontFamily: SIGN_FONT }}>{studio.name}</span>
            </div>
            <p className="text-[13.5px] font-semibold mt-2">{studio.name}</p>
            <p className="text-[12px] text-[#6B6680]">Studio · issued this agreement</p>
          </div>
          <div>
            {signature?.signedAt ? (
              <>
                <div className="h-[72px] flex items-end pb-1 border-b border-[#17151F]">
                  {signature.kind === "drawn" && signature.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={signature.image} alt={`Signature of ${signature.name}`} className="max-h-[66px] max-w-full object-contain" />
                    : <span className="text-[30px] leading-none truncate" style={{ fontFamily: SIGN_FONT }}>{signature.name}</span>}
                </div>
                <p className="text-[13.5px] font-semibold mt-2">{signature.name}</p>
                <p className="text-[12px] text-[#1F8A5B] font-medium">Signed online · {fmtDayTime(signature.signedAt)}</p>
                {signature.device && <p className="text-[11.5px] text-[#9893A8]">{signature.device}</p>}
              </>
            ) : children ?? (
              <>
                <div className="h-[72px] border-b border-dashed border-[#B5B0C4]" />
                <p className="text-[13.5px] font-semibold mt-2">{clientName || "Client"}</p>
                <p className="text-[12px] text-[#6B6680]">Client · signs here</p>
              </>
            )}
          </div>
        </div>
      </footer>
    </article>
  );
}
