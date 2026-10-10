import { createServiceClient } from "@/lib/supabase/service";

export interface AgingRow {
  customer_id: string;
  name: string;
  phone: string | null;
  balance: number;
  oldest_unpaid_date: string;
  oldest_days: number;
  due_date: string;
  bucket_0_15: number;
  bucket_15_30: number;
  bucket_30_plus: number;
}

export async function loadCustomerAging(): Promise<{ rows: AgingRow[]; error?: string }> {
  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("fn_customer_receivable_aging", { p_as_of: null, p_customer: null });
  if (error) return { rows: [], error: error.message };
  const list = (data ?? []) as any[];
  const ids = list.map((r) => r.customer_id);
  const { data: custs } = ids.length
    ? await service.from("customers").select("id, name, business_name, phone_number").in("id", ids)
    : { data: [] };
  const m = new Map<string, any>((custs ?? []).map((c: any) => [c.id, c]));
  const rows = list.map((r) => {
    const c = m.get(r.customer_id);
    return {
      customer_id: r.customer_id,
      name: c?.business_name || c?.name || "—",
      phone: c?.phone_number ?? null,
      balance: Number(r.balance),
      oldest_unpaid_date: r.oldest_unpaid_date,
      oldest_days: Number(r.oldest_days),
      due_date: r.due_date,
      bucket_0_15: Number(r.bucket_0_15),
      bucket_15_30: Number(r.bucket_15_30),
      bucket_30_plus: Number(r.bucket_30_plus),
    };
  });
  rows.sort((a, b) => b.bucket_30_plus - a.bucket_30_plus || b.balance - a.balance);
  return { rows };
}
