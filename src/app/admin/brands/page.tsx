import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteTaxonomyItem, saveTaxonomyItem } from "@/actions/taxonomy";
import { NewTaxonomyItemForm } from "@/app/admin/categories/new-taxonomy-item-form";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const supabase = createClient();
  const { data: items } = await supabase.from("brands").select("*").order("name");

  return (
    <div>
      <PageHeader title="Brands" description="Product brands, used to label products in the catalogue" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!items || items.length === 0 ? (
            <EmptyState title="No brands yet" />
          ) : (
            <div className="space-y-2">
              {items.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <span className="font-medium text-surface-900 dark:text-white">{b.name}</span>
                  <DeleteButton id={b.id} action={deleteTaxonomyItem.bind(null, "brands")} />
                </div>
              ))}
            </div>
          )}
        </div>
        <NewTaxonomyItemForm table="brands" label="Brand" action={saveTaxonomyItem.bind(null, "brands")} />
      </div>
    </div>
  );
}
