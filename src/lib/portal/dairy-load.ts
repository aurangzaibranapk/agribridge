import "server-only";
import { createClient } from "@/lib/supabase/server";
import { checkFarmerVerification, type VerificationGateResult } from "@/lib/utils/verification-gate";
import { addDays, parseAnimals, parseYields, type Animal, type Yield } from "./dairy";

/** Aaj ki tareekh Pakistan waqt mein (YYYY-MM-DD). */
export function todayPk(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export interface DairyContext {
  farmer: { id: string; full_name: string | null; farmer_code: string | null; cow_count: number; buffalo_count: number } | null;
  gate: VerificationGateResult;
}
export async function dairyContext(): Promise<DairyContext | null> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: f } = await sb.from("farmers").select("id, full_name, farmer_code, cow_count, buffalo_count").eq("user_id", user.id).maybeSingle();
  if (!f) return null;
  const gate = await checkFarmerVerification(f.id);
  return { farmer: { id: f.id, full_name: f.full_name, farmer_code: f.farmer_code, cow_count: Number(f.cow_count ?? 0), buffalo_count: Number(f.buffalo_count ?? 0) }, gate };
}

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// 566/567 abhi generated types mein nahi -- dheela type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = (sb: ReturnType<typeof createClient>) => sb as any;

/** RLS khud sirf apne janwar/doodh lautata hai (566/567). */
export async function loadDairy(asOf: string, days = 90): Promise<{ animals: Animal[]; yields: Yield[]; collection: { date: string; am: number; pm: number; total: number }[]; error: string | null }> {
  const sb = createClient();
  const from = addDays(asOf, -(days - 1));
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;
  const [a, y, c] = await Promise.all([
    loose(sb).from("dairy_animals").select("*").order("tag_no"),
    loose(sb).from("dairy_milk_yields").select("animal_id, yield_date, shift, liters, fat, withheld, note").gte("yield_date", from).lte("yield_date", asOf).limit(20000),
    rpc("fn_my_milk_collection", { p_from: addDays(asOf, -29), p_to: asOf }),
  ]);
  const collection = Array.isArray(c.data)
    ? (c.data as Record<string, unknown>[]).map((r) => ({ date: String(r.entry_date).slice(0, 10), am: Number(r.am) || 0, pm: Number(r.pm) || 0, total: Number(r.total) || 0 }))
    : [];
  return { animals: parseAnimals(a.data), yields: parseYields(y.data), collection, error: a.error?.message ?? y.error?.message ?? c.error?.message ?? null };
}
export async function loadFarms(): Promise<{ id: string; name: string }[]> {
  const sb = createClient();
  const { data } = await sb.from("farms").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}
