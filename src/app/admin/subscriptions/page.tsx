import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SubscriptionAdminClient } from "./subscription-admin-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: settings }, { data: subscriptions }, { data: farmers }, { data: announcements }, { count: totalFarmers }] = await Promise.all([
    supabase.from("subscription_settings").select("*").eq("id", true).single(),
    supabase
      .from("farmer_subscriptions")
      .select("id, amount_paid, payment_method, start_date, end_date, status, receipt_photo_url, created_at, farmers(full_name, farmer_code)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("farmers").select("id, full_name, farmer_code").eq("is_deleted", false).order("full_name").limit(200),
    supabase.from("announcements").select("id, title, is_active, cta_type, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("farmers").select("id", { count: "exact", head: true }).eq("is_deleted", false),
  ]);

  const normalizedSubs = (subscriptions ?? []).map((s: any) => {
    const farmer = Array.isArray(s.farmers) ? s.farmers[0] : s.farmers;
    return {
      id: s.id,
      amountPaid: Number(s.amount_paid),
      paymentMethod: s.payment_method,
      startDate: s.start_date,
      endDate: s.end_date,
      status: s.status,
      receiptPhotoUrl: s.receipt_photo_url,
      createdAt: s.created_at,
      farmerName: farmer?.full_name ?? "-",
      farmerCode: farmer?.farmer_code ?? "-",
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const activeSubscriberIds = new Set(
    normalizedSubs.filter((s) => s.status === "active" && s.endDate >= today).map((s) => s.farmerCode)
  );
  const totalRevenue = normalizedSubs.reduce((sum, s) => sum + s.amountPaid, 0);
  const activeSubscribersCount = activeSubscriberIds.size;
  const nonSubscribedCount = Math.max(0, (totalFarmers ?? 0) - activeSubscribersCount);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const revenueThisMonth = normalizedSubs
    .filter((s) => s.createdAt.slice(0, 10) >= monthStart)
    .reduce((sum, s) => sum + s.amountPaid, 0);

  return (
    <div>
      <PageHeader title={t("at_subscriptions", lang)} description="Farmer Portal Subscription enforce karein aur Announcements bhejein" />
      <SubscriptionAdminClient
        settings={settings ?? { is_enforced: false, minimum_amount: 500 }}
        subscriptions={normalizedSubs}
        farmers={farmers ?? []}
        announcements={announcements ?? []}
        stats={{
          totalRevenue,
          revenueThisMonth,
          activeSubscribersCount,
          nonSubscribedCount,
          totalFarmers: totalFarmers ?? 0,
        }}
      />
    </div>
  );
}