import { Landmark, ReceiptText, WalletCards } from "lucide-react";

export interface PaymentSummaryRow {
  method: string;
  label: string;
  sales: number;
  expenseNet: number;
  net: number;
}

const money = (v: number | null | undefined) => v == null ? "—" : `Rs ${Number(v).toLocaleString()}`;

const CREDIT_METHODS = new Set(["khata", "credit", "customer_credit", "udhaar"]);

function methodKind(method: string) {
  if (CREDIT_METHODS.has(method)) return "Credit / Khata";
  if (method === "cash") return "Cash Collected";
  return "Non-Cash Collected";
}

export function Shop360PaymentSummary({
  rows,
  totalSales,
  verifiedDeposit,
  pendingDeposit,
  outstanding,
}: {
  rows: PaymentSummaryRow[];
  totalSales: number;
  verifiedDeposit: number;
  pendingDeposit: number;
  outstanding: number;
}) {
  const creditSale = rows
    .filter((r) => CREDIT_METHODS.has(r.method))
    .reduce((sum, r) => sum + Number(r.sales || 0), 0);
  const collectedSale = totalSales - creditSale;
  const methodCount = rows.filter((r) => Number(r.sales || 0) !== 0).length;
  const totalExpenseNet = rows.reduce((sum, r) => sum + Number(r.expenseNet || 0), 0);
  const totalNet = rows.reduce((sum, r) => sum + Number(r.net || 0), 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <WalletCards className="h-4 w-4" /> Sale & Payment Summary
          </h3>
          <p className="mt-1 text-xs text-surface-500">
            Selected period mein kitni sale hui, kitni payment receive hui aur kitna Khata bana — sab ek jagah.
          </p>
        </div>
        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600">
          {methodCount} payment method{methodCount === 1 ? "" : "s"} used
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Total Sale Value</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(totalSales)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Cash + bank/digital + card + khata.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Payment Received</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(collectedSale)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Khata/credit ko receive payment mein include nahi kiya.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Khata / Credit Sale</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(creditSale)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Sale hui, payment abhi customer se leni hai.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Finance Verified Deposit</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(verifiedDeposit)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Company bank mein Finance-approved jama.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Collection Outstanding</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(outstanding)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Abhi staff/shop custody ya settlement mein baki.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500">
              <th className="px-4 py-2.5">Payment Method</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5 text-right">Sale / Payment Value</th>
              <th className="px-4 py-2.5 text-right">Expense / Adjustment</th>
              <th className="px-4 py-2.5 text-right">Net Position</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-5 text-center text-surface-400">Is selected period mein koi POS sale/payment nahi mili.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.method} className="border-b border-surface-100 last:border-0">
                <td className="px-4 py-2.5 font-medium">{r.label}</td>
                <td className="px-4 py-2.5 text-surface-500">{methodKind(r.method)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(r.sales)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(r.expenseNet)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(r.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-surface-50 font-semibold">
              <td className="px-4 py-2.5" colSpan={2}>Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(totalSales)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(totalExpenseNet)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(totalNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div className="rounded-lg bg-surface-50 p-3"><Landmark className="mr-1 inline h-4 w-4" />Pending Finance Deposit: <b>{money(pendingDeposit)}</b></div>
        <div className="rounded-lg bg-surface-50 p-3"><ReceiptText className="mr-1 inline h-4 w-4" />Verified Deposit: <b>{money(verifiedDeposit)}</b></div>
        <div className="rounded-lg bg-surface-50 p-3"><WalletCards className="mr-1 inline h-4 w-4" />Remaining Outstanding: <b>{money(outstanding)}</b></div>
      </div>

      <p className="text-[11px] text-surface-400">
        Note: Verified deposit, pending deposit aur outstanding ek hi collection lifecycle ke states hain; inhen total sale ke sath dobara jor kar fake grand total nahi banaya jata.
      </p>
    </section>
  );
}
