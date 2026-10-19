import localFont from "next/font/local";

/**
 * Urdu font -- project ke andar (OFL, src/app/fonts/urdu/OFL.txt), sirf
 * Arabi rasm-ul-khat ka subset (Latin aur hindse Nunito se hi aate hain,
 * taake raseed jaise tabular adad rahein).
 *
 *   Noto Naskh Arabic  ~33 KB  -- jism (body), parhne mein saaf
 *   Noto Nastaliq Urdu ~178 KB -- sirf sarkhiyan (h1-h3)
 *
 * `preload: false`: <link rel=preload> nahi lagta. Class sirf `ur` par
 * lagti hai, aur browser font tabhi utaarta hai jab koi likhai waqai is
 * font mein ho -- EN / Roman wala kisan ye 211 KB kabhi nahi utaarta.
 *
 * `fallback` jaan boojh kar khali: is font mein Latin nahi, to naam / code
 * (Latin) seedha agle font (Nunito, globals.css ka stack) par jate hain --
 * kisi system ke Arabic font ki Latin par nahi.
 */
export const urduBody = localFont({
  src: "../../app/fonts/urdu/NotoNaskhArabic-ur-subset.woff2",
  weight: "400 700",
  variable: "--font-urdu",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const urduDisplay = localFont({
  src: "../../app/fonts/urdu/NotoNastaliqUrdu-ur-subset.woff2",
  weight: "400 700",
  variable: "--font-urdu-display",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

/** Portal ke dhanche par lagne wali classes -- sirf ur par font, baqi par kuch nahi. */
export function portalShellClass(lang: string): string {
  return lang === "ur" ? `portal-shell font-urdu ${urduBody.variable} ${urduDisplay.variable}` : "portal-shell";
}
