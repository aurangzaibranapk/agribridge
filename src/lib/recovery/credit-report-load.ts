import { createClient } from "@/lib/supabase/server";
import type { Band } from "./credit-report";

export interface CreditReport {
  subjectType: "customer" | "farmer";
  score: number | null; band: Band | null; state: string; eligibility: string | null;
  defaultActive: boolean; kept: number; broken: number; snapshotDate: string | null;
  factors: Record<string, unknown> | null;
  promises: { date: string; amount: number | null; fulfilled: number; status: string }[];
  defaults: { marked_at: string; amount: number | null; softened: boolean }[];
}
export function mapCreditReport(subjectType: "customer" | "farmer", r: any): CreditReport | null {
  if (!r) return null;
  return {
    subjectType, score: r.score == null ? null : Number(r.score), band: (r.band ?? null) as Band | null,
    state: String(r.state ?? "insufficient_data"), eligibility: r.eligibility ?? null,
    defaultActive: Boolean(r.default_active), kept: Number(r.kept ?? 0), broken: Number(r.broken ?? 0),
    snapshotDate: r.snapshot_date ?? null, factors: r.factors ?? null,
    promises: (r.promises ?? []).map((p: any) => ({ date: p.date, amount: p.amount == null ? null : Number(p.amount), fulfilled: Number(p.fulfilled ?? 0), status: String(p.status) })),
    defaults: r.defaults ?? [],
  };
}
/** 541 fn_party_credit_report (staff-only RPC). Error par null -- page na ruke. */
export async function loadCreditReport(subjectType: "customer" | "farmer", id: string): Promise<CreditReport | null> {
  const sb = createClient() as any;
  const { data, error } = await sb.rpc("fn_party_credit_report", { p_type: subjectType, p_id: id });
  return error ? null : mapCreditReport(subjectType, data);
}
