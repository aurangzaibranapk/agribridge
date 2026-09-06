import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteContainer } from "@/components/site/site-container";

/**
 * Andar ke safhon ka upar wala hissa.
 *
 * Ye Home ke CMS wale HeroSlider se ALAG cheez hai aur jaan boojh kar
 * alag hai: Home par das banner chalte hain jo malik admin se badalte
 * hain; andar ke safhon par ek saada, halka sa unwan chahiye jo jaldi
 * khule aur baat seedhi kahe.
 *
 * Rang wohi hain jo poore nizam ke hain -- gehra sabz `#1E4A2E` aur
 * sunehri `#C9A227`. Nayi rangat NAHI banayi ja rahi: login ka safha,
 * header aur admin sab isi par hain, aur website un se alag dikhe to
 * banda samajhta hai ke do alag cheezein hain.
 */
export function PageHero({
  eyebrow,
  title,
  highlight,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-[#C9A227]/15 bg-[#f6f8f3] dark:border-surface-800 dark:bg-surface-950">
      {/* Halke se rang ke dhabbe. `pointer-events-none` zaroori hai --
          warna ye upar baithe hue khane neeche ke button dabne nahi
          dete. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#1E4A2E]/[0.06] blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#C9A227]/[0.08] blur-3xl" />
      </div>

      <SiteContainer className="relative py-14 sm:py-20 lg:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-500 hover:text-[#1E4A2E] dark:text-surface-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>

        <span className="mt-5 inline-flex rounded-full border border-[#C9A227]/25 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9791A] dark:bg-surface-900">
          {eyebrow}
        </span>

        <h1 className="mt-5 max-w-4xl text-balance font-display text-3xl font-semibold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl dark:text-white">
          {title} {highlight && <span className="text-[#1E4A2E] dark:text-brand-400">{highlight}</span>}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-8 text-surface-600 dark:text-surface-400">
          {description}
        </p>

        {(primaryHref || secondaryHref) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {primaryLabel && primaryHref && (
              <Link
                href={primaryHref}
                className="rounded-xl bg-[#1E4A2E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#163A23]"
              >
                {primaryLabel}
              </Link>
            )}
            {secondaryLabel && secondaryHref && (
              <Link
                href={secondaryHref}
                className="rounded-xl border border-surface-200 bg-white px-6 py-3 text-sm font-semibold text-surface-900 transition hover:border-[#1E4A2E]/40 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        )}
      </SiteContainer>
    </section>
  );
}
