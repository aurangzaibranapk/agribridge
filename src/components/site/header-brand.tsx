"use client";

import localFont from "next/font/local";
import { PUBLIC_BRAND } from "@/lib/brand";

const urdu = localFont({
  src: "../../app/login/fonts/noto-nastaliq-urdu.woff2",
  variable: "--font-urdu",
  display: "swap",
  weight: "400 700",
});

/** Naam upar, tagline seedha neeche. Urdu mein dono khatte. */
export function HeaderBrand({ tagline, urdu: isUrdu = false }: { name?: string; tagline: string; urdu?: boolean }) {
  return (
    <div dir={isUrdu ? "rtl" : "ltr"} className={`min-w-0 ${isUrdu ? `${urdu.variable} font-urdu text-right` : "text-left"}`}>
      <span className={`block truncate text-lg font-bold leading-tight text-surface-950 sm:text-xl dark:text-white ${isUrdu ? "leading-snug" : "font-display"}`}>{PUBLIC_BRAND}</span>
      {tagline ? (
        <span className={`block truncate text-[11px] sm:text-xs ${isUrdu ? "leading-snug text-surface-600" : "leading-tight text-surface-500"}`}>
          {tagline}
        </span>
      ) : null}
    </div>
  );
}
