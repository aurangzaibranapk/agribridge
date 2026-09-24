import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { CrmClient } from "@/app/admin/crm/crm-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminCrmPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [
    { data: customers },
    { data: suppliers },
    { data: companies },
    { data: dealers },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, contact_person, phone_number, email, address, credit_limit, payment_due_days, current_balance, is_active")
      .eq("is_deleted", false)
      .order("name"),
    supabase.from("suppliers").select("id, name, contact_person, phone_number, current_payable").eq("is_active", true).order("name"),
    supabase.from("companies").select("id, name, contact_person, phone_number").order("name"),
    supabase.from("dealers").select("id, business_name, district, verification_status, current_payable").order("business_name"),
  ]);

  return (
    <div>
      <PageHeader title={t("cr_title", lang)} description="Customers, Suppliers, Companies, and Dealers in one place" />
      <CrmClient
        customers={(customers ?? []).map((c) => ({
          ...c,
          current_balance: Number(c.current_balance),
          credit_limit: Number(c.credit_limit),
          payment_due_days: Number(c.payment_due_days),
        }))}
        suppliers={(suppliers ?? []).map((s) => ({ ...s, current_payable: Number(s.current_payable) }))}
        companies={companies ?? []}
        dealers={(dealers ?? []).map((d) => ({ ...d, current_payable: Number(d.current_payable) }))}
      />
    </div>
  );
}