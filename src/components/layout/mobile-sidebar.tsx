"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight, ChevronDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { DASHBOARD_ITEM } from "@/components/layout/nav-items";
import { iconByName } from "@/lib/access/icons";
import type { SidebarGroup } from "@/components/layout/sidebar";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { usePending, PENDING_PAGE } from "@/components/pending/pending-context";
import { RedBadge, NayaPill, PendingMeta, ZeroMark } from "@/components/pending/pending-ui";
import { badgeForGroup, badgeForHref, pendingQueueHref } from "@/lib/pending/categories";

const M_ACTIVE = "bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white";
const M_IDLE = "text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-white/5 dark:hover:text-white";
const M_PENDING = "border-l-red-500 bg-red-500/[0.07] text-surface-900 dark:border-l-red-400 dark:bg-red-500/[0.12] dark:text-white";

/**
 * Chhoti screen ka menu. Pehle ye HAR group dikhata tha, chahe banday ko
 * ijazat ho ya na ho -- rok phir bhi lagti thi, magar banda band darwaze
 * dekhta rehta tha. Ab ise wahi fehrist milti hai jo bari screen ko
 * milti hai.
 */
export function MobileSidebar({ subtitle, groups = [] }: { subtitle: string; groups?: SidebarGroup[] }) {
  const lang = useLang();
  const pend = usePending();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const activeGroupLabel = groups.find((g) => g.items.some((item) => isActive(item.href)))?.label;

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(activeGroupLabel ? [activeGroupLabel] : [])
  );

  // Wahi jo bari sidebar mein hai (19 September): rasta badle to active
  // safhe ka group khud khul jaye, taake khulta hua safha nazar aaye.
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("sh_open_menu", lang)}
        className="relative rounded-lg p-2 text-surface-600 hover:bg-surface-100 lg:hidden dark:text-surface-300 dark:hover:bg-surface-800"
      >
        <Menu className="h-5 w-5" />
        {pend.enabled && pend.totals.pending > 0 && <RedBadge n={pend.totals.pending} className="absolute -right-2 -top-1.5 h-[18px] min-w-[18px] text-[10px]" />}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[88vw] flex-col bg-white shadow-xl dark:bg-[#0b1430]">
            <div className="flex h-16 items-center justify-between border-b border-surface-200 px-5 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">{t("au_ar", lang)}</div>
                <div>
                  <p className="font-display text-sm font-semibold leading-tight text-surface-900 dark:text-white">{t("au_company", lang)}</p>
                  <p className="text-xs text-surface-400">{subtitle}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t("sh_close_menu", lang)} className="rounded-lg p-1.5 text-surface-400 hover:bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              <Link
                href={DASHBOARD_ITEM.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(DASHBOARD_ITEM.href) ? M_ACTIVE : M_IDLE
                )}
              >
                <DASHBOARD_ITEM.icon className="h-4 w-4" />
                {DASHBOARD_ITEM.label}
              </Link>
              {pend.enabled && (
                <Link
                  href={PENDING_PAGE}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border-l-[3px] px-3 py-2.5 text-sm font-semibold",
                    isActive(PENDING_PAGE) ? M_ACTIVE + " border-l-red-400" : pend.totals.pending > 0 ? M_PENDING : "border-l-transparent " + M_IDLE
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2.5"><Inbox className="h-4 w-4" />{t("apb_menu", lang)}</span>
                    {pend.totals.pending > 0 && <PendingMeta days={pend.totals.oldestDays} pendingWith={null} lang={lang} onDark={isActive(PENDING_PAGE)} />}
                  </span>
                  <span className="flex items-center gap-1">
                    <NayaPill n={pend.totals.naya} lang={lang} />
                    {pend.totals.pending > 0 ? <RedBadge n={pend.totals.pending} /> : <ZeroMark />}
                  </span>
                </Link>
              )}

              <div className="my-2 border-t border-surface-200 dark:border-white/10" />

              {groups.map((group) => {
                const isOpen = openGroups.has(group.label);
                const groupActive = group.items.some((item) => isActive(item.href));
                const hrefs = group.items.map((i) => i.href);
                const gb = pend.enabled ? badgeForGroup(pend.counts, group.key, hrefs) : null;
                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                        groupActive ? "text-blue-700 dark:text-blue-300" : "text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-surface-200"
                      )}
                    >
                      <span>{group.label}</span>
                      <span className="flex items-center gap-1 normal-case tracking-normal">
                        {pend.enabled && (gb ? (<><NayaPill n={gb.naya} lang={lang} short /><RedBadge n={gb.pending} /></>) : <ZeroMark />)}
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="space-y-0.5 pb-1">
                        {group.items.map((item, index) => {
                          const active = isActive(item.href);
                          const Icon = iconByName(item.icon);
                          const b = pend.enabled ? badgeForHref(pend.counts, item.href, Date.now(), hrefs) : null;
                          const dest = b ? pendingQueueHref(item.href) : item.href;
                          // Sarkhi wahin chhapti hai jahan wo badalti hai (174).
                          const prevSection = index > 0 ? (group.items[index - 1].section ?? null) : null;
                          const section = item.section ?? null;
                          return (
                            <div key={item.href}>
                              {!!section && section !== prevSection && (
                                <p className="px-3 pb-0.5 pl-6 pt-2 text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
                                  {section}
                                </p>
                              )}
                              <Link
                                href={dest}
                                data-pending-queue={b ? dest : undefined}
                                className={cn(
                                  "my-0.5 flex items-center justify-between gap-2 rounded-xl border-l-[3px] px-3 py-2.5 pl-5 text-sm font-medium transition-colors",
                                  active ? M_ACTIVE + " border-l-transparent" : b ? M_PENDING : "border-l-transparent " + M_IDLE
                                )}
                              >
                                <span className="min-w-0">
                                  <span className="flex items-center gap-2.5"><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span></span>
                                  {b && <PendingMeta days={b.oldestDays} pendingWith={b.pendingWith} lang={lang} onDark={active} />}
                                </span>
                                {b && (
                                  <span className="flex shrink-0 items-center gap-1">
                                    <NayaPill n={b.naya} lang={lang} />
                                    <RedBadge n={b.pending} />
                                  </span>
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
        </div>
      )}
    </>
  );
}