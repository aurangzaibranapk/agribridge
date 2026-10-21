import "@/components/finance-dash/finance-dash.css";
import "@/components/supply-chain/supply-chain.css";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SupplyChainDashboard } from "@/components/supply-chain/views";
import { MinStockSetter } from "@/components/supply-chain/min-stock-setter";
import { canSeeSupplyChain, loadSupplyChain } from "@/lib/supply-chain/load";
import { addMonths, isValidMonth, monthLabel } from "@/lib/supply-chain/compute";
import { todayPk } from "@/lib/finance-dash/load";

export const dynamic = "force-dynamic";

const uuidOr = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : "");

export default async function SupplyChainPage({ searchParams }: { searchParams: Promise<{ month?: string; branch?: string; category?: string; supplier?: string }> }) {
  const sp = await searchParams;
  const filters = {
    month: isValidMonth(sp.month) ? sp.month : "",
    branch: uuidOr(sp.branch),
    category: uuidOr(sp.category),
    supplier: uuidOr(sp.supplier),
  };
  const header = <PageHeader title="Supply Chain Dashboard" description="Khareed, GRN aur stock -- waqt par delivery, lead time, gardish aur stock khatam" />;
  if (!(await canSeeSupplyChain())) {
    return <div>{header}<p className="mt-4 text-sm text-surface-500">Ye dashboard sirf malik, admin, finance, procurement aur warehouse ke liye hai.</p></div>;
  }
  const cur = todayPk().slice(0, 7);
  const months = Array.from({ length: 24 }, (_, i) => addMonths(cur, -i)).map((key) => ({ key, label: monthLabel(key) }));
  try {
    const { result, options } = await loadSupplyChain(filters);
    return (
      <div>
        {header}
        <div className="mt-4">
          <SupplyChainDashboard d={result} filters={filters} options={{ ...options, months }} renderMinSetter={(id) => <MinStockSetter productId={id} />} />
        </div>
      </div>
    );
  } catch (e) {
    return (
      <div>
        {header}
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Dashboard load nahi hua: {(e as Error).message}</div>
      </div>
    );
  }
}
