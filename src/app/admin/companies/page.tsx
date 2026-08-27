import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteTaxonomyItem, saveTaxonomyItem } from "@/actions/taxonomy";
import { NewTaxonomyItemForm } from "@/app/admin/categories/new-taxonomy-item-form";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const supabase = createClient();
  const { data: items } = await supabase.from("companies").select("*").order("name");

  return (
    <div>
      <PageHeader title="Companies & Brands" description="Manufacturers/companies whose products you sell" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!items || items.length === 0 ? (
            <EmptyState title="No companies yet" />
          ) : (
            <div className="space-y-2">
              {items.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <span className="font-medium text-surface-900 dark:text-white">{c.name}</span>
                  <DeleteButton id={c.id} action={deleteTaxonomyItem.bind(null, "companies")} />
                </div>
              ))}
            </div>
          )}
        </div>
        <NewTaxonomyItemForm table="companies" label="Company" action={saveTaxonomyItem.bind(null, "companies")} />
      </div>
    </div>
  );
}
