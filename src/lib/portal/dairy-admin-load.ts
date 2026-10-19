import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseAdminRows, parsePnl, type AdminRow, type PnlRow } from "./dairy-pl";

export const ADMIN_ROLES = ["owner", "super_admin", "admin"];
/** Page guard (DB function bhi khud check karta hai). */
export async function isDairyAdmin(): Promise<boolean> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return ADMIN_ROLES.includes(String(data?.role ?? ""));
}
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (): Rpc => { const sb = createClient(); return sb.rpc.bind(sb) as unknown as Rpc; };
export async function loadAdminTotals(from: string, to: string): Promise<{ rows: AdminRow[]; error: string | null }> {
  const r = await rpc()("fn_admin_dairy_totals", { p_from: from, p_to: to });
  return { rows: parseAdminRows(r.data), error: r.error?.message ?? null };
}
export interface FarmerDrill {
  farmer: { id: string; farmer_code: string | null; full_name: string | null; village: string | null } | null;
  pnl: PnlRow[]; animals: { id: string; tag_no: string; name: string | null; status: string; litres: number; expense: number }[];
  recent: { date: string; type: string; cat: string; amount: number; detail: string | null; source: string }[];
}
export async function loadAdminFarmer(id: string, from: string, to: string): Promise<FarmerDrill | null> {
  const r = await rpc()("fn_admin_dairy_farmer", { p_farmer: id, p_from: from, p_to: to });
  if (r.error || !r.data) return null;
  const d = r.data as Record<string, unknown>;
  return {
    farmer: (d.farmer as FarmerDrill["farmer"]) ?? null, pnl: parsePnl(d.pnl),
    animals: ((d.animals as Record<string, unknown>[]) ?? []).map((a) => ({ id: String(a.id), tag_no: String(a.tag_no), name: (a.name as string) ?? null, status: String(a.status), litres: Number(a.litres ?? 0), expense: Number(a.expense ?? 0) })),
    recent: ((d.recent as Record<string, unknown>[]) ?? []).map((x) => ({ date: String(x.date), type: Number(x.amount ?? 0) < 0 ? "expense" : "income", cat: String(x.kind), amount: Number(x.amount ?? 0), detail: (x.detail as string) ?? null, source: String(x.source ?? "manual") })),
  };
}
