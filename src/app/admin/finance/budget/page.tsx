import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { trialBalance } from "@/lib/ledger/statements";
import { ArrowLeft } from "lucide-react";
import { BudgetClient } from "./budget-client";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Budget aur us ke saamne asal.
 *
 * Muqable ka arsa saal ke shuru se aaj tak. Saalana adad us arse par
 * baant liya jata hai (mahinon ke hisaab se) -- ye TAKREEBAN hai, aur
 * safhe par saaf likha hai ke takreeban hai.
 */
export default async function BudgetPage({ searchParams }: { searchParams: { year?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !VIEW_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("bg_only_finance", lang)}</div>;
  }

  const ab = new Date();
  const year = Number(searchParams.year ?? ab.getFullYear());
  const shuru = `${year}-01-01`;
  const aaj = ab.toISOString().slice(0, 10);
  const khatam = year === ab.getFullYear() ? aaj : `${year}-12-31`;

  // Kitne mahine guzre -- saalana adad isi hisaab se baanta jata hai.
  const guzreMahine =
    year === ab.getFullYear() ? ab.getMonth() + 1 : year < ab.getFullYear() ? 12 : 0;

  const service = createServiceClient();
  const [{ data: accounts, error: accErr }, { data: budget }, tb] = await Promise.all([
    service
      .from("gl_accounts")
      .select("code, name, account_type")
      .eq("is_active", true)
      .in("account_type", ["income", "expense"])
      .order("sort_order"),
    service.from("budgets").select("id").eq("year", year).eq("name", "Saalana budget").maybeSingle(),
    trialBalance(shuru, khatam),
  ]);

  const { data: lines } = budget
    ? await service.from("budget_lines").select("account_code, annual_amount").eq("budget_id", budget.id)
    : { data: [] as { account_code: string; annual_amount: number }[] };

  const budgetBy = new Map((lines ?? []).map((l) => [l.account_code as string, Number(l.annual_amount)]));
  // Asal adad na mil sakein to NULL -- safhe par "—" jayega, sifar nahi.
  const asalBy = tb.error ? null : new Map(tb.rows.map((r) => [r.code, r.balance]));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("bg_title", lang)}
        description={t("bg_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("bg_back", lang)}
          </Link>
        }
      />

      {(accErr || tb.error) && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("bg_error", lang)}: {accErr?.message ?? tb.error}
        </Card>
      )}

      <BudgetClient
        lang={lang}
        canEdit={RUN_ROLES.includes(me.role)}
        year={year}
        monthsElapsed={guzreMahine}
        rows={(accounts ?? []).map((a) => ({
          code: a.code as string,
          name: a.name as string,
          type: a.account_type as string,
          budget: budgetBy.get(a.code as string) ?? null,
          actual: asalBy ? (asalBy.get(a.code as string) ?? 0) : null,
        }))}
      />
    </div>
  );
}
