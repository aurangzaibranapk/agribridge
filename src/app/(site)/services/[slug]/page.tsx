import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SERVICES } from "@/lib/data/services";
import { Button } from "@/components/ui/form";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export default async function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = SERVICES.find((s) => s.slug === params.slug);
  if (!service) notFound();

  const supabase = createClient();
  const { data: relatedProducts } = await supabase
    .from("products")
    .select("id, name, selling_price, image_url")
    .eq("is_deleted", false)
    .eq("is_available", true)
    .limit(4);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <service.icon className="h-7 w-7" />
      </div>
      <h1 className="mt-4 font-display text-3xl font-semibold text-surface-900 dark:text-white">{service.title}</h1>
      <p className="mt-3 text-surface-600 dark:text-surface-300">{service.detail}</p>

      <Link href={`/contact?service=${encodeURIComponent(service.title)}`} className="mt-6 inline-block">
        <Button size="md">Inquire About This Service</Button>
      </Link>

      {relatedProducts && relatedProducts.length > 0 && (
        <div className="mt-12 border-t border-surface-200 pt-8 dark:border-surface-800">
          <h2 className="mb-4 font-display text-lg font-semibold text-surface-900 dark:text-white">Related Products</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relatedProducts.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                <p className="text-sm font-medium text-surface-900 dark:text-white">{p.name}</p>
                <p className="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-400">{formatCurrency(p.selling_price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
