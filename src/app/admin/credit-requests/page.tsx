import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { CreditRequestActions } from "@/app/admin/credit-requests/credit-request-actions";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminCreditRequestsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rawRequests } = await supabase
    .from("credit_requests")
    .select("id, category, quantity, mrp_rate, base_amount, margin_percentage, total_amount, status, created_at, farmers(full_name, farmer_code), products(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const requests = (rawRequests ?? []).map((r: any) => ({
    id: r.id,
    category: r.category,
    quantity: Number(r.quantity),
    baseAmount: Number(r.base_amount),
    marginPercentage: Number(r.margin_percentage),
    totalAmount: Number(r.total_amount),
    status: r.status,
    farmerName: Array.isArray(r.farmers) ? r.farmers[0]?.full_name : r.farmers?.full_name,
    farmerCode: Array.isArray(r.farmers) ? r.farmers[0]?.farmer_code : r.farmers?.farmer_code,
    productName: Array.isArray(r.products) ? r.products[0]?.name : r.products?.name,
  }));

  function statusTone(status: string) {
    if (status === "farmer_accepted") return "green" as const;
    if (status === "pending") return "amber" as const;
    if (status === "admin_approved") return "blue" as const;
    return "red" as const;
  }

  return (
    <div>
      <PageHeader title={t("crq_title", lang)} description="Seed/Fertilizer/Pesticide credit requests from farmers, priced at MRP" />
      {requests.length === 0 ? (
        <EmptyState title={t("crq_none_yet", lang)} />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_farmer", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_category", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_product", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_qty", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("crq_base", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_total", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_status", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_action", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{r.farmerName} ({r.farmerCode})</td>
                  <td className="px-4 py-3 capitalize text-surface-600 dark:text-surface-400">{r.category}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{r.productName}</td>
                  <td className="px-4 py-3 text-right text-surface-600 dark:text-surface-400">{r.quantity}</td>
                  <td className="px-4 py-3 text-right text-surface-600 dark:text-surface-400">Rs {r.baseAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-surface-800 dark:text-surface-200">Rs {r.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(r.status)}>{r.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" && (
                      <CreditRequestActions requestId={r.id} baseAmount={r.baseAmount} defaultMargin={r.marginPercentage} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}