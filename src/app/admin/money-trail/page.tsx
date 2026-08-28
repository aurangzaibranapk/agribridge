import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { moneyTrail, trialBalance, accountLedger } from "@/lib/ledger/money-trail";
import { AlertTriangle, CheckCircle2, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function MoneyTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Finance, Manager aur Admin ke liye hai.</div>;
  }

  const [trail, tb] = await Promise.all([moneyTrail(), trialBalance()]);
  const openAccount = params.account ?? null;
  const ledger = openAccount ? await accountLedger(openAccount) : [];

  const where = [
    { label: "Cash in Hand", value: trail.cash, code: "1000" },
    { label: "Bank", value: trail.bank, code: "1010" },
    { label: "Bank bheja, pahuncha nahi", value: trail.inTransit, code: "1020" },
    { label: "Customer se lena (Khata)", value: trail.receivableCustomers, code: "1100" },
    { label: "Branch se lena", value: trail.receivableBranches, code: "1110" },
    { label: "Supplier ko advance", value: trail.advanceSuppliers, code: "1120" },
    { label: "Staff ko advance", value: trail.advanceStaff, code: "1130" },
    { label: "Farmer ko advance", value: trail.advanceFarmers, code: "1140" },
    { label: "Stock ki qeemat", value: trail.stock, code: "1200" },
  ];

  const owed = [
    { label: "Supplier ko dena", value: trail.payableSuppliers, code: "2000" },
    { label: "Farmer ko dena", value: trail.payableFarmers, code: "2010" },
    { label: "Staff ko dena", value: trail.payableStaff, code: "2020" },
    { label: "Wallet ka bojh", value: trail.walletLiability, code: "2040" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Money Trail — Paisa Kahan Hai"
        description="Har adad seedha journal ki qataron se ginta hai. Koi alag rakha hua balance nahi."
      />

      {/* ---- Sehat ka ek hi adad ---- */}
      <Card
        className={`p-4 ${
          trail.balanced
            ? "border-l-4 border-l-green-500"
            : "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {trail.balanced ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {trail.balanced
                ? "Khate barabar hain — Debit = Credit"
                : `Khate barabar NAHI — farq ${rs(Math.abs(trail.difference))}`}
            </p>
            <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
              Debit {rs(tb.totalDebit)} • Credit {rs(tb.totalCredit)}
              {trail.balanced
                ? " — har entry par taala laga hua hai, is liye ye hamesha barabar rehna chahiye."
                : " — ye kisi ke paisa lene ka nishan nahi, balke is baat ka ke system mein kuch bunyadi tor par toota hai. Foran batayein."}
            </p>
          </div>
        </div>
      </Card>

      {/* ---- Paisa kahan hai ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
          Paisa is waqt kahan hai
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {where.map((item) => (
            <Link key={item.code} href={`/admin/money-trail?account=${item.code}`}>
              <Card className={`h-full p-4 transition hover:border-brand-400 ${openAccount === item.code ? "ring-2 ring-brand-500" : ""}`}>
                <p className="text-xs text-surface-500">{item.label}</p>
                <p className="mt-1 text-xl font-semibold text-surface-900 dark:text-white">{rs(item.value)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ---- Kis ka dena hai ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Hum ne dena hai</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {owed.map((item) => (
            <Link key={item.code} href={`/admin/money-trail?account=${item.code}`}>
              <Card className={`h-full p-4 transition hover:border-brand-400 ${openAccount === item.code ? "ring-2 ring-brand-500" : ""}`}>
                <p className="text-xs text-surface-500">{item.label}</p>
                <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-500">{rs(item.value)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {trail.suspense !== 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{rs(trail.suspense)}</strong> aisi raqam hai jis ki wajah abhi maloom nahi (Suspense).
              <br />
              Ye kahin chhupayi nahi jati — jab tak wajah nahi milti, yahin nazar aati rahegi.
            </span>
          </p>
        </Card>
      )}

      {/* ---- Ek khate ka poora silsila ---- */}
      {openAccount && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
              <Wallet className="h-4 w-4" />
              {tb.rows.find((r) => r.code === openAccount)?.name ?? openAccount} — poora silsila
            </h3>
            <Link href="/admin/money-trail" className="text-xs text-surface-500 underline">
              band karein
            </Link>
          </div>
          {ledger.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-surface-400">Is khate mein abhi koi qatar nahi.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
                  <tr>
                    <th className="px-4 py-2 font-medium">Number</th>
                    <th className="px-4 py-2 font-medium">Tareekh</th>
                    <th className="px-4 py-2 font-medium">Tafseel</th>
                    <th className="px-4 py-2 text-right font-medium">Aaya</th>
                    <th className="px-4 py-2 text-right font-medium">Gaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {ledger.map((line, i) => (
                    <tr key={`${line.entryNumber}-${i}`} className={line.isReversal ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <td className="px-4 py-2 font-mono text-xs text-surface-500">{line.entryNumber}</td>
                      <td className="px-4 py-2 text-xs text-surface-500">{line.entryDate}</td>
                      <td className="px-4 py-2 text-surface-800 dark:text-surface-200">
                        {line.description}
                        {line.isReversal && <span className="ml-1 text-xs text-amber-700">(ulti gayi)</span>}
                        <span className="block text-xs text-surface-400">{line.sourceModule}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-green-700 dark:text-green-400">
                        {line.debit > 0 ? rs(line.debit) : ""}
                      </td>
                      <td className="px-4 py-2 text-right text-red-700 dark:text-red-400">
                        {line.credit > 0 ? rs(line.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <p className="px-1 text-xs text-surface-400">
        Koi bhi financial entry mitayi nahi ja sakti — ghalti reversal se theek hoti hai, aur dono qataren
        hamesha nazar aati hain. Ye rok database mein hai.
      </p>
    </div>
  );
}
