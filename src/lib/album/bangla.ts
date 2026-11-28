/**
 * Bangla words on the pages (the studio chooses English or বাংলা for an album). The same layouts, with
 * Bangla type: Noto Serif Bengali for titles, Galada for names, Hind Siliguri for lines. Our own words.
 */
import type { Item, TextItem } from "./types";

export const BN_FONTS = {
  serif: "'Noto Serif Bengali', serif",
  script: "'Galada', cursive",
  sans: "'Hind Siliguri', sans-serif",
  tiro: "'Tiro Bangla', serif",
  anek: "'Anek Bangla', sans-serif",
} as const;

export const QUOTES_BN = [
  "দুটি পরিবার, একটি গল্প — আজ শুরু হলো একসাথে পথচলা।",
  "হাতে হাত রাখলেই অর্ধেক পথ পেরিয়ে যায়।",
  "আজ তার সবচেয়ে সুন্দর গয়না তার হাসি।",
  "কিছু মুহূর্ত শুধু মনে রাখার জন্য নয়, ছবিতে রেখে দেওয়ার জন্য।",
  "সব ভালোবাসার গল্পই সুন্দর, তবে আমাদেরটা সবচেয়ে প্রিয়।",
  "ছোট ছোট যত্নে গড়া এক বড় প্রতিশ্রুতি।",
  "শীতের সকালের প্রথম আলোর মতো সে এলো।",
  "ভিড়ের মাঝেও তারা শুধু দুজন দুজনকেই দেখল।",
  "সবচেয়ে সুন্দর দিনগুলো এখনো আসছে — একসাথে।",
  "হাসি, ফুল, পরিবার আর চিরদিনের শুরু।",
  "এক দিনের রং, সারাজীবনের সাথী।",
  "হাতে মেহেদি, চোখে হাজারো স্বপ্ন।",
  "হলুদের রঙে, হাসির ছোঁয়ায় শুরু হলো উৎসব।",
  "ধীরে ধীরে লেখা গল্প, হঠাৎ একদিন পূর্ণ হলো।",
  "যেখানে ভালোবাসা, সেখানেই উৎসব।",
  "লাল-সোনালিতে মোড়া, সবার দোয়ায় ভরা।",
  "গানের আগের নীরবতা, চিরদিনের আগের শান্তি।",
  "কিছু প্রতিশ্রুতি বলা হয় না, অনুভব করা যায়।",
  "এক পলক, এক হাসি — আর পুরো ঘর চুপ।",
  "চিরদিন তাদের মানায়।",
  "নরম আলোয় লেখা এক নতুন অধ্যায়।",
  "ভালোবাসা থাকে ছোট ছোট মুহূর্তে।",
  "প্রতিটি পদক্ষেপে সৌন্দর্য, প্রতিটি দৃষ্টিতে আনন্দ।",
  "দুটি মন, একটি ঘর, অনেক সুখের বছর।",
  "এই দিন, এই দুজন, আর সামনের সব পথ — সবই আশীর্বাদ।",
  "যে দিনের স্বপ্ন দেখেছিল, অবশেষে সেই দিন।",
  "সুন্দর শুরুই সবচেয়ে সুন্দর স্মৃতি হয়।",
  "এমন মুহূর্তের জন্যই তো ছবি তুলে রাখা।",
];

/** Words the designs write in English, in Bangla. */
const WORDS: Record<string, string> = {
  BRIDE: "বধূ", Bride: "নববধূ", Beautiful: "সুন্দর", Couple: "জুটি", THE: "", "Thank you": "ধন্যবাদ",
  LOVE: "ভালোবাসা", "TALES OF THE HEARTS": "হৃদয়ের গল্প", "Our Story": "আমাদের গল্প", "Our Wedding": "আমাদের বিয়ে",
  Forever: "চিরকাল", "Your words": "আপনার কথা",
};
/** Common chapter (folder) names, in Bangla. */
const CHAPTERS: [RegExp, string][] = [
  [/holud|haldi|gaye/i, "গায়ে হলুদ"], [/mehe?n?di/i, "মেহেদি সন্ধ্যা"], [/engage|ring|angti/i, "আংটি বদল"],
  [/akd|aqd|nikah|kabin/i, "আকদ"], [/wedding|biye|bie|shadi/i, "বিয়ে"], [/reception|bou ?bhat|bouvat|walima/i, "বৌভাত"],
  [/pre.?wedding|outdoor/i, "প্রি-ওয়েডিং"],
];
export const isBangla = (t: string) => /[ঀ-৿]/.test(t);
export const chapterBn = (name: string) => CHAPTERS.find(([re]) => re.test(name))?.[1] ?? name;

/** The Bangla font that suits an English one. */
export function bnFontFor(font: string) {
  if (/Pinyon|Great Vibes/.test(font)) return BN_FONTS.script;
  if (/Montserrat|Plus Jakarta/.test(font)) return BN_FONTS.sans;
  if (/Cormorant/.test(font)) return BN_FONTS.sans;
  return BN_FONTS.serif;
}

/** Turns a page's texts into Bangla: words, fonts, and no tracking or italics (they break Bangla letters). */
export function toBangla(items: Item[], quoteAt: number, chapter: string | null) {
  return items.map(it => {
    if (it.k !== "text") return it;
    const t = it as TextItem;
    let text = t.t;
    if (t.role === "quote") text = QUOTES_BN[quoteAt % QUOTES_BN.length];
    else if (chapter && text === chapter) text = chapterBn(chapter);
    else if (WORDS[text] !== undefined) text = WORDS[text];
    else if (/ · /.test(text) && !isBangla(text)) text = text; // names and date stay as typed
    const display = t.role !== "quote";
    return { ...t, t: text, font: bnFontFor(t.font), italic: false, up: false, ls: undefined, size: display ? t.size * 0.82 : t.size * 1.05, lh: Math.max(t.lh ?? 1.15, 1.35) };
  }).filter(it => !(it.k === "text" && (it as TextItem).t === ""));
}
