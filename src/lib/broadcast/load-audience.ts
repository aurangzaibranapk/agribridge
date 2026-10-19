/**
 * Audience ke candidates (service client, sirf server). Kaun kaun: farmers, customers,
 * active staff. Filter applyAudience karta hai; yahan sirf data jama hota hai.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { departmentForRole } from "@/lib/departments";
import { applyAudience, type AudienceSpec, type Candidate } from "./audience";

const STAFF_ROLES_EXCLUDED = new Set(["farmer", "customer", "vendor", "company", "dealer", "buyer"]);
const asLang = (v: unknown): "en" | "rm" | "ur" => (v === "en" || v === "ur" ? v : "rm");

export async function loadCandidates(db: SupabaseClient, spec: AudienceSpec): Promise<Candidate[]> {
  const want = spec.role === "all" ? ["farmers", "customers", "staff"] : spec.role === "custom" ? ["farmers", "customers", "staff"] : [spec.role];
  const out: Candidate[] = [];
  const needCustomer = want.includes("customers") || want.includes("farmers");
  const [farmersQ, customersQ, staffQ, bookingsQ, agingQ, milkQ] = await Promise.all([
    want.includes("farmers") ? db.from("farmers").select("id, full_name, phone_number, whatsapp_number, village, preferred_language").eq("is_deleted", false).limit(20000) : Promise.resolve({ data: [] }),
    needCustomer ? db.from("customers").select("id, name, phone_number, farmer_id, current_balance").eq("is_deleted", false).eq("is_active", true).limit(20000) : Promise.resolve({ data: [] }),
    want.includes("staff") ? db.from("profiles").select("id, full_name, phone_number, role").eq("is_active", true).limit(5000) : Promise.resolve({ data: [] }),
    spec.campaignIds?.length ? db.from("campaign_bookings").select("farmer_id, campaign_id, status").in("campaign_id", spec.campaignIds) : Promise.resolve({ data: [] }),
    spec.udhaarDays || spec.udhaarMin ? db.rpc("fn_customer_receivable_aging", { p_as_of: null, p_customer: null }) : Promise.resolve({ data: [] }),
    spec.dairyOnly ? db.from("milk_entries").select("farmer_id").gte("entry_date", new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)).limit(50000) : Promise.resolve({ data: [] }),
  ]);
  for (const q of [farmersQ, customersQ, staffQ, bookingsQ, agingQ, milkQ] as { error?: { message: string } | null }[]) {
    if (q.error) throw new Error(`Audience load failed: ${q.error.message}`); // chup-chap 0 nahi
  }
  const camps = new Map<string, string[]>();
  for (const b of (bookingsQ.data ?? []) as any[]) if (b.status !== "cancelled") camps.set(b.farmer_id, [...(camps.get(b.farmer_id) ?? []), b.campaign_id]);
  const aging = new Map<string, { days: number | null; bal: number }>();
  for (const a of (agingQ.data ?? []) as any[]) aging.set(a.customer_id, { days: a.oldest_days == null ? null : Number(a.oldest_days), bal: Number(a.balance ?? 0) });
  const dairy = new Set(((milkQ.data ?? []) as any[]).map((m) => m.farmer_id));
  const custByFarmer = new Map<string, any>();
  for (const c of (customersQ.data ?? []) as any[]) if (c.farmer_id) custByFarmer.set(c.farmer_id, c);
  const farmerVillage = new Map<string, string | null>();

  for (const f of (farmersQ.data ?? []) as any[]) {
    farmerVillage.set(f.id, f.village ?? null);
    const c = custByFarmer.get(f.id); const ag = c ? aging.get(c.id) : undefined;
    out.push({ type: "farmer", id: f.id, name: f.full_name ?? "", phone: f.whatsapp_number || f.phone_number, lang: asLang(f.preferred_language), village: f.village,
      campaignIds: camps.get(f.id) ?? [], udhaarDays: ag?.days ?? null, balance: ag?.bal ?? (c ? Number(c.current_balance ?? 0) : null), dairy: dairy.has(f.id) });
  }
  if (want.includes("customers")) for (const c of (customersQ.data ?? []) as any[]) {
    const ag = aging.get(c.id);
    out.push({ type: "customer", id: c.id, name: c.name ?? "", phone: c.phone_number, village: c.farmer_id ? farmerVillage.get(c.farmer_id) ?? null : null,
      udhaarDays: ag?.days ?? null, balance: ag?.bal ?? Number(c.current_balance ?? 0), campaignIds: c.farmer_id ? camps.get(c.farmer_id) ?? [] : [], dairy: c.farmer_id ? dairy.has(c.farmer_id) : false });
  }
  for (const p of (staffQ.data ?? []) as any[]) {
    if (STAFF_ROLES_EXCLUDED.has(p.role)) continue;
    out.push({ type: "staff", id: p.id, name: p.full_name ?? "", phone: p.phone_number, department: departmentForRole(p.role)?.key ?? null });
  }
  return out;
}

export async function resolveAudience(db: SupabaseClient, spec: AudienceSpec, season = "") {
  return applyAudience(await loadCandidates(db, spec), spec, season);
}
