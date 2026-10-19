"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { DASHBOARD_ITEM } from "@/components/layout/nav-items";
import { iconByName } from "@/lib/access/icons";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { usePending, PENDING_PAGE } from "@/components/pending/pending-context";
import { RedBadge, NayaPill, PendingMeta, ZeroMark } from "@/components/pending/pending-ui";
import { badgeForGroup, badgeForHref } from "@/lib/pending/categories";
export type { NavItem } from "@/components/layout/nav-items";

/**
 * Menu ab database se aata hai, is liye group aur item yahan tak taiyar
 * shakal mein pahunchte hain. Icon ka sirf naam aata hai -- us ka
 * component yahan banta hai, kyunke component server se client tak bheja
 * nahi ja sakta.
 */
export interface SidebarGroup {
  key: string;
  label: string;
  items: { href: string; label: string; icon: string | null; section?: string | null }[];
}

/** Khula safha neela (laal sirf "baqi kaam" ke liye). */
const ACTIVE_CLS = "bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,.7)]";
const IDLE_CLS = "text-surface-700 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-white/5 dark:hover:text-white";
const PENDING_CLS = "border-l-red-500 bg-red-500/[0.07] text-surface-900 hover:bg-red-500/[0.11] dark:border-l-red-400 dark:bg-red-500/[0.12] dark:text-white";

export function Sidebar({
  subtitle,
  homeHref = "/",
  role = "",
  allowedPages = null,
  groups = null,
}: {
  subtitle: string;
  homeHref?: string;
  role?: string;
  allowedPages?: string[] | null;
  groups?: SidebarGroup[] | null;
}) {
  const pathname = usePathname();
  const lang = useLang();
  // Pending badges (582). `enabled=false` (migration na ho) par sab pehle jaisa.
  const pend = usePending();
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const isUnrestricted = role === "owner" || role === "super_admin" || role === "admin";
  const visibleGroups: SidebarGroup[] = groups ?? [];

  const activeGroupLabel = visibleGroups.find((g) => g.items.some((item) => isActive(item.href)))?.label;
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(activeGroupLabel ? [activeGroupLabel] : [])
  );
  // Boss (19 September): "jo link browser mein khula ho, sidebar mein
  // wo nazar aaye/highlight ho." Highlight pehle se tha, magar group
  // sirf pehli dafa khulta tha -- aage navigate karne par naya active
  // safha band group ke andar chhupa rehta tha. Ab jab bhi rasta
  // badle, us ka group khud khul jata hai (baqi khule group band nahi
  // hote -- banda jo khud khol chuka hai wo waise ka waisa rehta hai).
  useEffect(() => {
    if (!activeGroupLabel) return;
    setOpenGroups((prev) => {
      if (prev.has(activeGroupLabel)) return prev;
      const next = new Set(prev);
      next.add(activeGroupLabel);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeGroupLabel]);
  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Sidebar HAMESHA poori chaurai -- koi collapse / icon-only nahi (malik, 19 Oct).
  return (
    <aside data-sidebar="admin" className="hidden h-screen min-h-0 w-72 shrink-0 overflow-hidden border-r border-surface-200 bg-white/90 backdrop-blur-xl lg:flex lg:flex-col dark:border-white/10 dark:bg-[#0b1430]">
      <Link href={homeHref} className="flex h-16 items-center gap-2 border-b border-surface-200 px-5 dark:border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-blue-600 text-sm font-bold text-white">{t("au_ar", lang)}</div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-tight text-surface-900 dark:text-white">{t("au_company", lang)}</p>
          <p className="truncate text-xs text-surface-500 dark:text-surface-400">{subtitle}</p>
        </div>
        {pend.enabled && (
          <span className="flex items-center gap-1">
            <NayaPill n={pend.totals.naya} lang={lang} short />
            <RedBadge n={pend.totals.pending} />
          </span>
        )}
      </Link>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
        {(isUnrestricted || (allowedPages ?? []).includes(DASHBOARD_ITEM.href)) && homeHref !== DASHBOARD_ITEM.href && (
          <Link
            href={DASHBOARD_ITEM.href}
            className={cn(
              "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              isActive(DASHBOARD_ITEM.href) ? ACTIVE_CLS : IDLE_CLS
            )}
          >
            <span className="flex items-center gap-2.5">
              <DASHBOARD_ITEM.icon className={cn("h-4 w-4", isActive(DASHBOARD_ITEM.href) ? "text-white" : "text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-200")} />
              {DASHBOARD_ITEM.label}
            </span>
          </Link>
        )}
        {pend.enabled && (
          <Link
            href={PENDING_PAGE}
            data-pending-item={pend.totals.pending > 0 ? "pending" : "zero"}
            className={cn(
              "group flex items-center justify-between gap-2 rounded-xl border-l-[3px] px-3 py-2 text-sm font-medium transition-colors",
              isActive(PENDING_PAGE) ? ACTIVE_CLS + " border-l-red-400" : pend.totals.pending > 0 ? PENDING_CLS : "border-l-transparent " + IDLE_CLS
            )}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2.5 font-semibold">
                <Inbox className="h-4 w-4 shrink-0" />
                {t("apb_menu", lang)}
              </span>
              {pend.totals.pending > 0 && <PendingMeta days={pend.totals.oldestDays} pendingWith={null} lang={lang} onDark={isActive(PENDING_PAGE)} />}
            </span>
            <span className="flex items-center gap-1">
              <NayaPill n={pend.totals.naya} lang={lang} />
              {pend.totals.pending > 0 ? <RedBadge n={pend.totals.pending} /> : <ZeroMark />}
            </span>
          </Link>
        )}
        <div className="my-2 border-t border-surface-200 dark:border-white/10" />
        {visibleGroups.map((group) => {
          const isOpen = openGroups.has(group.label);
          const groupActive = group.items.some((item) => isActive(item.href));
          const gb = pend.enabled ? badgeForGroup(pend.counts, group.key, group.items.map((i) => i.href)) : null;
          return (
            <div key={group.key}>
              <div className={cn("flex w-full items-center rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors", groupActive ? "text-blue-700 dark:text-blue-300" : "text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-surface-200")}>
                {isUnrestricted ? <Link href={group.key === "master" ? "/admin/command-center" : group.key === "reports" ? "/admin/reports" : `/admin/department-dashboard/${group.key}`} className="min-w-0 flex-1 truncate px-3 py-2">{group.label}</Link> : <button type="button" onClick={() => toggleGroup(group.label)} className="min-w-0 flex-1 truncate px-3 py-2 text-left uppercase">{group.label}</button>}
                {pend.enabled && (
                  <span data-group-badge={gb ? gb.pending : 0} className="flex items-center gap-1 normal-case tracking-normal">
                    {gb ? (
                      <>
                        <NayaPill n={gb.naya} lang={lang} short />
                        <RedBadge n={gb.pending} />
                      </>
                    ) : (
                      <ZeroMark />
                    )}
                  </span>
                )}
                <button type="button" onClick={() => toggleGroup(group.label)} aria-label={`${group.label} menu`} className="p-2 pr-3">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
              </div>
              {isOpen && (
                <div className="space-y-0.5 pb-1">
                  {group.items.map((item, index) => {
                    const active = isActive(item.href);
                    // Sarkhi sirf wahan chhapti hai jahan wo badalti hai --
                    // har item par dohrana fehrist ko lamba karta hai, saaf
                    // nahi.
                    const prevSection = index > 0 ? (group.items[index - 1].section ?? null) : null;
                    const section = item.section ?? null;
                    const showSection = !!section && section !== prevSection;
                    const Icon = iconByName(item.icon);
                    const b = pend.enabled ? badgeForHref(pend.counts, item.href) : null;
                    return (
                      <div key={item.href}>
                        {showSection && (
                          <p className="px-3 pb-0.5 pl-6 pt-2 text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
                            {section}
                          </p>
                        )}
                      <Link
                        href={item.href}
                        data-pending-item={b ? "pending" : undefined}
                        className={cn(
                          "group my-0.5 flex items-center justify-between gap-2 rounded-xl border-l-[3px] px-3 py-2 pl-5 text-sm font-medium transition-colors",
                          active ? ACTIVE_CLS + (b ? " border-l-red-400" : " border-l-transparent") : b ? PENDING_CLS : "border-l-transparent " + IDLE_CLS
                        )}
                      >
                        <span className="min-w-0">
                          <span className={cn("flex items-center gap-2.5", b && "font-semibold")}>
                            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-200")} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {b && <PendingMeta days={b.oldestDays} pendingWith={b.pendingWith} lang={lang} onDark={active} />}
                        </span>
                        {b ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <NayaPill n={b.naya} lang={lang} />
                            <RedBadge n={b.pending} />
                          </span>
                        ) : (
                          active && <ChevronRight className="h-3.5 w-3.5 text-white/70" />
                        )}
                      </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      {pend.enabled && (
        <div data-pending-legend className="mx-3 mb-3 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-surface-100 px-3 py-2 text-[10.5px] text-surface-500 dark:bg-white/5 dark:text-surface-400">
          <span className="flex items-center gap-1"><NayaPill lang={lang} /> {t("apb_legend_new", lang)}</span>
          <span className="flex items-center gap-1"><RedBadge n={5} /> {t("apb_legend_pending", lang)}</span>
          <span className="flex items-center gap-1"><ZeroMark /> {t("apb_legend_zero", lang)}</span>
        </div>
      )}
    </aside>
  );
}
