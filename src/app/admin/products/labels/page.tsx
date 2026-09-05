import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";
import { t } from "@/lib/i18n/translations";
import { LabelsClient } from "./labels-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse", "sales_staff", "manager"];

/**
 * Barcode Label (261). Jin cheezon par company ka barcode nahi, un ke
 * liye apna EAN-13 (200...) banta hai aur yahan se label chhapta hai.
 * Company ka barcode ho to us ka label bhi yahin se.
 */
export default async function LabelsPage({ searchParams }: { searchParams: { q?: string; f?: string } }) {
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
        <PageHeader title={t("pf_lb_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  const q = (searchParams.q ?? "").trim();
  const f = searchParams.f === "missing" || searchParams.f === "internal" ? searchParams.f : "all";

  let query = supabase
    .from("products")
    .select("id, name, pack_size, barcode, internal_barcode, barcode_source, selling_price, sale_rate_pending")
    .eq("is_deleted", false)
    .order("name")
    .limit(400);
  if (q) query = query.ilike("name", `%${q}%`);
  if (f === "missing") query = query.or("barcode.is.null,barcode.eq.");
  if (f === "internal") query = query.eq("barcode_source", "internal");
  const { data: products } = await query;

  const { count: missingCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false)
    .or("barcode.is.null,barcode.eq.");

  return (
    <div>
      <PageHeader title={t("pf_lb_title", lang)} description={t("pf_lb_desc", lang)} />
      <ProductSetupTabs current="labels" lang={lang} />
      <LabelsClient
        lang={lang}
        q={q}
        filter={f}
        missingCount={missingCount ?? 0}
        rows={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          packSize: p.pack_size,
          barcode: p.barcode && p.barcode.trim() ? p.barcode.trim() : null,
          internalBarcode: p.internal_barcode,
          source: p.barcode_source,
          price: p.sale_rate_pending ? null : Number(p.selling_price),
        }))}
      />
    </div>
  );
}
