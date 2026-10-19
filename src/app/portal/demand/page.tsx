import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DemandCenterClient, type ProductDemandRow, type DemandProduct } from "./demand-client";
import { classifyProducts, type ClassifiedCategory } from "@/lib/demand/categories";

export const dynamic = "force-dynamic";

export default async function FarmerDemandCenterPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();
  if (!farmer) redirect("/login");

  const [{ data: products }, { data: categories }, { data: demands }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, pack_size, unit, is_available, is_deleted, category_id")
      .eq("is_deleted", false)
      .order("name"),
    // categories: public read RLS -- qism cards ke liye (Raw Grain farmer se chhupa).
    (supabase as any).from("categories").select("id, name, parent_category_id, category_kind"),
    (supabase as any)
      .from("farmer_product_demands")
      .select("id, product_id, product_name, quantity, unit, needed_by, purpose, notes, status, staff_note, created_at, updated_at")
      .eq("farmer_id", farmer.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Pipeline/category (migration 20261015233000) -- na hon to purana hi dikhao.
  const ids = (demands ?? []).map((d: { id: string }) => d.id);
  const extra = new Map<string, { pipeline_status: string | null; category: string | null }>();
  if (ids.length) {
    const { data: ext, error: extErr } = await (supabase as any)
      .from("farmer_product_demands")
      .select("id, pipeline_status, category")
      .in("id", ids);
    if (!extErr) for (const e of ext ?? []) extra.set(e.id, { pipeline_status: e.pipeline_status ?? null, category: e.category ?? null });
  }
  const merged = (demands ?? []).map((d: any) => ({ ...d, ...(extra.get(d.id) ?? {}) }));

  return (
    <DemandCenterClient
      farmerName={farmer.full_name ?? "Kisan"}
      products={classifyProducts((products ?? []) as any[], (categories ?? []) as ClassifiedCategory[]) as DemandProduct[]}
      demands={merged as ProductDemandRow[]}
    />
  );
}
