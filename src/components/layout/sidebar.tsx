"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { DASHBOARD_ITEM } from "@/components/layout/nav-items";
import { iconByName } from "@/lib/access/icons";
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
  items: { href: string; label: string; icon: string | null }[];
}

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
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const isUnrestricted = role === "owner" || role === "super_admin" || role === "admin";
  const visibleGroups: SidebarGroup[] = groups ?? [];

  const activeGroupLabel = visibleGroups.find((g) => g.items.some((item) => isActive(item.href)))?.label;
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
    <aside className="hidden w-64 shrink-0 border-r border-surface-800 bg-[#1a1f36] lg:flex lg:flex-col">
      <Link href={homeHref} className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">AR</div>
        <div>
          <p className="font-display text-sm font-semibold leading-tight text-white">Al Rana Traders</p>
          <p className="text-xs text-surface-400">{subtitle}</p>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {(isUnrestricted || (allowedPages ?? []).includes(DASHBOARD_ITEM.href)) && homeHref !== DASHBOARD_ITEM.href && (
          <Link
            href={DASHBOARD_ITEM.href}
            className={cn(
              "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(DASHBOARD_ITEM.href) ? "bg-brand-600 text-white" : "text-surface-300 hover:bg-white/5 hover:text-white"
            )}
          >
            <span className="flex items-center gap-2.5">
              <DASHBOARD_ITEM.icon className={cn("h-4 w-4", isActive(DASHBOARD_ITEM.href) ? "text-white" : "text-surface-400 group-hover:text-surface-200")} />
              {DASHBOARD_ITEM.label}
            </span>
          </Link>
        )}
        <div className="my-2 border-t border-white/10" />
        {visibleGroups.map((group) => {
          const isOpen = openGroups.has(group.label);
          const groupActive = group.items.some((item) => isActive(item.href));
          return (
            <div key={group.key}>
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
                          "group flex items-center justify-between rounded-lg px-3 py-2 pl-6 text-sm font-medium transition-colors",
                          active ? "bg-brand-600 text-white" : "text-surface-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className={cn("h-4 w-4", active ? "text-white" : "text-surface-400 group-hover:text-surface-200")} />
                          {item.label}
                        </span>
                        {active && <ChevronRight className="h-3.5 w-3.5 text-white/70" />}
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
  );
}