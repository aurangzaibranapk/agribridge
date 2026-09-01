import { createServiceClient } from "@/lib/supabase/service";
import { UrduAgreementTemplate } from "@/components/agreement/urdu-agreement-template";
import { SignSection } from "./sign-section";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";

export const dynamic = "force-dynamic";

export default async function AgreementSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const serviceClient = createServiceClient();

  const { data: agreement } = await serviceClient
    .from("shop_rent_agreements")
    .select("*, branches(name, address)")
    .eq("signing_token", token)
    .single();

  const { data: settings } = await serviceClient.from("company_billing_settings").select("company_stamp_url").limit(1).single();

  if (!agreement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 p-4">
        <p className="text-surface-500">Ye link ghalat hai ya expire ho chuka hai.</p>
      </div>
    );
  }

  const branch = Array.isArray(agreement.branches) ? agreement.branches[0] : agreement.branches;

  const templateData = {
    branchName: branch?.name ?? "Shop",
    shopFullAddress: agreement.shop_full_address ?? branch?.address ?? null,
    shopSize: agreement.shop_size,
    landlordName: agreement.landlord_name,
    landlordCnic: agreement.landlord_cnic,
    monthlyRent: Number(agreement.monthly_rent),
    annualIncreasePercent: Number(agreement.annual_increase_percent ?? 0),
    dueDay: agreement.due_day,
    securityDeposit: Number(agreement.security_deposit ?? 0),
    durationYears: agreement.duration_years ?? 1,
    renewalYears: agreement.renewal_years ?? 1,
    agreementStartDate: agreement.agreement_start_date,
    bankAccountTitle: agreement.bank_account_title,
    bankName: agreement.bank_name,
    bankAccountNumber: agreement.bank_account_number,
    approvedUse: agreement.approved_use,
    companyRepName: agreement.company_rep_name,
    companyRepTitle: agreement.company_rep_title,
    witness1Name: agreement.witness1_name,
    witness1Cnic: agreement.witness1_cnic,
    witness2Name: agreement.witness2_name,
    witness2Cnic: agreement.witness2_cnic,
    landlordSignatureData: agreement.landlord_signature_data,
    landlordSignedAt: agreement.landlord_signed_at,
    companySignatureData: agreement.company_signature_data,
    companySignedAt: agreement.company_signed_at,
    companyStampUrl: settings?.company_stamp_url ?? null,
  };

  return (
    <div className="min-h-screen bg-surface-100 py-8">
      <UrduAgreementTemplate data={templateData} />
      {!agreement.landlord_signature_data && (
        <div className="mx-auto mt-4 max-w-3xl">
          <LangProvider lang={getLanguageFromCookies("ur")}>
            <SignSection token={token} />
          </LangProvider>
        </div>
      )}
      {agreement.landlord_signature_data && (
        <p className="mx-auto mt-4 max-w-3xl rounded-lg bg-green-50 p-4 text-center text-green-700" dir="rtl">
          آپ نے پہلے ہی دستخط کر دیے ہیں۔ شکریہ۔
        </p>
      )}
    </div>
  );
}