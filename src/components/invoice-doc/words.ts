const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function upTo999(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? " " + ONES[r % 10] : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}

/** 125000 → "One Lakh Twenty Five Thousand" (South Asian grouping). */
export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${upTo999(lakh)} Lakh`);
  if (thousand) parts.push(`${upTo999(thousand)} Thousand`);
  if (n) parts.push(upTo999(n));
  return parts.join(" ");
}

const UNIT: Record<string, [string, string]> = { BDT: ["Taka", "Paisa"], USD: ["Dollars", "Cents"], INR: ["Rupees", "Paise"], EUR: ["Euros", "Cents"], GBP: ["Pounds", "Pence"] };

/** "Taka Fifty Thousand Only" */
export function amountInWords(amount: number, currency = "BDT") {
  const [big, small] = UNIT[currency] ?? [currency, "Cents"];
  const whole = Math.floor(Math.abs(amount));
  const frac = Math.round((Math.abs(amount) - whole) * 100);
  return `${big} ${numberToWords(whole)}${frac ? ` and ${numberToWords(frac)} ${small}` : ""} Only`;
}
