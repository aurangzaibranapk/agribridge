import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { PurchaseForm } from "@/app/admin/purchases/purchase-form";
import { ReceiveButton } from "@/app/admin/purchases/receive-button";
import { DeletePurchaseButton } from "@/app/admin/purchases/delete-purchase-button";
export const dynamic = "force-dynamic";
export default async function AdminPurchasesPage() {
  const supabase = createClient();

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
      .select("id, purchase_number, purchase_date, status, total_amount, suppliers(name), branches(name)")
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
      <PageHeader title="Purchases" description="Purchase orders from suppliers, and receiving stock" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {normalizedPurchases.length === 0 ? (
            <EmptyState title="No purchase orders yet" />
          ) : (
            <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-4 py-3 font-medium text-surface-500">PO #</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Supplier</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Branch</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">Amount</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Status</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Action</th>
                    {isAdminLevel && <th className="px-4 py-3 font-medium text-surface-500">Delete</th>}
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
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "pending" && <ReceiveButton purchaseId={p.id} />}
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