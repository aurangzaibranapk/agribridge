"use client";
import { usePathname } from "next/navigation";
import { t, type Lang } from "@/lib/i18n/translations";
import { PORTAL_NAV_GROUPS, isNavActive as sharedIsNavActive, type PortalNavGroup } from "@/lib/portal/nav";
import { LanguageToggle } from "./language-toggle";
import { NavFooter, NavList } from "./nav-list";
import { NAV_ICONS } from "./nav-icons";

/** Purana naam -- ab andar se wahi ek qaida (lib/portal/nav). */
export function isNavActive(pathname: string, href: string): boolean {
  return sharedIsNavActive(pathname, href);
}
/** Seedhi fehrist (purane istemal ke liye) -- groups se bani. */
export function getPortalNavItems(lang: Lang) {
  return PORTAL_NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, label: t(i.k, lang), icon: NAV_ICONS[i.icon] })));
}

export function PortalBrand({ lang }: { lang: Lang }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 px-2 pb-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-yellow-500 font-bold text-white" aria-hidden>A</span>
      <div>
        <p className="font-display text-base font-semibold text-white">{t("app_name", lang)}</p>
        <p className="text-[11px] text-emerald-100/60">{t("farmer_portal", lang)}</p>
      </div>
    </div>
  );
}

export function PortalSidebar({ lang, groups = PORTAL_NAV_GROUPS, badges }: { lang: Lang; groups?: PortalNavGroup[]; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#0f2a1f] px-3 py-6 dark:bg-[#0b1322] sm:flex print:hidden">
      <PortalBrand lang={lang} />
      <div className="mb-4 px-2"><LanguageToggle current={lang} /></div>
      <NavList groups={groups} lang={lang} pathname={pathname} tone="farmer" badges={badges} />
      <NavFooter lang={lang} />
    </aside>
  );
}
