import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResponseButtons } from "./response-buttons";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function JobOfferPage({ params }: { params: { token: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: offer } = await supabase
    .from("job_offers")
    .select("id, designation, proposed_salary, offer_message, status, branches(name), job_applications(full_name)")
    .eq("offer_token", params.token)
    .single();

  if (!offer) notFound();

  const branchName = Array.isArray(offer.branches) ? offer.branches[0]?.name : (offer.branches as any)?.name;
  const applicantName = Array.isArray(offer.job_applications) ? offer.job_applications[0]?.full_name : (offer.job_applications as any)?.full_name;

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-10">
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-lg">
        <div className="bg-[#1a1f36] px-6 py-6 text-center">
          <p className="font-display text-xl font-bold text-white">{t("sh_company", lang)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{t("sh_hero_title", lang)}</p>
        </div>

        <div className="p-6">
          <h1 className="font-display text-lg font-semibold text-surface-900">{t("ou_job_offer", lang)}</h1>
          <p className="mt-1 text-sm text-surface-500">Assalam-o-Alaikum {applicantName},</p>

          <div className="mt-4 space-y-2 rounded-lg bg-surface-50 p-4 text-sm">
            <p><strong>{t("ou_designation", lang)}</strong> {offer.designation}</p>
            {offer.proposed_salary && <p><strong>{t("ou_proposed_salary", lang)}</strong> Rs {Number(offer.proposed_salary).toLocaleString()}</p>}
            {branchName && <p><strong>{t("ou_shop_branch", lang)}</strong> {branchName}</p>}
            {offer.offer_message && <p className="mt-2 text-surface-600">{offer.offer_message}</p>}
          </div>

          <div className="mt-5">
            {offer.status === "pending" ? (
              <ResponseButtons token={params.token} />
            ) : (
              <p className="rounded-lg bg-surface-50 p-4 text-center text-sm text-surface-500">
                Is offer ka jawab pehle he diya ja chuka hai ({offer.status}).
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-surface-100 bg-surface-50 px-6 py-4 text-center">
          <p className="text-xs text-surface-500">alranatraders.pk &nbsp;|&nbsp; info@alranatraders.pk</p>
          <p className="mt-1 text-[11px] text-surface-400">© {new Date().getFullYear()} Al Rana Traders. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}