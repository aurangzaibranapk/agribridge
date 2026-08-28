import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import {
  moneyTrail,
  trialBalance,
  accountLedger,
  ledgerCoverage,
  unpostedRows,
  tableLabel,
} from "@/lib/ledger/money-trail";
import { AlertTriangle, CheckCircle2, Wallet, Link2Off } from "lucide-react";

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

  const [trail, tb, coverage, pending] = await Promise.all([
    moneyTrail(),
    trialBalance(),
    ledgerCoverage(),
    unpostedRows(25),
  ]);
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
            {trail.balanced && !coverage.complete && (
              <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-500">
                Magar &quot;barabar&quot; ka matlab &quot;poora&quot; nahi. {coverage.totalPending} entriyan
                ({rs(coverage.totalAmount)}) abhi ledger tak nahi pahunchin — neeche dekhein.
              </p>
            )}
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

      {/* ---- Jo ledger tak nahi pahuncha ---- */}
      <Card
        className={`p-4 ${
          coverage.complete
            ? "border-l-4 border-l-green-500"
            : "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {coverage.complete ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <Link2Off className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {coverage.complete
                ? "Har raqam ledger tak pahunch chuki hai"
                : `${coverage.totalPending} raqmein ledger tak nahi pahunchin — ${rs(coverage.totalAmount)}`}
            </p>
            <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
              Trial Balance hamesha barabar rehta hai, kyunki har entry par taala laga hai. Wo sirf ye
              batata hai ke JO likha gaya wo theek likha gaya — ye nahi ke sab kuch likha bhi gaya. Paisa
              isi farq mein se nikalta hai, is liye wo raqam yahan alag se ginti hai.
            </p>

            {!coverage.complete && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {coverage.rows.map((row) => (
                    <span
                      key={row.sourceTable}
                      className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs dark:border-amber-800 dark:bg-surface-900"
                    >
                      <span className="text-surface-600 dark:text-surface-300">{row.label}</span>
                      <span className="ml-1.5 font-semibold text-amber-800 dark:text-amber-400">
                        {row.pending} • {rs(row.pendingAmount)}
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="text-left text-surface-500">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Kahan se</th>
                        <th className="py-1 pr-3 font-medium">Qism</th>
                        <th className="py-1 pr-3 font-medium">Tafseel</th>
                        <th className="py-1 text-right font-medium">Raqam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
                      {pending.map((row) => (
                        <tr key={`${row.sourceTable}-${row.rowId}`}>
                          <td className="py-1.5 pr-3 text-surface-600 dark:text-surface-300">
                            {tableLabel(row.sourceTable)}
                          </td>
                          <td className="py-1.5 pr-3 text-surface-500">{row.kind}</td>
                          <td className="max-w-[260px] truncate py-1.5 pr-3 text-surface-700 dark:text-surface-200">
                            {row.detail}
                          </td>
                          <td className="py-1.5 text-right font-medium text-amber-800 dark:text-amber-400">
                            {rs(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {coverage.totalPending > pending.length && (
                    <p className="mt-2 text-xs text-surface-500">
                      … aur {coverage.totalPending - pending.length} aur.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

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
