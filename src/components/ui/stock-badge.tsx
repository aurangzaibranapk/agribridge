import { stockStatus, STOCK_LABEL, formatStockQty, type StockStatus as StockLevel } from "@/lib/stock/stock-status";

export function stockBadgeText(qty: number | null | undefined, min: number | null | undefined, unit?: string | null): string {
  const lvl = stockStatus(qty, min);
  return lvl === "out" ? `${STOCK_LABEL.out} · 0` : `${STOCK_LABEL[lvl]} · ${formatStockQty(qty, unit)}`;
}

// Colors copied from the approved mockup (/workspace/mockups/stock-badges).
const TONE: Record<StockLevel, { pill: string; dot: string }> = {
  ok: { pill: "bg-[#eaf5ec] text-[#174d2b] dark:bg-[rgba(43,128,71,.22)] dark:text-[#b3d9bb]", dot: "bg-[#2b8047] dark:bg-[#4f9f66]" },
  low: { pill: "bg-[#fff4d6] text-[#8a5a0b] dark:bg-[rgba(217,166,46,.2)] dark:text-[#e5bb54]", dot: "bg-[#d9a62e] dark:bg-[#e5bb54]" },
  out: { pill: "bg-[#fdecec] text-[#9c2b2b] dark:bg-[rgba(214,69,69,.2)] dark:text-[#fad7d7]", dot: "bg-[#d64545]" },
};

export function StockBadge({
  qty,
  min,
  unit,
  floating = false,
  className = "",
  testId,
}: {
  qty: number | null | undefined;
  min?: number | null;
  unit?: string | null;
  floating?: boolean;
  className?: string;
  testId?: string;
}) {
  const lvl = stockStatus(qty, min);
  const tone = TONE[lvl];
  return (
    <span
      data-testid={testId}
      data-stock-level={lvl}
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold ${tone.pill} ${floating ? "absolute right-1.5 top-1.5 shadow-[0_1px_2px_rgba(0,0,0,.12)] backdrop-blur-[4px]" : ""} ${className}`}
    >
      <i className={`inline-block h-[7px] w-[7px] rounded-full ${tone.dot}`} aria-hidden />
      {stockBadgeText(qty, min, unit)}
    </span>
  );
}
