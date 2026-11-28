import { QUOTES_BN } from "./bangla";
/** Short lines for album pages (our own words). The editor's "Another quote" walks through them. */
export const QUOTES = [
  "Two families, one story, and a lifetime that starts today.",
  "Hold my hand, and we are halfway home.",
  "A smile is the most beautiful thing she wears today.",
  "Some moments are too lovely to keep only in memory.",
  "Every love story is beautiful, but ours is our favourite.",
  "Here begins a promise made of small, everyday kindnesses.",
  "She walked in like the first light of a winter morning.",
  "In a house full of people, they only saw each other.",
  "The best is yet to come, and it is coming together.",
  "Laughter, flowers, family, and the start of forever.",
  "A day of colour, a lifetime of togetherness.",
  "Mehendi on her hands, a hundred dreams in her eyes.",
  "Turmeric, laughter and the sound of every aunt singing.",
  "Their story was written slowly, and then all at once.",
  "Where there is love, there is always a celebration.",
  "Wrapped in red and gold, and in everyone's blessings.",
  "The quiet before the music, the calm before forever.",
  "Some promises are spoken; this one was felt.",
  "One look, one smile, and the whole room went quiet.",
  "Forever looks good on them.",
  "A new chapter, written in the softest light.",
  "Love is in the little moments no one plans.",
  "Grace in every step, joy in every glance.",
  "Today the stars wore gold, and so did she.",
  "Two hearts, one home, many happy years.",
  "Bless this day, these two, and every road ahead.",
  "The day they had dreamed of, finally here.",
  "Nothing says forever like the way he looks at her.",
  "Beautiful beginnings make the best memories.",
  "Moments like this are why we keep photographs.",
];

export function quoteAfter(t: string) {
  const list = /[\u0980-\u09FF]/.test(t) ? QUOTES_BN : QUOTES;
  const i = list.indexOf(t);
  return list[(i + 1) % list.length];
}
