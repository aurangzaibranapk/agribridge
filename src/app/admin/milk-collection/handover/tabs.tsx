import Link from "next/link";
import { t, type Lang } from "@/lib/i18n/translations";

const TABS = [
  ["summary", "/admin/milk-collection/handover", "mh_tab_summary"],
  ["company", "/admin/milk-collection/handover/company", "mh_tab_company"],
  ["vendor", "/admin/milk-collection/handover/vendor", "mh_tab_vendor"],
  ["party", "/admin/milk-collection/handover/party", "mh_tab_party"],
  ["parties", "/admin/milk-collection/handover/parties", "mh_tab_parties"],
] as const;

export function HandoverTabs({ lang, current, date }: { lang: Lang; current: (typeof TABS)[number][0]; date: string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Milk handover">
      {TABS.map(([key, href, label]) => {
        const on = key === current;
        const path = date ? `${href}?date=${date}` : href;
        return (
          <Link
            key={key}
            href={path}
            className={on ? "rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700"}
            aria-current={on ? "page" : undefined}
          >
            {t(label, lang)}
          </Link>
        );
      })}
    </nav>
  );
}
