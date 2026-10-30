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
import { badgeForGroup, badgeForHref, pendingQueueHref } from "@/lib/pending/categories";
import { BrandMark } from "@/components/brand/brand-mark";
import { brandName, isHiddenBrand } from "@/lib/brand";
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
/** Pine #10241c — light aur dark dono. Headings 700, items 600. */
const PINE = "border-white/10 bg-[#10241c] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] dark:border-white/10 dark:bg-[#10241c]";
const IDLE_CLS = "text-[#e7eef8] hover:bg-white/10 hover:text-white";
const PENDING_CLS = "border-l-red-500 bg-red-500/[0.12] text-white hover:bg-red-500/[0.18]";

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
    <aside data-sidebar="admin" className={cn("hidden h-screen min-h-0 w-72 shrink-0 overflow-hidden border-r backdrop-blur-xl lg:flex lg:flex-col", PINE)}>
      <Link href={homeHref} className="flex min-h-16 items-center gap-2 border-b border-white/10 px-5 py-2">
        <BrandMark className="h-8 w-8 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold leading-tight text-white">{brandName(lang)}</p>
          {subtitle && !isHiddenBrand(subtitle) && subtitle !== brandName(lang) && (
            <p className="truncate text-[10px] text-[#d3deee]">{subtitle}</p>
          )}
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
              "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              isActive(DASHBOARD_ITEM.href) ? ACTIVE_CLS : IDLE_CLS
            )}
          >
            <span className="flex items-center gap-2.5">
              <DASHBOARD_ITEM.icon className={cn("h-4 w-4", isActive(DASHBOARD_ITEM.href) ? "text-white" : "text-[#d3deee] group-hover:text-white")} />
              {DASHBOARD_ITEM.label}
            </span>
          </Link>
        )}
        {pend.enabled && (
          <Link
            href={PENDING_PAGE}
            data-pending-item={pend.totals.pending > 0 ? "pending" : "zero"}
            className={cn(
              "group flex items-center justify-between gap-2 rounded-xl border-l-[3px] px-3 py-2 text-sm font-semibold transition-colors",
              isActive(PENDING_PAGE) ? ACTIVE_CLS + " border-l-red-400" : pend.totals.pending > 0 ? PENDING_CLS : "border-l-transparent " + IDLE_CLS
            )}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2.5 font-semibold">
                <Inbox className="h-4 w-4 shrink-0" />
                {t("apb_menu", lang)}
              </span>
              {pend.totals.pending > 0 && <PendingMeta days={pend.totals.oldestDays} pendingWith={null} lang={lang} onDark />}
            </span>
            <span className="flex items-center gap-1">
              <NayaPill n={pend.totals.naya} lang={lang} />
              {pend.totals.pending > 0 ? <RedBadge n={pend.totals.pending} /> : <ZeroMark className="text-[#d3deee]" />}
            </span>
          </Link>
        )}
        <div className="my-2 border-t border-white/10" />
        {visibleGroups.map((group) => {
          const isOpen = openGroups.has(group.label);
          const groupActive = group.items.some((item) => isActive(item.href));
          const hrefs = group.items.map((i) => i.href);
          const gb = pend.enabled ? badgeForGroup(pend.counts, group.key, hrefs) : null;
          return (
            <div key={group.key}>
              <div className={cn("flex w-full items-center rounded-lg text-xs font-bold uppercase tracking-wide transition-colors", groupActive ? "text-[#dbeafe]" : "text-[#f5f8fc] hover:text-white")}>
                {isUnrestricted ? <Link href={group.key === "master" ? "/admin/command-center" : group.key === "reports" ? "/admin/reports" : `/admin/department-dashboard/${group.key}`} className="min-w-0 flex-1 truncate px-3 py-2">{group.label}</Link> : <button type="button" onClick={() => toggleGroup(group.label)} className="min-w-0 flex-1 truncate px-3 py-2 text-left uppercase">{group.label}</button>}
                {pend.enabled && (
                  <span data-group-badge={gb ? gb.pending : 0} className="flex items-center gap-1 normal-case tracking-normal">
                    {gb ? (
                      <>
                        <NayaPill n={gb.naya} lang={lang} short />
                        <RedBadge n={gb.pending} />
                      </>
                    ) : (
                      <ZeroMark className="text-[#d3deee]" />
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
                    const b = pend.enabled ? badgeForHref(pend.counts, item.href, Date.now(), hrefs) : null;
                    const dest = b ? pendingQueueHref(item.href) : item.href;
                    return (
                      <div key={item.href}>
                        {showSection && (
                          <p className="px-3 pb-0.5 pl-6 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#d3deee]">
                            {section}
                          </p>
                        )}
                      <Link
                        href={dest}
                        data-pending-item={b ? "pending" : undefined}
                        data-pending-queue={b ? dest : undefined}
                        className={cn(
                          "group my-0.5 flex items-center justify-between gap-2 rounded-xl border-l-[3px] px-3 py-2 pl-5 text-sm font-semibold transition-colors",
                          active ? ACTIVE_CLS + (b ? " border-l-red-400" : " border-l-transparent") : b ? PENDING_CLS : "border-l-transparent " + IDLE_CLS
                        )}
                      >
                        <span className="min-w-0">
                          <span className={cn("flex items-center gap-2.5", b && "font-semibold")}>
                            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-[#d3deee] group-hover:text-white")} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {b && <PendingMeta days={b.oldestDays} pendingWith={b.pendingWith} lang={lang} onDark />}
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
    </aside>
  );
}
