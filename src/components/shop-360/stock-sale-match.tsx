import { CheckCircle2, AlertTriangle, PackageCheck } from "lucide-react";

const money = (v: number | null | undefined) => v == null ? "—" : `Rs ${Number(v).toLocaleString()}`;

export function Shop360StockSaleMatch({
  openingValue,
  stockInValue,
  stockSaleOutValue,
  otherStockOutValue,
  expectedClosingValue,
  actualClosingValue,
  stockDifference,
  posSalesValue,
  posVsStockSaleDifference,
  verifiedDeposit,
  outstanding,
}: {
  openingValue: number | null;
  stockInValue: number | null;
  stockSaleOutValue: number | null;
  otherStockOutValue: number | null;
  expectedClosingValue: number | null;
  actualClosingValue: number | null;
  stockDifference: number | null;
  posSalesValue: number;
  posVsStockSaleDifference: number | null;
  verifiedDeposit: number;
  outstanding: number;
}) {
  const stockMatched = stockDifference != null && Math.abs(stockDifference) < 1;
  const saleMatched = posVsStockSaleDifference != null && Math.abs(posVsStockSaleDifference) < 1;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold"><PackageCheck className="h-4 w-4" /> Stock + Sale + Payment Match</h3>
        <p className="mt-1 text-xs text-surface-500">Selling-rate stock se jo maal nikla, us ki sale aur payment ka raasta alag alag verify hota hai.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-surface-200 bg-white p-3"><p className="text-xs text-surface-500">Opening / Entrusted Stock Value</p><p className="mt-1 text-lg font-bold">{money(openingValue)}</p></div>
        <div className="rounded-xl border border-surface-200 bg-white p-3"><p className="text-xs text-surface-500">+ Stock In</p><p className="mt-1 text-lg font-bold">{money(stockInValue)}</p></div>
        <div className="rounded-xl border border-surface-200 bg-white p-3"><p className="text-xs text-surface-500">− Sold Stock @ Selling Rate</p><p className="mt-1 text-lg font-bold">{money(stockSaleOutValue)}</p></div>
        <div className="rounded-xl border border-surface-200 bg-white p-3"><p className="text-xs text-surface-500">− Other Stock Out</p><p className="mt-1 text-lg font-bold">{money(otherStockOutValue)}</p></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3"><p className="text-xs text-surface-500">Expected Closing Stock</p><p className="mt-1 text-lg font-bold">{money(expectedClosingValue)}</p></div>
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3"><p className="text-xs text-surface-500">Actual Closing Stock</p><p className="mt-1 text-lg font-bold">{money(actualClosingValue)}</p></div>
        <div className={`rounded-xl border p-3 ${stockMatched ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="text-xs text-surface-500">Stock Difference</p><p className="mt-1 text-lg font-bold">{money(stockDifference)}</p><p className="mt-1 text-[11px]">{stockMatched ? "Expected aur actual stock mil raha hai." : "Stock ledger verify karein."}</p></div>
        <div className={`rounded-xl border p-3 ${saleMatched ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="text-xs text-surface-500">POS Sale vs Stock Sold Difference</p><p className="mt-1 text-lg font-bold">{money(posVsStockSaleDifference)}</p><p className="mt-1 text-[11px]">{saleMatched ? "POS sale aur stock-out value mil rahi hai." : "Discount/rate/movement check karein."}</p></div>
      </div>

      <div className="rounded-xl border border-surface-200 bg-white p-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-surface-500">POS Sale Value</p><b>{money(posSalesValue)}</b></div>
          <div><p className="text-xs text-surface-500">Finance Verified Deposit</p><b>{money(verifiedDeposit)}</b></div>
          <div><p className="text-xs text-surface-500">Collection Outstanding</p><b>{money(outstanding)}</b></div>
        </div>
        <div className="mt-3 border-t pt-3 text-xs text-surface-600">
          {stockMatched && saleMatched ? <><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600"/>Stock aur sale side match hai. Payment side tab fully settled hogi jab collectible amount Finance-verified deposit/valid receivable/approved state mein explain ho.</> : <><AlertTriangle className="mr-1 inline h-4 w-4 text-amber-600"/>Kisi layer mein farq hai; isay green Full Match nahi dikhaya jayega.</>}
        </div>
      </div>
    </section>
  );
}
