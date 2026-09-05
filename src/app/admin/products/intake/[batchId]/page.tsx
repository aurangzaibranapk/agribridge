import { loadUnits } from "@/lib/units";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";
import { BatchClient } from "./batch-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

export default async function IntakeBatchPage({ params }: { params: { batchId: string } }) {
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
        <PageHeader title={t("pf_intake_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  const { data: batch } = await supabase
    .from("product_intake_batches")
    .select("id, name, status, warehouse_id, created_at, warehouses(name)")
    .eq("id", params.batchId)
    .maybeSingle();

  if (!batch) notFound();

  const [{ data: items }, { data: categories }, units] = await Promise.all([
    supabase
      .from("product_intake_items")
      .select("*")
      .eq("batch_id", params.batchId)
      .neq("status", "skipped")
      .order("created_at"),
    supabase.from("categories").select("name").order("name"),
    loadUnits(true),
  ]);

  const warehouseName = (batch as unknown as { warehouses?: { name?: string } }).warehouses?.name ?? null;

  return (
    <div>
      <PageHeader
        title={batch.name}
        description={
          warehouseName
            ? t("pf_after_approve_wh", lang).replace("{warehouse}", warehouseName)
            : t("pf_after_approve", lang)
        }
        actions={
          <Link
            href="/admin/products/intake"
            className="inline-flex items-center gap-1 rounded-lg border border-surface-300 px-3 py-1.5 text-sm hover:bg-surface-50"
          >
            <ArrowLeft className="h-4 w-4" /> {t("pf_back", lang)}
          </Link>
        }
      />

      <BatchClient
        lang={lang}
        batchId={batch.id}
        batchStatus={batch.status}
        categories={(categories ?? []).map((c) => c.name)}
        units={units.map((u) => u.label)}
        items={(items ?? []).map((i) => ({
          id: i.id,
          imageUrl: i.image_url,
          barcode: i.barcode,
          barcodeSource: i.barcode_source,
          barcodeVerified: i.barcode_verified,
          name: i.name,
          brandName: i.brand_name,
          companyName: i.company_name,
          categoryName: i.category_name,
          packSize: i.pack_size,
          unit: i.unit,
          manufactureDate: i.manufacture_date,
          expiryDate: i.expiry_date,
          mrpPrice: i.mrp_price,
          sellingPrice: i.selling_price,
          wholesalePrice: i.wholesale_price,
          purchasePrice: i.purchase_price,
          openingQty: i.opening_qty,
          status: i.status,
          aiReadAt: i.ai_read_at,
        }))}
      />
    </div>
  );
}
