import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteMenuItem } from "@/actions/cms";
import { NewMenuItemForm } from "@/app/admin/menus/new-menu-item-form";

export const dynamic = "force-dynamic";

export default async function AdminMenusPage() {
  const supabase = createClient();
  const { data: items } = await supabase.from("menu_items").select("*").order("menu_location").order("display_order");

  return (
    <div>
      <PageHeader title="Menus" description="Header and footer navigation links" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!items || items.length === 0 ? (
            <EmptyState title="No custom menu items yet" description="The site uses its built-in default navigation until items are added here." />
          ) : (
            <div className="space-y-2">
              {items.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div>
                    <Badge tone="gray">{m.menu_location}</Badge>
                    <span className="ml-2 font-medium text-surface-900 dark:text-white">{m.label}</span>
                    <span className="ml-2 text-xs text-surface-400 dark:text-surface-500">{m.url}</span>
                  </div>
                  <DeleteButton id={m.id} action={deleteMenuItem} />
                </div>
              ))}
            </div>
          )}
        </div>
        <NewMenuItemForm />
      </div>
    </div>
  );
}
