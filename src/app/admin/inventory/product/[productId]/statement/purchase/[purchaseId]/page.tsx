import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

export default async function ProductPurchaseStatement({ params }: { params: { productId: string; purchaseId: string } }) {
  const supabase = createClient();
  const [{ data: product }, { data: purchase }, { data: items }] = await Promise.all([
    supabase.from("products").select("id, name, pack_size").eq("id", params.productId).maybeSingle(),
    supabase.from("purchases").select("id, purchase_number, supplier_bill_no, supplier_id, purchase_date, total_amount, invoice_total, discount_amount, tax_amount, status, review_status, notes, suppliers(name), warehouses(name)").eq("id", params.purchaseId).maybeSingle(),
    supabase.from("purchase_items").select("id, product_id, quantity, received_qty, damaged_qty, short_qty, unit_cost, line_total, grn_note, products(name, pack_size)").eq("purchase_id", params.purchaseId).order("id"),
  ]);
  if (!product || !purchase) notFound();

  const itemRows = (items ?? []).filter((item: any) => item.product_id === params.productId);
  const supplier = Array.isArray((purchase as any).suppliers) ? (purchase as any).suppliers[0] : (purchase as any).suppliers;
  const warehouse = Array.isArray((purchase as any).warehouses) ? (purchase as any).warehouses[0] : (purchase as any).warehouses;
  const selectedQty = itemRows.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);
  const selectedReceived = itemRows.reduce((sum: number, item: any) => sum + Number(item.received_qty ?? 0), 0);
  const selectedAmount = itemRows.reduce((sum: number, item: any) => sum + Number(item.line_total ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title={`${product.name} — Purchase Bill`} description="Supplier, bill, received quantity aur amount ka separate record" actions={<Link href={`/admin/inventory/product/${product.id}/statement`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Product statement</Link>} />
      <Card className="grid gap-3 md:grid-cols-4">
        <Info label="Supplier" value={supplier?.name ?? "Supplier not linked"} />
        <Info label="PO number" value={(purchase as any).purchase_number ?? "—"} />
        <Info label="Supplier bill" value={(purchase as any).supplier_bill_no ?? "—"} />
        <Info label="Purchase date" value={(purchase as any).purchase_date ?? "—"} />
        <Info label="Warehouse" value={warehouse?.name ?? "—"} />
        <Info label="Status" value={`${(purchase as any).status ?? "—"}${(purchase as any).review_status ? ` · ${(purchase as any).review_status}` : ""}`} />
        <Info label="PO / Invoice total" value={Number((purchase as any).invoice_total ?? (purchase as any).total_amount ?? 0).toLocaleString()} />
        <Info label="This product total" value={selectedAmount.toLocaleString()} />
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Ordered" value={selectedQty} /><Metric label="Received" value={selectedReceived} /><Metric label="Short" value={itemRows.reduce((sum: number, item: any) => sum + Number(item.short_qty ?? 0), 0)} /><Metric label="Damaged" value={itemRows.reduce((sum: number, item: any) => sum + Number(item.damaged_qty ?? 0), 0)} /></div>
      <Card className="overflow-x-auto"><h2 className="mb-3 font-semibold">Product line details</h2><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-xs text-surface-500"><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Short</th><th className="px-3 py-2 text-right">Damaged</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Line total</th><th className="px-3 py-2">Note</th></tr></thead><tbody>{itemRows.map((item: any) => { const p = Array.isArray(item.products) ? item.products[0] : item.products; return <tr key={item.id} className="border-b border-surface-100"><td className="px-3 py-2">{p?.name ?? product.name} {p?.pack_size ? `(${p.pack_size})` : ""}</td><td className="px-3 py-2 text-right tabular-nums">{item.quantity ?? 0}</td><td className="px-3 py-2 text-right tabular-nums">{item.received_qty ?? 0}</td><td className="px-3 py-2 text-right tabular-nums text-amber-700">{item.short_qty ?? 0}</td><td className="px-3 py-2 text-right tabular-nums text-red-600">{item.damaged_qty ?? 0}</td><td className="px-3 py-2 text-right tabular-nums">{Number(item.unit_cost ?? 0).toLocaleString()}</td><td className="px-3 py-2 text-right tabular-nums">{Number(item.line_total ?? 0).toLocaleString()}</td><td className="px-3 py-2 text-xs text-surface-500">{item.grn_note ?? "—"}</td></tr>; })}</tbody></table>{itemRows.length === 0 && <p className="py-6 text-sm text-surface-500">Is purchase mein is product ki line nahi mili.</p>}</Card>
      {(purchase as any).notes && <Card><p className="text-sm text-surface-600">{(purchase as any).notes}</p></Card>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] uppercase tracking-wide text-surface-500">{label}</p><p className="mt-1 font-medium text-surface-900 dark:text-white">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <Card className="p-3"><p className="text-xs text-surface-500">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p></Card>; }
