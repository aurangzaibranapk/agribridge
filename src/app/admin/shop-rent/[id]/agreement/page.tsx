import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { UrduAgreementTemplate } from "@/components/agreement/urdu-agreement-template";
import { AgreementAdminActions } from "./agreement-admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: agreement } = await supabase.from("shop_rent_agreements").select("*, branches(name, address)").eq("id", id).single();
  const { data: settings } = await supabase.from("company_billing_settings").select("company_stamp_url").limit(1).single();

  if (!agreement) {
    return <div className="p-8 text-center text-surface-400">Agreement nahi mila.</div>;
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
    <div>
      <PageHeader title="Rent Agreement" description={`${branch?.name ?? "Shop"} - ${agreement.landlord_name}`} />
      <AgreementAdminActions
        agreementId={agreement.id}
        signingToken={agreement.signing_token}
        hasCompanySignature={!!agreement.company_signature_data}
        hasLandlordSignature={!!agreement.landlord_signature_data}
      />
      <div className="mt-4 rounded-card border border-surface-200 shadow-card print:border-0 print:shadow-none">
        <UrduAgreementTemplate data={templateData} />
      </div>
    </div>
  );
}