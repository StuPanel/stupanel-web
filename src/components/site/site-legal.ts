/**
 * A studio website's Terms and Privacy pages.
 * The studio can write its own (Website → Terms & privacy); until then these standard words are shown.
 * Simple writing rules, so any studio can lay out a policy without HTML:
 *   "## Heading" on its own line → a heading in the site's own heading font
 *   "- point" lines → a list
 *   a blank line → a new paragraph
 */
export type LegalPage = "terms" | "privacy";
export type LegalBlock = { kind: "h"; text: string } | { kind: "p"; text: string } | { kind: "ul"; items: string[] };

export const LEGAL_MAX = 15000;

/** The standard words, written in the same simple format, so a studio can start from them and change what it likes. */
export function standardLegal(page: LegalPage, studio: string): string {
  return page === "privacy"
    ? [
        "## What this site collects",
        `When you send the booking form, ${studio} receives what you typed: your name, phone number, wedding date, the package you picked and your message. Nothing is collected if you only look around.`,
        "## What it is used for",
        `Only to answer your enquiry and plan your booking. ${studio} does not sell or share your details with advertisers.`,
        "## Where it is kept",
        `Enquiries are stored in StuPanel, the studio software ${studio} uses to manage its bookings.`,
        "## Videos and fonts",
        "Films play from YouTube's privacy-enhanced player and only load when you press play. Fonts are loaded from Google Fonts.",
        "## Your choices",
        `To see, correct or delete what you sent, contact ${studio} using the details on the Contact page.`,
      ].join("\n\n")
    : [
        "## Photos and films",
        `Every photo and film on this site belongs to ${studio} and is shown with the families' permission. Please do not copy or reuse them.`,
        "## Prices",
        "Prices shown are a guide. Your final price depends on your dates, places and the events you choose, and is confirmed in your quote.",
        "## Bookings",
        `Sending the form is an enquiry, not a booking. Your date is held only after ${studio} confirms it with you.`,
        "## Changes",
        `${studio} may update this site, its packages and these terms at any time.`,
      ].join("\n\n");
}

/** Turns the written text into headings, paragraphs and lists. Lines next to each other stay in one paragraph. */
export function parseLegal(src: string): LegalBlock[] {
  const out: LegalBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { out.push({ kind: "p", text: para.join("\n") }); para = []; } };
  const flushList = () => { if (list.length) { out.push({ kind: "ul", items: list }); list = []; } };
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const h = /^#{1,3}\s+(.+)$/.exec(line);
    if (h) { flushPara(); flushList(); out.push({ kind: "h", text: h[1].trim() }); continue; }
    const li = /^(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);
    if (li) { flushPara(); list.push(li[1].trim()); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return out;
}
