import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { SuggestedClient } from "./suggested-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "manager", "sales_staff", "warehouse"];

/**
 * "Shop ko kya chahiye" (280) -- godam se mangwane ki tajweez.
 *
 * Ye `/admin/products/reorder` se ALAG sawal hai. Wahan sawal ye hota
 * hai ke SUPPLIER se kya kharidna hai (poore idare ka ek hisaab); yahan
 * sawal ye hai ke kis SHOP ko GODAM se kya bhejna hai.
 *
 * Tajweez hai, hukm nahi: button sirf darkhwast ka draft banata hai --
 * wohi darkhwast jo shop staff khud banata hai, usi raaste se manzoori
 * aur dispatch se guzarti hai. Yahan se maal seedha nahi jata.
 *
 * Jis cheez ki 30 din mein ek bhi bikri nahi hui, us ka "kitne din ka
 * maal" NULL rehta hai aur wo tawajjo wali fehrist mein nahi aati --
 * sifar likh dena "aaj khatam" kehta, jab ke asal baat ye hai ke us ki
 * raftaar maloom hi nahi.
 */
export default async function SuggestedTransfersPage({
  searchParams,
}: {
  searchParams?: { shop?: string };
}) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active, shop_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("sr_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  // Shop staff sirf apni dukan dekhta hai; manager/admin sab.
  const isMaster = ["owner", "super_admin", "admin", "manager", "warehouse"].includes(me.role);
  const shopFilter = isMaster ? (searchParams?.shop ?? null) : (me.shop_id ?? null);

  const service = createServiceClient();
  let q = service
    .from("v_shop_replenishment" as never)
    .select("*")
    .in("urgency", ["out", "critical", "low"])
    .order("urgency")
    .order("days_cover", { ascending: true, nullsFirst: false })
    .limit(300);
  if (shopFilter) q = q.eq("shop_id", shopFilter);
  const [{ data: rows, error }, { data: shops }] = await Promise.all([
    q,
    service.from("shops").select("id, name").order("name"),
  ]);

  if (error) {
    // Khali fehrist "sab theek hai" kehti hai. Ye alag baat hai, aur
    // usay chhupana bande ko ghalat itminan de deta hai.
    return (
      <div>
        <PageHeader title={t("sr_title", lang)} />
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">{t("ar_load_failed", lang)}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <PageHeader title={t("sr_title", lang)} description={t("sr_desc", lang)} />
      <SuggestedClient
        lang={lang}
        rows={((rows ?? []) as any[]).map((r) => ({
          shopId: String(r.shop_id),
          shopName: r.shop_name ?? "",
          productId: String(r.product_id),
          productName: r.product_name ?? "",
          packSize: r.pack_size ?? null,
          shopOnHand: Number(r.shop_on_hand ?? 0),
          warehouseOnHand: Number(r.warehouse_on_hand ?? 0),
          dailyRate: Number(r.daily_rate ?? 0),
          daysCover: r.days_cover === null || r.days_cover === undefined ? null : Number(r.days_cover),
          suggestedQty: Number(r.suggested_qty ?? 0),
          urgency: String(r.urgency ?? "ok"),
        }))}
        shops={(shops ?? []).map((s) => ({ id: String(s.id), name: s.name ?? "" }))}
        showShopPicker={isMaster}
        selectedShop={shopFilter}
      />
    </div>
  );
}
