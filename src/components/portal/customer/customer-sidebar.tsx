"use client";
import { usePathname } from "next/navigation";
import { t, type Lang } from "@/lib/i18n/translations";
import { CUSTOMER_NAV_GROUPS, activeHref, hrefsOf } from "@/lib/portal/nav";
import { LanguageToggle } from "../language-toggle";
import { NavFooter, NavList } from "../nav-list";
import { NAV_ICONS } from "../nav-icons";
import { PortalMobileSidebar } from "../mobile-sidebar";
import { brandName } from "@/lib/brand";

/** Purani fehrist (phase 5) -- ab groups se bani; wahi raaste aur keys. */
export const CUSTOMER_NAV = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, k: i.k, icon: NAV_ICONS[i.icon] })));
export function custNavActive(pathname: string, href: string): boolean {
  return activeHref(pathname, hrefsOf(CUSTOMER_NAV_GROUPS)) === href;
}

function Brand({ lang }: { lang: Lang }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 px-2 pb-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-[#16356e] text-[11px] font-black text-white" aria-hidden>AB</span>
      <div>
        <p className="font-display text-base font-bold text-white">{brandName(lang)}</p>
        <p className="text-[10px] text-white/45">{t("pc_portal", lang)}</p>
      </div>
    </div>
  );
}
export function CustomerSidebar({ lang, pathname: forced }: { lang: Lang; pathname?: string }) {
  const live = usePathname();
  const pathname = forced ?? live;
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-white/10 bg-[#0c1a30]/88 px-3 py-6 backdrop-blur-xl dark:bg-[#07111c]/90 sm:flex print:hidden">
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
