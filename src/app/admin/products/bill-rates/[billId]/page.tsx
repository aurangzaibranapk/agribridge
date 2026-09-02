import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { BillClient } from "./bill-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

export default async function BillRatePage({ params }: { params: { billId: string } }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("pf_bill_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  const { data: bill } = await supabase
    .from("supplier_bill_reads")
    .select(
      "id, bill_number, bill_date, bill_total, supplier_name_raw, supplier_id, purchase_id, image_url, source, status, ai_read_at, created_at, suppliers(name)"
    )
    .eq("id", params.billId)
    .maybeSingle();

  if (!bill) notFound();

  // Purchase banane ke liye: supplier (agar bill par na ho) aur branch
  // (admin chune, staff ki apni). Wohi qaida jo purchases/new par hai.
  const isAdminLevel = ["owner", "super_admin", "admin"].includes(me.role);

  const [{ data: lines }, { data: products }, { data: billFiles }, { data: suppliers }, { data: branches }] = await Promise.all([
    supabase
      .from("supplier_bill_lines")
      .select("*")
      .eq("bill_read_id", params.billId)
      .neq("status", "skipped")
      .order("line_no"),
    supabase
      .from("products")
      .select("id, name, pack_size, purchase_price, trade_rate_pending")
      .eq("is_deleted", false)
      .order("name")
      .limit(5000),
    supabase
      .from("supplier_bill_files")
      .select("id, file_url, mime_type, page_no, ai_read_at, problem, lines_found")
      .eq("bill_read_id", params.billId)
      .order("page_no"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    isAdminLevel
      ? supabase.from("branches").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const supplierName = (bill as unknown as { suppliers?: { name?: string } }).suppliers?.name ?? bill.supplier_name_raw;

  // Qataron ka jorh bill ke kul se milta hai ya nahi. Farq ka matlab
  // hai koi qatar chhoot gayi -- aur wo khamoshi se chhootti hai.
  const linesTotal = (lines ?? []).reduce((sum, l) => sum + Number(l.line_total ?? 0), 0);

  return (
    <div>
      <Link
        href="/admin/products/bill-rates"
        className="mb-2 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> {t("pf_bill_all", lang)}
      </Link>

      <PageHeader
        title={supplierName ?? t("pf_bill_of_supplier", lang)}
        description={
          [
            bill.bill_number ? `Bill #${bill.bill_number}` : null,
            bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-GB") : null,
            bill.bill_total != null
              ? t("pf_bill_total_on", lang).replace("{amount}", Number(bill.bill_total).toLocaleString())
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || t("pf_bill_unread_head", lang)
        }
      />

      <BillClient
        lang={lang}
        billId={bill.id}
        billStatus={bill.status}
        source={bill.source}
        billSupplierId={bill.supplier_id}
        purchaseId={bill.purchase_id}
        suppliers={(suppliers ?? []).map((sp) => ({ id: sp.id, name: sp.name }))}
        branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))}
        defaultBranchId={me.branch_id ?? null}
        isAdminLevel={isAdminLevel}
        files={(billFiles ?? []).map((f) => ({
          id: f.id,
          url: f.file_url,
          mime: f.mime_type,
          pageNo: f.page_no,
          read: Boolean(f.ai_read_at),
          problem: f.problem,
          linesFound: f.lines_found,
        }))}
        billTotal={bill.bill_total == null ? null : Number(bill.bill_total)}
        linesTotal={linesTotal}
        aiRead={Boolean(bill.ai_read_at)}
        lines={(lines ?? []).map((l) => ({
          id: l.id,
          lineNo: l.line_no,
          rawText: l.raw_text,
          itemName: l.item_name,
          packSize: l.pack_size,
          qty: l.qty == null ? null : Number(l.qty),
          rate: l.rate == null ? null : Number(l.rate),
          lineTotal: l.line_total == null ? null : Number(l.line_total),
          pageNo: l.page_no,
          productId: l.product_id,
          matchSource: l.match_source,
          confidence: (l as { confidence?: string | null }).confidence ?? null,
          status: l.status,
          problem: l.problem,
          appliedRate: l.applied_rate == null ? null : Number(l.applied_rate),
        }))}
        products={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          packSize: p.pack_size,
          purchasePrice: Number(p.purchase_price ?? 0),
          ratePending: Boolean(p.trade_rate_pending),
        }))}
      />
    </div>
  );
}
