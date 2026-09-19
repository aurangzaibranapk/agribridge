import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteGalleryItem } from "@/actions/cms";
import { NewGalleryItemForm } from "@/app/admin/gallery/new-gallery-item-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: items } = await supabase.from("gallery_items").select("*").order("display_order");

  return (
    <div>
      <PageHeader title={t("at_gallery", lang)} description="Photos and videos shown on the /gallery page" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!items || items.length === 0 ? (
            <EmptyState title={t("at_no_gallery", lang)} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((g) => (
                <div key={g.id} className="rounded-card border border-surface-200 bg-white p-2 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div className="mb-2 aspect-square overflow-hidden rounded-lg bg-surface-100">
                    <img src={g.thumbnail_url || g.url} alt={g.caption ?? ""} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge tone="gray">{g.type}</Badge>
                    <DeleteButton id={g.id} action={deleteGalleryItem} label="" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <NewGalleryItemForm />
      </div>
    </div>
  );
}
