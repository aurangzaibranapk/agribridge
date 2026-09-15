import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";
import { DuplicatesClient } from "./duplicates-client";
import { MergeRequestsClient } from "./merge-requests-client";

export const dynamic = "force-dynamic";

/**
 * Duplicate naam wale products -- review, naam theek karna, ya hataana.
 *
 * Malik (13 September): ek hi cheez 4/4 dafa add ho gayi hai, us ka
 * draft chahiye taake naam set kar sakein ya duplicate khatam kar sakein.
 */
export default async function DuplicateProductsPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));

  if (!sabKuchWala) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600 dark:text-surface-400">Ye safha sirf admin/owner ke liye hai.</p>
      </div>
    );
  }

  const [{ data: products }, { data: inventoryRows }, { data: mergeRequests }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, pack_size, purchase_price, selling_price, sale_rate_pending, trade_rate_pending, categories(name)")
      .eq("is_deleted", false)
      .order("name"),
    supabase.from("inventory").select("product_id, quantity_on_hand, warehouses(name)"),
    supabase
      .from("product_merge_requests")
      .select(
        "id, created_at, source_stock_snapshot, source:products!product_merge_requests_source_product_id_fkey(name), target:products!product_merge_requests_target_product_id_fkey(name), profiles(full_name)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const pendingMerges = (mergeRequests ?? []).map((r: any) => {
    const source = Array.isArray(r.source) ? r.source[0] : r.source;
    const target = Array.isArray(r.target) ? r.target[0] : r.target;
    const proposer = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const snapshot = (r.source_stock_snapshot ?? []) as { warehouseName: string; qty: number }[];
    return {
      id: r.id,
      created_at: r.created_at,
      source_name: source?.name ?? "—",
      target_name: target?.name ?? "—",
      proposer_name: proposer?.full_name ?? "—",
      total_qty: snapshot.reduce((s, row) => s + Number(row.qty ?? 0), 0),
      rows: snapshot,
    };
  });

  const stockByProduct = new Map<string, { warehouseName: string; qty: number }[]>();
  for (const row of (inventoryRows ?? []) as any[]) {
    const qty = Number(row.quantity_on_hand);
    if (qty <= 0) continue;
    const warehouseName = Array.isArray(row.warehouses) ? row.warehouses[0]?.name : row.warehouses?.name;
    const list = stockByProduct.get(row.product_id) ?? [];
    list.push({ warehouseName: warehouseName ?? "—", qty });
    stockByProduct.set(row.product_id, list);
  }

  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      pack_size: string | null;
      category_name: string | null;
      purchase_price: number;
      selling_price: number;
      sale_rate_pending: boolean;
      trade_rate_pending: boolean;
      stock: { warehouseName: string; qty: number }[];
    }[]
  >();
  for (const p of (products ?? []) as any[]) {
    const nameNorm = String(p.name ?? "").trim().toLowerCase();
    if (!nameNorm) continue;
    // Pack size bhi shamil -- warna alag pack size wale legitimate
    // products (500g vs 1kg) "duplicate" lagte hain, jab ke wo alag
    // SKU hain (malik, 14 September: "ek naam ki 4 packing duplicate
    // nahi ginti"). Isi galat grouping ki wajah se 15 September ko
    // Surf Excel Powder, Supreme Black Tea Leaf, White Chanay Motay
    // aur Sunsilk Shampoo ke dono pack sahi hote huye bhi "duplicate"
    // dikhe aur ghalti se hata diye gaye the.
    const packNorm = String(p.pack_size ?? "").trim().toLowerCase();
    const norm = `${nameNorm}|${packNorm}`;
    const list = groups.get(norm) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      pack_size: p.pack_size,
      category_name: Array.isArray(p.categories) ? p.categories[0]?.name ?? null : p.categories?.name ?? null,
      purchase_price: Number(p.purchase_price),
      selling_price: Number(p.selling_price),
      sale_rate_pending: Boolean(p.sale_rate_pending),
      trade_rate_pending: Boolean(p.trade_rate_pending),
      stock: stockByProduct.get(p.id) ?? [],
    });
    groups.set(norm, list);
  }

  const duplicateGroups = Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([norm, items]) => ({ norm, items }))
    .sort((a, b) => b.items.length - a.items.length);

  const totalDuplicateProducts = duplicateGroups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div>
      <PageHeader
        title="Duplicate Products"
        description={`${duplicateGroups.length} naam aise hain jin par ek se zyada product ban chuka hai (kul ${totalDuplicateProducts} products) — naam theek karein ya jo istemal mein nahi wo hata dein.`}
      />
      <ProductSetupTabs current="duplicates" lang={lang} />
      <MergeRequestsClient requests={pendingMerges} allProductNames={(products ?? []).map((p: any) => p.name)} />
      <DuplicatesClient groups={duplicateGroups} allProductNames={(products ?? []).map((p: any) => p.name)} />
    </div>
  );
}
