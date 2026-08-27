import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ProposeForm } from "./propose-form";

export const dynamic = "force-dynamic";

export default async function ProposeProductPage() {
  const supabase = createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  return (
    <div>
      <PageHeader title="Naya Product Propose Karein" description="Main Warehouse Catalog ke liye - admin verify karega ke baad live hoga" />
      <ProposeForm categories={categories ?? []} />
    </div>
  );
}