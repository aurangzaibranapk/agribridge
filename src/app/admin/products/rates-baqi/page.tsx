import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";
import { t } from "@/lib/i18n/translations";
import { RatesClient } from "./rates-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

/**
 * Rate Baqi -- jin products ka rate abhi nahi mila.
 *
 * Chalees ki sheet charhne ke baad teen chaar ke rate reh jate hain.
 * Un ki wajah se poori sheet rok dena ghalat hai (naam, expiry, trade
 * rate sab maujood hain), aur unhen bhool jana us se bhi bura -- kyunke
 * un ka selling_price 0 para hota hai, aur 0 counter par muft ban jata
 * hai. Is liye wo bikte nahi, aur is fehrist mein khare rehte hain.
 */
export default async function RatesBaqiPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("pf_rb_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("v_products_rate_baqi")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  // Malik (15 September): "Extra Item" se ginti ke dauran kai jagah
  // rate aur quantity ka khana ulat gaya (jo quantity ka box tha wahan
  // rate likha gaya, aur ulta). Yahin par, sath mein quantity dikha kar
  // theek karne ka mauqa dena hai -- alag safhe par bhejna wahi ghalti
  // wahin chhoR deta jo naam ke liye pehle se maani gayi hai.
  const productIds = (rows ?? []).map((r) => String(r.id));
  const { data: invRows } = productIds.length
    ? await supabase
        .from("inventory")
        .select("product_id, warehouse_id, quantity_on_hand, warehouses(name)")
        .in("product_id", productIds)
    : { data: [] as never[] };
  const invByProduct = new Map<string, { warehouseId: string; warehouseName: string; qty: number }[]>();
  for (const row of (invRows ?? []) as any[]) {
    const list = invByProduct.get(row.product_id) ?? [];
    list.push({
      warehouseId: row.warehouse_id,
      warehouseName: (Array.isArray(row.warehouses) ? row.warehouses[0]?.name : row.warehouses?.name) ?? "—",
      qty: Number(row.quantity_on_hand ?? 0),
    });
    invByProduct.set(row.product_id, list);
  }

  return (
    <div>
      <PageHeader title={t("pf_rb_title", lang)} description={t("pf_rb_desc", lang)} />
      <ProductSetupTabs current="rates" lang={lang} />

      {(rows ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-surface-600">{t("pf_rb_none", lang)}</p>
        </Card>
      ) : (
        <RatesClient
          lang={lang}
          rows={(rows ?? []).map((r) => ({
            id: String(r.id),
            name: r.name ?? "",
            packSize: r.pack_size,
            barcode: r.barcode,
            // View se rate NULL aata hai jab maloom na ho -- sifar nahi.
            sellingPrice: r.selling_price == null ? null : Number(r.selling_price),
            purchasePrice: r.purchase_price == null ? null : Number(r.purchase_price),
            mrpPrice: r.mrp_price == null ? null : Number(r.mrp_price),
            saleMissing: Boolean(r.sale_rate_pending),
            tradeMissing: Boolean(r.trade_rate_pending),
            inventory: invByProduct.get(String(r.id)) ?? [],
          }))}
        />
      )}
    </div>
  );
}
