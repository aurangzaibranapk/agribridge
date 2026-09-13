import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteTaxonomyItem, saveTaxonomyItem } from "@/actions/taxonomy";
import { NewTaxonomyItemForm } from "@/app/admin/categories/new-taxonomy-item-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { MastersTabs } from "@/components/products/masters-tabs";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: items } = await supabase.from("categories").select("*").order("name");

  return (
    <div>
      <PageHeader title={t("at_categories", lang)} description="Product categories shown on the Products page filter" />
      <MastersTabs current="categories" lang={lang} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!items || items.length === 0 ? (
            <EmptyState title={t("at_no_categories", lang)} />
          ) : (
            <div className="space-y-2">
              {items.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <span className="font-medium text-surface-900 dark:text-white">{c.name}</span>
                  <DeleteButton id={c.id} action={deleteTaxonomyItem.bind(null, "categories")} />
                </div>
              ))}
            </div>
          )}
        </div>
        <NewTaxonomyItemForm table="categories" label={t("at_category", lang)} action={saveTaxonomyItem.bind(null, "categories")} />
      </div>
    </div>
  );
}
