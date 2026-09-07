"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { Sprout } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

export interface SideItem {
  href: string;
  label: string;
  icon: string | null;
}

export interface SideGroup {
  key: string;
  label: string;
  items: SideItem[];
}

function Icon({ name, className }: { name: string | null; className?: string }) {
  const C =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name ?? ""] ??
    Icons.LayoutGrid;
  return <C className={className} />;
}

export function WorkSidebar({
  lang,
  homeHref,
  quick,
  departments,
  reports,
  settings,
}: {
  lang: Lang;
  homeHref: string;
  quick: SideItem[];
  departments: SideItem[];
  reports: SideItem[];
  settings: SideItem[];
}) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, { count: number | null; tone: string }>>({});

  useEffect(() => {
    fetch("/api/my-work/badges")
      .then((r) => (r.ok ? r.json() : { byRoute: {} }))
      .then((d) => setBadges(d.byRoute ?? {}))
      .catch(() => setBadges({}));
  }, []);

  function Row({ item }: { item: SideItem }) {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const b = badges[item.href];
    const show = b && (b.count === null || b.count > 0);
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] transition ${
          active
            ? "bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
            : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
        }`}
      >
        <Icon name={item.icon} className={`h-4 w-4 shrink-0 ${active ? "text-brand-700 dark:text-brand-300" : "text-surface-400"}`} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {show && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white ${
              b!.tone === "red" ? "bg-red-500" : b!.tone === "amber" ? "bg-amber-500" : "bg-brand-600"
            }`}
          >
            {b!.count === null ? "—" : b!.count}
          </span>
        )}
      </Link>
    );
  }

  function Section({ label, items }: { label: string; items: SideItem[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        <p className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-surface-400">{label}</p>
        <div className="space-y-0.5">
          {items.map((i) => <Row key={i.href} item={i} />)}
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden w-[12.5rem] shrink-0 flex-col border-r border-surface-200 bg-white lg:flex dark:border-surface-800 dark:bg-surface-900">
      <Link href={homeHref} className="flex items-center gap-2 border-b border-surface-200 px-3 py-3 dark:border-surface-800">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Sprout className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[14px] font-semibold leading-tight text-brand-700 dark:text-brand-300">AgriBridge</span>
          <span className="block truncate text-[9px] leading-tight text-surface-400">{t("ws_tagline", lang)}</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        <div className="mb-3 space-y-0.5">
          <Row item={{ href: homeHref, label: t("mw_title", lang), icon: "Home" }} />
        </div>
        <Section label={t("ws_quick", lang)} items={quick} />
        <Section label={t("ws_departments", lang)} items={departments} />
        <Section label={t("ws_reports", lang)} items={reports} />
        <Section label={t("ws_settings", lang)} items={settings} />

        <div className="mb-3">
          <p className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-surface-400">{t("ws_help", lang)}</p>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => document.dispatchEvent(new CustomEvent("agribridge:open-assistant"))}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] text-surface-600 transition hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
            >
              <Icons.Bot className="h-4 w-4 shrink-0 text-surface-400" />
              <span className="min-w-0 flex-1 truncate">{t("ws_ai", lang)}</span>
            </button>
            <Row item={{ href: "/admin/academy", label: t("ws_training", lang), icon: "GraduationCap" }} />
            <Row item={{ href: "/admin/improvements", label: t("ws_suggestions", lang), icon: "Lightbulb" }} />
          </div>
        </div>
      </nav>
    </aside>
  );
}
