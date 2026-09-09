import Link from "next/link";
import { Droplet, Wheat, Tractor, ShoppingCart, Warehouse, Truck, Wallet, Users, AlertTriangle } from "lucide-react";
import PnlPage from "@/app/admin/reports/pnl/page";
import { Card } from "@/components/ui/layout-primitives";
import { branchConsolidated360 } from "@/lib/pos/shop-360";

export const dynamic = "force-dynamic";

/**
 * Branch Dashboard -- "Branches" ki fehrist se seedha, Reports mein
 * dhoondhna nahi paRta.
 *
 * Malik (8 September): "Branch par click karte hi seedha uska poora
 * dashboard khule -- Budget, Sales, Stock, Kharche sab kuch usi ek
 * jagah mile."
 *
 * Ye poora hisaab (branch → har shop → budget/sale/stock/kharcha)
 * `/admin/reports/pnl` mein pehle se ban chuka hai aur asal data se
 * verify ho chuka hai. Yahan wohi engine reuse hota hai -- dobara
 * likhna do jagah do hisaab ka khatra banata (is project mein pehle
 * bhi ho chuka hai). Sirf DARWAZA yahan hai: is branch ke `id` ko
 * `branch_id` bana kar seedha wahi safha dikha diya jata hai.
 *
 * Malik (8 September, doosra qadam): "sidebar waisi hi rahe -- is
 * dashboard ke ANDAR baqi modules (Milk, Grain, Machinery, waghera)
 * ke quick link aa jayen, ek jagah se poora branch chal sake."
 *
 * Jin safhon ke apne `/admin/reports/*` mein pehle se branch filter
 * hai (Sales, Inventory, Purchase -- `?branch=`), wahan seedha isi
 * branch ka data khulta hai. Baqi (Milk, Grain, Machinery, Finance ka
 * Cash Book, Fleet, HR) abhi khud branch-scoped nahi hain -- wahan
 * plain link hai (poori fehrist), jhoothi filtering ka daawa nahi.
 */
const QUICK_LINKS = (branchId: string) => [
  { label: "Doodh (Milk)", href: "/admin/milk-collection", icon: Droplet, scoped: false },
  { label: "Anaj (Grain)", href: "/admin/grain-procurement/dashboard", icon: Wheat, scoped: false },
  { label: "Machinery", href: "/admin/machinery-rental/dashboard", icon: Tractor, scoped: false },
  { label: "Sales & Retail", href: `/admin/reports/sales?branch=${branchId}`, icon: ShoppingCart, scoped: true },
  { label: "Inventory & Warehouse", href: `/admin/reports/inventory?branch=${branchId}`, icon: Warehouse, scoped: true },
  { label: "Purchase", href: `/admin/reports/purchases?branch=${branchId}`, icon: Truck, scoped: true },
  { label: "Finance (Cash Book)", href: "/admin/finance", icon: Wallet, scoped: false },
  { label: "HR & Staff", href: "/admin/hr", icon: Users, scoped: false },
];

/**
 * Shop 360 — Consolidated (Phase 5).
 *
 * Har shop ka apna, alag se durust hisaab (`src/lib/pos/shop-360.ts`)
 * hi jama kiya jata hai -- koi naya "branch-level" formula nahi likha.
 * Receivable ek hi dafa dikhta hai (branch-level hai, har shop ke liye
 * dobara jorna usay N guna kar deta).
 */
async function BranchShop360Summary({ branchId }: { branchId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const c = await branchConsolidated360(branchId, today);

  if (c.shops.length === 0) {
    return (
      <Card className="mb-4">
        <p className="text-sm text-surface-500">{c.note}</p>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
        Shop 360 — Consolidated (aaj)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
              <th className="pb-1.5 pr-4">Shop</th>
              <th className="pb-1.5 pr-4 text-right">Stock (FIFO)</th>
              <th className="pb-1.5 pr-4 text-right">Cash/Bank/Digital</th>
              <th className="pb-1.5 pr-4 text-right">Cash Diff</th>
              <th className="pb-1.5 pr-4 text-right">POS Outstanding</th>
              <th className="pb-1.5 text-right">Net Owner Equity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {c.shops.map((s) => (
              <tr key={s.shopId}>
                <td className="py-1.5 pr-4">
                  <Link href={`/admin/shop-360/match?shop_id=${s.shopId}`} className="text-brand-700 underline">
                    {s.shopName}
                  </Link>
                  {s.openShifts > 0 && <span className="ml-1 text-amber-700">({s.openShifts} khuli)</span>}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">{s.stockValue == null ? "—" : `Rs ${s.stockValue.toLocaleString()}`}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">Rs {s.cashDigitalTotal.toLocaleString()}</td>
                <td className={`py-1.5 pr-4 text-right tabular-nums ${Math.abs(s.cashDifference) >= 1 ? "text-red-700" : ""}`}>
                  Rs {s.cashDifference.toLocaleString()}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">Rs {s.outstanding.toLocaleString()}</td>
                <td className="py-1.5 text-right tabular-nums">Rs {s.netOwnerEquity.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-4">Total ({c.shops.length} shops)</td>
              <td className="py-1.5 pr-4 text-right tabular-nums">Rs {c.totalStockValue.toLocaleString()}</td>
              <td className="py-1.5 pr-4 text-right tabular-nums">Rs {c.totalCashDigital.toLocaleString()}</td>
              <td className={`py-1.5 pr-4 text-right tabular-nums ${Math.abs(c.totalCashDifference) >= 1 ? "text-red-700" : ""}`}>
                Rs {c.totalCashDifference.toLocaleString()}
              </td>
              <td className="py-1.5 pr-4 text-right tabular-nums">Rs {c.totalOutstanding.toLocaleString()}</td>
              <td className="py-1.5 text-right tabular-nums">Rs {c.totalNetOwnerEquity.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-surface-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        Customer Receivable (branch-level) alag se: {c.receivableBranchLevel == null ? "—" : `Rs ${c.receivableBranchLevel.toLocaleString()}`} —
        har shop ke liye dobara nahi jorha (double-count na ho). Har shop ka apna poora hisaab, naam par click karke.
      </p>
    </Card>
  );
}

export default async function BranchDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_LINKS(id).map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-surface-800"
            title={l.scoped ? "Isi branch ka data" : "Poori company ki fehrist (is branch tak scoped nahi)"}
          >
            <l.icon className="h-3.5 w-3.5" />
            {l.label}
          </Link>
        ))}
      </div>
      <BranchShop360Summary branchId={id} />
      <PnlPage searchParams={Promise.resolve({ branch_id: id })} />
    </div>
  );
}
