import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/app/portal/orders/order-form";
import { checkFarmerVerification } from "@/lib/utils/verification-gate";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function FarmerOrdersPage() {
  const lang = getLanguageFromCookies("ur");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, district, tehsil")
    .eq("user_id", user.id)
    .single();
  if (!farmer) redirect("/login");

  const gate = await checkFarmerVerification(farmer.id);
  if (!gate.allowed) {
    return <VerificationGateMessage reason={gate.reason!} />;
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price")
    .eq("is_available", true)
    .eq("is_deleted", false)
    .order("name");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">{t("back_to_dashboard", lang)}</Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("pm_place_order", lang)}</h1>
      <p className="mt-1 text-surface-500">{t("pm_order_routed", lang)}</p>

      <div className="mt-6">
        <OrderForm
          products={products ?? []}
          farmerDistrict={farmer.district}
          farmerTehsil={farmer.tehsil}
        />
      </div>
    </div>
  );
}