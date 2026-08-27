import { createClient } from "@/lib/supabase/server";
import { getCurrentSeller } from "@/lib/current-seller";
import { PageHeader } from "@/components/ui/layout-primitives";
import { NewReturnForm } from "./new-return-form";

export const dynamic = "force-dynamic";

export default async function NewReturnPage() {
  const seller = await getCurrentSeller();
  if (!seller || seller.kind !== "branch") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">Ye account kisi branch se linked nahi hai. Admin se rabta karein.</p>
      </div>
    );
  }

  const supabase = createClient();

  // Shop sirf wahi maal wapas kar sakti hai jo us ke apne godown mein
  // maujood hai — is liye list us ke apne stock se banti hai.
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id")
    .eq("branch_id", seller.id)
    .eq("code", "MAIN")
    .maybeSingle();

  let products: { id: string; name: string; pack_size: string | null; price: number; stock: number }[] = [];
  if (warehouse) {
    const { data: rows } = await supabase
      .from("inventory")
      .select("quantity_on_hand, products(id, name, pack_size, selling_price)")
      .eq("warehouse_id", warehouse.id)
      .gt("quantity_on_hand", 0);

    products = (rows ?? [])
      .map((r: any) => {
        const p = Array.isArray(r.products) ? r.products[0] : r.products;
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          pack_size: p.pack_size,
          price: Number(p.selling_price ?? 0),
          stock: Number(r.quantity_on_hand),
        };
      })
      .filter(Boolean) as typeof products;
    products.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Is shop ke mukammal order, taake return kisi asal order se joda ja sake.
  const { data: orders } = await supabase
    .from("agri_orders")
    .select("id, order_number, created_at")
    .eq("order_to_branch_id", seller.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader title="Naya Return" description={`${seller.name} — maal HQ ko wapas bhejein`} />
      <NewReturnForm products={products} orders={orders ?? []} warehouseMissing={!warehouse} />
    </div>
  );
}
