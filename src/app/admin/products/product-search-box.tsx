"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Malik (19 September): "products search nahi ho rahi" -- asal masla
 * ye tha ke search box ek plain HTML form tha, sirf Enter dabane par
 * chalta tha (koi button, koi ishara nahi ke Enter dabana hai). Type
 * kar ke rukna khud-ba-khud kuch nahi karta tha.
 *
 * Malik (8 October): field mein pehle poora lafz likhna hai aur phir
 * Apply dabana hai. Har harf par query chalne se list uchhalti thi aur
 * mobile par ghalat/adhoori search khul jati thi.
 */
export function ProductSearchBox({
  initialQuery,
  cat,
  filter,
  placeholder,
}: {
  initialQuery: string;
  cat: string;
  filter?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (cat) params.set("cat", cat);
    if (filter) params.set("filter", filter);
    if (value.trim()) params.set("q", value.trim());
    router.push(`/admin/products${params.toString() ? `?${params.toString()}` : ""}`);
    router.refresh();
  }

  return (
    <form onSubmit={apply} className="flex w-full max-w-xl items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-surface-700 dark:bg-surface-900"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        Apply
      </button>
    </form>
  );
}
