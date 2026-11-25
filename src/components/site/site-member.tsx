"use client";
/**
 * A team member's own page on the studio website (Faisal 25-NOV-2026): /team/TM-016.
 * Opens from the ID card's QR code (with the green "verified" bar) or, when the studio allows it, a click on
 * the About page. Only who they are: photo, name, title, a verified seal, then the parts the studio filled in.
 * A part that is off or empty is simply not there and the rest closes up; with nothing extra the page becomes
 * a centred card. Every look dresses it its own way in site.css (.mbp). Someone who left: only that, no name.
 */
import Link from "next/link";
import type { SiteData, SiteMember } from "./site-view";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
const checkedAt = () => new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function MemberPage({ m, data, L, scan }: { m: SiteMember; data: SiteData; L: (path: string) => string; scan: boolean }) {
  const studio = data.studio.name;
  const phone = data.content.phone || data.content.whatsapp;

  if (m.left) return (
    <>
      <div className="mbbar no" role="alert">
        <span className="mbi" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></span>
        <span><b>Not a member of {studio} now</b><small suppressHydrationWarning>Checked {checkedAt()}</small></span>
      </div>
      <section className="mbgone wrap">
        <span className="mbx" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></svg></span>
        <h1 className="pf">This ID card is no longer valid</h1>
        <p className="mbmeta"><span>ID {m.memberId}</span></p>
        <p>The person with this card does not work for {studio} now. Please don&apos;t let them shoot or take payment in the studio&apos;s name.</p>
        {phone ? <a className="cap gold shine btn" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>Call {studio}</a> : <Link className="cap gold shine btn" href={L("/contact")}>Contact {studio}</Link>}
      </section>
    </>
  );

  const facts = [
    m.years ? ["Experience", m.years] : null,
    m.languages ? ["Speaks", m.languages] : null,
    m.weddings ? ["Weddings", `${m.weddings}`] : null,
  ].filter(Boolean) as [string, string][];
  const skills = m.skills ?? [];
  const social = [m.instagram ? ["Instagram", m.instagram] : null, m.facebook ? ["Facebook", m.facebook] : null].filter(Boolean) as [string, string][];
  const bare = !m.about && !facts.length && !skills.length && !social.length;

  return (
    <>
      {scan && (
        <div className="mbbar ok" role="status">
          <span className="mbi" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg></span>
          <span><b>Verified member of {studio}</b><small suppressHydrationWarning>Checked {checkedAt()}</small></span>
        </div>
      )}
      <section className={`mbp wrap${bare ? " bare" : ""}`}>
        <div className="mbpf">
          <div className="mbph">
            {m.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={m.photo} alt={m.name ?? ""} />
              : <span className="mbin cz" aria-hidden="true">{initials(m.name ?? "")}</span>}
          </div>
        </div>
        <div className="mbwho">
          <p className="mbmeet sc" aria-hidden="true">meet</p>
          {m.role && <p className="mbrole cap">{m.role}</p>}
          <h1 className="mbname pf">{m.name}</h1>
          <div className="mbrule" aria-hidden="true"><svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 0l6 6-6 6-6-6z" fill="currentColor" /></svg></div>
          <div className="mbseal">
            <span className="mbvf">
              <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M16 2.5l3.2 2.3 3.9-.3 1.4 3.7 3.5 1.8-.6 3.9 2.1 3.3-2.6 3 .3 3.9-3.8 1.1-1.8 3.5-3.9-.9-3.3 2.1-3-2.6-3.9.4-1.1-3.8-3.5-1.8.9-3.9L2.5 16l2.6-3-.3-3.9 3.8-1.1 1.8-3.5 3.9.9z" /><path d="M11 16.3l3.4 3.4 6.6-7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Verified member of {studio}
            </span>
            <span className="mbmeta"><span>ID {m.memberId}</span>{m.since ? <span>Since {m.since}</span> : null}</span>
          </div>
          {m.about && <div className="mbabout">{m.about.split(/\n+/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}</div>}
          {facts.length > 0 && (
            <dl className="mbfacts">
              {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="pf">{v}</dd></div>)}
            </dl>
          )}
          {skills.length > 0 && <ul className="mbskills" aria-label="Good at">{skills.map(s => <li key={s}>{s}</li>)}</ul>}
          {social.length > 0 && (
            <div className="mbsocial">
              {social.map(([k, href]) => (
                <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${m.name} on ${k}`}>
                  {k === "Instagram"
                    ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" /></svg>
                    : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z" /></svg>}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
