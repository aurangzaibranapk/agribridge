"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/utils/dashboard-filters";

export function DateRangeFilter({ current, from, to }: { current: DateRangeKey; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");
  const [loading, setLoading] = useState(false);

  // Jab URL badal jaye (navigation complete) to bar band karo
  useEffect(() => {
    setLoading(false);
  }, [pathname, searchParams]);

  // 19 September, malik: "Today/Yesterday/Month koi bhi select karein
  // to select nahi hota, na hi data milta hai." `router.push` akele
  // Next.js ke client-side route cache ki wajah se purana (cached)
  // data hi dikhata reh jata tha -- `refresh()` server se taaza data
  // mangwata hai.
  function goto(params: URLSearchParams) {
    setLoading(true);
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
    <>
      {loading && (
        <>
          <style>{`
            @keyframes topbar-slide {
              0%   { transform: scaleX(0);    opacity: 1; }
              70%  { transform: scaleX(0.88); opacity: 1; }
              100% { transform: scaleX(0.96); opacity: 1; }
            }
            @keyframes topbar-pulse {
              0%, 100% { opacity: 1; }
              50%       { opacity: 0.65; }
            }
          `}</style>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              zIndex: 9999,
              background: "#16a34a",
              transformOrigin: "left center",
              animation:
                "topbar-slide 2.5s cubic-bezier(0.1,0.7,0.4,1) forwards, topbar-pulse 1s ease-in-out infinite",
            }}
          />
        </>
      )}
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
    </>
  );
}
