import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LivestockForm } from "./livestock-form";
import LivestockChart from "./LivestockChart";
import { LivestockDetailsForm } from "./livestock-details-form";
import { checkProfileComplete } from "@/lib/utils/profile-gate";
import { ProfileGateMessage } from "@/components/portal/profile-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export default async function LivestockServicePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("*").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  if (!checkProfileComplete(farmer)) {
    return <ProfileGateMessage />;
  }
  const { data: loans } = await supabase
    .from("livestock_loans")
    .select("cow_count, buffalo_count, goat_count, loan_amount, outstanding_amount, repayment_type, created_at")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });
  const totals = (loans ?? []).reduce(
    (acc, l) => {
      acc.cow += l.cow_count || 0;
      acc.buffalo += l.buffalo_count || 0;
      acc.goat += l.goat_count || 0;
      return acc;
    },
    { cow: 0, buffalo: 0, goat: 0 }
  );
  const chartData = [
    { animal: t("animal_cow", lang), count: totals.cow },
    { animal: t("animal_buffalo", lang), count: totals.buffalo },
    { animal: t("animal_goat", lang), count: totals.goat },
  ].filter((d) => d.count > 0);
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        {t("back_to_dashboard", lang)}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("livestock_title", lang)}</h1>
      <p className="mt-1 text-sm text-surface-500">{t("livestock_subtitle", lang)}</p>
      <div className="mt-6">
        <LivestockDetailsForm farmer={farmer} />
      </div>
      <h2 className="mt-6 font-display text-lg font-semibold text-surface-900">{t("livestock_loan_request", lang)}</h2>
      <div className="mt-3">
        <LivestockForm />
      </div>
      <LivestockChart data={chartData} />
      <h2 className="mt-8 font-display text-lg font-semibold text-surface-900">{t("past_requests", lang)}</h2>
      <div className="mt-3 space-y-2">
        {!loans || loans.length === 0 ? (
          <p className="rounded-card border border-dashed border-surface-200 bg-white p-6 text-center text-sm text-surface-400">
            {t("no_requests_yet", lang)}
          </p>
        ) : (
          loans.map((l, i) => (
            <div key={i} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 text-sm">
              <span className="font-medium text-surface-900">
                {l.cow_count ? `${l.cow_count} ${t("animal_cow", lang)}` : ""} {l.buffalo_count ? `${l.buffalo_count} ${t("animal_buffalo", lang)}` : ""} {l.goat_count ? `${l.goat_count} ${t("animal_goat", lang)}` : ""}
              </span>
              <span className="text-surface-500">Rs. {l.loan_amount?.toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}