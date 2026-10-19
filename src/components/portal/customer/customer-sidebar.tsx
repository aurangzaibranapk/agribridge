"use client";
import { usePathname } from "next/navigation";
import { t, type Lang } from "@/lib/i18n/translations";
import { CUSTOMER_NAV_GROUPS, activeHref, hrefsOf } from "@/lib/portal/nav";
import { LanguageToggle } from "../language-toggle";
import { NavFooter, NavList } from "../nav-list";
import { NAV_ICONS } from "../nav-icons";
import { PortalMobileSidebar } from "../mobile-sidebar";

/** Purani fehrist (phase 5) -- ab groups se bani; wahi raaste aur keys. */
export const CUSTOMER_NAV = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, k: i.k, icon: NAV_ICONS[i.icon] })));
export function custNavActive(pathname: string, href: string): boolean {
  return activeHref(pathname, hrefsOf(CUSTOMER_NAV_GROUPS)) === href;
}

function Brand({ lang }: { lang: Lang }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 px-2 pb-4">
      <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 via-rose-500 to-violet-500" aria-hidden />
      <div>
        <p className="font-display text-base font-bold text-white">AgriBridge</p>
        <p className="text-[11px] text-indigo-200/60">{t("pc_tagline", lang)}</p>
      </div>
    </div>
  );
}
export function CustomerSidebar({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#0b1f44] px-3 py-6 dark:bg-[#06102a] sm:flex print:hidden">
      <Brand lang={lang} />
      <div className="mb-4 px-2"><LanguageToggle current={lang} /></div>
      <NavList groups={CUSTOMER_NAV_GROUPS} lang={lang} pathname={pathname} tone="customer" />
      <NavFooter lang={lang} />
    </aside>
  );
}
export function CustomerMobileNav({ lang }: { lang: Lang }) {
  return <PortalMobileSidebar lang={lang} groups={CUSTOMER_NAV_GROUPS} tone="customer" brand={<Brand lang={lang} />} />;
}
