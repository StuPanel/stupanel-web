/**
 * Typed commands for the editor, in Bangla or English, read by fixed rules (no AI, no cost).
 * "এই পাতা সাদাকালো", "ছবিটা বড় করো", "পাতা ৫", "আর্চ ডিজাইন", "লেখা সরাও", "উল্টাও"…
 */
import type { LookId } from "./types";

export type Command =
  | { do: "bw"; on: boolean; scope: "photo" | "page" }
  | { do: "scale"; by: number }
  | { do: "removeText" }
  | { do: "addPage" } | { do: "removePage" }
  | { do: "layout" } | { do: "look"; look: LookId }
  | { do: "go"; page: number } | { do: "next" } | { do: "prev" }
  | { do: "flip" } | { do: "quote" } | { do: "undo" } | { do: "redo" }
  | { do: "addText"; text: string | null }
  | { do: "empty" };

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const digits = (t: string) => t.replace(/[০-৯]/g, d => String(BN_DIGITS.indexOf(d)));

const LOOK_WORDS: [RegExp, LookId][] = [
  [/mono|monochrome|সাদাকালো ডিজাইন|মনো/i, "mono"], [/inset|bride inset|ইনসেট|কাচ/i, "inset"], [/couple|কাপল|জুটি/i, "couple"],
  [/arch|আর্চ|খিলান/i, "arch"], [/strip|স্ট্রিপ|ফালি/i, "strips"], [/band|red|লাল/i, "band"], [/blush|ব্লাশ|গোলাপি/i, "blush"],
  [/the bride|bride page|ব্রাইড|সাদা কলাম/i, "bride"],
];

/** Reads one typed command; null when it is not understood. */
export function parseCommand(input: string): Command | null {
  const t = digits(input.trim().toLowerCase()).normalize("NFC");
  if (!t) return null;
  const has = (...w: (string | RegExp)[]) => w.some(x => (typeof x === "string" ? t.includes(x.normalize("NFC")) : x.test(t)));
  const page = has("পাতা", "page", "পেজ", "spread", "সব ছবি", "all photos");

  if (has("undo", "আগের মতো", "ফিরিয়ে", "আনডু")) return { do: "undo" };
  if (has("redo", "রিডু")) return { do: "redo" };
  const go = t.match(/(?:পাতা|পেজ|page)\s*(?:নং|নম্বর|no\.?)?\s*(\d{1,3})|(\d{1,3})\s*(?:নং|নম্বর)?\s*(?:পাতা|পেজ|page)/);
  if (go && !has("মুছ", "বাদ", "remove", "delete", "যোগ", "add")) return { do: "go", page: Number(go[1] ?? go[2]) };
  if (has("পরের পাতা", "পরের পেজ", "next page", "next")) return { do: "next" };
  if (has("আগের পাতা", "আগের পেজ", "previous", "prev")) return { do: "prev" };

  if (has("রঙিন", "রঙ ফিরিয়ে", "colour", "color", "কালার")) return { do: "bw", on: false, scope: page ? "page" : "photo" };
  if (has("সাদাকালো", "সাদা কালো", "black and white", "black & white", "b&w", "bw", "grayscale", "ব্ল্যাক")) {
    if (has("ডিজাইন", "design")) return { do: "look", look: "mono" };
    return { do: "bw", on: true, scope: page ? "page" : "photo" };
  }
  if (has("নতুন পাতা", "পাতা যোগ", "পেজ যোগ", "add page", "new page")) return { do: "addPage" };
  if ((has("পাতা", "পেজ", "page") && has("মুছ", "বাদ", "ডিলিট", "remove", "delete"))) return { do: "removePage" };
  if (has("লেখা") && has("সরাও", "মুছ", "বাদ", "ডিলিট") || has("remove text", "delete text", "no text")) return { do: "removeText" };
  const add = input.match(/(?:লেখো|লিখুন|লিখো|লেখ|write|add text)[:\s]+(.+)/i);
  if (add) return { do: "addText", text: add[1].trim().slice(0, 200) };
  if (has("লেখা যোগ", "add text")) return { do: "addText", text: null };
  if (has("অন্য কোট", "নতুন কোট", "অন্য লাইন", "another quote", "new quote", "quote")) return { do: "quote" };
  if (has("উল্টাও", "উল্টে", "উলটো", "ডান-বাম", "flip", "mirror", "swap sides")) return { do: "flip" };
  if (has("খালি", "empty")) return { do: "empty" };
  if (has("বড়", "বড়", "bigger", "larger", "enlarge", "zoom in")) return { do: "scale", by: has("অনেক", "much", "a lot") ? 1.25 : 1.12 };
  if (has("ছোট", "smaller", "shrink", "zoom out")) return { do: "scale", by: has("অনেক", "much", "a lot") ? 0.8 : 0.9 };
  for (const [re, look] of LOOK_WORDS) if (re.test(t) && has("ডিজাইন", "design", "স্টাইল", "style", "লুক", "look")) return { do: "look", look };
  if (has("অন্য লেআউট", "লেআউট বদল", "লেআউট পাল্ট", "অন্যভাবে", "another layout", "shuffle", "layout")) return { do: "layout" };
  for (const [re, look] of LOOK_WORDS) if (re.test(t)) return { do: "look", look };
  return null;
}

/** Examples shown under the box. */
export const COMMAND_EXAMPLES = ["এই পাতা সাদাকালো", "ছবিটা বড় করো", "অন্য লেআউট", "আর্চ ডিজাইন", "লেখা সরাও", "উল্টাও", "পাতা ৫", "লেখো: শুভ বিবাহ"];
