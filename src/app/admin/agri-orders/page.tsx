import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import {
  FileText, Clock, DollarSign, CheckCircle2, Package, Truck, MapPin, CheckSquare,
  ClipboardCheck, XCircle, Plus, TrendingUp, AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "draft", label: "Draft Orders", icon: FileText, color: "text-surface-500" },
  { key: "submitted", label: "Pending Approval", icon: Clock, color: "text-amber-600" },
  { key: "sales_verified", label: "Sales Verified", icon: CheckSquare, color: "text-blue-600" },
  { key: "finance_verified", label: "Finance Verified", icon: DollarSign, color: "text-indigo-600" },
  { key: "approved", label: "Approved Orders", icon: CheckCircle2, color: "text-brand-600" },
  { key: "processing", label: "In Process", icon: Package, color: "text-purple-600" },
  { key: "dispatched", label: "Dispatched", icon: Truck, color: "text-blue-500" },
  { key: "in_transit", label: "In Transit", icon: Truck, color: "text-amber-500" },
  { key: "delivered", label: "Delivered", icon: MapPin, color: "text-green-500" },
  { key: "grn_submitted", label: "GRN Pending", icon: ClipboardCheck, color: "text-orange-600" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "text-green-700" },
  { key: "cancelled", label: "Cancelled", icon: XCircle, color: "text-red-500" },
];

// Statuses where SOMEONE needs to take the next action — these get the
// urgent red highlight so whoever's turn it is notices immediately.
const AWAITING_ACTION_STATUSES = ["submitted", "sales_verified", "finance_verified", "approved"];
const DONE_STATUSES = ["completed"];

function statusTone(status: string) {
  if (["completed", "approved", "delivered"].includes(status)) return "green" as const;
  if (["rejected", "cancelled"].includes(status)) return "red" as const;
  if (status === "draft") return "amber" as const;
  return "blue" as const;
}

export default async function AgriOrdersPage() {
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("agri_orders")
    .select("id, order_number, order_type, shop_dealer_name, order_to_type, grand_total, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const counts: Record<string, number> = {};
  let totalValue = 0;
  let pendingPayment = 0;
  const now = new Date();
  let thisMonthSales = 0;

  (orders ?? []).forEach((o) => {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
    totalValue += Number(o.grand_total);
    if (["submitted", "sales_verified", "finance_verified"].includes(o.status)) pendingPayment += Number(o.grand_total);
    const created = new Date(o.created_at);
    if (created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) thisMonthSales += Number(o.grand_total);
  });

  return (
    <div>
      <PageHeader
        title="AgriBridge Ordering"
        description="Order Creation se Delivery/GRN tak - poora tracking"
        actions={
          <Link href="/admin/agri-orders/new" className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> New Order
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Orders</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-800 dark:text-brand-200">{orders?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Total Order Value</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalValue.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Pending Payment</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700 dark:text-amber-300">Rs {pendingPayment.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">This Month Sales</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {thisMonthSales.toLocaleString()}</p>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key} className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <div className={`flex items-center gap-1.5 ${s.color}`}>
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">{s.label}</span>
              </div>
              <p className="mt-1.5 font-display text-lg font-semibold text-surface-900 dark:text-white">{counts[s.key] ?? 0}</p>
            </Card>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500"></th>
              <th className="px-3 py-2 font-medium text-surface-500">Order No.</th>
              <th className="px-3 py-2 font-medium text-surface-500">Type</th>
              <th className="px-3 py-2 font-medium text-surface-500">To</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Value</th>
              <th className="px-3 py-2 font-medium text-surface-500">Status</th>
              <th className="px-3 py-2 font-medium text-surface-500"></th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => {
              const needsAction = AWAITING_ACTION_STATUSES.includes(o.status);
              const isDone = DONE_STATUSES.includes(o.status);
              const rowClass = needsAction
                ? "bg-red-50 dark:bg-red-950/20"
                : isDone
                ? "bg-green-50 dark:bg-green-950/20"
                : "";
              return (
                <tr key={o.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${rowClass}`}>
                  <td className="px-3 py-2">
                    {needsAction && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    {isDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-surface-700 dark:text-surface-300">{o.order_number}</td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{o.order_type}</td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{o.shop_dealer_name ?? o.order_to_type}</td>
                  <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {Number(o.grand_total).toLocaleString()}</td>
                  <td className="px-3 py-2"><Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, " ")}</Badge></td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/agri-orders/${o.id}`}
                      className={`text-xs font-medium hover:underline ${needsAction ? "text-red-600" : isDone ? "text-green-600" : "text-brand-600"}`}
                    >
                      Dekhein
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(orders ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">Koi order nahi hai abhi.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}