import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { aajKaKhana } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

const METHOD_LABELS: Record<string, string> = {
  cash:          "Cash",
  khata:         "Khata (Udhaar)",
  easypaisa:     "Easypaisa",
  jazzcash:      "JazzCash",
  waseela_card:  "Waseela Card",
  card:          "Bank Card / ATM",
  bank_transfer: "Bank Transfer",
  qr:            "QR Code",
  cheque:        "Cheque",
  wallet:        "Wallet",
};

function methodLabel(m: string) {
  return METHOD_LABELS[m] ?? m;
}

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}

export default async function PaymentMethodsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Sirf Finance ke log dekh sakte hain.</div>;
  }

  const service = createServiceClient();
  const aaj = aajKaKhana();
  const saalShuru = `${new Date().getFullYear()}-01-01`;
  const from = searchParams.from ?? saalShuru;
  const to = searchParams.to ?? aaj;

  // POS payments (created_at date range)
  const { data: posRows } = await service
    .from("pos_sale_payment_details")
    .select("payment_method, amount")
    .gte("created_at", from)
    .lte("created_at", to + "T23:59:59");

  // Supplier payments
  const { data: supRows } = await service
    .from("supplier_payments")
    .select("payment_method, amount, payment_date")
    .gte("payment_date", from)
    .lte("payment_date", to);

  // Aggregate POS by method
  const posMap = new Map<string, { count: number; amount: number }>();
  for (const r of posRows ?? []) {
    const m = r.payment_method ?? "cash";
    const e = posMap.get(m) ?? { count: 0, amount: 0 };
    posMap.set(m, { count: e.count + 1, amount: e.amount + Number(r.amount) });
  }

  // Aggregate Supplier by method
  const supMap = new Map<string, { count: number; amount: number }>();
  for (const r of supRows ?? []) {
    const m = r.payment_method ?? "cash";
    const e = supMap.get(m) ?? { count: 0, amount: 0 };
    supMap.set(m, { count: e.count + 1, amount: e.amount + Number(r.amount) });
  }

  // Combined
  const allMethods = new Set([...posMap.keys(), ...supMap.keys()]);
  const combined = [...allMethods].map((m) => ({
    method: m,
    posCount: posMap.get(m)?.count ?? 0,
    posAmount: posMap.get(m)?.amount ?? 0,
    supCount: supMap.get(m)?.count ?? 0,
    supAmount: supMap.get(m)?.amount ?? 0,
    total: (posMap.get(m)?.amount ?? 0) + (supMap.get(m)?.amount ?? 0),
  })).sort((a, b) => b.total - a.total);

  const grandPos = combined.reduce((s, r) => s + r.posAmount, 0);
  const grandSup = combined.reduce((s, r) => s + r.supAmount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment Method Analysis"
        description="Kis tareeqe se ziyada buying/selling hui — date range ke hisaab se"
      />

      <Card>
        <form className="flex flex-wrap items-end gap-2" action="/admin/finance/payment-methods">
          <div>
            <label className="block text-xs text-surface-500">Se</label>
            <input type="date" name="from" defaultValue={from}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
          </div>
          <div>
            <label className="block text-xs text-surface-500">Tak</label>
            <input type="date" name="to" defaultValue={to}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
          </div>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Dikhao
          </button>
        </form>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {combined.slice(0, 6).map((r) => (
          <Card key={r.method} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{methodLabel(r.method)}</p>
            <p className="font-display text-lg font-bold tabular-nums text-surface-900 dark:text-white">{money(r.total)}</p>
            <div className="text-xs text-surface-500">
              {r.posAmount > 0 && <span>Karyana: {money(r.posAmount)} ({r.posCount} sale)</span>}
              {r.posAmount > 0 && r.supAmount > 0 && <span className="mx-1">·</span>}
              {r.supAmount > 0 && <span>Kharid: {money(r.supAmount)} ({r.supCount} adaigi)</span>}
            </div>
          </Card>
        ))}
      </div>

      {/* Detail Table */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">
            Tafseel — {from} se {to} tak
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-2">Payment Method</th>
              <th className="px-4 py-2 text-right">Karyana Sales</th>
              <th className="px-4 py-2 text-right">Sales Raqam</th>
              <th className="px-4 py-2 text-right">Supplier Adaigi</th>
              <th className="px-4 py-2 text-right">Adaigi Raqam</th>
              <th className="px-4 py-2 text-right">Kul Raqam</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {combined.map((r) => (
              <tr key={r.method}>
                <td className="px-4 py-2 font-medium text-surface-900 dark:text-white">{methodLabel(r.method)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-surface-600">{r.posCount || "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.posAmount ? money(r.posAmount) : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-surface-600">{r.supCount || "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.supAmount ? money(r.supAmount) : "—"}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-surface-900 dark:text-white">{money(r.total)}</td>
              </tr>
            ))}
            {combined.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Is period mein koi transaction nahi mili.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-600">
              <td className="px-4 py-2">Kul</td>
              <td className="px-4 py-2 text-right tabular-nums">{combined.reduce((s, r) => s + r.posCount, 0)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{money(grandPos)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{combined.reduce((s, r) => s + r.supCount, 0)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{money(grandSup)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{money(grandPos + grandSup)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}
