"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type Lang } from "@/lib/i18n/translations";
import { breadcrumb, PORTAL_NAV_GROUPS, type PortalNavGroup } from "@/lib/portal/nav";

/** Header ka breadcrumb: Portal › Dairy › Breeding (desktop par). */
export function PortalBreadcrumb({ lang, groups = PORTAL_NAV_GROUPS }: { lang: Lang; groups?: PortalNavGroup[] }) {
  const crumbs = breadcrumb(usePathname(), groups);
  return (
    <nav aria-label={t("ph6_crumb_label", lang)} className="hidden min-w-0 sm:block">
      <ol className="flex items-center gap-1.5 truncate text-xs text-surface-500 dark:text-slate-400">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="rtl:-scale-x-100">›</span>}
            {c.href ? <Link href={c.href} className="rounded hover:text-surface-900 dark:hover:text-white">{t(c.k, lang)}</Link>
              : <span aria-current="page" className="font-semibold text-surface-800 dark:text-slate-100">{t(c.k, lang)}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
