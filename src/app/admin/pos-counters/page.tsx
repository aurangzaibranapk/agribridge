import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { PosCountersClient } from "./pos-counters-client";

export const dynamic = "force-dynamic";

/**
 * POS Counters -- Branch ke andar har Shop ka apna sale point, aur ek
 * staff ko kai counters ki ijazat (many-to-many).
 *
 * Malik ka poora spec (8 September): "AGRIBRIDGE — EXISTING POS AUDIT +
 * MULTI-SHOP POS COUNTER & SHIFT UPGRADE". Schema 366 mein bana; ye
 * safha us par management UI hai.
 */
export default async function PosCountersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const role = String(me?.role ?? "");
  const sabKuchWala = UNRESTRICTED_ROLES.includes(role);
  const myBranchId = (me?.branch_id as string | null) ?? null;

  if (!sabKuchWala && role !== "manager") {
    return <p className="p-6 text-sm text-surface-500">Ye safha sirf Manager ya Owner/Admin ke liye hai.</p>;
  }
  if (!sabKuchWala && !myBranchId) {
    return <p className="p-6 text-sm text-amber-700">Aap ki koi branch set nahi hai — pehle admin se apni branch lagwayein.</p>;
  }

  const service = createServiceClient();

  const branchesQuery = service.from("branches").select("id, name").order("name");
  const [{ data: branches }, { data: countersRaw }] = await Promise.all([
    sabKuchWala ? branchesQuery : branchesQuery.eq("id", myBranchId as string),
    service
      .from("pos_counters")
      .select("id, name, branch_id, shop_id, warehouse_id, is_active")
      .order("created_at", { ascending: false }),
  ]);

  const visibleBranchIds = new Set((branches ?? []).map((b) => b.id));
  const counters = (countersRaw ?? []).filter((c) => sabKuchWala || visibleBranchIds.has(c.branch_id));

  const [{ data: shops }, { data: warehouses }, { data: staffAll }, { data: assignmentsRaw }] = await Promise.all([
    service.from("shops").select("id, name, branch_id").in("branch_id", Array.from(visibleBranchIds)).order("name"),
    service.from("warehouses").select("id, name").in("branch_id", Array.from(visibleBranchIds)),
    service
      .from("profiles")
      .select("id, full_name, role, branch_id")
      .in("branch_id", Array.from(visibleBranchIds))
      .eq("is_active", true)
      .order("full_name"),
    service
      .from("pos_counter_staff")
      .select("id, counter_id, profile_id, is_active")
      .in("counter_id", counters.map((c) => c.id))
      .eq("is_active", true),
  ]);

  const shopName = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const warehouseName = new Map((warehouses ?? []).map((w) => [w.id, w.name]));
  const staffName = new Map((staffAll ?? []).map((p) => [p.id, p.full_name ?? "—"]));

  return (
    <div>
      <PageHeader
        title="POS Counters"
        description="Har shop ka apna POS Counter, aur staff ko un counters ki ijazat — ek staff kai shops chala sakta hai."
      />
      <PosCountersClient
        branches={branches ?? []}
        shops={(shops ?? []).map((s) => ({ id: s.id, name: s.name, branch_id: s.branch_id }))}
        staff={(staffAll ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "—", branch_id: p.branch_id }))}
        counters={counters.map((c) => ({
          id: c.id,
          name: c.name,
          branchId: c.branch_id,
          branchName: branchName.get(c.branch_id) ?? "—",
          shopName: shopName.get(c.shop_id) ?? "—",
          warehouseName: c.warehouse_id ? (warehouseName.get(c.warehouse_id) ?? "—") : "— (nahi mila)",
          isActive: c.is_active,
          staff: (assignmentsRaw ?? [])
            .filter((a) => a.counter_id === c.id)
            .map((a) => ({ profileId: a.profile_id, name: staffName.get(a.profile_id) ?? "—" })),
        }))}
        singleBranchId={sabKuchWala ? null : myBranchId}
      />
    </div>
  );
}
