import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { requireGrainApprover } from "@/lib/grain/approval-guard";
import { stockOutPlan } from "@/lib/inventory/stock-math";
import { GRAIN_SALE_DELIVERY_LABELS } from "@/lib/grain/sale-draft-payload";
import type { GrainPendingPayload } from "@/lib/grain/pending-payload";
import { SaleDraftBadge } from "@/app/admin/grain-procurement/sell/sell-grain-client";
import { GrainSaleDraftActions } from "./sale-draft-actions";

export const dynamic = "force-dynamic";

const GRAIN_NAME: Record<string, string> = { wheat: "Gandum", rice: "Munji / Dhan", maize: "Makai" };
const rs = (n: number | null | undefined) => `Rs ${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const kg = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;
const pkDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}-${m}-${y}`;
};
const pkTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }) + " PKT" : "—");

/**
 * Grain bikri jo "Draft (Admin approval)" par hai. Sirf Owner / Admin /
 * Super Admin. Approve par hi stock nikalta hai, lagat (COGS) ledger mein
 * jati hai aur bardana/mazdoori ka kharcha darj hota hai.
 */
export default async function GrainSaleApprovalsPage() {
  const guard = await requireGrainApprover();
  if ("error" in guard) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Anaj Bikri -- Admin Approval" description="Draft bikri ka review." />
        <Card><p className="text-sm text-red-700">{guard.error}</p></Card>
      </div>
    );
  }

  const service = createServiceClient() as any;
  const [{ data: open }, { data: done }] = await Promise.all([
    service.from("grain_sale_drafts").select("*").in("status", ["pending", "approving"]).order("sale_date", { ascending: true }).order("created_at", { ascending: true }),
    service.from("grain_sale_drafts").select("*").in("status", ["approved", "rejected"]).order("reviewed_at", { ascending: false }).limit(30),
  ]);
  const rows: any[] = [...(open ?? []), ...(done ?? [])];
  const ids = (key: string) => Array.from(new Set(rows.map((r) => r[key]).filter(Boolean)));
  const accountIds = Array.from(new Set(rows.map((r) => (r.payload ?? {}).cost_account_id).filter(Boolean)));
  const peopleIds = Array.from(new Set(rows.flatMap((r) => [r.created_by, r.reviewed_by, r.updated_by]).filter(Boolean)));
  const saleIds = ids("approved_sale_id");

  const [{ data: buyers }, { data: warehouses }, { data: accounts }, { data: profiles }, { data: sales }, { data: products }, { data: allWarehouses }, { data: allAccounts }] = await Promise.all([
    ids("buyer_id").length ? service.from("buyers").select("id, business_name, buyer_code").in("id", ids("buyer_id")) : { data: [] },
    ids("warehouse_id").length ? service.from("warehouses").select("id, name").in("id", ids("warehouse_id")) : { data: [] },
    accountIds.length ? service.from("finance_accounts").select("id, name").in("id", accountIds) : { data: [] },
    peopleIds.length ? service.from("profiles").select("id, full_name").in("id", peopleIds) : { data: [] },
    saleIds.length ? service.from("grain_sales").select("id, sale_number").in("id", saleIds) : { data: [] },
    service.from("grain_type_products").select("grain_type, product_id"),
    service.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    service.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
  ]);
  const nameOf = (list: any[] | null, id: string | null, field: string) => (id ? list?.find((x) => x.id === id)?.[field] ?? "—" : "—");

  // Har khule draft ke liye: godam ka maujooda stock aur FIFO se andaza-e-lagat.
  const stockInfo: Record<string, { available: number; cogs: number | null; error: string | null }> = {};
  for (const r of open ?? []) {
    const productId = (products ?? []).find((p: any) => p.grain_type === r.grain_type)?.product_id;
    if (!productId) {
      stockInfo[r.id] = { available: 0, cogs: null, error: "Grain product setup nahi hai." };
      continue;
    }
    const [{ data: inv }, { data: batches }] = await Promise.all([
      service.from("inventory").select("quantity_on_hand").eq("warehouse_id", r.warehouse_id).eq("product_id", productId).maybeSingle(),
      service.from("stock_batches").select("remaining_quantity, unit_cost").eq("warehouse_id", r.warehouse_id).eq("product_id", productId).gt("remaining_quantity", 0).order("created_at", { ascending: true }),
    ]);
    const available = Number(inv?.quantity_on_hand ?? 0);
    const plan = stockOutPlan(Number(r.quantity_kg), available, (batches ?? []).map((b: any) => ({ remaining: Number(b.remaining_quantity), unitCost: Number(b.unit_cost ?? 0) })));
    stockInfo[r.id] = { available, cogs: plan.ok ? plan.cost : null, error: plan.ok ? null : plan.error };
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5">
      <PageHeader
        title="Anaj Bikri -- Admin Approval"
        description="Staff ne ye bikri 'Draft (Admin approval)' par save ki hai. Abhi in ka stock nahi nikla, lagat (COGS) ledger mein nahi gayi aur bardana/mazdoori ka kharcha darj NAHI hua. Parh kar Approve, Edit ya Reject karein."
      />
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
        <p><b>Approve</b> = bikri ki asal tareekh par stock niklega, lagat ledger mein aur kharcha darj (purani tareekh par wajah: &quot;Admin approved backdated entry&quot;). Do dafa click se do bikri nahi banti. Godam mein poora stock na ho to Approve nahi hogi.</p>
        <p className="mt-1"><b>Edit</b> = khaane theek karein, bikri Draft hi rahegi. <b>Reject</b> = kuch darj nahi hoga, record wajah ke sath mehfooz rahega.</p>
        <p className="mt-1"><Link href="/admin/grain-procurement/sell" className="underline">Grain Bechein par wapas</Link></p>
      </div>

      {(open ?? []).length === 0 && <Card><p className="text-sm text-surface-500">Is waqt koi bikri approval ka intezar nahi kar rahi.</p></Card>}

      {rows.map((r) => {
        const p = (r.payload ?? {}) as GrainPendingPayload;
        const isOpen = r.status === "pending" || r.status === "approving";
        const info = stockInfo[r.id];
        const qty = Number(r.quantity_kg ?? 0);
        const rate = Number(r.rate_per_kg ?? 0);
        const extra = Number(r.bardana_cost ?? 0) + Number(r.mazdoori_cost ?? 0);
        const history = Array.isArray(r.edit_history) ? r.edit_history : [];
        return (
          <section id={`d-${r.id}`} key={r.id} className={`rounded-2xl border bg-white p-4 shadow-card dark:bg-surface-900 sm:p-5 ${isOpen ? "border-amber-300 dark:border-amber-800" : "border-surface-200 dark:border-surface-800"}`}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-surface-100 pb-3 dark:border-surface-800">
              <div>
                <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">
                  {nameOf(buyers, r.buyer_id, "business_name")} <span className="text-xs font-normal text-surface-500">({nameOf(buyers, r.buyer_id, "buyer_code")})</span> <SaleDraftBadge status={r.status} />
                </h2>
                <p className="text-xs text-surface-500">
                  {GRAIN_NAME[r.grain_type] ?? r.grain_type} · Tareekh <b>{pkDate(r.sale_date)}</b> · Godam {nameOf(warehouses, r.warehouse_id, "name")} · Banayi: {nameOf(profiles, r.created_by, "full_name")} ({pkTime(r.created_at)})
                </p>
                {r.reviewed_at && <p className="text-xs text-surface-500">{r.status === "rejected" ? "Reject" : "Approve"}: {nameOf(profiles, r.reviewed_by, "full_name")} ({pkTime(r.reviewed_at)})</p>}
              </div>
              {r.approved_sale_id && <span className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Asal bikri: {nameOf(sales, r.approved_sale_id, "sale_number")}</span>}
            </div>

            {r.reject_reason && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">Reject ki wajah: {r.reject_reason}</p>}
            {r.last_error && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-300">Pichli koshish: {r.last_error}</p>}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-surface-200 p-3 text-sm dark:border-surface-700">
                <h3 className="mb-2 font-semibold">Wazan aur rate</h3>
                <Line k="Wazan" v={`${kg(qty)} (${(qty / 40).toLocaleString(undefined, { maximumFractionDigits: 3 })} mand)`} />
                <Line k="Rate" v={`${rs(rate)} fi kg (${rs(rate * 40)} fi mand)`} />
                <Line k="Kul raqam (buyer se leni)" v={rs(r.total_amount)} strong />
                <Line k="Delivery" v={GRAIN_SALE_DELIVERY_LABELS[p.delivery_term ?? ""] ?? p.delivery_term ?? "—"} />
                <Line k="Wasooli" v="Bikri par koi wasooli nahi -- Approve ke baad alag se" />
              </div>
              <div className="rounded-xl border border-surface-200 p-3 text-sm dark:border-surface-700">
                <h3 className="mb-2 font-semibold">Stock aur lagat (andaza)</h3>
                {info ? (
                  <>
                    <Line k="Godam mein is waqt" v={kg(info.available)} />
                    {info.available < qty && <p className="my-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Stock kam hai ({kg(qty - info.available)} ki kami) -- abhi Approve nahi hogi. Pehle khareed darj/approve karein.</p>}
                    <Line k="Lagat (FIFO, andaza)" v={info.cogs === null ? "—" : rs(info.cogs)} />
                    <Line k="Bardana + mazdoori" v={rs(extra)} />
                    <Line k="Munafa (andaza)" v={info.cogs === null ? "—" : rs(Number(r.total_amount) - info.cogs - extra)} strong />
                  </>
                ) : (
                  <p className="text-xs text-surface-500">Band draft -- stock ka andaza nahi.</p>
                )}
              </div>
              <div className="rounded-xl border border-surface-200 p-3 text-sm dark:border-surface-700">
                <h3 className="mb-2 font-semibold">Kharcha aur notes</h3>
                <Line k="Bardana" v={rs(r.bardana_cost)} />
                <Line k="Mazdoori" v={rs(r.mazdoori_cost)} />
                {extra > 0 && <Line k="Kis account se" v={nameOf(accounts, p.cost_account_id ?? null, "name")} />}
                <div className="mt-2 border-t border-surface-100 pt-2 text-xs text-surface-600 dark:border-surface-800">
                  <p className="font-medium">Notes</p>
                  <p className="whitespace-pre-wrap">{p.notes || "—"}</p>
                </div>
                {history.length > 0 && <p className="mt-2 text-[11px] text-surface-500">Admin ne {history.length} dafa edit kiya.</p>}
              </div>
            </div>

            {isOpen && (
              <GrainSaleDraftActions
                draftId={r.id}
                status={r.status}
                payload={p}
                warehouses={allWarehouses ?? []}
                accounts={allAccounts ?? []}
                stockShort={Boolean(info && info.available < qty)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${strong ? "font-semibold text-surface-900 dark:text-white" : "text-surface-600 dark:text-surface-300"}`}>
      <span>{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
