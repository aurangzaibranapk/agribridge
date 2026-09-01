import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { WarehouseForm } from "@/app/admin/inventory/warehouses/warehouse-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminWarehousesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, address, is_active")
    .order("name");

  return (
    <div>
      <PageHeader title={t("at_warehouses", lang)} description="Physical storage locations for your stock" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!warehouses || warehouses.length === 0 ? (
            <EmptyState title={t("at_no_warehouses", lang)} />
          ) : (
            <div className="space-y-2">
              {warehouses.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
                >
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white">
                      {w.name} <span className="text-xs text-surface-400">({w.code})</span>
                    </p>
                    {w.address && <p className="mt-0.5 text-xs text-surface-500">{w.address}</p>}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      w.is_active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400"
                    }`}
                  >
                    {w.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <WarehouseForm />
      </div>
    </div>
  );
}