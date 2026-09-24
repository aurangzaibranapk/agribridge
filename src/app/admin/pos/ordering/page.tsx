import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { getCurrentSeller } from "@/lib/current-seller";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import { ShoppingCart, Store, UserRound } from "lucide-react";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (["completed", "approved", "delivered"].includes(status)) return "green" as const;
  if (["rejected", "cancelled"].includes(status)) return "red" as const;
  if (status === "draft") return "amber" as const;
  return "blue" as const;
}

export default async function OrderingDashboardPage() {
  const lang = getLanguageFromCookies("rm");
  const seller = await getCurrentSeller();

  if (!seller) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">{t("at_no_branch_dealer_link", lang)}</p>
      </div>
    );
  }

  const supabase = createClient();

  const { data: orders } =
    seller.kind === "branch"
      ? await supabase
          .from("agri_orders")
          .select("id, order_number, order_type, grand_total, status, created_at, requested_by")
          .eq("order_to_branch_id", seller.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [] as any[] };

  const requesterIds = Array.from(new Set((orders ?? []).map((o) => o.requested_by).filter(Boolean)));
  let requesterNames: Record<string, string> = {};
  if (requesterIds.length > 0) {
    const { data: requesters } = await supabase.from("profiles").select("id, full_name").in("id", requesterIds);
    requesterNames = Object.fromEntries((requesters ?? []).map((r: any) => [r.id, r.full_name ?? "User"]));
  }

  const totalOrders = orders?.length ?? 0;
  const totalValue = (orders ?? []).reduce((sum, o) => sum + Number(o.grand_total), 0);
  const inTransit = (orders ?? []).filter((o) => ["dispatched", "in_transit"].includes(o.status)).length;
  const delivered = (orders ?? []).filter((o) => ["delivered", "completed"].includes(o.status)).length;

  // Advance/credit balance: if this branch has paid more (verified
  // payments) than it's been charged (GRN completions), the difference
  // is available as an advance for future orders.
  let advanceBalance = 0;
  if (seller.kind === "branch") {
    const { data: creditTxns } = await supabase
      .from("branch_credit_transactions")
      .select("transaction_type, amount")
      .eq("branch_id", seller.id);
    const advancePaid = (creditTxns ?? []).filter((t) => t.transaction_type === "advance_payment").reduce((s, t) => s + Number(t.amount), 0);
    const orderCharges = (creditTxns ?? []).filter((t) => t.transaction_type === "order_charge").reduce((s, t) => s + Number(t.amount), 0);
    const adjustments = (creditTxns ?? [])
      .filter((t) => t.transaction_type === "adjustment" || t.transaction_type === "refund")
      .reduce((s, t) => s + Number(t.amount), 0);
    const outstanding = orderCharges - advancePaid - adjustments;
    advanceBalance = outstanding < 0 ? Math.abs(outstanding) : 0;
  }

  return (
    <div>
      <PageHeader title={t("pos_karyana_ordering", lang)} description={seller.name} />

      <div className="mb-6 rounded-card bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-100">{t("pos_total_orders", lang)}</p>
            <p className="mt-1 font-display text-xl font-semibold">{totalOrders}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-100">{t("pos_total_order_value", lang)}</p>
            <p className="mt-1 font-display text-xl font-semibold">Rs {totalValue.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-100">{t("pos_orders_in_transit", lang)}</p>
            <p className="mt-1 font-display text-xl font-semibold">{inTransit}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-100">{t("pos_orders_delivered", lang)}</p>
            <p className="mt-1 font-display text-xl font-semibold">{delivered}</p>
          </div>
        </div>
      </div>

      {advanceBalance > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-card border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/40 dark:bg-green-950/30">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-green-600">{t("pos_advance_balance", lang)}</p>
            <p className="font-display text-lg font-semibold text-green-700 dark:text-green-300">Rs {advanceBalance.toLocaleString()}</p>
          </div>
          <p className="max-w-xs text-right text-xs text-green-600">{t("pos_advance_hint", lang)}</p>
        </div>
      )}

      <div className="mb-6">
        <Link
          href="/admin/pos/ordering/new"
          className="flex flex-col items-center justify-center gap-2 rounded-card border border-surface-200 bg-white p-5 shadow-card hover:border-brand-300 dark:border-surface-800 dark:bg-surface-900"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30">
            <ShoppingCart className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-surface-900 dark:text-white">{t("pos_new_order", lang)}</span>
        </Link>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("pos_recent_orders", lang)}</h2>
        <Link href="/admin/pos/ordering/history" className="text-xs font-medium text-brand-600 hover:underline">
          {t("pos_view_all", lang)}
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {(orders ?? []).length === 0 ? (
          <div className="px-3 py-10 text-center text-surface-400">{t("pos_no_orders", lang)}</div>
        ) : (
          (orders ?? []).map((o) => {
            const requesterName = o.requested_by ? requesterNames[o.requested_by] ?? "User" : "User";
            return (
              <Link
                key={o.id}
                href={`/admin/agri-orders/${o.id}`}
                className="flex items-center justify-between gap-3 border-b border-surface-100 px-4 py-3.5 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    <Store className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{seller.name}</p>
                    <p className="flex items-center gap-1 text-xs text-surface-500">
                      <UserRound className="h-3 w-3" /> {requesterName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-surface-400">
                      {o.order_number} · {new Date(o.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">Rs {Number(o.grand_total).toLocaleString()}</p>
                  <Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, " ")}</Badge>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}