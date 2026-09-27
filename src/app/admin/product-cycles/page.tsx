import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ProductCycleClient } from "./cycle-client";
import { StockCountCycleClient } from "./stock-count-client";
import { getCycleCountSettings, getTodaySession, getSessionItems } from "@/actions/cycle-stock-count";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product Cycles" };

export default async function ProductCyclesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab === "stock" ? "stock" : "shops";

  const supabase = createClient();

  const [{ data: shops }, settings, session] = await Promise.all([
    supabase.from("shops").select("id, name, code, business_type").eq("is_active", true).order("name"),
    getCycleCountSettings(),
    getTodaySession(),
  ]);

  const items = session ? await getSessionItems(session.id) : [];

  return (
    <div className="space-y-0">
      <PageHeader
        title="Product Cycles"
        description="Shop product rotation aur daily cycle stock count — dono ek jagah."
      />

      {/* Tab bar */}
      <div className="border-b border-surface-200 px-4 dark:border-surface-800">
        <div className="flex gap-0">
          <a
            href="?tab=shops"
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "shops"
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            Shop Product Rotation
          </a>
          <a
            href="?tab=stock"
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "stock"
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            Daily Stock Count Cycle
          </a>
        </div>
      </div>

      {activeTab === "shops" ? (
        <ProductCycleClient shops={(shops ?? []) as any} />
      ) : (
        <StockCountCycleClient
          initialSettings={settings}
          initialSession={session}
          initialItems={items}
        />
      )}
    </div>
  );
}
