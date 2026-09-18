import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { DueSoon } from "@/components/purchases/due-soon";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { FinanceClient } from "@/app/admin/finance/finance-client";
import { trialBalance } from "@/lib/ledger/statements";
import { aajKaKhana } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const { data: accounts } = await supabase
    .from("finance_accounts")
    .select("id, name, account_type, gl_code, current_balance, opening_balance, bank_name, account_title, account_number")
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

  // Kis khate ka shuruati balance darj ho chuka hai. Ye sawal is safhe
  // par saaf nazar aana chahiye: jis khate ka shuru maloom hi nahi, us
  // ka "balance" asal balance nahi -- sirf us ke baad ki aamad-o-raft
  // hai. Wohi wajah hai ke UBL par Rs -11,370 likha aa raha tha.
  const { data: openingRows } = await supabase
    .from("finance_transactions")
    .select("account_id")
    .eq("category", "Shuruati balance");
  const openingDone = new Set((openingRows ?? []).map((r) => r.account_id as string));

  const { data: rawTransactions } = await supabase
    .from("finance_transactions")
    .select("id, account_id, transaction_type, category, amount, transaction_date, notes")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  // Balance ab seedha ledger se -- `current_balance` sirf un raqmon se
  // hilta hai jo `finance_transactions` (purani cash book) se guzarti
  // hain. Machinery ki payment, Load/Bill, POS jaisi adhiktar raqamein
  // seedha ledger (`journal_lines`) mein jati hain aur is column ko
  // kabhi chhoti hi nahi -- is liye Easypaisa jaisa khata mahinon purana
  // adad dikhata reh jata tha jabke paisa waqai aa chuka hota tha (18
  // September, Rs 40,000 ki machinery payment ka waqia).
  const tb = await trialBalance("1900-01-01", aajKaKhana());
  const ledgerBalance = new Map(tb.rows.map((r) => [r.code, r.balance]));

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
      <FinanceClient
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          account_type: a.account_type,
          current_balance:
            tb.error || !a.gl_code ? Number(a.current_balance) : ledgerBalance.get(a.gl_code) ?? 0,
          bank_name: a.bank_name,
          account_title: a.account_title,
          account_number: a.account_number,
          shuruatiDarj: openingDone.has(a.id) || Number(a.opening_balance) > 0,
        }))}
        transactions={transactions}
      />
    </div>
  );
}