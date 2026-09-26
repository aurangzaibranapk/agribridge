import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  const service = createServiceClient();

  const [suppliersResult, productsResult, categoriesResult, companiesResult, warehousesResult, accountsResult, units] = await Promise.all([
    service.from("suppliers").select("id, name, company_name, phone_number").eq("is_active", true).order("name").limit(1000),
    service.from("products").select("id, name, company_id, category_id, pack_size, units_per_pack, unit, purchase_price, selling_price, wholesale_price, mrp_price, trade_rate_pending, product_code").eq("is_deleted", false).order("name").limit(3000),
    service.from("categories").select("id, name, parent_category_id, category_kind").order("name"),
    service.from("companies").select("id, name").order("name"),
    service.from("warehouses").select("id, name, branch_id, shop_id, branches(name), shops(name)").eq("is_active", true).order("name"),
    service.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type").order("name"),
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
    suppliers={(suppliersResult.data ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      companyName: (s.company_name as string | null) ?? null,
      phone: (s.phone_number as string | null) ?? null,
    }))}
    products={(productsResult.data ?? []).map((product: any) => ({
      ...product,
      purchase_price: Number(product.purchase_price),
      selling_price: Number(product.selling_price),
      wholesale_price: product.wholesale_price == null ? null : Number(product.wholesale_price),
      mrp_price: product.mrp_price == null ? null : Number(product.mrp_price),
      product_code: (product.product_code as string | null) ?? null,
    }))}
    categories={categoriesResult.data ?? []}
    companies={companiesResult.data ?? []}
    warehouses={warehouses}
    accounts={(accountsResult.data ?? []).map((account) => ({ ...account, account_type: String(account.account_type) }))}
    units={units.map((unit) => ({ code: unit.code, label: unit.label }))}
  />;
}
