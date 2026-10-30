import Link from "next/link";
import { BarChart3, Coins, Home, Shield, Wallet } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { brandName } from "@/lib/brand";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

function Pair({ a, b, lang }: { a: TranslationKey; b: TranslationKey; lang: Lang }) {
  return (
    <span>
      {t(a, lang)} <span className="font-normal text-white/45">({t(b, lang)})</span>
    </span>
  );
}

export function CustodyRail({
  lang,
  homeHref,
  count,
}: {
  lang: Lang;
  homeHref: string;
  /** null = ginti parhi nahi. */
  count: number | null;
}) {
  const items: { href: string; icon: typeof Home; label: TranslationKey; alt: TranslationKey; active?: boolean; badge?: boolean }[] = [
    { href: homeHref, icon: Home, label: "cny_nav_home", alt: "cny_nav_home_alt" },
    { href: "/admin/cash-custody", icon: Shield, label: "cny_nav_custody", alt: "cny_nav_custody_alt", active: true, badge: true },
    { href: "/admin/cash-handover", icon: Wallet, label: "cny_nav_wasoli", alt: "cny_nav_wasoli_alt" },
    { href: "/admin/finance/pos-deposits", icon: Coins, label: "cny_nav_jama", alt: "cny_nav_jama_alt" },
    { href: "/admin/reports/finance", icon: BarChart3, label: "cny_nav_reports", alt: "cny_nav_reports_alt" },
  ];

  return (
    <aside data-testid="cash-needs-rail" className="flex flex-col border-b border-white/10 bg-[#0d1c16]/90 p-4 backdrop-blur-xl lg:min-h-[680px] lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5 px-1">
          <BrandMark className="h-10 w-10 rounded-xl" />
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold leading-tight text-white">{brandName(lang)}</span>
          </span>
        </Link>
        <div className="lg:hidden">
          <LanguageSwitch current={lang} tone="onDark" />
        </div>
      </div>
      <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-6 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-cash-nav={item.active ? "custody" : undefined}
              className={
                "flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition lg:shrink lg:w-full " +
                (item.active
                  ? "bg-rose-500/15 font-semibold text-white ring-1 ring-rose-400/35"
                  : "text-white/75 hover:bg-white/5 hover:text-white")
              }
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className={"h-4 w-4 shrink-0 " + (item.active ? "text-rose-200" : "text-white/50")} />
                <span className="truncate">
                  <Pair a={item.label} b={item.alt} lang={lang} />
                </span>
              </span>
              {item.badge && count !== 0 && (
                <span
                  data-testid="cash-needs-badge"
                  className={
                    "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold " +
                    (count === null ? "bg-amber-500/80 text-black" : "bg-red-500 text-white")
                  }
                >
                  {count === null ? "—" : count}
                </span>
              )}
              {item.badge && count === 0 && (
                <span data-testid="cash-needs-badge" className="text-[11px] font-semibold text-white/35">
                  0
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 hidden lg:mt-auto lg:block lg:pt-6">
        <LanguageSwitch current={lang} tone="onDark" />
      </div>
    </aside>
  );
}
