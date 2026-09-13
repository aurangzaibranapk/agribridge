import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ReorderClient } from "./reorder-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse", "manager"];

/**
 * Kya Mangwana Hai (262): 30 din ki bikri se roz ki raftaar, us se
 * kitne din ka stock baqi, aur kitna mangwana chahiye. Sujhaav hai,
 * hukm nahi -- banda tadad aur supplier dekh kar purchase banata hai,
 * jo phir manzoori se guzarti hai.
 */
export default async function ReorderPage() {
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
        <PageHeader title={t("pf_ro_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  const [{ data: rows }, { data: suppliers }] = await Promise.all([
    supabase.from("v_reorder_suggestions").select("*").order("urgency").order("days_cover", { ascending: true, nullsFirst: false }).limit(300),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div>
      <PageHeader title={t("pf_ro_title", lang)} description={t("pf_ro_desc", lang)} />
      <ReorderClient
        lang={lang}
        suppliers={suppliers ?? []}
        rows={(rows ?? []).map((r) => ({
          id: String(r.product_id),
          name: r.name ?? "",
          packSize: r.pack_size,
          sold30: Number(r.sold_30 ?? 0),
          sold7: Number(r.sold_7 ?? 0),
          onHand: Number(r.on_hand ?? 0),
          dailyRate: Number(r.daily_rate ?? 0),
          daysCover: r.days_cover == null ? null : Number(r.days_cover),
          suggested: Number(r.suggested_qty ?? 0),
          urgency: String(r.urgency ?? "ok"),
          minStock: Number(r.min_stock_threshold ?? 0),
          lastSupplierId: r.last_supplier_id,
          lastSupplierName: r.last_supplier_name,
          lastCost: r.last_unit_cost == null ? null : Number(r.last_unit_cost),
          tradeRate: r.trade_rate_pending ? null : Number(r.purchase_price ?? 0),
          lastPurchaseDate: r.last_purchase_date,
        }))}
      />
    </div>
  );
}
