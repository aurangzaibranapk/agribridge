import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { TransferActions } from "@/app/admin/stock-transfers/transfer-actions";
import { TransferWorkflowActions } from "@/app/admin/stock-transfers/transfer-workflow-actions";
import { RequestTransferForm } from "@/app/admin/stock-transfers/request-transfer-form";

export const dynamic = "force-dynamic";

/**
 * Halat database mein angrezi mein rehti hai (wo data hai). Screen par
 * us ka lafz yahan se aata hai -- warna manager ko "payment_verified"
 * likha nazar aata tha.
 */
const TRANSFER_STATUS: Record<string, TranslationKey> = {
  pending: "st_s_pending",
  approved: "st_s_approved",
  payment_verified: "st_s_payment_verified",
  in_transit: "st_s_in_transit",
  completed: "st_s_completed",
  discrepancy: "st_s_discrepancy",
  cancelled: "st_s_cancelled",
};

export default async function AdminStockTransfersPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const role = profile?.role ?? "";
  const isAdminLevel = role === "super_admin" || role === "admin";
  const canRequest = isAdminLevel || role === "manager" || role === "sales_staff";

  const [{ data: rawTransfers }, { data: rawProducts }, { data: rawShops }, { data: financeAccounts }, { data: centralBranch }] = await Promise.all([
    supabase
      .from("stock_transfers")
      .select(
        `id, transfer_number, quantity, confirmed_quantity, unit_price, total_amount, status, notes, discrepancy_notes, discrepancy_resolved_at, created_at,
         products(name),
         from_wh:from_warehouse_id(name, shop_id, branches(name)),
         to_wh:to_warehouse_id(name, branch_id, shop_id, branches(name))`
      )
      .order("created_at", { ascending: false })
      .limit(100),
    canRequest
      ? supabase.from("products").select("id, name, pack_size, selling_price, purchase_price, image_url, category_id, categories(name), companies(name)").eq("is_deleted", false).order("name")
      : Promise.resolve({ data: [] as any[] }),
    canRequest
      ? supabase.from("shops").select("id, name, business_type, branches(name), warehouses(id)").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as any[] }),
    canRequest
      ? supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type")
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("branches").select("id").eq("is_distribution_center", true).maybeSingle(),
  ]);

  let centralWarehouseId: string | null = null;
  if (centralBranch) {
    const { data: cw } = await supabase.from("warehouses").select("id").eq("branch_id", centralBranch.id).eq("code", "MAIN").maybeSingle();
    centralWarehouseId = cw?.id ?? null;
  }

  const shopOptions = (rawShops ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    business_type: s.business_type,
    branch_name: Array.isArray(s.branches) ? s.branches[0]?.name : s.branches?.name,
    warehouse_id: Array.isArray(s.warehouses) ? s.warehouses[0]?.id ?? null : s.warehouses?.id ?? null,
  }));

  const allWarehouseIds = [...shopOptions.map((s) => s.warehouse_id).filter(Boolean), centralWarehouseId].filter(Boolean) as string[];
  const { data: inventoryRows } = canRequest && allWarehouseIds.length > 0
    ? await supabase.from("inventory").select("warehouse_id, product_id, quantity_on_hand").in("warehouse_id", allWarehouseIds)
    : { data: [] as any[] };

  const stockByWarehouse: Record<string, Record<string, number>> = {};
  (inventoryRows ?? []).forEach((r: any) => {
    if (!stockByWarehouse[r.warehouse_id]) stockByWarehouse[r.warehouse_id] = {};
    stockByWarehouse[r.warehouse_id][r.product_id] = Number(r.quantity_on_hand);
  });

  const products = (rawProducts ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    pack_size: p.pack_size,
    selling_price: Number(p.selling_price ?? 0),
    purchase_price: p.purchase_price ? Number(p.purchase_price) : 0,
    image_url: p.image_url,
    category_id: p.category_id,
    category: Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name,
    brand: Array.isArray(p.companies) ? p.companies[0]?.name : p.companies?.name,
  }));

  const categories = Array.from(
    new Map(products.filter((p) => p.category_id).map((p) => [p.category_id, { id: p.category_id as string, name: p.category ?? "Other" }])).values()
  );

  const transfers = (rawTransfers ?? []).map((t: any) => {
    const fromWh = Array.isArray(t.from_wh) ? t.from_wh[0] : t.from_wh;
    const toWh = Array.isArray(t.to_wh) ? t.to_wh[0] : t.to_wh;
    const toBranch = toWh ? (Array.isArray(toWh.branches) ? toWh.branches[0] : toWh.branches) : null;
    const fromBranch = fromWh ? (Array.isArray(fromWh.branches) ? fromWh.branches[0] : fromWh.branches) : null;
    const product = Array.isArray(t.products) ? t.products[0] : t.products;
    return {
      id: t.id,
      transfer_number: t.transfer_number,
      quantity: t.quantity,
      confirmed_quantity: t.confirmed_quantity,
      unit_price: t.unit_price,
      total_amount: t.total_amount,
      status: t.status,
      notes: t.notes,
      discrepancy_notes: t.discrepancy_notes,
      discrepancy_resolved_at: t.discrepancy_resolved_at,
      created_at: t.created_at,
      product_name: product?.name,
      from_warehouse: fromWh?.name,
      from_branch_name: fromBranch?.name ?? null,
      to_warehouse: toWh?.name,
      to_branch_id: toWh?.branch_id ?? null,
      to_branch_name: toBranch?.name ?? null,
      is_shop_to_shop: !!fromWh?.shop_id && !!toWh?.shop_id,
    };
  });

  function statusTone(status: string) {
    if (status === "completed") return "green" as const;
    if (status === "discrepancy") return "red" as const;
    if (status === "cancelled") return "gray" as const;
    return "amber" as const;
  }

  return (
    <div>
      <PageHeader title={t("st_title", lang)} description={t("st_subtitle", lang)} />
      {/* Tajweez wala safha (280): 30 din ki bikri se kya kam paR raha hai. */}
      <Link
        href="/admin/stock-transfers/suggested"
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200"
      >
        {t("sr_title", lang)} →
      </Link>

      {canRequest && (
        <div className="mt-4">
          <RequestTransferForm
            products={products}
            categories={categories}
            isAdminLevel={isAdminLevel}
            shops={shopOptions}
            currentShopId={profile?.shop_id ?? null}
            centralWarehouseId={centralWarehouseId}
            stockByWarehouse={stockByWarehouse}
          />
        </div>
      )}

      <div className="mt-6">
        {transfers.length === 0 ? (
          <EmptyState title={t("st_empty", lang)} />
        ) : (
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-4 py-3 font-medium text-surface-500">{t("st_product", lang)}</th>
                  <th className="px-4 py-3 font-medium text-surface-500">{t("st_from", lang)}</th>
                  <th className="px-4 py-3 font-medium text-surface-500">{t("st_to", lang)}</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">{t("st_qty", lang)}</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">{t("st_amount", lang)}</th>
                  <th className="px-4 py-3 font-medium text-surface-500">{t("st_status", lang)}</th>
                  <th className="px-4 py-3 font-medium text-surface-500">{t("st_action", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((row) => (
                  <tr key={row.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{row.product_name}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">
                      {row.from_warehouse}{row.from_branch_name ? ` (${row.from_branch_name})` : ""}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">
                      {row.to_warehouse}{row.to_branch_name ? ` (${row.to_branch_name})` : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">
                      {row.quantity}
                      {row.confirmed_quantity != null && Number(row.confirmed_quantity) !== Number(row.quantity) ? ` (${t("st_received", lang)}: ${row.confirmed_quantity})` : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">
                      {row.total_amount != null ? `Rs. ${Number(row.total_amount).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(row.status)}>{t(TRANSFER_STATUS[row.status] ?? "st_status", lang)}</Badge>
                      {row.status === "discrepancy" && row.discrepancy_notes && (
                        <p className="mt-1 text-[10px] text-surface-400">{row.discrepancy_notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.unit_price != null ? (
                        <TransferWorkflowActions
                          transferId={row.id}
                          status={row.status}
                          discrepancyResolvedAt={row.discrepancy_resolved_at}
                          currentUserRole={role}
                          currentUserBranchId={profile?.branch_id ?? null}
                          toBranchId={row.to_branch_id}
                          isShopToShop={row.is_shop_to_shop}
                          financeAccounts={financeAccounts ?? []}
                        />
                      ) : (
                        row.status === "pending" && <TransferActions transferId={row.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}