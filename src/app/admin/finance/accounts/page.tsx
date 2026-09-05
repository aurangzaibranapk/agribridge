import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { trialBalance } from "@/lib/ledger/statements";
import { ArrowLeft } from "lucide-react";
import { AccountsClient } from "./accounts-client";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Khaton ki fehrist.
 *
 * Har khate ka baqi wahi `trialBalance` deta hai jo gosharay banata hai
 * -- yahan alag se gina nahi jata. Do jagah do adad ban jane ka sab se
 * aam raasta yehi hota hai: "chhoti si" ginti safhe par likh dena.
 */
export default async function ChartOfAccountsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !VIEW_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("coa_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const aaj = new Date().toISOString().slice(0, 10);

  const [{ data: accounts, error }, tb] = await Promise.all([
    service.from("gl_accounts").select("code, name, account_type, normal_side, is_active, is_contra, sort_order").order("sort_order"),
    trialBalance("1900-01-01", aaj),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("coa_title", lang)} />
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("coa_load_error", lang)}: {error.message}
        </Card>
      </div>
    );
  }

  // Baqi na mil sake to har khate ke saamne "—" jayega, sifar nahi.
  // Sifar kehta hai "dekh liya, kuch nahi"; yahan dekha hi nahi ja saka.
  const balances = tb.error ? null : new Map(tb.rows.map((r) => [r.code, r.balance]));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("coa_title", lang)}
        description={t("coa_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("coa_back", lang)}
          </Link>
        }
      />

      {tb.error && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          {t("coa_balance_error", lang)}: {tb.error}
        </Card>
      )}

      <AccountsClient
        lang={lang}
        canEdit={RUN_ROLES.includes(me.role)}
        accounts={(accounts ?? []).map((a) => ({
          code: a.code as string,
          name: a.name as string,
          type: a.account_type as string,
          side: a.normal_side as string,
          active: a.is_active as boolean,
          contra: (a.is_contra as boolean | null) ?? false,
          sort: Number(a.sort_order),
          balance: balances ? (balances.get(a.code as string) ?? 0) : null,
        }))}
      />
    </div>
  );
}
