"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/utils/dashboard-filters";

export function DateRangeFilter({ current }: { current: DateRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(key: DateRangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    router.push(`${pathname}?${params.toString()}`);
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
    </div>
  );
}