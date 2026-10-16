"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ALL_SHOPS, SALES_SHOP_COOKIE, SALES_SHOP_PARAM } from "@/lib/reports/sales-shop-filter";

/** "Dukan chunein" -- URL ?salesShop= badalta hai aur cookie mein yaad rakhta hai. */
export function SalesShopSelect({ shops, current, label, allLabel }: {
  shops: { id: string; name: string }[]; current: string; label: string; allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-xs text-surface-500">
      <span className="font-semibold">{label}</span>
      <select
        aria-label={label}
        data-testid="sales-shop-select"
        value={current || ALL_SHOPS}
        onChange={(e) => {
          const v = e.target.value;
          document.cookie = `${SALES_SHOP_COOKIE}=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`;
          const q = new URLSearchParams(sp?.toString() ?? "");
          q.set(SALES_SHOP_PARAM, v);
          router.push(`${pathname}?${q.toString()}`, { scroll: false });
        }}
        className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
      >
        <option value={ALL_SHOPS}>{allLabel}</option>
        {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}
