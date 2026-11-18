import localFont from "next/font/local";

/** The portal's one display face: program names over photos (OFL licence, kept in the repo). */
export const display = localFont({
  src: [{ path: "../../../fonts/cormorant-garamond-latin-wght-normal.woff2", weight: "300 700", style: "normal" }],
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
