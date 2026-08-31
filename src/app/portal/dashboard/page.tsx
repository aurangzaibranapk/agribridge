import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Sprout,
  Landmark,
  Tractor,
  ArrowRight,
  Clock,
  MapPin,
  Phone,
  Wheat,
  LandPlot,
  ClipboardList,
  ShoppingBag,
  Store,
  Wallet,
  Warehouse,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeProfileCompletion } from "@/lib/utils/farmer-profile";
import { ActivityTrendChart, ServiceBreakdownChart } from "@/components/dashboard/dashboard-charts";
import { WeatherStatCard } from "@/components/dashboard/weather-widget";
import { ForecastWidget } from "@/components/dashboard/forecast-widget";
import { getMachineryReminders, MachineryReminderBanner } from "@/components/portal/machinery-reminder";
import { getWateringReminders, WateringReminderBanner } from "@/components/portal/watering-reminder";
import { ExpenseStatement } from "@/components/portal/expense-statement";
import { computeFarmerCreditScore } from "@/lib/utils/credit-score";
import { CreditScoreCard } from "@/components/portal/credit-score-card";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export default async function FarmerDashboardPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase.from("farmers").select("*").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  const completion = computeProfileCompletion(farmer);

  const { data: categories } = await supabase.from("service_categories").select("category").eq("farmer_id", farmer.id);
  const activeCategories = new Set((categories ?? []).map((c) => c.category));

  const { data: machineryRequests } = await supabase
    .from("machinery_requests")
    .select("machine_type, machine_type_other, acres, expected_date, created_at")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });

  const { data: fertilizerRequests } = await supabase
    .from("fertilizer_requests")
    .select("crop_type, cultivation_date, created_at")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });

  const { data: livestockLoans } = await supabase
    .from("livestock_loans")
    .select("cow_count, buffalo_count, goat_count, loan_amount, outstanding_amount, created_at")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });

  const { data: farms } = await supabase.from("farms").select("id").eq("farmer_id", farmer.id);
  const farmIds = (farms ?? []).map((f) => f.id);

  const { data: crops } = farmIds.length
    ? await supabase.from("crop_history").select("id, crop_name, sowing_date, expected_harvest_date, farms(name)").in("farm_id", farmIds)
    : { data: [] };

  const machineryReminders = getMachineryReminders(crops ?? []);
  const wateringReminders = getWateringReminders(crops ?? []);

  const { data: harvests } = farmIds.length
    ? await supabase
        .from("harvest_records")
        .select("id, quantity_harvested, sale_rate, total_expense")
        .in("farm_id", farmIds)
    : { data: [] };

  const farmsCount = farms?.length ?? 0;
  const cropsCount = crops?.length ?? 0;
  const harvestCount = harvests?.length ?? 0;

  const harvestProfit = (harvests ?? []).reduce((sum, h) => {
    if (h.sale_rate !== null && h.total_expense !== null) {
      return sum + (h.quantity_harvested * h.sale_rate - h.total_expense);
    }
    return sum;
  }, 0);

  const cropIds = (crops ?? []).map((c) => c.id);
  const { data: allExpenses } = cropIds.length
    ? await supabase.from("crop_expenses").select("expense_category, amount").in("crop_history_id", cropIds)
    : { data: [] };
  const categoryTotalsMap: Record<string, number> = {};
  (allExpenses ?? []).forEach((e) => {
    categoryTotalsMap[e.expense_category] = (categoryTotalsMap[e.expense_category] ?? 0) + Number(e.amount);
  });
  const categoryTotals = Object.entries(categoryTotalsMap).map(([category, amount]) => ({ category, amount }));
  const totalExpenseAllCrops = Object.values(categoryTotalsMap).reduce((sum, v) => sum + v, 0);
  const totalRevenueAllHarvests = (harvests ?? []).reduce((sum, h) => {
    return h.sale_rate !== null ? sum + h.quantity_harvested * h.sale_rate : sum;
  }, 0);

  const { data: verifiedFarm } = await supabase.from("farms").select("id").eq("farmer_id", farmer.id).eq("is_verified", true).limit(1).maybeSingle();
  const { data: creditLedgerRows } = await supabase.from("farmer_credit_ledger").select("ledger_type, amount").eq("farmer_id", farmer.id);
  const totalCreditIssued = (creditLedgerRows ?? []).filter((r) => r.ledger_type === "debit").reduce((sum, r) => sum + Number(r.amount), 0);
  const totalCreditRepaid = (creditLedgerRows ?? []).filter((r) => r.ledger_type === "credit").reduce((sum, r) => sum + Number(r.amount), 0);

  // Saboot ki ginti -- score dikhane se pehle.
  //
  // Ye wo kaam hain jo kisan ke naam par WAQAI hue aur jin par kisi na
  // kisi taur par tasdeeq ka nishan hai: tasdeeq shuda doodh, wo booking
  // jis ka rate kisan ne khud maan liya, aur udhaar ke khate ki har
  // qatar (wo bina kisi ke darj kiye banti hi nahi).
  //
  // Fasal aur kattai ka record yahan jaan boojh kar nahi gina gaya: wo
  // kisan apne liye khud likhta hai, aur us par kisi doosre ki tasdeeq
  // nahi hoti. Us se score ka saboot banana bande ko apna hi darja
  // barhane ka raasta de deta.
  const [{ count: verifiedMilkCount }, { count: confirmedBookingCount }] = await Promise.all([
    supabase
      .from("milk_entries")
      .select("id", { count: "exact", head: true })
      .eq("farmer_id", farmer.id)
      .not("verified_at", "is", null),
    supabase
      .from("machinery_bookings")
      .select("id", { count: "exact", head: true })
      .eq("farmer_id", farmer.id)
      .not("farmer_confirmed_at", "is", null),
  ]);

  const meaningfulEventCount =
    (verifiedMilkCount ?? 0) + (confirmedBookingCount ?? 0) + (creditLedgerRows?.length ?? 0);

  const relationshipDays = farmer.created_at
    ? Math.floor((Date.now() - new Date(farmer.created_at).getTime()) / 86_400_000)
    : 0;

  const creditScore = computeFarmerCreditScore({
    profileComplete: completion.isComplete,
    hasVerifiedFarm: !!verifiedFarm,
    totalCreditIssued,
    totalCreditRepaid,
    harvestRecordCount: harvestCount,
    cropCount: cropsCount,
    relationshipDays,
    meaningfulEventCount,
  });

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("owner_type", "farmer")
    .eq("owner_id", farmer.id)
    .single();
  const walletBalance = Number(wallet?.balance ?? 0);

  const cropCounts: Record<string, number> = {};
  (crops ?? []).forEach((c) => {
    cropCounts[c.crop_name] = (cropCounts[c.crop_name] ?? 0) + 1;
  });
  const cropBreakdown = Object.entries(cropCounts).map(([service, count]) => ({ service, count }));

  type Activity = { type: "machinery" | "fertilizer" | "livestock"; label: string; detail: string; date: string };
  const activity: Activity[] = [
    ...(machineryRequests ?? []).map((r) => ({
      type: "machinery" as const,
      label: `Machinery: ${r.machine_type === "other" ? r.machine_type_other : r.machine_type}`,
      detail: r.acres ? `${r.acres} acres - Needed by ${r.expected_date}` : `Needed by ${r.expected_date}`,
      date: r.created_at,
    })),
    ...(fertilizerRequests ?? []).map((r) => ({
      type: "fertilizer" as const,
      label: `Fertilizer for ${r.crop_type}`,
      detail: `Cultivation date: ${r.cultivation_date}`,
      date: r.created_at,
    })),
    ...(livestockLoans ?? []).map((r) => ({
      type: "livestock" as const,
      label: `Livestock Loan: PKR ${r.loan_amount?.toLocaleString()}`,
      detail: `Animals: ${r.cow_count + r.buffalo_count + r.goat_count} - Outstanding: PKR ${r.outstanding_amount?.toLocaleString()}`,
      date: r.created_at,
    })),
  ];
  activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allDates: string[] = [
    ...(machineryRequests ?? []).map((r) => r.created_at),
    ...(fertilizerRequests ?? []).map((r) => r.created_at),
    ...(livestockLoans ?? []).map((r) => r.created_at),
  ];

  const monthLabels: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(d.toLocaleString("default", { month: "short" }));
  }

  const trendData = monthLabels.map((label, idx) => {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const count = allDates.filter((dateStr) => {
      const d = new Date(dateStr);
      return d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth();
    }).length;
    return { month: label, requests: count };
  });

  const serviceBreakdown = [
    { service: "Machinery", count: machineryRequests?.length ?? 0 },
    { service: "Fertilizer", count: fertilizerRequests?.length ?? 0 },
    { service: "Livestock", count: livestockLoans?.length ?? 0 },
  ];

  const initials = (farmer.full_name ?? "F")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        {t("back_to_website", lang)}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">
        {t("welcome", lang)}{farmer.full_name ? `, ${farmer.full_name}` : ""}
      </h1>
      <p className="mt-1 text-surface-500">{t("farmer_code", lang)}: {farmer.farmer_code}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <WateringReminderBanner reminders={wateringReminders} />
          <MachineryReminderBanner reminders={machineryReminders} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-5">
            <Link href="/portal/profile">
              <StatCard
                color={completion.isComplete ? "green" : "red"}
                icon={completion.isComplete ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                label={t("profile", lang)}
                value={completion.isComplete ? t("complete", lang) : `${completion.percent}%`}
              />
            </Link>
            <Link href="/portal/wallet">
              <StatCard color="cyan" icon={<Wallet className="h-5 w-5" />} label={t("my_wallet_stat", lang)} value={`Rs ${walletBalance.toLocaleString()}`} />
            </Link>
            <Link href="/portal/farms">
              <StatCard color="teal" icon={<LandPlot className="h-5 w-5" />} label={t("my_farms_stat", lang)} value={String(farmsCount)} />
            </Link>
            <Link href="/portal/crops">
              <StatCard color="lime" icon={<Wheat className="h-5 w-5" />} label={t("my_crops_stat", lang)} value={String(cropsCount)} />
            </Link>
            <Link href="/portal/harvest">
              <StatCard
                color={harvestProfit >= 0 ? "green" : "red"}
                icon={<Warehouse className="h-5 w-5" />}
                label={t("harvest_profit", lang)}
                value={harvestCount === 0 ? "-" : `Rs ${harvestProfit.toLocaleString()}`}
              />
            </Link>
            <Link href="/portal/services/machinery">
              <StatCard color="blue" icon={<Tractor className="h-5 w-5" />} label={t("machinery_stat", lang)} value={String(machineryRequests?.length ?? 0)} />
            </Link>
            <Link href="/portal/services/fertilizer">
              <StatCard color="amber" icon={<Sprout className="h-5 w-5" />} label={t("fertilizer_stat", lang)} value={String(fertilizerRequests?.length ?? 0)} />
            </Link>
            <Link href="/portal/services/livestock">
              <StatCard color="purple" icon={<Landmark className="h-5 w-5" />} label={t("livestock_stat", lang)} value={String(livestockLoans?.length ?? 0)} />
            </Link>
            <WeatherStatCard district={farmer.district} />
          </div>

          <div className="mt-6">
            <CreditScoreCard result={creditScore} />
          </div>

          <div className="mt-6">
            <ExpenseStatement
              categoryTotals={categoryTotals}
              totalExpense={totalExpenseAllCrops}
              totalRevenue={totalRevenueAllHarvests}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <ActivityTrendChart data={trendData} />
            <ServiceBreakdownChart data={serviceBreakdown} />
          </div>

          {cropBreakdown.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4">
              <ServiceBreakdownChart data={cropBreakdown} />
            </div>
          )}

          <div className="mt-6">
            <ForecastWidget fixedDistrict={farmer.district} title={`${farmer.district ?? "Aapka"} - 5 Din Ka Mausam`} />
          </div>

          <h2 className="mt-8 font-display text-lg font-semibold text-surface-900">{t("recent_activity", lang)}</h2>
          <p className="mt-1 text-sm text-surface-500">{t("activity_subtitle", lang)}</p>
          <div className="mt-3 space-y-2">
            {activity.length === 0 ? (
              <p className="rounded-card border border-dashed border-surface-200 bg-white p-6 text-center text-sm text-surface-400">
                {t("no_activity_yet", lang)}
              </p>
            ) : (
              activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-card border border-surface-200 bg-white p-4 shadow-card">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    {a.type === "machinery" && <Tractor className="h-4 w-4" />}
                    {a.type === "fertilizer" && <Sprout className="h-4 w-4" />}
                    {a.type === "livestock" && <Landmark className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900">{a.label}</p>
                    <p className="text-xs text-surface-500">{a.detail}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-surface-400">
                    <Clock className="h-3 w-3" />
                    {new Date(a.date).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-surface-200 bg-white p-5 text-center shadow-card">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
              {initials}
            </div>
            <p className="mt-3 font-display text-base font-semibold text-surface-900">{farmer.full_name ?? "Farmer"}</p>
            <p className="text-xs text-surface-500">{farmer.farmer_code}</p>

            <div className="mt-4 space-y-2 border-t border-surface-100 pt-4 text-left">
              <div className="flex items-center gap-2 text-sm text-surface-600">
                <MapPin className="h-4 w-4 text-surface-400" />
                {farmer.district ?? t("district_not_set", lang)}
              </div>
              <div className="flex items-center gap-2 text-sm text-surface-600">
                <Phone className="h-4 w-4 text-surface-400" />
                {farmer.mobile ?? farmer.phone_number ?? t("mobile_not_set", lang)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
            <h3 className="mb-3 text-sm font-semibold text-surface-900">{t("quick_links", lang)}</h3>
            <div className="space-y-2">
              <Link
                href="/portal/wallet"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-surface-700 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> {t("my_wallet_stat", lang)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/portal/sell-produce"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50"
              >
                <span className="flex items-center gap-2">
                  <Wheat className="h-4 w-4" /> {t("sell_produce", lang)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/portal/marketplace"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
              >
                <span className="flex items-center gap-2">
                  <Store className="h-4 w-4" /> {t("marketplace", lang)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/portal/orders"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-surface-700 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> {t("place_order_bridge", lang)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/portal/crops"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-surface-700 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <span className="flex items-center gap-2">
                  <Wheat className="h-4 w-4" /> {t("my_crops_stat", lang)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/portal/farms"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-surface-700 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <span className="flex items-center gap-2">
                  <LandPlot className="h-4 w-4" /> {t("my_farms_stat", lang)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/portal/harvest"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-surface-700 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> {t("harvest_link", lang)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  green: "from-emerald-400 to-emerald-600",
  red: "from-rose-400 to-rose-600",
  blue: "from-sky-400 to-blue-600",
  amber: "from-amber-400 to-orange-500",
  purple: "from-violet-400 to-purple-600",
  teal: "from-teal-400 to-cyan-600",
  lime: "from-lime-400 to-green-600",
  cyan: "from-cyan-400 to-teal-500",
};

function StatCard({ color, icon, label, value }: { color: string; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className={`relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${COLOR_MAP[color]} p-5 text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
    </div>
  );
}