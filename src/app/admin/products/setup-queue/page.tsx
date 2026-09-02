import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { QueueClient, type Filter } from "./queue-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];
const APPROVERS = ["owner", "super_admin", "admin"];
const FILTERS: Filter[] = ["all", "rate", "barcode", "image", "expiry", "approval"];

/**
 * Adhoore products (258) -- jo bhi baqi hai, ek jagah.
 *
 * Rate Baqi (252) ka bara bhai. Wahan sirf rate; yahan rate, barcode,
 * tasveer, miyaad aur manzoori sath. Upar ginti, neeche fehrist, ek
 * form. Koi naya nishan nahi -- wohi jo products par pehle se hain.
 */
export default async function SetupQueuePage({ searchParams }: { searchParams?: { f?: string } }) {
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
        <PageHeader title={t("pf_sq_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  const filter: Filter = FILTERS.includes((searchParams?.f ?? "all") as Filter) ? ((searchParams?.f ?? "all") as Filter) : "all";

  const [{ data: counts }, { data: rows }] = await Promise.all([
    supabase.from("v_product_setup_counts").select("*").maybeSingle(),
    supabase
      .from("v_product_setup_queue")
      .select("*")
      .order("issue_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <div>
      <PageHeader title={t("pf_sq_title", lang)} description={t("pf_sq_desc", lang)} />
      <QueueClient
        lang={lang}
        filter={filter}
        canApprove={APPROVERS.includes(me.role)}
        counts={{
          rate: Number(counts?.rate_pending ?? 0),
          barcode: Number(counts?.barcode_missing ?? 0),
          image: Number(counts?.image_missing ?? 0),
          expiry: Number(counts?.expiry_attention ?? 0),
          approval: Number(counts?.approval_pending ?? 0),
          intakeOpen: Number(counts?.intake_open ?? 0),
          total: Number(counts?.total_products ?? 0),
        }}
        rows={(rows ?? []).map((r) => ({
          id: String(r.id),
          name: r.name ?? "",
          packSize: r.pack_size,
          barcode: r.barcode,
          imageUrl: r.image_url,
          expiryDate: r.expiry_date,
          daysLeft: r.days_left == null ? null : Number(r.days_left),
          sellingPrice: r.selling_price == null ? null : Number(r.selling_price),
          purchasePrice: r.purchase_price == null ? null : Number(r.purchase_price),
          mrpPrice: r.mrp_price == null ? null : Number(r.mrp_price),
          saleMissing: Boolean(r.sale_rate_pending),
          tradeMissing: Boolean(r.trade_rate_pending),
          barcodeMissing: Boolean(r.barcode_missing),
          imageMissing: Boolean(r.image_missing),
          expired: Boolean(r.expired),
          expirySoon: Boolean(r.expiry_soon),
          approvalPending: Boolean(r.approval_pending),
        }))}
      />
    </div>
  );
}
