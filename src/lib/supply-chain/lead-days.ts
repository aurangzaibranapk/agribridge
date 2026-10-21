import "server-only";
import { medianLeadDays } from "./lead-days-core";

/** Har supplier ke din: suppliers.default_lead_days (692), warna pichle GRN ka median. Migration na lagi ho to bhi chale. */
export async function loadSupplierLeadDays(supabase: unknown): Promise<Record<string, number>> {
  const sb = supabase as any;
  const out: Record<string, number> = {};
  try {
    const { data: hist } = await sb.from("purchases").select("supplier_id, purchase_date, received_at").not("received_at", "is", null).order("received_at", { ascending: false }).limit(500);
    Object.assign(out, medianLeadDays(hist ?? []));
    const { data, error } = await sb.from("suppliers").select("id, default_lead_days").not("default_lead_days", "is", null);
    if (!error) for (const r of data ?? []) out[r.id] = Number(r.default_lead_days);
  } catch {
    /* dashboard ke baghair bhi PO form chalta rahe */
  }
  return out;
}

export { medianLeadDays };

export function withLeadDays<T extends { id: string }>(suppliers: T[], lead: Record<string, number>): (T & { lead_days: number | null })[] {
  return suppliers.map((s) => ({ ...s, lead_days: lead[s.id] ?? null }));
}
