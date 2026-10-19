"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type Lang } from "@/lib/i18n/translations";
import { activeTab, portalTabs } from "@/lib/portal/nav";
import { NAV_ICONS } from "./nav-icons";
import { OPEN_MENU_EVENT } from "./use-drawer";

/** Phone ki neeche wali tab bar: Home · Khata · Dairy · Bills · More. */
export function PortalTabBar({ lang, kind, hasDairy }: { lang: Lang; kind: "farmer" | "customer"; hasDairy: boolean }) {
  const pathname = usePathname();
  const tabs = portalTabs(kind, hasDairy);
  const on = activeTab(pathname, kind, hasDairy);
  const tone = kind === "farmer" ? "text-green-700 dark:text-green-300" : "text-blue-700 dark:text-blue-300";
  return (
    <nav aria-label={t("ph6_tabbar_label", lang)}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-[#1e2b4a] dark:bg-[#0b1322]/95 sm:hidden print:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tb) => {
          const Icon = NAV_ICONS[tb.icon];
          const active = on === tb.key;
          const cls = `flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? tone : "text-surface-500 dark:text-slate-400"}`;
          const inner = (<><Icon className="h-5 w-5" aria-hidden /><span>{t(tb.k, lang)}</span>{active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-amber-400" aria-hidden />}</>);
          return (
            <li key={tb.key} className="relative flex justify-center">
              {tb.href ? (
                <Link href={tb.href} aria-current={active ? "page" : undefined} className={cls}>{inner}</Link>
              ) : (
                <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))} aria-haspopup="dialog" aria-controls="portal-drawer" aria-current={active ? "page" : undefined} className={cls}>{inner}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
