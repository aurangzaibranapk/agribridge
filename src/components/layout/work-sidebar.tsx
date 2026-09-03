"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { Sprout, Bot } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

/**
 * Staff ki apni sidebar (malik ke reference ke mutabiq, 4 September).
 *
 * Pehle staff ko koi sidebar nahi thi -- sirf upar ek patti (CompactNav).
 * Wo faisla is soch par tha ke "poori ERP navigation staff ko na dikhe".
 * Wo soch yahan bhi zinda hai: ye sidebar poora ERP nahi dikhati.
 *
 * Isi liye ye Sidebar (jo Owner/Admin ko milti hai) se alag component
 * hai, us ka chhota roop nahi:
 *
 *   Jaldi ke kaam  -- is role ke rozana ke safhe, baqi ginti ke sath
 *   Department     -- sirf wohi jo is bande ko khulte hain
 *   Reports        -- jo us ke paas hain
 *   Settings       -- apna khata
 *
 * Adad `/api/my-work/badges` se aate hain -- wohi "aaj kya baqi hai"
 * wali ginti, koi doosra hisaab nahi. Na mile to "—", sifar nahi.
 */

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
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
          active
            ? "bg-brand-50 font-medium text-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
            : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
        }`}
      >
        <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0 text-surface-400" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {show && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white ${
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
      <div className="mb-4">
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">{label}</p>
        <div className="space-y-0.5">
          {items.map((i) => (
            <Row key={i.href} item={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden w-[15rem] shrink-0 flex-col border-r border-surface-200 bg-white lg:flex dark:border-surface-800 dark:bg-surface-900">
      <Link href={homeHref} className="flex items-center gap-2 border-b border-surface-200 px-4 py-4 dark:border-surface-800">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Sprout className="h-5 w-5" />
        </span>
        <span className="font-display text-base font-semibold text-surface-900 dark:text-white">AgriBridge</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-4 space-y-0.5">
          <Row item={{ href: homeHref, label: t("mw_title", lang), icon: "Home" }} />
        </div>
        <Section label={t("ws_quick", lang)} items={quick} />
        <Section label={t("ws_departments", lang)} items={departments} />
        <Section label={t("ws_reports", lang)} items={reports} />
        <Section label={t("ws_settings", lang)} items={settings} />
      </nav>

      {/* AI ka darwaza yahan bhi -- panel wohi hai jo neeche daayen kone
          mein hai, do alag AI nahi. */}
      <button
        type="button"
        onClick={() => document.dispatchEvent(new CustomEvent("agribridge:open-assistant"))}
        className="m-2 flex items-center gap-2.5 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2.5 text-left hover:bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20"
      >
        <Bot className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-brand-800 dark:text-brand-200">{t("ws_ai", lang)}</span>
          <span className="block truncate text-[11px] text-brand-600/80 dark:text-brand-300/70">{t("ws_ai_sub", lang)}</span>
        </span>
      </button>
    </aside>
  );
}
