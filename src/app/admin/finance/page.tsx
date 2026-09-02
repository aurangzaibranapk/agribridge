import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { DueSoon } from "@/components/purchases/due-soon";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { FinanceClient } from "@/app/admin/finance/finance-client";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const { data: accounts } = await supabase
    .from("finance_accounts")
    .select("id, name, account_type, current_balance")
    .eq("is_active", true)
    .order("created_at");

  if (!accounts || accounts.length === 0) {
    return (
      <div>
        <PageHeader title={t("fn_title", lang)} description={t("fn_subtitle", lang)} />
        <EmptyState
          title={t("fn_no_accounts", lang)}
          description={t("fn_no_accounts_note", lang)}
        />
        <div className="mt-4">
          <FinanceClient accounts={[]} transactions={[]} />
        </div>
      </div>
    );
  }

  const { data: rawTransactions } = await supabase
    .from("finance_transactions")
    .select("id, account_id, transaction_type, category, amount, transaction_date, notes")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const transactions = (rawTransactions ?? []).map((t) => ({
    id: t.id,
    account_id: t.account_id,
    transaction_type: t.transaction_type,
    category: t.category,
    amount: Number(t.amount),
    transaction_date: t.transaction_date,
    notes: t.notes,
  }));

  return (
    <div>
      <PageHeader title={t("fn_title", lang)} description={t("fn_subtitle", lang)} />
      {/* Supplier ki adaigi ka calendar -- finance ko supplier se phone
          par poochhna na paRe (255). */}
      <div className="mb-4">
        <DueSoon lang={lang} compact />
      </div>
      <FinanceClient accounts={accounts} transactions={transactions} />
    </div>
  );
}