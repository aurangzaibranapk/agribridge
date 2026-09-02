import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin"];

/**
 * CSV se products charhana.
 *
 * Ye safha Owner/Admin tak mehdood hai, jaan boojh kar. Ek file poora
 * catalogue banati hai -- ghalat file poora catalogue kharab bhi kar
 * sakti hai, aur us ka pata mahine baad chalta hai jab qeematein ghalat
 * nikalti hain.
 */
export default async function ProductsImportPage() {
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
        <PageHeader title={t("pf_import_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">
            {t("pf_import_gate", lang)}
          </p>
        </Card>
      </div>
    );
  }

  const [{ data: categories }, { data: brands }, { data: companies }, { count: pendingCount }, { data: warehouses }, { data: suppliers }] = await Promise.all([
    supabase.from("categories").select("name").order("name"),
    supabase.from("brands").select("name").order("name"),
    supabase.from("companies").select("name").order("name"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("trade_rate_pending", true)
      .eq("is_deleted", false),
    supabase.from("warehouses").select("id, name, code").order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div>
      <PageHeader
        title={t("pf_import_title", lang)}
        description={t("pf_import_desc", lang)}
      />
      <ImportClient
        categories={(categories ?? []).map((c) => c.name)}
        brands={(brands ?? []).map((b) => b.name)}
        companies={(companies ?? []).map((c) => c.name)}
        tradeRatePending={pendingCount ?? null}
        warehouses={(warehouses ?? []).map((w) => ({ id: w.id, name: w.name, code: w.code }))}
        suppliers={(suppliers ?? []).map((sp) => ({ id: sp.id, name: sp.name }))}
      />
    </div>
  );
}
