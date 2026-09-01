import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BranchCreditClient } from "./branch-credit-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function BranchCreditPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
  const { data: accounts } = await supabase.from("branch_credit_accounts").select("branch_id, credit_limit");
  const { data: transactions } = await supabase.from("branch_credit_transactions").select("branch_id, transaction_type, amount, created_at").order("created_at", { ascending: false });

  const limitMap = new Map((accounts ?? []).map((a) => [a.branch_id, Number(a.credit_limit)]));

  const branchesWithCredit = (branches ?? []).map((b) => {
    const branchTxns = (transactions ?? []).filter((t) => t.branch_id === b.id);
    const advancePaid = branchTxns.filter((t) => t.transaction_type === "advance_payment").reduce((s, t) => s + Number(t.amount), 0);
    const orderCharges = branchTxns.filter((t) => t.transaction_type === "order_charge").reduce((s, t) => s + Number(t.amount), 0);
    const adjustments = branchTxns
      .filter((t) => t.transaction_type === "adjustment" || t.transaction_type === "refund")
      .reduce((s, t) => s + Number(t.amount), 0);

    const creditLimit = limitMap.get(b.id) ?? 0;
    const outstanding = orderCharges - advancePaid - adjustments;
    const availableCredit = creditLimit - outstanding;

    return {
      id: b.id,
      name: b.name,
      creditLimit,
      advancePaid,
      orderCharges,
      outstanding,
      availableCredit,
      recentTransactions: branchTxns.slice(0, 5).map((t) => ({
        transaction_type: t.transaction_type,
        amount: Number(t.amount),
        created_at: t.created_at,
      })),
    };
  });

  return (
    <div>
      <PageHeader title={t("bc_title", lang)} description="Har shop ka credit limit set karein, advance payment record karein" />
      <BranchCreditClient branches={branchesWithCredit} />
    </div>
  );
}