"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ALL_SHOPS, SALES_SHOP_COOKIE, SALES_SHOP_PARAM, salesShopHref } from "@/lib/reports/sales-shop-filter";

/**
 * "Dukan chunein" -- URL ?salesShop= badalta hai aur cookie mein yaad rakhta hai.
 * Pehle controlled <select> + router.push tha: kuch safhon par soft navigation
 * server data refresh nahi karti thi aur select foran "Sab dukanein" par wapas
 * aa jata. Ab local state (foran dikhe) + poori navigation (server hamesha nayi
 * param parhe).
 */
export function SalesShopSelect({ shops, current, label, allLabel }: {
  shops: { id: string; name: string }[]; current: string; label: string; allLabel: string;
}) {
  const sp = useSearchParams();
  const [value, setValue] = useState(current || ALL_SHOPS);
  useEffect(() => setValue(current || ALL_SHOPS), [current]);
  return (
    <label className="flex items-center gap-2 text-xs text-surface-500">
      <span className="font-semibold">{label}</span>
      <select
        aria-label={label}
        data-testid="sales-shop-select"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          document.cookie = `${SALES_SHOP_COOKIE}=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`;
          window.location.assign(salesShopHref(window.location.pathname, sp?.toString() ?? window.location.search, v));
        }}
        className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
      >
        <option value={ALL_SHOPS}>{allLabel}</option>
        {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}
