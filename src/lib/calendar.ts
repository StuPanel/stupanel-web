/**
 * "Add to calendar" for work days: an .ics file (phone / Apple / Outlook calendars)
 * and a Google Calendar link. Days are whole-day entries — the app keeps dates, not clock times.
 */
export type CalDay = { date: string; title: string; location?: string; details?: string };

const ymd = (d: string) => d.slice(0, 10).replace(/-/g, "");
function nextDay(d: string) {
  const [y, m, dd] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10).replace(/-/g, "");
}
const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}/.test(d);

/** Text values: escape \ ; , and line breaks (RFC 5545). */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 bytes are folded onto the next line with a leading space. */
function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(days: CalDay[], uidBase: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StuPanel//Member schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  days.filter(d => validDay(d.date)).forEach((d, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uidBase}-${ymd(d.date)}-${i}@stupanel.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d.date)}`,
      `DTEND;VALUE=DATE:${nextDay(d.date)}`,
      `SUMMARY:${esc(d.title)}`,
      ...(d.location ? [`LOCATION:${esc(d.location)}`] : []),
      ...(d.details ? [`DESCRIPTION:${esc(d.details)}`] : []),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Program tomorrow", "TRIGGER:-PT12H", "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(days: CalDay[], uidBase: string, fileName: string) {
  const blob = new Blob([buildIcs(days, uidBase)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "program"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens Google Calendar with one whole-day entry filled in. */
export function googleCalendarUrl(d: CalDay) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: d.title, dates: `${ymd(d.date)}/${nextDay(d.date)}` });
  if (d.location) q.set("location", d.location);
  if (d.details) q.set("details", d.details);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
