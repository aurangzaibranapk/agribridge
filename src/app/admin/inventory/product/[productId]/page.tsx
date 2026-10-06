import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
import { UnbatchedFixer } from "./unbatched-fixer";

export const dynamic = "force-dynamic";

export default async function ProductCardPage({ params }: { params: { productId: string } }) {
  const supabase = createClient();
  const [{ data: product }, { data: cards }, { data: unbatched }] = await Promise.all([
    supabase.from("products").select("id, name, pack_size, purchase_price, selling_price").eq("id", params.productId).maybeSingle(),
    supabase.from("v_warehouse_product_card").select("*").eq("product_id", params.productId).order("warehouse_name"),
    supabase.from("inventory").select("id, quantity_on_hand, warehouses(name)").eq("product_id", params.productId).is("batch_id", null).gt("quantity_on_hand", 0),
  ]);
  if (!product) notFound();

  const onHand = (cards ?? []).reduce((sum, row) => sum + Number(row.on_hand ?? 0), 0);
  const reserved = (cards ?? []).reduce((sum, row) => sum + Number(row.reserved ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${product.name}${product.pack_size ? ` (${product.pack_size})` : ""}`}
        description="Product ka stock har godam mein"
        actions={<div className="flex flex-wrap gap-3">
          <Link href={`/admin/inventory/product/${product.id}/statement`} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"><FileText className="h-4 w-4" /> Product Statement</Link>
          <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
        </div>}
      />
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Para hua", value: onHand },
          { label: "Reserved", value: reserved },
          { label: "Available", value: onHand - reserved },
        ].map((item) => <Card key={item.label} className="p-4"><p className="text-xs text-surface-500">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p></Card>)}
      </div>
      {(unbatched ?? []).length > 0 && <UnbatchedFixer
        productId={product.id}
        productName={product.name}
        unbatchedRows={(unbatched ?? []).map((row) => ({
          warehouseName: (Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses)?.name ?? "—",
          quantityOnHand: Number(row.quantity_on_hand ?? 0),
        }))}
        saleRate={product.selling_price == null ? null : Number(product.selling_price)}
        purchaseRate={product.purchase_price == null ? null : Number(product.purchase_price)}
      />}
      {(cards ?? []).length === 0 ? <Card><p className="text-sm text-surface-500">Is product ka stock abhi darj nahi.</p></Card> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(cards ?? []).map((row) => <Card key={row.warehouse_id} className="p-4">
            <p className="font-medium">{row.warehouse_name ?? "Godam"}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-xs text-surface-500">Para hua</p><p className="font-semibold">{Number(row.on_hand ?? 0)}</p></div>
              <div><p className="text-xs text-surface-500">Reserved</p><p className="font-semibold">{Number(row.reserved ?? 0)}</p></div>
              <div><p className="text-xs text-surface-500">Available</p><p className="font-semibold">{Number(row.available ?? 0)}</p></div>
            </div>
          </Card>)}
        </div>
      )}
    </div>
  );
}
