import Link from "next/link";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

export type MastersTab = "categories" | "brands" | "companies";

const TABS: { key: MastersTab; href: string; label: TranslationKey }[] = [
  { key: "categories", href: "/admin/categories", label: "at_categories" },
  { key: "brands", href: "/admin/brands", label: "at_brands" },
  { key: "companies", href: "/admin/companies", label: "at_companies_brands" },
];

/** Product Masters (265): qismein, brand, companies -- ek patti. */
export function MastersTabs({ current, lang }: { current: MastersTab; lang: Lang }) {
  return (
    <nav className="mb-4 -mt-2 flex flex-wrap gap-1 border-b border-surface-200 pb-2 text-sm dark:border-surface-800" aria-label="Product Masters">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-full px-3 py-1.5 ${tab.key === current ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"}`}
        >
          {t(tab.label, lang)}
        </Link>
      ))}
    </nav>
  );
}
