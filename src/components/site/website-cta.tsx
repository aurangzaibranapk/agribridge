import Link from "next/link";
import { SiteContainer } from "@/components/site/site-container";

/** Safhe ke aakhir mein agla qadam — har safhe par ek hi shakl mein. */
export function WebsiteCta({
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="bg-white py-14 dark:bg-surface-950 sm:py-20">
      <SiteContainer>
        <div className="rounded-3xl border border-[#1E4A2E]/10 bg-[#f6f8f3] px-6 py-12 text-center sm:px-10 dark:border-surface-800 dark:bg-surface-900">
          <h2 className="text-balance font-display text-2xl font-semibold text-surface-900 sm:text-3xl dark:text-white">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-surface-600 sm:text-base dark:text-surface-400">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={primaryHref}
              className="rounded-xl bg-[#1E4A2E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#163A23]"
            >
              {primaryLabel}
            </Link>
            {secondaryLabel && secondaryHref && (
              <Link
                href={secondaryHref}
                className="rounded-xl border border-surface-200 bg-white px-6 py-3 text-sm font-semibold text-surface-900 transition hover:border-[#1E4A2E]/40 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </SiteContainer>
    </section>
  );
}
