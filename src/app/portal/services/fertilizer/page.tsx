import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreditRequestForm } from "./credit-request-form";
import { checkProfileComplete } from "@/lib/utils/profile-gate";
import { ProfileGateMessage } from "@/components/portal/profile-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
export default async function FertilizerRequestPage() {
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
  const { data: creditBalance } = await supabase
    .from("farmer_credit_balances")
    .select("balance_due")
    .eq("farmer_id", farmer.id)
    .single();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .in("name", ["Fertilizer", "Pesticide", "Seeds"]);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, mrp_price, selling_price, category_id")
    .eq("is_available", true)
    .eq("is_deleted", false)
    .order("name");
  const { data: rawRequests } = await supabase
    .from("credit_requests")
    .select("id, category, quantity, mrp_rate, base_amount, margin_percentage, total_amount, admin_comments, status, products(name)")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });
  const requests = (rawRequests ?? []).map((r: any) => ({
    ...r,
    quantity: Number(r.quantity),
    mrp_rate: Number(r.mrp_rate),
    base_amount: Number(r.base_amount),
    margin_percentage: Number(r.margin_percentage),
    total_amount: Number(r.total_amount),
    product_name: Array.isArray(r.products) ? r.products[0]?.name : r.products?.name,
  }));
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        {t("back_to_dashboard", lang)}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("fertilizer_title", lang)}</h1>
      <p className="mt-1 text-sm text-surface-500">{t("fertilizer_subtitle", lang)}</p>
      {creditBalance && Number(creditBalance.balance_due) !== 0 && (
        <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-700">{t("credit_balance_label", lang)}</p>
          <p className="text-lg font-semibold text-amber-900">Rs {Number(creditBalance.balance_due).toLocaleString()}</p>
        </div>
      )}
      <div className="mt-6">
        <CreditRequestForm categories={categories ?? []} products={products ?? []} requests={requests} />
      </div>
    </div>
  );
}