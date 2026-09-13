"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function ShopFilter({
  shops,
  current,
}: {
  shops: { id: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setShop(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("shop", value);
    else params.delete("shop");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => setShop(e.target.value)}
      className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
    >
      <option value="">Sab Shops</option>
      {shops.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
