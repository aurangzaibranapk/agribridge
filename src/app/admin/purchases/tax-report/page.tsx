import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { aajKaKhana } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function money(n: number | null | undefined) {
  if (!n) return "—";
  return "Rs " + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PurchaseTaxReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; supplier?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Sirf Finance/Admin dekh sakte hain.</div>;
  }

  const service = createServiceClient();
  const aaj = aajKaKhana();
  const saalShuru = `${new Date().getFullYear()}-01-01`;
  const from = searchParams.from ?? saalShuru;
  const to = searchParams.to ?? aaj;

  // Suppliers list for filter
  const { data: suppliers } = await service
    .from("suppliers")
    .select("id, name")
    .order("name");

  // Purchases with discount/tax in date range
  let q = service
    .from("purchases")
    .select("id, purchase_number, purchase_date, supplier_bill_no, total_amount, invoice_total, discount_amount, tax_amount, tax_label, suppliers(name)")
    .gte("purchase_date", from)
    .lte("purchase_date", to)
    .or("discount_amount.not.is.null,tax_amount.not.is.null")
    .order("purchase_date", { ascending: false });

  if (searchParams.supplier) {
    q = q.eq("supplier_id", searchParams.supplier);
  }

  const { data: rows } = await q;
  const purchases = (rows ?? []) as {
    id: string;
    purchase_number: string;
    purchase_date: string;
    supplier_bill_no: string | null;
    total_amount: number;
    invoice_total: number | null;
    discount_amount: number | null;
    tax_amount: number | null;
    tax_label: string | null;
    suppliers: { name: string } | null;
  }[];

  // Totals
  const totalDiscount = purchases.reduce((s, r) => s + (Number(r.discount_amount) || 0), 0);
  const totalTax = purchases.reduce((s, r) => s + (Number(r.tax_amount) || 0), 0);
  const totalPurchase = purchases.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);

  // Tax grouped by label
  const taxByLabel = new Map<string, number>();
  for (const r of purchases) {
    if (!r.tax_amount) continue;
    const label = r.tax_label || "Tax";
    taxByLabel.set(label, (taxByLabel.get(label) ?? 0) + Number(r.tax_amount));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tax & Discount Statement"
        description="Supplier bills par jo Advance Tax kata aur jo trade discount mila — tax filing ke liye"
      />

      {/* Filter */}
      <Card>
        <form className="flex flex-wrap items-end gap-2" action="/admin/purchases/tax-report">
          <div>
            <label className="block text-xs text-surface-500">Se (Date)</label>
            <input type="date" name="from" defaultValue={from}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
          </div>
          <div>
            <label className="block text-xs text-surface-500">Tak (Date)</label>
            <input type="date" name="to" defaultValue={to}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
          </div>
          <div>
            <label className="block text-xs text-surface-500">Supplier (ikhtiyari)</label>
            <select name="supplier" defaultValue={searchParams.supplier ?? ""}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900">
              <option value="">Sab Suppliers</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Dikhao
          </button>
          {purchases.length > 0 && (
            <a
              href={`/admin/purchases/tax-report/export?from=${from}&to=${to}${searchParams.supplier ? `&supplier=${searchParams.supplier}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              ↓ CSV Download
            </a>
          )}
        </form>
      </Card>

      {/* Summary Boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">Kul Kharid</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-surface-900 dark:text-white">
            Rs {Math.round(totalPurchase).toLocaleString()}
          </p>
          <p className="text-xs text-surface-400">{purchases.length} bill</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">Trade Discount (Mila)</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            Rs {totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-surface-400">Supplier ne diya</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">Advance Tax (Kata)</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
            Rs {totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-surface-400">Tax filing mein claim hoga</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">Net Kharid (Tax + Disc baad)</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-surface-900 dark:text-white">
            Rs {(totalPurchase - totalDiscount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-surface-400">Actual paid (approx)</p>
        </Card>
      </div>

      {/* Tax by label */}
      {taxByLabel.size > 1 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-200">Tax qism ke mutabiq</p>
          <div className="space-y-1">
            {[...taxByLabel.entries()].map(([label, amt]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-surface-600 dark:text-surface-300">{label}</span>
                <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  Rs {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detail Table */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">
            Bill-wise Tafseel — {from} se {to}
          </p>
        </div>
        {purchases.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-surface-400">
            Is period mein koi bill nahi mila jis mein discount ya tax ho.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
              <tr>
                <th className="px-4 py-2">Tareekh</th>
                <th className="px-4 py-2">Bill No.</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2 text-right">Kul Raqam</th>
                <th className="px-4 py-2 text-right text-emerald-700">Trade Discount</th>
                <th className="px-4 py-2 text-right text-amber-700">Advance Tax</th>
                <th className="px-4 py-2 text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {purchases.map((p) => {
                const disc = Number(p.discount_amount) || 0;
                const tax = Number(p.tax_amount) || 0;
                const net = Number(p.total_amount) - disc;
                return (
                  <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/40">
                    <td className="px-4 py-2 whitespace-nowrap text-surface-600 dark:text-surface-300">{p.purchase_date}</td>
                    <td className="px-4 py-2">
                      <span className="font-medium text-surface-900 dark:text-white">{p.supplier_bill_no || p.purchase_number}</span>
                      {p.supplier_bill_no && (
                        <span className="block text-[11px] text-surface-400">{p.purchase_number}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-surface-700 dark:text-surface-300">{p.suppliers?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{money(p.total_amount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {disc ? money(disc) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {tax ? (
                        <>
                          {money(tax)}
                          {p.tax_label && (
                            <span className="block text-[10px] text-surface-400">{p.tax_label}</span>
                          )}
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-surface-900 dark:text-white">{money(net)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-600 bg-surface-50 dark:bg-surface-800/30">
                <td className="px-4 py-2" colSpan={3}>Kul</td>
                <td className="px-4 py-2 text-right tabular-nums">Rs {Math.round(totalPurchase).toLocaleString()}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                  Rs {totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                  Rs {totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  Rs {(totalPurchase - totalDiscount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">
        <strong>Note:</strong> Sirf wo bills yahan dikhte hain jin mein Import karte waqt Discount ya Tax fill kiya gaya ho. Agar koi purana bill choot gaya to us bill ko Purchases mein khol kar edit karein.
      </Card>
    </div>
  );
}
