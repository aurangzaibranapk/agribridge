import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { KhataClient } from "@/components/khata/khata-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function KhataPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: dealer } = await supabase
    .from("dealers")
    .select("id, business_name")
    .eq("user_id", user.id)
    .single();

  if (!dealer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">{t("at_no_dealer_profile", lang)}</p>
      </div>
    );
  }

  const { data: accounts } = await supabase
    .from("khata_accounts")
    .select("id, customer_id, current_balance, dealer_customers(name, phone)")
    .eq("dealer_id", dealer.id)
    .order("current_balance", { ascending: false });

  const normalized = (accounts ?? []).map((a: any) => ({
    id: a.id,
    customer_id: a.customer_id,
    current_balance: a.current_balance,
    customer: Array.isArray(a.dealer_customers) ? a.dealer_customers[0] ?? null : a.dealer_customers ?? null,
  }));

  return <KhataClient dealerName={dealer.business_name} accounts={normalized} />;
}
