import { createServiceClient } from "@/lib/supabase/service";

const TABLES = [
  "pos_deposit_counters",
  "pos_shift_counters",
  "agri_order_counters",
  "agri_payment_counters",
  "agri_return_counters",
] as const;

export type YearCounterTable = (typeof TABLES)[number];

/** Atomic year counter. Two clicks cannot take the same number. */
export async function nextYearNumber(table: YearCounterTable, prefix: string): Promise<string> {
  const year = new Date().getFullYear() % 100;
  const service = createServiceClient();
  const { data, error } = await (service as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: number | null; error: { message: string } | null }> }).rpc(
    "fn_next_year_counter",
    { p_table: table, p_year: year },
  );
  if (error || data == null) {
    throw new Error(error?.message ?? "Number nahi bana.");
  }
  return `${prefix}${year}-${String(data).padStart(5, "0")}`;
}
