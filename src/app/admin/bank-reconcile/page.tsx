import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ImportForm, BookLineForm } from "./bank-client";
import { bankComparison, unmatchedBankLines } from "@/lib/ledger/handover";
import { AlertTriangle, CheckCircle2, Landmark } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "finance"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function BankReconcilePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return (
      <div className="p-8 text-center text-surface-400">
        Ye safha sirf Finance aur Admin ke liye hai — bank statement wohi dekhte hain.
      </div>
    );
  }

  const [{ data: accountRows }, compare, unmatched] = await Promise.all([
    supabase.from("finance_accounts").select("id, name").eq("account_type", "bank").order("name"),
    bankComparison(),
    unmatchedBankLines(100),
  ]);

  const accounts = (accountRows ?? []).map((a) => ({ id: a.id, name: a.name }));
  const hasData = compare.perBank !== 0 || compare.perBooks !== 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bank se Milaan"
        description="Bank kabhi ghalat nahi hota — wo paisa asal mein rakhta hai. Farq hamesha hamari taraf hota hai."
      />

      {/* ---- Milaan ka nateeja ---- */}
      <Card
        className={`p-4 ${
          !hasData
            ? "border-l-4 border-l-surface-300"
            : compare.matched
              ? "border-l-4 border-l-green-500"
              : "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {compare.matched && hasData ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle
              className={`mt-0.5 h-5 w-5 shrink-0 ${hasData ? "text-red-600" : "text-surface-400"}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {!hasData
                ? "Abhi milaan ke liye kuch nahi"
                : compare.matched
                  ? "Bank aur hamara khata barabar hain"
                  : `Farq ${rs(Math.abs(compare.difference))}`}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-surface-200 px-3 py-2 dark:border-surface-800">
                <p className="text-xs text-surface-500">Bank ke mutabiq</p>
                <p className="mt-0.5 font-medium tabular-nums text-surface-900 dark:text-white">
                  {rs(compare.perBank)}
                </p>
              </div>
              <div className="rounded-lg border border-surface-200 px-3 py-2 dark:border-surface-800">
                <p className="text-xs text-surface-500">Hamare khate ke mutabiq</p>
                <p className="mt-0.5 font-medium tabular-nums text-surface-900 dark:text-white">
                  {rs(compare.perBooks)}
                </p>
              </div>
              <div className="rounded-lg border border-surface-200 px-3 py-2 dark:border-surface-800">
                <p className="text-xs text-surface-500">Farq</p>
                <p
                  className={`mt-0.5 font-medium tabular-nums ${
                    compare.difference === 0
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {rs(compare.difference)}
                </p>
              </div>
            </div>
            {!compare.matched && hasData && (
              <p className="mt-2 text-xs text-surface-600 dark:text-surface-400">
                Farq ki wajah neeche wali fehrist mein hoti hai: wo qataren jo bank ke paas hain magar
                hamare khate mein nahi. Har ek ki entry bana dein, farq khud sifar ho jayega.
              </p>
            )}
          </div>
        </div>
      </Card>

      {compare.accounts.length > 1 && (
        <Card className="p-4">
          <p className="text-xs text-surface-600 dark:text-surface-400">
            Milaan sab banks ka <strong>mila kar</strong> hai, har bank ka alag nahi — kyunki ledger mein
            teenon banks ek hi khate (1010) mein jate hain. Har bank ka apna adad chahiye to har account
            ko apna GL khata dena parega.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {compare.accounts.map((a) => (
              <span
                key={a.accountId}
                className="rounded-md border border-surface-200 px-2 py-1 text-xs dark:border-surface-800"
              >
                <span className="text-surface-500">{a.accountName}</span>
                <span className="ml-1.5 font-medium tabular-nums text-surface-900 dark:text-white">
                  {rs(a.perBank)}
                </span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
            <Landmark className="h-4 w-4" /> Statement daalein
          </h2>
          <ImportForm accounts={accounts} />
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">
              Bank ke paas hain, hamare khate mein nahi
            </h2>
            <p className="mt-0.5 text-xs text-surface-500">
              Bank charges, munafa, ya koi adaigi jo kisi ne likhi hi nahi. In ko &quot;chhota sa hai&quot;
              keh kar chhorna hi wo tareeqa hai jis se bank aur khata dheere dheere alag hote chale jate
              hain.
            </p>
          </div>
          {unmatched.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-green-700 dark:text-green-400">
              Bank ki har qatar hamare khate mein maujood hai.
            </p>
          ) : (
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {unmatched.map((l) => (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-surface-800 dark:text-surface-200">
                        {l.description}
                      </p>
                      <p className="text-xs text-surface-400">
                        {l.txnDate} • {l.accountName}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-medium tabular-nums ${
                        l.amount > 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {l.amount > 0 ? "+" : "−"}
                      {rs(Math.abs(l.amount))}
                    </span>
                  </div>
                  <div className="mt-2">
                    <BookLineForm lineId={l.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
