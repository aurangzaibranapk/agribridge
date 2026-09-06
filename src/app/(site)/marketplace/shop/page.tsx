import { createClient } from "@/lib/supabase/server";
import { MarketplaceClient } from "./marketplace-client";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const supabase = createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase
      .from("products")
      .select("id, name, image_url, selling_price, mrp_price, pack_size, unit, category_id")
      .eq("is_available", true)
      .eq("is_deleted", false)
      .order("name"),
  ]);

  return <MarketplaceClient categories={categories ?? []} products={products ?? []} />;
}