"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, BookOpen, ShoppingBag, Wallet, UserCircle, LogOut, Menu, X } from "lucide-react";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import { LanguageToggle } from "../language-toggle";

const OTHERS: Record<Lang, Lang[]> = { en: ["rm", "ur"], rm: ["en", "ur"], ur: ["en", "rm"] };
export const CUSTOMER_NAV: { href: string; k: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { href: "/portal/c", k: "pc_nav_dash", icon: LayoutDashboard },
  { href: "/portal/c/khata", k: "pc_nav_khata", icon: BookOpen },
  { href: "/portal/c/orders", k: "pc_nav_orders", icon: ShoppingBag },
  { href: "/portal/c/payments", k: "pc_nav_pay", icon: Wallet },
  { href: "/portal/c/profile", k: "pc_nav_profile", icon: UserCircle },
];
export function custNavActive(pathname: string, href: string): boolean {
  return href === "/portal/c" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function Items({ lang, pathname }: { lang: Lang; pathname: string }) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[.12em] text-indigo-200/50">{t("pc_menu", lang)}</p>
      {CUSTOMER_NAV.map((it) => {
        const on = custNavActive(pathname, it.href);
        return (
          <Link key={it.href} href={it.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${on ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_6px_18px_rgba(37,99,235,.35)]" : "text-indigo-50/80 hover:bg-white/10 hover:text-white"}`}>
            <it.icon className="h-4 w-4 shrink-0" />
            <span className="leading-tight">
              {t(it.k, lang)}
              <span className={`block text-[10px] ${on ? "text-indigo-100" : "text-indigo-200/50"}`}>
                {OTHERS[lang].map((o, i) => <span key={o}>{i ? " · " : ""}<span dir={o === "ur" ? "rtl" : undefined}>{t(it.k, o)}</span></span>)}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
function Brand({ lang }: { lang: Lang }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 px-2 pb-4">
      <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 via-rose-500 to-violet-500" />
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
    <aside className="hidden w-60 shrink-0 flex-col bg-[#0b1f44] px-3 py-6 dark:bg-[#06102a] sm:flex print:hidden">
      <Brand lang={lang} />
      <div className="mb-4 px-2"><LanguageToggle current={lang} /></div>
      <Items lang={lang} pathname={pathname} />
      <Link href="/" className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white">
        <LogOut className="h-4 w-4 shrink-0" />{t("back_to_website", lang)}
      </Link>
    </aside>
  );
}
export function CustomerMobileNav({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t("at_open_menu", lang)} className="rounded-lg p-2 text-surface-600 hover:bg-surface-100 sm:hidden dark:text-surface-300 dark:hover:bg-surface-800">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#0b1f44] px-3 py-6 shadow-xl">
            <div className="flex justify-end"><button onClick={() => setOpen(false)} aria-label={t("at_close_menu", lang)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
            <Brand lang={lang} />
            <div className="mb-4 px-2"><LanguageToggle current={lang} /></div>
            <Items lang={lang} pathname={pathname} />
          </aside>
        </div>
      )}
    </>
  );
}
