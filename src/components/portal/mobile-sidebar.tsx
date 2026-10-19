"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";
import { PORTAL_NAV_GROUPS, type PortalNavGroup } from "@/lib/portal/nav";
import { LanguageToggle } from "./language-toggle";
import { PortalBrand } from "./sidebar";
import { NavFooter, NavList, type NavTone } from "./nav-list";
import { OPEN_MENU_EVENT, useDrawer } from "./use-drawer";

/**
 * Phone ka drawer -- wahi groups aur wahi roshan qaida jo sidebar ka
 * (pehle yahan sirf poori URL milti to roshan hota tha).
 */
export function PortalMobileSidebar({ lang, groups = PORTAL_NAV_GROUPS, tone = "farmer", badges, brand }: { lang: Lang; groups?: PortalNavGroup[]; tone?: NavTone; badges?: Record<string, number>; brand?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);
  const ref = useDrawer(open, close);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const o = () => setOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, o);
    return () => window.removeEventListener(OPEN_MENU_EVENT, o);
  }, []);
  const bg = tone === "farmer" ? "bg-[#0f2a1f] dark:bg-[#0b1322]" : "bg-[#0b1f44] dark:bg-[#06102a]";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("at_open_menu", lang)} aria-expanded={open} aria-controls="portal-drawer"
        className="grid h-11 w-11 place-items-center rounded-lg text-surface-600 hover:bg-surface-100 sm:hidden dark:text-surface-300 dark:hover:bg-surface-800">
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden />
          <div ref={ref} id="portal-drawer" role="dialog" aria-modal="true" aria-label={t("ph6_nav_label", lang)}
            className={`absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-xl ${bg}`}>
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="min-w-0 flex-1 [&>div]:mb-0 [&>div]:border-0 [&>div]:pb-0">{brand ?? <PortalBrand lang={lang} />}</div>
              <button type="button" onClick={close} aria-label={t("at_close_menu", lang)} className="grid h-11 w-11 place-items-center rounded-lg text-slate-300 hover:bg-white/10">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="mb-3 px-2"><LanguageToggle current={lang} /></div>
            <NavList groups={groups} lang={lang} pathname={pathname} tone={tone} badges={badges} />
            <NavFooter lang={lang} />
          </div>
        </div>
      )}
    </>
  );
}
