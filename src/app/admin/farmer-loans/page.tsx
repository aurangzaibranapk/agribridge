import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { FarmerLoansClient } from "./farmer-loans-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function FarmerLoansPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: farmers }, { data: rawLoans }] = await Promise.all([
    supabase.from("farmers").select("id, full_name, farmer_code").eq("is_deleted", false).order("full_name"),
    supabase
      .from("farmer_loans")
      .select("id, farmer_id, principal_amount, weekly_installment, outstanding_balance, status, notes, created_at, farmers(full_name, farmer_code)")
      .order("created_at", { ascending: false }),
  ]);

  const loans = (rawLoans ?? []).map((l: any) => {
    const farmer = Array.isArray(l.farmers) ? l.farmers[0] : l.farmers;
    return {
      id: l.id,
      farmer_id: l.farmer_id,
      farmer_name: farmer?.full_name ?? "-",
      farmer_code: farmer?.farmer_code ?? "-",
      principal_amount: Number(l.principal_amount),
      weekly_installment: Number(l.weekly_installment),
      outstanding_balance: Number(l.outstanding_balance),
      status: l.status,
      notes: l.notes,
      created_at: l.created_at,
    };
  });

  const totalDisbursed = loans.reduce((s, l) => s + l.principal_amount, 0);
  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding_balance, 0);
  const activeCount = loans.filter((l) => l.status === "active").length;
  const paidOffCount = loans.filter((l) => l.status === "paid_off").length;

  return (
    <div>
      <PageHeader title={t("at_farmer_loans", lang)} description="Farmer ko Loan dein - Wallet se Weekly Installment khud katta rahega" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_total_given", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalDisbursed.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">{t("at_total_remaining", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalOutstanding.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_active_loans", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{activeCount}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">{t("at_completed", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">{paidOffCount}</p>
        </Card>
      </div>

      <FarmerLoansClient farmers={farmers ?? []} loans={loans} />
    </div>
  );
}