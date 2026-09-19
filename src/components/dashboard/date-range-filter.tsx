"use client";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/utils/dashboard-filters";

export function DateRangeFilter({ current, from, to }: { current: DateRangeKey; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");

  // 19 September, malik: "Today/Yesterday/Month koi bhi select karein
  // to select nahi hota, na hi data milta hai." `router.push` akele
  // Next.js ke client-side route cache ki wajah se purana (cached)
  // data hi dikhata reh jata tha -- `refresh()` server se taaza data
  // mangwata hai.
  function goto(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  function setRange(key: DateRangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    if (key !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    goto(params);
  }

  function applyCustom(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("from", nextFrom);
    params.set("to", nextTo);
    goto(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setRange(opt.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            current === opt.key
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-surface-200 bg-white text-surface-600 hover:border-brand-200 hover:text-brand-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {current === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              applyCustom(e.target.value, customTo);
            }}
            className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
          />
          <span className="text-xs text-surface-400">se</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => {
              setCustomTo(e.target.value);
              applyCustom(customFrom, e.target.value);
            }}
            className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
          />
        </div>
      )}
    </div>
  );
}
