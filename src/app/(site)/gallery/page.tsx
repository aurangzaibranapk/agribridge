import { createClient } from "@/lib/supabase/server";
import { GalleryGrid } from "@/app/(site)/gallery/gallery-grid";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const supabase = createClient();
  const { data: items } = await supabase.from("gallery_items").select("*").eq("is_published", true).order("display_order");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">Gallery</h1>
        <p className="mx-auto mt-2 max-w-lg text-surface-500 dark:text-surface-400">Farm visits, dealer network events, and product demonstrations.</p>
      </div>
      <div className="mt-10">
        <GalleryGrid items={items ?? []} />
      </div>
    </div>
  );
}
