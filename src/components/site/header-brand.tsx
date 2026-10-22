"use client";

import localFont from "next/font/local";
import { BrandWord } from "@/components/brand/brand-mark";
import type { Lang } from "@/lib/i18n/translations";

const urdu = localFont({
  src: "../../app/login/fonts/noto-nastaliq-urdu.woff2",
  variable: "--font-urdu",
  display: "swap",
  weight: "400 700",
});

/** Har safhe par ek hi lockup: naam, neeche us zaban ki tagline. */
export function HeaderBrand({ lang, tagline }: { lang: Lang; tagline: string }) {
  const rtl = lang === "ur";
  return (
    <div className={`min-w-0 ${rtl ? urdu.variable : ""}`}>
      <BrandWord className="block truncate font-display text-lg font-bold leading-tight text-surface-950 sm:text-xl dark:text-white" />
      <span
        dir={rtl ? "rtl" : "ltr"}
        className={`block truncate text-[11px] text-surface-500 sm:text-xs ${rtl ? "font-urdu leading-snug" : "leading-tight"}`}
      >
        {tagline}
      </span>
    </div>
  );
}
