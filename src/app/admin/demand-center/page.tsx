import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { aggregateDemands, isApproverRole, isReviewerRole, type DemandRow } from "@/lib/demand/demand-rules";
import { DemandReviewRow, type AdminDemandRow } from "./review-actions";
import { SuggestionCard, PlanArrivedButton, NotifyButton } from "./planning-actions";
import { buildInsights, productKey, type InsightRow } from "@/lib/demand/insights";
import { effectivePipeline, PIPELINE_LABELS, PIPELINE_STATUSES } from "@/lib/demand/pipeline";
import { DEMAND_CATEGORY_LABELS, isDemandCategory } from "@/lib/demand/categories";

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
  // Naye columns (migration 20261015233000) live na hon to purana select.
  let { data, error } = await service
    .from("farmer_product_demands")
    .select("id, product_id, product_name, quantity, unit, needed_by, status, pipeline_status, category, area, notified_at, procurement_plan_id, farmer_id, staff_note, recommended_action, reviewed_by, created_at, farmers(full_name, phone_number, village, tehsil, district)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    ({ data, error } = await service
      .from("farmer_product_demands")
      .select("id, product_id, product_name, quantity, unit, needed_by, status, farmer_id, staff_note, recommended_action, reviewed_by, created_at, farmers(full_name, phone_number, village, tehsil, district)")
      .order("created_at", { ascending: false })
      .limit(500));
  }
  const rows = (data ?? []) as (DemandRow & AdminDemandRow)[];
  const agg = aggregateDemands(rows);
  const totals = agg.reduce((t, a) => ({
    pending: t.pending + a.counts.pending, approved: t.approved + a.counts.approved,
    rejected: t.rejected + a.counts.rejected, ordered: t.ordered + a.counts.ordered,
  }), { pending: 0, approved: 0, rejected: 0, ordered: 0 });
  const approver = isApproverRole(me.role);
  const insights = buildInsights(rows as unknown as InsightRow[]);
  const { data: plans } = await service.from("demand_procurement_plans").select("id, product_key, product_name, unit, planned_quantity, confirmed_quantity, status, approved_at").order("approved_at", { ascending: false }).limit(50);
  const arrivedRows = (rows as any[]).filter((r) => ["stock_arrived", "notified"].includes(effectivePipeline(r)));
  const arrivedByKey = new Map<string, any[]>();
  for (const r of arrivedRows) { const k = productKey(r); arrivedByKey.set(k, [...(arrivedByKey.get(k) ?? []), r]); }
  const prioTone = (p: string) => (p === "High" ? "bg-rose-100 text-rose-800" : p === "Medium" ? "bg-amber-100 text-amber-800" : "bg-surface-100 text-surface-700");

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
        <h2 className="mb-2 font-semibold">Sab se zyada mangi gayi cheezen (priority)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500"><th className="py-1">#</th><th>Product</th><th>Category</th><th>Priority</th><th>Score</th><th>Kisan</th><th>Miqdar</th><th>Ilaqe</th><th>Pipeline</th></tr></thead>
            <tbody>
              {insights.map((i, n) => (
                <tr key={i.key} className="border-t border-surface-100 align-top">
                  <td className="py-1.5">{n + 1}</td>
                  <td className="font-medium">{i.productName}</td>
                  <td>{i.category && isDemandCategory(i.category) ? DEMAND_CATEGORY_LABELS[i.category].rm : "—"}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs ${prioTone(i.priority)}`}>{i.priority}</span></td>
                  <td>{i.score}</td>
                  <td>{i.farmers}</td>
                  <td>{i.liveQuantity.toLocaleString()} {i.unit}</td>
                  <td className="text-xs">{i.areas.slice(0, 4).map((a) => `${a.area}: ${a.farmers} kisan / ${a.quantity}`).join(" · ") || "—"}</td>
                  <td className="text-xs">{PIPELINE_STATUSES.filter((p) => i.pipeline[p]).map((p) => `${PIPELINE_LABELS[p]} ${i.pipeline[p]}`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Kharid ke mashware</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {insights.filter((i) => i.suggestion.confirmed > 0).length === 0 && <p className="text-sm text-surface-500">Abhi koi approved demand nahi jis par kharid ka mashwara ho.</p>}
          {insights.filter((i) => i.suggestion.confirmed > 0).map((i) => (
            <SuggestionCard key={i.key} productKey={i.key} productName={i.productName} unit={i.unit} confirmed={i.suggestion.confirmed} buffer={i.suggestion.buffer} suggested={i.suggestion.suggested} farmers={i.confirmedFarmers} isApprover={approver} canAskSupplier={(i.pipeline.interest_confirmed ?? 0) > 0} />
          ))}
        </div>
        {(plans ?? []).length > 0 && (
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium">Manzoor-shuda plan</p>
            {(plans ?? []).map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-surface-100 py-1">
                <span>{p.product_name}: {Number(p.planned_quantity)} {p.unit} ({p.status})</span>
                {approver && p.status === "planned" && <PlanArrivedButton planId={p.id} />}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Maal aa gaya — dilchaspi rakhne wale kisan</h2>
        {arrivedByKey.size === 0 && <p className="text-sm text-surface-500">Abhi kisi product par &quot;maal aa gaya&quot; nahi laga.</p>}
        {[...arrivedByKey.entries()].map(([k, list]) => (
          <div key={k} className="mb-3">
            <p className="font-medium">{list[0].product_name} — {list.length} kisan</p>
            <div className="mt-1 space-y-2">
              {list.map((r: any) => (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-surface-100 p-2 text-sm">
                  <span>{r.farmers?.full_name ?? "Kisan"}{r.farmers?.phone_number ? ` · ${r.farmers.phone_number}` : ""} — {r.quantity} {r.unit}{r.notified_at ? " · bataya ja chuka" : ""}</span>
                  <NotifyButton demandId={r.id} already={!!r.notified_at} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="mt-2 text-xs text-surface-500">Notify sirf waqt darj karta aur message tayyar karta hai. WhatsApp/SMS khud nahi jata.</p>
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
