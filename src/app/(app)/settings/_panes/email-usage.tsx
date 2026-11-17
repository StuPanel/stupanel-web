"use client";

/**
 * Settings → Notifications, on top: how many emails the studio sent this month, against its plan's limit,
 * to whom and what kind, and the last six months. Every email to a client, a team member, the studio itself
 * or an event guest counts; sign-in and password emails don't.
 */
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { WHO, kindLabel, limitText, n, type EmailBar, type EmailCounts, type EmailKindRow, type EmailMonth } from "@/lib/email-usage";
import { Group } from "../_ui";

type Mine = { month: EmailMonth; label: string; totals: EmailCounts; kinds: EmailKindRow[]; months: EmailBar[] };

export function EmailUsageGroup() {
  const [d, setD] = useState<Mine | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    apiFetch(`${API}/email-usage`).then(r => (r.ok ? r.json() : null)).then(x => { if (on) setD(x); }).catch(() => { if (on) setD(null); });
    return () => { on = false; };
  }, []);
  if (d === null) return null;

  const m = d ? limitText(d.month) : null;
  const who = WHO.filter(w => w.id !== "system");
  const max = d ? Math.max(1, ...d.months.map(b => b.total)) : 1;
  return (
    <Group title="Email use" note={d ? (d.month.limit === null
      ? "Every email StuPanel sends for your studio is counted — to clients, your team, you, and event guests. Your plan has no monthly limit."
      : `Your plan includes ${n(d.month.limit)} emails a month (each person an email goes to counts as one). It starts again on the 1st. Sign-in and password emails are not counted.`) : undefined}>
      <div id="set-email-usage" className="px-4 sm:px-5 py-4 scroll-mt-28">
        {!d ? (
          <div className="space-y-3"><div className="sp-skel h-8 w-40 rounded-lg" /><div className="sp-skel h-2.5 w-full rounded-full" /><div className="sp-skel h-16 w-full rounded-xl" /></div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-[12px] bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><Mail className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-[#6B6680]">{d.label}</p>
                <p className={cn("text-[22px] leading-tight font-extrabold tabular-nums", m!.over ? "text-[#C2304F]" : "text-[#17151F]")}>
                  {d.month.limit === null ? `${n(d.month.used)} emails` : <>{n(d.month.used)} <span className="text-[15px] font-semibold text-[#6B6680]">of {n(d.month.limit)} emails</span></>}
                </p>
              </div>
              {d.month.left !== null && <span className={cn("h-7 px-2.5 rounded-full text-[12px] font-semibold inline-flex items-center flex-shrink-0", m!.over ? "bg-[#FDECEF] text-[#C2304F]" : m!.near ? "bg-[#FFF4E0] text-[#8A5A00]" : "bg-[#E2F4EA] text-[#1F6B47]")}>{m!.over ? "Limit reached" : `${n(d.month.left)} left`}</span>}
            </div>
            {d.month.limit !== null && (
              <div className="mt-3 h-2.5 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-valuenow={d.month.used} aria-valuemin={0} aria-valuemax={d.month.limit} aria-label="Emails used this month">
                <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", m!.over ? "bg-[#C2304F]" : m!.near ? "bg-[#E0A030]" : "bg-[#7D5CEF]")} style={{ width: `${m!.pct}%` }} />
              </div>
            )}
            {m!.over && <p className="mt-2.5 text-[13px] text-[#8A1F36] bg-[#FDECEF] rounded-[12px] px-3 py-2">Emails to clients and your team are paused until the 1st. Contact StuPanel to raise your limit.</p>}

            {/* Who got them this month */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {who.map(w => (
                <div key={w.id} className="rounded-[14px] bg-[#F7F6FA] px-3 py-2.5">
                  <p className="text-[12px] text-[#6B6680] flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: w.color }} />{w.label}</p>
                  <p className="text-[17px] font-bold text-[#17151F] tabular-nums mt-0.5">{n(d.totals[w.id])}</p>
                </div>
              ))}
            </div>

            {/* Last six months */}
            <div className="mt-4">
              <p className="text-[12px] font-semibold text-[#4A4658] mb-2">Last 6 months</p>
              <div className="h-20 flex items-end gap-2" role="img" aria-label={d.months.map(b => `${b.label}: ${b.total}`).join(", ")}>
                {d.months.map(b => (
                  <div key={b.key} className="flex-1 h-full flex flex-col justify-end" title={`${b.label}: ${n(b.total)}`}>
                    <div className="w-full rounded-t-[6px] overflow-hidden flex flex-col-reverse min-h-[3px] bg-[#EEEBF4]" style={{ height: `${Math.max(3, (b.total / max) * 100)}%` }}>
                      {who.map(w => (b[w.id] ? <div key={w.id} style={{ height: `${(b[w.id] / b.total) * 100}%`, background: w.color }} /> : null))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-1">{d.months.map(b => <span key={b.key} className="flex-1 text-center text-[11px] text-[#8A8599]">{b.label}</span>)}</div>
            </div>

            {/* What kinds */}
            {d.kinds.length > 0 && (
              <details className="mt-4 group">
                <summary className="text-[13px] font-semibold text-[#5B3FD0] cursor-pointer list-none">What was sent this month</summary>
                <ul className="mt-2 divide-y divide-[#EEEBF4]">
                  {d.kinds.map(k => (
                    <li key={`${k.kind}|${k.who}`} className="py-2 flex items-center gap-2 text-[13.5px]">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: WHO.find(w => w.id === k.who)?.color }} />
                      <span className="flex-1 min-w-0 truncate text-[#17151F]">{kindLabel(k.kind)}</span>
                      {k.blocked > 0 && <span className="text-[12px] text-[#C2304F]">{n(k.blocked)} not sent</span>}
                      <span className="font-semibold tabular-nums text-[#17151F]">{n(k.sent)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </Group>
  );
}
