import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadKhata } from "./khata-load";
import { looseDb } from "./dairy-pl-load";
import { checkFarmerVerification } from "@/lib/utils/verification-gate";
import { profileComplete } from "./customer";
import {
  parseAdminCustomers, parseBills, parseOrders, parsePayments, parseProfile, parsePromises, parseQueue, parseRequests, parseReturns,
  type CustomerProfile,
} from "./customer";

/**
 * Customer Portal -- 572/573 ke functions gahak ke apne session se (auth.uid()).
 * Service client nahi: function khud sirf apna data lautate hain.
 */
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export const rpc = (): Rpc => { const sb = createClient(); return sb.rpc.bind(sb) as unknown as Rpc; };
export { todayPk } from "./dairy-load";

export interface CustCtx { userId: string; profile: CustomerProfile | null; isFarmer: boolean; farmerId: string | null }
export async function customerContext(): Promise<CustCtx | null> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [p, f] = await Promise.all([rpc()("fn_my_customer_profile", {}), sb.from("farmers").select("id").eq("user_id", user.id).maybeSingle()]);
  return { userId: user.id, profile: parseProfile(p.data), isFarmer: !!f.data, farmerId: f.data ? String(f.data.id) : null };
}

export async function loadBills(from: string | null = null, to: string | null = null, limit = 200) {
  const r = await rpc()("fn_my_bills", { p_from: from, p_to: to, p_limit: limit });
  return parseBills(r.data);
}
export async function loadOrders(limit = 50) { return parseOrders((await rpc()("fn_my_orders", { p_limit: limit })).data); }
export async function loadReturns() { return parseReturns((await rpc()("fn_my_returns", {})).data); }
export async function loadPromises() { return parsePromises((await rpc()("fn_my_promises", {})).data); }
export async function loadPayments(from: string | null = null, to: string | null = null) {
  return parsePayments((await rpc()("fn_my_payments", { p_from: from, p_to: to })).data);
}
export async function loadRequests() { return parseRequests((await rpc()("fn_my_requests", {})).data); }
export { loadKhata };

/** Farmer se jura ho to apne janwar (RLS: sirf apne). */
export async function loadAnimalCount(): Promise<number> {
  const { count } = await looseDb().from("dairy_animals").select("id", { count: "exact", head: true }).not("status", "in", "(sold,dead)");
  return count ?? 0;
}

// ---------- admin ----------
export async function loadAdminCustomers() {
  const r = await rpc()("fn_admin_customer_portal", {});
  return { rows: parseAdminCustomers(r.data), error: r.error?.message ?? null };
}
export async function loadQueue() {
  const r = await rpc()("fn_cp_queue", {});
  return { items: parseQueue(r.data), error: r.error?.message ?? null };
}
export async function loadFinanceAccounts(): Promise<{ id: string; name: string }[]> {
  const sb = createClient();
  const { data } = await sb.from("finance_accounts").select("id, name").eq("is_active", true).order("name");
  return (data ?? []).map((a) => ({ id: String(a.id), name: String(a.name) }));
}
export async function proofUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const sb = createClient();
  const { data } = await sb.storage.from("customer-proofs").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Darwaza: kisan ho to kisan wali tasdeeq; sirf gahak ho to naam + mobile. */
export async function custGate(ctx: CustCtx): Promise<{ allowed: boolean; farmerReason?: "incomplete_profile" | "pending_review" }> {
  if (ctx.isFarmer && ctx.farmerId) {
    const g = await checkFarmerVerification(ctx.farmerId);
    return { allowed: g.allowed, farmerReason: g.reason };
  }
  return { allowed: profileComplete(ctx.profile?.customers[0]) };
}
