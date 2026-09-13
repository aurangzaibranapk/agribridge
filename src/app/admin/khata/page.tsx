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

  // Dealer nahi hai to ye safha KHATAM nahi hota -- gahak ke khate par
  // le jata hai.
  //
  // Malik (6 September) ne staff ke login se "Customer Ledger" khola aur
  // jawab mila: "This account is not linked to a dealer." Menu par likha
  // tha "Customer Ledger", aur andar dealer ka module tha -- do alag
  // cheezein ek naam ke neeche.
  //
  // Dukan ke staff ke liye "gahak ka khata" ka matlab CRM hai (wahan har
  // gahak ka baqi aur us ka poora statement khulta hai). Dealer ka khata
  // sirf DEALER ke liye hai, aur wo apni jagah chal raha hai.
  //
  // Marne wala safha dikhane se behtar hai bande ko wahan bhej dena
  // jahan wo kaam waqai hota hai.
  if (!dealer) {
    redirect("/admin/crm");
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
