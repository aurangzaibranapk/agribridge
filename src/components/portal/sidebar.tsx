"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserCircle, Tractor, Sprout, Landmark, LogOut, Warehouse, MapPin, Wallet, Sparkles } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";
import { LanguageToggle } from "./language-toggle";

export function getPortalNavItems(lang: Lang) {
  return [
    { href: "/portal/dashboard", label: t("nav_dashboard", lang), icon: LayoutDashboard },
    { href: "/portal/profile", label: t("nav_profile", lang), icon: UserCircle },
    { href: "/portal/wallet", label: t("nav_wallet", lang), icon: Wallet },
    { href: "/portal/farms", label: t("nav_farms", lang), icon: MapPin },
    { href: "/portal/services/livestock", label: t("nav_livestock", lang), icon: Landmark },
    { href: "/portal/crops", label: t("nav_crops", lang), icon: Sprout },
    { href: "/portal/services/fertilizer", label: t("nav_fertilizer", lang), icon: Sprout },
    { href: "/portal/services/machinery", label: t("nav_machinery", lang), icon: Tractor },
    { href: "/portal/harvest", label: t("nav_farm_management", lang), icon: Warehouse },
    { href: "/portal/ai-assistant", label: lang === "ur" ? "کسان AI اسسٹنٹ" : "Kisan AI Assistant", icon: Sparkles },
  ];
}

export function PortalSidebar({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const NAV_ITEMS = getPortalNavItems(lang);
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-[#1a1f36] px-3 py-6 sm:flex">
      <div className="mb-4 px-2">
        <p className="font-display text-lg font-semibold text-white">{t("app_name", lang)}</p>
        <p className="text-xs text-slate-400">{t("farmer_portal", lang)}</p>
      </div>
      <div className="mb-4 px-2">
        <LanguageToggle current={lang} />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-600 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/"
        className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {t("back_to_website", lang)}
      </Link>
    </aside>
  );
}