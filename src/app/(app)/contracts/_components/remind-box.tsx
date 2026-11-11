"use client";

/**
 * Sent but not signed: a short note on how long it has waited, and one-tap reminders.
 * WhatsApp opens the studio's WhatsApp with the message and link ready; email is sent by us.
 * Either way the reminder is noted so the "not signed yet" nudge waits a few days again.
 */
import { useState } from "react";
import { BellRing, Check, Loader2, Mail, MessageCircle } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { waNumber } from "@/lib/phone";
import { notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { clientFull, contractLink, fmtDayTime } from "@/lib/contracts";

export interface RemindTarget {
  id: string; title: string; publicToken: string; status: string;
  sentAt: string | null; viewedAt?: string | null; lastRemindedAt?: string | null; needsReminder?: boolean;
  client: { firstName: string; lastName: string | null; phone: string | null; email: string | null };
}

export function reminderMessage(c: RemindTarget, studioName: string) {
  const first = c.client.firstName || clientFull(c.client);
  return `Hi ${first}, a friendly reminder to sign "${c.title}". It takes about a minute.\n${contractLink(c.publicToken)}\n\n— ${studioName}`;
}

const daysSince = (d?: string | null) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0);
const ago = (n: number) => (n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);

/** Note the reminder on the server (WhatsApp) or send it (email). Returns the new "last reminded" time. */
export async function sendReminder(id: string, channel: "whatsapp" | "email"): Promise<string | null> {
  const r = await apiFetch(`${API}/contracts/${id}/remind`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't send the reminder", { error: true }); return null; }
  return d.lastRemindedAt ?? new Date().toISOString();
}

export function RemindBox({ contract, studioName, onReminded, className }: {
  contract: RemindTarget; studioName: string; onReminded?: (at: string) => void; className?: string;
}) {
  const [mailing, setMailing] = useState(false);
  const [last, setLast] = useState(contract.lastRemindedAt ?? null);
  if (!["sent", "viewed"].includes(contract.status)) return null;
  const wa = waNumber(contract.client.phone);
  const waUrl = `https://wa.me/${wa ?? ""}?text=${encodeURIComponent(reminderMessage(contract, studioName))}`;
  const waited = daysSince(contract.sentAt);
  const urgent = !!contract.needsReminder && !(last && daysSince(last) < 1);

  async function done(channel: "whatsapp" | "email") {
    const at = await sendReminder(contract.id, channel);
    if (at) { setLast(at); onReminded?.(at); if (channel === "email") notify(`Reminder emailed to ${contract.client.email}`); }
  }
  async function email() { setMailing(true); try { await done("email"); } finally { setMailing(false); } }

  return (
    <section className={cn("rounded-[20px] p-4", urgent ? "bg-[#FFF3E0]" : "bg-[#F5F3FA]", className)} aria-label="Reminder">
      <div className="flex items-start gap-3">
        <span className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0", urgent ? "bg-white text-[#9A5B00]" : "bg-white text-[#5B3FD0]")}><BellRing className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-bold text-[#17151F]">Not signed yet</p>
          <p className="text-[12.5px] text-[#6B6680] mt-0.5">
            Sent {ago(waited)}{contract.status === "viewed" ? " · the client opened it" : " · not opened yet"}
            {last ? ` · reminded ${fmtDayTime(last)}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => { void done("whatsapp"); }}
          className="h-10 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
          <MessageCircle className="w-4 h-4 flex-shrink-0" /><span className="sm:hidden">WhatsApp</span><span className="hidden sm:inline">Remind on WhatsApp</span>
        </a>
        <button type="button" onClick={email} aria-label="Email reminder" disabled={!contract.client.email || mailing}
          title={contract.client.email ? undefined : "This client has no email"}
          className="h-10 rounded-full bg-white hover:bg-[#EEEBF4] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
          {mailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}<span className="sm:hidden">Email</span><span className="hidden sm:inline">Email reminder</span>
        </button>
      </div>
      {!contract.client.email && <p className="mt-2 text-[12px] text-[#6B6680]">Email is off — this client has no email address.</p>}
      {last && daysSince(last) < 1 && <p className="mt-2 text-[12px] text-[#1F8A5B] font-semibold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Reminder noted. We&apos;ll nudge you again in a few days if it&apos;s still not signed.</p>}
    </section>
  );
}
