"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserCircle, Tractor, Sprout, Landmark, LogOut, Warehouse, MapPin, Wallet, Sparkles, PackageSearch, CalendarClock, Milk, Calculator, Dna, Syringe, ShoppingBag, HandCoins } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";
import { LanguageToggle } from "./language-toggle";

/** Dairy ke andar wale hisse apne nav item ko roshan karein (alerts -> Nasal). */
const DAIRY_SUB: Record<string, string[]> = {
  "/portal/dairy/hisaab": ["/portal/dairy/hisaab"],
  "/portal/dairy/breeding": ["/portal/dairy/breeding", "/portal/dairy/alerts"],
  "/portal/dairy/health": ["/portal/dairy/health"],
};
export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (DAIRY_SUB[href]) return DAIRY_SUB[href].some((p) => pathname.startsWith(p));
  if (href === "/portal/dairy") return pathname.startsWith("/portal/dairy") && !Object.values(DAIRY_SUB).flat().some((p) => pathname.startsWith(p));
  return false;
}
export function getPortalNavItems(lang: Lang) {
  return [
    { href: "/portal/dashboard", label: t("nav_dashboard", lang), icon: LayoutDashboard },
    { href: "/portal/profile", label: t("nav_profile", lang), icon: UserCircle },
    { href: "/portal/wallet", label: t("nav_wallet", lang), icon: Wallet },
    // Phase 5: bill/orders aur adaigi/wade (Customer Portal ke safhe, kisan ke liye bhi)
    { href: "/portal/c/orders", label: t("pc_nav_bills_f", lang), icon: ShoppingBag },
    { href: "/portal/c/payments", label: t("pc_nav_pay_f", lang), icon: HandCoins },
    { href: "/portal/farms", label: t("nav_farms", lang), icon: MapPin },
    { href: "/portal/demand", label: t("nav_demand", lang), icon: PackageSearch },
    { href: "/portal/campaigns", label: t("nav_campaigns", lang), icon: CalendarClock },
    { href: "/portal/dairy", label: t("nav_dairy", lang), icon: Milk },
    { href: "/portal/dairy/hisaab", label: t("nav_dairy_hisaab", lang), icon: Calculator },
    { href: "/portal/dairy/breeding", label: t("nav_dairy_breeding", lang), icon: Dna },
    { href: "/portal/dairy/health", label: t("nav_dairy_health", lang), icon: Syringe },
    { href: "/portal/services/livestock", label: t("nav_livestock", lang), icon: Landmark },
    { href: "/portal/crops", label: t("nav_crops", lang), icon: Sprout },
    { href: "/portal/services/fertilizer", label: t("nav_fertilizer", lang), icon: Sprout },
    { href: "/portal/services/machinery", label: t("nav_machinery", lang), icon: Tractor },
    { href: "/portal/harvest", label: t("nav_farm_management", lang), icon: Warehouse },
    { href: "/portal/ai-assistant", label: t("nav_ai", lang), icon: Sparkles },
  ];
}

export function PortalSidebar({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const NAV_ITEMS = getPortalNavItems(lang);
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-[#0f2a1f] px-3 py-6 dark:bg-[#0b1322] sm:flex print:hidden">
      <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 px-2 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-yellow-500 font-bold text-white">A</span>
        <div>
          <p className="font-display text-base font-semibold text-white">{t("app_name", lang)}</p>
          <p className="text-[11px] text-emerald-100/60">{t("farmer_portal", lang)}</p>
        </div>
      </div>
      <div className="mb-4 px-2"><LanguageToggle current={lang} /></div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow" : "text-emerald-50/75 hover:bg-white/10 hover:text-white"}`}>
              <item.icon className="h-4 w-4 shrink-0" />{item.label}
            </Link>
          );
        })}
      </nav>
      <Link href="/" className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white">
        <LogOut className="h-4 w-4 shrink-0" />{t("back_to_website", lang)}
      </Link>
    </aside>
  );
}