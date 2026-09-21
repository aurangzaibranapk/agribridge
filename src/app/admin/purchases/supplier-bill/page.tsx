import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupplierBillClient } from "./supplier-bill-client";
import { loadUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function SupplierPurchaseBillPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) redirect("/login");
  if (!["owner", "admin", "super_admin"].includes(profile.role)) redirect("/admin/purchases");

  const [suppliersResult, productsResult, categoriesResult, warehousesResult, accountsResult, units] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name").limit(1000),
    supabase.from("products").select("id, name, category_id, pack_size, unit, purchase_price, selling_price, trade_rate_pending").eq("is_deleted", false).order("name").limit(3000),
    supabase.from("categories").select("id, name, parent_category_id, category_kind").order("name"),
    supabase.from("warehouses").select("id, name, branch_id, shop_id, branches(name), shops(name)").eq("is_active", true).order("name"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type").order("name"),
    loadUnits(true),
  ]);

  const warehouses = (warehousesResult.data ?? []).map((warehouse: any) => ({
    id: warehouse.id as string,
    name: warehouse.name as string,
    branchId: warehouse.branch_id as string,
    shopName: (Array.isArray(warehouse.shops) ? warehouse.shops[0]?.name : warehouse.shops?.name) as string | null,
    branchName: (Array.isArray(warehouse.branches) ? warehouse.branches[0]?.name : warehouse.branches?.name) as string | null,
  }));

  return <SupplierBillClient
    suppliers={suppliersResult.data ?? []}
    products={(productsResult.data ?? []).map((product) => ({ ...product, purchase_price: Number(product.purchase_price), selling_price: Number(product.selling_price) }))}
    categories={categoriesResult.data ?? []}
    warehouses={warehouses}
    accounts={(accountsResult.data ?? []).map((account) => ({ ...account, account_type: String(account.account_type) }))}
    units={units.map((unit) => ({ code: unit.code, label: unit.label }))}
  />;
}
