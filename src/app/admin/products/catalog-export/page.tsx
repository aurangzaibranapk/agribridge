import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { CatalogExportClient } from "./catalog-export-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";
import { categoriesForShop } from "@/lib/products/shop-kinds";

export const dynamic = "force-dynamic";

/** Har dukan-qism ke jaR (shop-kinds.ts): "Karyana" ka matlab sirf ye 3
 * root categories nahi -- unki har aulaad bhi (Grocery ke neeche 15+
 * upar-categories). Yehi hisaab POS/ordering filter mein bhi lagta hai
 * -- yahan dobara likhne ki zaroorat nahi. */
const SHOP_GROUPS: { key: string; label: string }[] = [
  { key: "karyana", label: "Karyana" },
  { key: "fertilizer", label: "Fertilizer" },
  { key: "pesticide", label: "Pesticide" },
  { key: "seeds", label: "Seeds" },
  { key: "animal_feed", label: "Animal Feed" },
];

export default async function CatalogExportPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  // Pehle har jawab ka `error` chhor diya jata tha aur khali jawab par
  // stock/bikri SIFAR likh di jati thi -- export mein "0 stock" jhoot hota
  // tha. Ab koi bhi qatar na aa sake to safha saaf bata deta hai. Bari
  // tables (inventory, pos_sale_items) 1,000 ki hadd se aage paging se aati hain.
  async function fetchAll<T>(build: (from: number, to: number) => any): Promise<{ data: T[]; error: string | null }> {
    const all: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build(from, from + 999);
      if (error) return { data: all, error: error.message as string };
      all.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) break;
    }
    return { data: all, error: null };
  }

  const [productsRes, categoriesRes, inventoryRes, warehousesRes, shopsRes, saleItemsRes, companiesRes] = await Promise.all([
    fetchAll<any>((from, to) =>
      supabase
        .from("products")
        .select("id, name, category_id, company_id, pack_size, purchase_price, selling_price, wholesale_price, mrp_price, unit, barcode, product_code, manufacture_date, expiry_date, categories(name), companies(name)")
        .eq("is_deleted", false)
        .order("name")
        .range(from, to)
    ),
    fetchAll<any>((from, to) => supabase.from("categories").select("id, name, parent_category_id").order("id").range(from, to)),
    fetchAll<any>((from, to) => supabase.from("inventory").select("product_id, quantity_on_hand, warehouse_id").order("id").range(from, to)),
    supabase.from("warehouses").select("id, name, shop_id").eq("is_active", true).order("name"),
    supabase.from("shops").select("id, name").eq("is_active", true).order("name"),
    fetchAll<any>((from, to) => supabase.from("pos_sale_items").select("product_id, quantity, subtotal").order("id").range(from, to)),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  const loadErrors = [
    productsRes.error && `Products: ${productsRes.error}`,
    categoriesRes.error && `Categories: ${categoriesRes.error}`,
    inventoryRes.error && `Stock: ${inventoryRes.error}`,
    warehousesRes.error && `Godam: ${warehousesRes.error.message}`,
    shopsRes.error && `Shops: ${shopsRes.error.message}`,
    saleItemsRes.error && `Bikri: ${saleItemsRes.error}`,
    companiesRes.error && `Companies: ${companiesRes.error.message}`,
  ].filter(Boolean) as string[];
  if (loadErrors.length > 0) {
    return (
      <div>
        <PageHeader title={t("pd_catalog_export", lang)} description="Category select karein, fields choose karein, Print/Download/WhatsApp/Email karein" />
        <ProductSetupTabs current="export" lang={lang} />
        <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Data poora nahi aa saka -- export abhi na karein (adad ghalat honge).</p>
          <ul className="mt-2 list-disc pl-5">{loadErrors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      </div>
    );
  }

  const rawProducts = productsRes.data;
  const allCategories = categoriesRes.data;
  const inventoryRows = inventoryRes.data;
  const warehouses = warehousesRes.data;
  const shops = shopsRes.data;
  const saleItems = saleItemsRes.data;
  const companiesRaw = companiesRes.data;

  const categories = (allCategories ?? []).map((c: any) => ({ id: c.id, name: c.name }));
  const catNodes = (allCategories ?? []).map((c: any) => ({ id: c.id, name: c.name, parent_category_id: c.parent_category_id as string | null }));

  // Karyana/Agri Inputs/Dairy = category ID ka set (jaR + saari aulaad).
  const groupCategoryIds = new Map(SHOP_GROUPS.map((g) => [g.key, categoriesForShop(g.key, catNodes)]));

  const salesByProduct = new Map<string, { qty: number; amount: number }>();
  for (const item of (saleItems ?? [])) {
    const pid = item.product_id as string;
    const cur = salesByProduct.get(pid) ?? { qty: 0, amount: 0 };
    salesByProduct.set(pid, { qty: cur.qty + Number(item.quantity ?? 0), amount: cur.amount + Number(item.subtotal ?? 0) });
  }

  const stockByProduct = new Map<string, number>();
  const warehousesByProduct = new Map<string, string[]>();
  for (const row of inventoryRows ?? []) {
    const pid = row.product_id as string;
    const wid = (row as any).warehouse_id as string | null;
    stockByProduct.set(pid, (stockByProduct.get(pid) ?? 0) + Number(row.quantity_on_hand ?? 0));
    if (wid && Number(row.quantity_on_hand) > 0) {
      const arr = warehousesByProduct.get(pid) ?? [];
      if (!arr.includes(wid)) arr.push(wid);
      warehousesByProduct.set(pid, arr);
    }
  }

  const products = (rawProducts ?? []).map((p: any) => {
    const categoryId = p.category_id as string | null;
    const shopGroups = SHOP_GROUPS.filter((g) => categoryId && groupCategoryIds.get(g.key)?.has(categoryId)).map((g) => g.key);
    return {
      id: p.id,
      name: p.name,
      category_id: categoryId,
      company_id: p.company_id as string | null,
      category: Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name,
      shopGroups,
      brand: Array.isArray(p.companies) ? p.companies[0]?.name : p.companies?.name,
      pack_size: p.pack_size,
      purchase_price: p.purchase_price ? Number(p.purchase_price) : null,
      selling_price: p.selling_price ? Number(p.selling_price) : null,
      wholesale_price: p.wholesale_price ? Number(p.wholesale_price) : null,
      mrp_price: p.mrp_price ? Number(p.mrp_price) : null,
      unit: p.unit,
      barcode: p.barcode,
      product_code: (p.product_code as string | null) ?? null,
      manufacture_date: p.manufacture_date,
      expiry_date: p.expiry_date,
      stock_qty: stockByProduct.get(p.id) ?? 0,
      stock_value_purchase: p.purchase_price != null ? Number(p.purchase_price) * (stockByProduct.get(p.id) ?? 0) : null,
      stock_value_selling: p.selling_price != null ? Number(p.selling_price) * (stockByProduct.get(p.id) ?? 0) : null,
      stock_value_wholesale: p.wholesale_price != null ? Number(p.wholesale_price) * (stockByProduct.get(p.id) ?? 0) : null,
      warehouse_ids: warehousesByProduct.get(p.id) ?? [],
      qty_sold: salesByProduct.get(p.id)?.qty ?? 0,
      sales_amount: salesByProduct.get(p.id)?.amount ?? 0,
    };
  });

  const warehouseList = (warehouses ?? []).map((w: any) => ({ id: w.id, name: w.name, shop_id: w.shop_id as string | null }));
  const shopList = (shops ?? []).map((s: any) => ({ id: s.id, name: s.name }));
  const companiesList = (companiesRaw ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string }));

  return (
    <div>
      <PageHeader title={t("pd_catalog_export", lang)} description="Category select karein, fields choose karein, Print/Download/WhatsApp/Email karein" />
      <ProductSetupTabs current="export" lang={lang} />
      <CatalogExportClient products={products} categories={categories} companies={companiesList} shopGroups={SHOP_GROUPS} warehouses={warehouseList} shops={shopList} />
    </div>
  );
}