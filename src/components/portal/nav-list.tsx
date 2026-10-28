"use client";
import Link from "next/link";
import { Globe } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";
import { activeHref, hrefsOf, type PortalNavGroup } from "@/lib/portal/nav";
import { NAV_ICONS } from "./nav-icons";
import { PortalLogout } from "./portal-logout";

const OTHERS: Record<Lang, Lang[]> = { en: ["rm", "ur"], rm: ["en", "ur"], ur: ["en", "rm"] };
export type NavTone = "farmer" | "customer";
const ACTIVE: Record<NavTone, string> = {
  farmer: "bg-gradient-to-r from-green-600 to-green-700 text-white shadow rtl:bg-gradient-to-l",
  customer: "bg-gradient-to-r from-emerald-700 to-[#16356e] text-white shadow-[0_8px_22px_rgba(12,60,40,.35)] rtl:bg-gradient-to-l",
};
const IDLE: Record<NavTone, string> = { farmer: "text-emerald-50/80 hover:bg-white/10 hover:text-white", customer: "text-indigo-50/80 hover:bg-white/10 hover:text-white" };
const SUB: Record<NavTone, string> = { farmer: "text-emerald-100/55", customer: "text-indigo-200/55" };

/**
 * Grouped menu (Phase 6) -- desktop sidebar aur phone drawer dono yahi.
 * Roshan item ka qaida `activeHref` (lib/portal/nav) -- har jagah ek.
 */
export function NavList({ groups, lang, pathname, tone, badges = {} }: { groups: PortalNavGroup[]; lang: Lang; pathname: string; tone: NavTone; badges?: Record<string, number> }) {
  const active = activeHref(pathname, hrefsOf(groups));
  return (
    <nav aria-label={t("ph6_nav_label", lang)} className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
      {groups.map((g) => (
        <div key={g.key} role="group" aria-labelledby={`pnav-${g.key}`}>
          <p id={`pnav-${g.key}`} className={`mb-1 flex items-baseline justify-between px-3 text-[10px] font-semibold uppercase tracking-[.12em] ${SUB[tone]}`}>
            <span>{t(g.k, lang === "ur" ? "rm" : lang)}</span>
            <span dir="rtl" lang="ur" className="normal-case tracking-normal">{t(g.k, "ur")}</span>
          </p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const on = it.href === active;
              const Icon = NAV_ICONS[it.icon];
              const n = it.badge ? badges[it.badge] ?? 0 : 0;
              return (
                <li key={it.href}>
                  <Link href={it.href} aria-current={on ? "page" : undefined}
                    className={`relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition motion-reduce:transition-none ${on ? `${ACTIVE[tone]} before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-amber-400` : IDLE[tone]}`}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 leading-tight">
                      {t(it.k, lang)}
                      <span className={`block truncate text-[10px] ${on ? "text-white/75" : SUB[tone]}`}>
                        {OTHERS[lang].map((o, i) => <span key={o}>{i ? " · " : ""}<span dir={o === "ur" ? "rtl" : undefined}>{t(it.k, o)}</span></span>)}
                      </span>
                    </span>
                    {n > 0 && (
                      <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold tabular-nums text-amber-950" aria-label={t("ph6_badge_due", lang).replace("{n}", String(n))}>{n}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Neeche ke do alag kaam: asal Log out, aur website par wapas. */
export function NavFooter({ lang }: { lang: Lang }) {
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <PortalLogout lang={lang} />
      <Link href="/" className="flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white">
        <Globe className="h-4 w-4 shrink-0" aria-hidden />{t("back_to_website", lang)}
      </Link>
    </div>
  );
}
