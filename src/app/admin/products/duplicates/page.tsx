import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
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
      .select("id, name, pack_size, purchase_price, selling_price, categories(name)")
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
    { id: string; name: string; pack_size: string | null; category_name: string | null; purchase_price: number; selling_price: number; stock: { warehouseName: string; qty: number }[] }[]
  >();
  for (const p of (products ?? []) as any[]) {
    const norm = String(p.name ?? "").trim().toLowerCase();
    if (!norm) continue;
    const list = groups.get(norm) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      pack_size: p.pack_size,
      category_name: Array.isArray(p.categories) ? p.categories[0]?.name ?? null : p.categories?.name ?? null,
      purchase_price: Number(p.purchase_price),
      selling_price: Number(p.selling_price),
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
      <MergeRequestsClient requests={pendingMerges} allProductNames={(products ?? []).map((p: any) => p.name)} />
      <DuplicatesClient groups={duplicateGroups} allProductNames={(products ?? []).map((p: any) => p.name)} />
    </div>
  );
}
