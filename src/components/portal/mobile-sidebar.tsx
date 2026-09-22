"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";
import { getPortalNavItems } from "./sidebar";
import { LanguageToggle } from "./language-toggle";

export function PortalMobileSidebar({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const NAV_ITEMS = getPortalNavItems(lang);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("at_open_menu", lang)}
        className="rounded-lg p-2 text-surface-600 hover:bg-surface-100 sm:hidden dark:text-surface-300 dark:hover:bg-surface-800"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#1a1f36] px-3 py-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-2">
              <div>
                <p className="font-display text-lg font-semibold text-white">{t("app_name", lang)}</p>
                <p className="text-xs text-slate-400">{t("farmer_portal", lang)}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t("at_close_menu", lang)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4 px-2">
              <LanguageToggle current={lang} />
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
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
        </div>
      )}
    </>
  );
}