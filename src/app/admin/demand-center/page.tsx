import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { aggregateDemands, isApproverRole, isReviewerRole, type DemandRow } from "@/lib/demand/demand-rules";
import { DemandReviewRow, type AdminDemandRow } from "./review-actions";

export const dynamic = "force-dynamic";

const pkDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("-") : "—");

/** Admin/Staff Demand Center — kisanon ki product demand, product-wise jama + review. */
export default async function DemandCenterPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle() : { data: null };
  if (!user || !me?.is_active || !isReviewerRole(me.role)) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Demand Center / ڈیمانڈ سینٹر" description="Kisanon ki product demand." />
        <Card><p className="text-sm text-red-700">Ye safha sirf staff ke liye hai.</p></Card>
      </div>
    );
  }

  const service = createServiceClient() as any;
  const { data, error } = await service
    .from("farmer_product_demands")
    .select("id, product_id, product_name, quantity, unit, needed_by, status, farmer_id, staff_note, recommended_action, reviewed_by, created_at, farmers(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as (DemandRow & AdminDemandRow)[];
  const agg = aggregateDemands(rows);
  const totals = agg.reduce((t, a) => ({
    pending: t.pending + a.counts.pending, approved: t.approved + a.counts.approved,
    rejected: t.rejected + a.counts.rejected, ordered: t.ordered + a.counts.ordered,
  }), { pending: 0, approved: 0, rejected: 0, ordered: 0 });
  const approver = isApproverRole(me.role);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <PageHeader title="Demand Center / ڈیمانڈ سینٹر" description="Product-wise kisan demand. Staff note ke sath review karta hai, Admin/Owner (doosra banda) approve karta hai." />
      {error && <Card><p className="text-sm text-red-700">Demand parhi nahi ja saki: {error.message}</p></Card>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["Pending", totals.pending, "text-amber-700"], ["Approved", totals.approved, "text-emerald-700"], ["Rejected", totals.rejected, "text-rose-700"], ["Ordered", totals.ordered, "text-sky-700"]] as const).map(([l, n, c]) => (
          <Card key={l}><p className="text-xs text-surface-500">{l}</p><p className={`text-2xl font-semibold ${c}`}>{n}</p></Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-2 font-semibold">Product-wise jama</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500"><th className="py-1">Product</th><th>Kul miqdar</th><th>Kisan</th><th>Zaroorat (pehli — aakhri)</th><th>Pending</th><th>Approved</th><th>Rejected</th><th>Ordered</th></tr></thead>
            <tbody>
              {agg.length === 0 && <tr><td colSpan={8} className="py-3 text-surface-500">Abhi koi demand nahi.</td></tr>}
              {agg.map((a) => (
                <tr key={a.key} className="border-t border-surface-100">
                  <td className="py-1.5 font-medium">{a.productName}</td>
                  <td>{a.totalQuantity.toLocaleString()} {a.unit}</td>
                  <td>{a.farmers}</td>
                  <td>{pkDate(a.earliestNeededBy)} — {pkDate(a.latestNeededBy)}</td>
                  <td>{a.counts.pending}</td><td>{a.counts.approved}</td><td>{a.counts.rejected}</td><td>{a.counts.ordered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Har demand ka review</h2>
        <div className="space-y-2">
          {rows.filter((r) => r.status !== "cancelled").map((r) => (
            <DemandReviewRow key={r.id} row={r} isApprover={approver} myId={user.id} />
          ))}
        </div>
      </Card>
    </div>
  );
}
