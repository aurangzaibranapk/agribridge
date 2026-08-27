import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ProductForm } from "@/app/admin/products/new/product-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: product }, { data: companies }, { data: brands }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).single(),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  if (!product) notFound();

  return (
    <div>
      <PageHeader title="Edit Product" description={product.name} />
      <ProductForm
        companies={companies ?? []}
        brands={brands ?? []}
        categories={categories ?? []}
        product={product}
      />
    </div>
  );
}