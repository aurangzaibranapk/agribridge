import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, categories(name), brands(name), companies(name)")
    .eq("id", params.id)
    .eq("is_deleted", false)
    .single();

  if (!product) notFound();

  const { data: inv } = await supabase.from("inventory").select("quantity_on_hand").eq("product_id", product.id);
  const totalStock = (inv ?? []).reduce((sum, r) => sum + r.quantity_on_hand, 0);

  const { data: related } = await supabase
    .from("products")
    .select("id, name, selling_price, image_url")
    .eq("category_id", (product as any).category_id)
    .eq("is_deleted", false)
    .eq("is_available", true)
    .neq("id", product.id)
    .limit(4);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-card border border-surface-200 bg-surface-100 dark:border-surface-800 dark:bg-surface-800">
          {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <Package className="h-16 w-16 text-surface-300" />}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
            {[(product as any).categories?.name, (product as any).brands?.name, (product as any).companies?.name].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-surface-900 dark:text-white">{product.name}</h1>
          <p className="mt-3 font-display text-2xl font-semibold text-brand-700 dark:text-brand-400">{formatCurrency(product.selling_price)}</p>
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${totalStock > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {totalStock > 0 ? "In Stock" : "Out of Stock"}
          </span>

          <dl className="mt-6 space-y-3 text-sm">
            {product.pack_size && <Row label="Pack Size" value={product.pack_size} />}
            {product.unit && <Row label="Unit" value={product.unit} />}
            {product.active_ingredient && <Row label="Active Ingredient" value={product.active_ingredient} />}
            {product.composition && <Row label="Composition" value={product.composition} />}
            {product.dose && <Row label="Dosage" value={product.dose} />}
            {product.expiry_date && product.show_expiry_to_customer && <Row label="Best Before" value={new Date(product.expiry_date).toLocaleDateString("en-PK", { year: "numeric", month: "long" })} />}
          </dl>

          {product.usage_instructions && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-surface-400 dark:text-surface-500">Usage Instructions</p>
              <p className="mt-1 text-sm text-surface-700 dark:text-surface-300">{product.usage_instructions}</p>
            </div>
          )}
          {product.safety_information && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Safety Information</p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{product.safety_information}</p>
            </div>
          )}

          {product.brochure_pdf_url && (
            <a href={product.brochure_pdf_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800">
              <FileDown className="h-4 w-4" /> Download Brochure (PDF)
            </a>
          )}

          <Link href="/contact" className="mt-6 block">
            <span className="inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Order This Product</span>
          </Link>
        </div>
      </div>

      {related && related.length > 0 && (
        <div className="mt-16 border-t border-surface-200 pt-8 dark:border-surface-800">
          <h2 className="mb-4 font-display text-lg font-semibold text-surface-900 dark:text-white">Related Products</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((r) => (
              <Link key={r.id} href={`/products/${r.id}`} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
                  {r.image_url ? <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-surface-300" />}
                </div>
                <p className="text-sm font-medium text-surface-900 dark:text-white">{r.name}</p>
                <p className="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-400">{formatCurrency(r.selling_price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 text-surface-400 dark:text-surface-500">{label}</dt>
      <dd className="text-surface-700 dark:text-surface-300">{value}</dd>
    </div>
  );
}
