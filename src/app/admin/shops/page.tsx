import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ShopsListClient } from "./shops-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rawShops } = await supabase
    .from("shops")
    .select("id, name, code, business_type, is_active, status, suspend_reason, suspended_at, branch_id, branches(name)")
    .order("created_at", { ascending: false });

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  const shopIds = (rawShops ?? []).map((s: any) => s.id);

  // Kaunsi dukan mit sakti hai aur kaunsi nahi -- ye safhe par pehle se
  // dikhna chahiye, delete dabane ke BAAD ki ghalti par nahi. Rok
  // database par lagi hui hai (291); ye us rok ka aaina hai.
  //
  // Ginti mein NAKAAMI aur SIFAR ek cheez nahi. Sawal ka jawab na mile
  // to yahan null jata hai -- safha "—" likhta hai, "0" nahi. Sifar ka
  // matlab hota "dekh liya, kuch nahi hai", aur usi bharose par banda
  // delete daba deta.
  const stockByShop = new Map<string, number | null>();
  const staffByShop = new Map<string, number | null>();
  const salesByShop = new Map<string, number | null>();

  if (shopIds.length) {
    const { data: warehouses, error: whErr } = await supabase
      .from("warehouses")
      .select("id, shop_id")
      .in("shop_id", shopIds);

    const whShop = new Map((warehouses ?? []).map((w: any) => [w.id, w.shop_id as string]));
    const whIds = Array.from(whShop.keys());

    const { data: invRows, error: invErr } = whIds.length
      ? await supabase.from("inventory").select("warehouse_id, quantity_on_hand").in("warehouse_id", whIds)
      : { data: [] as any[], error: null };

    for (const id of shopIds) stockByShop.set(id, whErr || invErr ? null : 0);
    if (!whErr && !invErr) {
      for (const row of invRows ?? []) {
        const shopId = whShop.get(row.warehouse_id);
        if (!shopId) continue;
        stockByShop.set(shopId, (stockByShop.get(shopId) ?? 0) + Number(row.quantity_on_hand ?? 0));
      }
    }

    const { data: staffRows, error: staffErr } = await supabase.from("profiles").select("shop_id").in("shop_id", shopIds);
    for (const id of shopIds) staffByShop.set(id, staffErr ? null : 0);
    if (!staffErr) {
      for (const row of staffRows ?? []) {
        if (row.shop_id) staffByShop.set(row.shop_id, (staffByShop.get(row.shop_id) ?? 0) + 1);
      }
    }

    const { data: saleRows, error: saleErr } = await supabase.from("pos_sales").select("shop_id").in("shop_id", shopIds);
    for (const id of shopIds) salesByShop.set(id, saleErr ? null : 0);
    if (!saleErr) {
      for (const row of saleRows ?? []) {
        if (row.shop_id) salesByShop.set(row.shop_id, (salesByShop.get(row.shop_id) ?? 0) + 1);
      }
    }
  }

  const shops = (rawShops ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    business_type: s.business_type,
    branch_id: s.branch_id,
    is_active: s.is_active,
    status: (s.status as string) ?? (s.is_active ? "active" : "inactive"),
    suspend_reason: s.suspend_reason ?? null,
    suspended_at: s.suspended_at ?? null,
    branch_name: Array.isArray(s.branches) ? s.branches[0]?.name : s.branches?.name,
    stock: stockByShop.get(s.id) ?? null,
    staff: staffByShop.get(s.id) ?? null,
    sales: salesByShop.get(s.id) ?? null,
  }));

  return (
    <div>
      <PageHeader
        title={t("at_shops", lang)}
        description="Har Branch ke andar business-type ke hisab se Shops manage karein (Karyana, Agri Inputs, Dairy, wagera)"
      />
      <ShopsListClient shops={shops} branches={branches ?? []} />
    </div>
  );
}
