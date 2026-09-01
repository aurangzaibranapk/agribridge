import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { BillClient } from "./bill-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

export default async function BillRatePage({ params }: { params: { billId: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title="Bill se Trade Rate" />
        <Card>
          <p className="text-sm text-surface-600">Ye safha Owner, Admin aur Warehouse wale ke liye hai.</p>
        </Card>
      </div>
    );
  }

  const { data: bill } = await supabase
    .from("supplier_bill_reads")
    .select(
      "id, bill_number, bill_date, bill_total, supplier_name_raw, image_url, status, ai_read_at, created_at, suppliers(name)"
    )
    .eq("id", params.billId)
    .maybeSingle();

  if (!bill) notFound();

  const [{ data: lines }, { data: products }] = await Promise.all([
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
        <ArrowLeft className="h-4 w-4" /> Sab bill
      </Link>

      <PageHeader
        title={supplierName ?? "Supplier ka bill"}
        description={
          [
            bill.bill_number ? `Bill #${bill.bill_number}` : null,
            bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-GB") : null,
            bill.bill_total != null ? `Bill par kul Rs ${Number(bill.bill_total).toLocaleString()}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Bill ki tafseel parhi nahi ja saki — qatarein khud dekh lein."
        }
      />

      <BillClient
        billId={bill.id}
        billStatus={bill.status}
        billImageUrl={bill.image_url}
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
          productId: l.product_id,
          matchSource: l.match_source,
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
