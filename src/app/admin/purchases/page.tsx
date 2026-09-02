import { createClient } from "@/lib/supabase/server";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { PurchaseForm } from "@/app/admin/purchases/purchase-form";
import { ReceiveButton } from "@/app/admin/purchases/receive-button";
import { DeletePurchaseButton } from "@/app/admin/purchases/delete-purchase-button";
export const dynamic = "force-dynamic";

/** Halat database mein angrezi mein rehti hai; screen ka lafz yahan se. */
const PURCHASE_STATUS: Record<string, TranslationKey> = {
  pending: "pu_s_pending",
  received: "pu_s_received",
  cancelled: "pu_s_cancelled",
};
export default async function AdminPurchasesPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id, branches(name)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const isAdminLevel = profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "owner";
  const staffBranchRel: any = (profile as any)?.branches;
  const staffBranchName = Array.isArray(staffBranchRel) ? staffBranchRel[0]?.name : staffBranchRel?.name;

  const [{ data: purchases }, { data: suppliers }, { data: products }, { data: branches }] = await Promise.all([
    supabase
      .from("purchases")
      .select(
        "id, purchase_number, purchase_date, status, total_amount, invoice_total, suppliers(name), branches(name), purchase_items(id, quantity, unit_cost, products(name, pack_size))"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("products")
      .select("id, name, pack_size, purchase_price")
      .eq("is_deleted", false)
      .order("name"),
    isAdminLevel
      ? supabase.from("branches").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const normalizedPurchases = (purchases ?? []).map((p: any) => ({
    id: p.id,
    purchase_number: p.purchase_number,
    purchase_date: p.purchase_date,
    status: p.status,
    total_amount: p.total_amount,
    invoice_total: p.invoice_total as number | null,
    // Ginti ke liye lines (256) -- sirf pending par kaam aati hain.
    items: ((p.purchase_items ?? []) as any[]).map((i) => {
      const rel = Array.isArray(i.products) ? i.products[0] : i.products;
      return {
        id: i.id as string,
        name: (rel?.name as string) ?? "Product",
        pack_size: (rel?.pack_size as string | null) ?? null,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
      };
    }),
    supplier_name: Array.isArray(p.suppliers) ? p.suppliers[0]?.name : p.suppliers?.name,
    branch_name: Array.isArray(p.branches) ? p.branches[0]?.name : p.branches?.name,
  }));

  function statusTone(status: string) {
    if (status === "received") return "green" as const;
    if (status === "pending") return "amber" as const;
    if (status === "cancelled") return "red" as const;
    return "gray" as const;
  }

  return (
    <div>
      <PageHeader title={t("pu_title", lang)} description={t("pu_subtitle", lang)} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {normalizedPurchases.length === 0 ? (
            <EmptyState title={t("pu_empty", lang)} />
          ) : (
            <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_po_no", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_supplier", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_branch", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_date", lang)}</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">{t("pu_amount", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_status", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_action", lang)}</th>
                    {isAdminLevel && <th className="px-4 py-3 font-medium text-surface-500">{t("pu_delete", lang)}</th>}
                  </tr>
                </thead>
                <tbody>
                  {normalizedPurchases.map((p) => (
                    <tr key={p.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{p.purchase_number}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{p.supplier_name ?? "-"}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{p.branch_name ?? "-"}</td>
                      <td className="px-4 py-3 text-surface-500">{p.purchase_date}</td>
                      <td className="px-4 py-3 text-right font-semibold text-surface-800 dark:text-surface-200">
                        Rs {Number(p.total_amount).toLocaleString()}
                        {p.invoice_total != null && Number(p.invoice_total) !== Number(p.total_amount) && (
                          <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-400">
                            {t("grn_discrepancy", lang)}: Rs {Number(p.invoice_total).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(p.status)}>{t(PURCHASE_STATUS[p.status] ?? "pu_status", lang)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "pending" && (
                          <ReceiveButton purchaseId={p.id} purchaseNumber={p.purchase_number} items={p.items} />
                        )}
                      </td>
                      {isAdminLevel && (
                        <td className="px-4 py-3">
                          <DeletePurchaseButton purchaseId={p.id} purchaseNumber={p.purchase_number} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <PurchaseForm
          suppliers={suppliers ?? []}
          products={products ?? []}
          isAdminLevel={isAdminLevel}
          branches={branches ?? []}
          staffBranchName={staffBranchName ?? null}
        />
      </div>
    </div>
  );
}