"use server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireMoneyAdmin } from "@/lib/access/money-gate";
import { isCustomerBalanceDrift } from "@/lib/finance/money-guards";

export interface DriftRow {
  customerId: string;
  name: string | null;
  stored: number | null;
  ledger: number | null;
  farq: number | null;
}

/** Rozana jaanch. Cron is code se nahi chalta — Owner/Admin khud bulayein. */
export async function listCustomerBalanceDrift(): Promise<{ error: string } | { rows: DriftRow[] }> {
  const gate = await requireMoneyAdmin("Customer balance drift dekhna");
  if (!gate.ok) return { error: gate.error };
  const service = createServiceClient();
  const { data, error } = await (service as any).rpc("fn_customer_balance_drift");
  if (error) return { error: error.message };
  const rows: DriftRow[] = (data ?? [])
    .map((row: { customer_id: string; customer_name: string | null; stored: number | null; ledger: number | null; farq: number | null }) => ({
      customerId: row.customer_id,
      name: row.customer_name,
      stored: row.stored == null ? null : Number(row.stored),
      ledger: row.ledger == null ? null : Number(row.ledger),
      farq: row.farq == null ? null : Number(row.farq),
    }))
    .filter((row: DriftRow) => isCustomerBalanceDrift(row.stored, row.ledger));
  return { rows };
}
