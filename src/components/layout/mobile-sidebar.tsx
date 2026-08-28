"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { DASHBOARD_ITEM } from "@/components/layout/nav-items";
import { iconByName } from "@/lib/access/icons";
import type { SidebarGroup } from "@/components/layout/sidebar";

/**
 * Chhoti screen ka menu. Pehle ye HAR group dikhata tha, chahe banday ko
 * ijazat ho ya na ho -- rok phir bhi lagti thi, magar banda band darwaze
 * dekhta rehta tha. Ab ise wahi fehrist milti hai jo bari screen ko
 * milti hai.
 */
export function MobileSidebar({ subtitle, groups = [] }: { subtitle: string; groups?: SidebarGroup[] }) {
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
        aria-label="Open menu"
        className="rounded-lg p-2 text-surface-600 hover:bg-surface-100 lg:hidden dark:text-surface-300 dark:hover:bg-surface-800"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#1a1f36] shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">AR</div>
                <div>
                  <p className="font-display text-sm font-semibold leading-tight text-white">Al Rana Traders</p>
                  <p className="text-xs text-surface-400">{subtitle}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-surface-400 hover:bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              <Link
                href={DASHBOARD_ITEM.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(DASHBOARD_ITEM.href) ? "bg-brand-600 text-white" : "text-surface-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <DASHBOARD_ITEM.icon className="h-4 w-4" />
                {DASHBOARD_ITEM.label}
              </Link>

              <div className="my-2 border-t border-white/10" />

              {groups.map((group) => {
                const isOpen = openGroups.has(group.label);
                const groupActive = group.items.some((item) => isActive(item.href));
                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                        groupActive ? "text-brand-300" : "text-surface-400 hover:text-surface-200"
                      )}
                    >
                      <span>{group.label}</span>
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    {isOpen && (
                      <div className="space-y-0.5 pb-1">
                        {group.items.map((item) => {
                          const active = isActive(item.href);
                          const Icon = iconByName(item.icon);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 pl-6 text-sm font-medium transition-colors",
                                active ? "bg-brand-600 text-white" : "text-surface-300 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                            </Link>
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