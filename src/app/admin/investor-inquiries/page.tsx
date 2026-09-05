import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { formatDateTime } from "@/lib/utils/format";
import { InquiryStatusForm } from "@/app/admin/investor-inquiries/inquiry-status-form";
import { ConvertDealerButton } from "@/app/admin/investor-inquiries/convert-dealer-button";
import { ConvertInvestorButton } from "@/app/admin/investor-inquiries/convert-investor-button";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminInvestorInquiriesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: inquiries } = await supabase
    .from("investor_inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title={t("ii_title", lang)} description="Submissions from the /invest page" />
      {!inquiries || inquiries.length === 0 ? (
        <EmptyState title={t("ii_none_yet", lang)} />
      ) : (
        <div className="space-y-3">
          {inquiries.map((i) => (
            <div
              key={i.id}
              className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-surface-900 dark:text-white">
                    {i.name}{" "}
                    {i.interest_type && (
                      <Badge tone="blue" className="ml-2">
                        {i.interest_type}
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">
                    {[i.phone, i.email].filter(Boolean).join(" - ")} - {formatDateTime(i.created_at)}
                  </p>
                  {i.message && (
                    <p className="mt-2 text-sm text-surface-700 dark:text-surface-300">{i.message}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <InquiryStatusForm id={i.id} status={i.status} />
                  {i.interest_type === "corporation_deal" && (
                    <ConvertDealerButton
                      inquiryId={i.id}
                      suggestedName={i.name}
                      suggestedPhone={i.phone}
                      suggestedEmail={i.email}
                    />
                  )}
                  {["product_investment", "dairy_investment", "franchise", "other"].includes(i.interest_type) && (
                    <ConvertInvestorButton
                      inquiryId={i.id}
                      suggestedName={i.name}
                      suggestedPhone={i.phone}
                      suggestedEmail={i.email}
                      suggestedDealType={i.interest_type}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}