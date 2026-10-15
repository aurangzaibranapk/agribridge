/**
 * Demand-first pipeline (naye status). Purana `status` column apni jagah
 * rehta hai (maker-checker usi par); `pipeline_status` us ke upar
 * planning ki manzil batata hai. Kuch bhi purchase/stock/ledger post nahi karta.
 */
export const PIPELINE_STATUSES = [
  "new", "interest_confirmed", "supplier_asked", "procurement_planned",
  "stock_arrived", "notified", "order_converted", "cancelled",
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  new: "Nayi demand",
  interest_confirmed: "Dilchaspi confirm",
  supplier_asked: "Supplier se rate manga",
  procurement_planned: "Kharid plan hui",
  stock_arrived: "Maal aa gaya",
  notified: "Kisan ko bataya",
  order_converted: "Order ban gaya",
  cancelled: "Cancel / band",
};

/** Purane status se pipeline (jab pipeline_status khali ho). */
export function pipelineFromStatus(status: string): PipelineStatus {
  switch (status) {
    case "pending": return "new";
    case "reviewing":
    case "approved": return "interest_confirmed";
    case "ordered":
    case "fulfilled": return "order_converted";
    case "rejected":
    case "cancelled": return "cancelled";
    default: return "new";
  }
}

export function effectivePipeline(row: { status: string; pipeline_status?: string | null }): PipelineStatus {
  const p = row.pipeline_status;
  if (p && (PIPELINE_STATUSES as readonly string[]).includes(p)) return p as PipelineStatus;
  return pipelineFromStatus(row.status);
}

/** Pipeline kis manzil se aage ja sakti hai (sirf aage, cancel kabhi bhi). */
const NEXT: Record<PipelineStatus, PipelineStatus[]> = {
  new: ["interest_confirmed", "cancelled"],
  interest_confirmed: ["supplier_asked", "procurement_planned", "cancelled"],
  supplier_asked: ["procurement_planned", "cancelled"],
  procurement_planned: ["stock_arrived", "cancelled"],
  stock_arrived: ["notified", "order_converted", "cancelled"],
  notified: ["order_converted", "cancelled"],
  order_converted: [],
  cancelled: [],
};
export function canMovePipeline(from: PipelineStatus, to: PipelineStatus) {
  return NEXT[from].includes(to);
}
