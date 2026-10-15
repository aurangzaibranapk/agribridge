import { redirect } from "next/navigation";
import { Award, Banknote, Medal, ShieldCheck, Target, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, PageHeader } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = new Set(["owner", "super_admin", "admin", "manager", "finance", "hr"]);
const EXCLUDED_REWARD_ROLES = new Set(["owner", "super_admin", "admin"]);
const VOID_STATUSES = new Set(["cancelled", "void", "voided", "returned", "refunded"]);

type Staff = { id: string; full_name: string; role: string };
type Reward = {
  id: string;
  profile_id: string;
  sale_date: string;
  threshold_amount: number;
  reward_amount: number;
  title: string;
  status: string;
  created_at: string;
};
type RewardRule = { threshold: number; reward: number; title: string };

function pakistanDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function monthBounds(today: string) {
  const [year, month] = today.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:00`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:00`,
  };
}

function money(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

export default async function StaffAchievementPage() {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const db = service as any;
  const { data: profile } = await service
    .from("profiles")
    .select("id,full_name,role,organization_id,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) redirect("/login");

  const isManager = MANAGER_ROLES.has(String(profile.role));
  const { data: staffRows, error: staffError } = isManager
    ? await service
        .from("profiles")
        .select("id,full_name,role")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("full_name")
    : await service.from("profiles").select("id,full_name,role").eq("id", user.id);
  if (staffError) throw new Error(staffError.message);

  const allStaff = ((staffRows ?? []) as Staff[]).filter((staff) => !EXCLUDED_REWARD_ROLES.has(String(staff.role)));
  const visibleStaff = isManager ? allStaff : ((staffRows ?? []) as Staff[]);
  const staffIds = visibleStaff.map((staff) => staff.id);
  const today = pakistanDate();
  const bounds = monthBounds(today);

  const [{ data: rules, error: rulesError }, rewardsResult, salesResult] = await Promise.all([
    db.from("staff_sales_reward_rules").select("id,threshold_amount,reward_amount,title,is_active").eq("is_active", true).gte("threshold_amount", 30000).order("threshold_amount"),
    staffIds.length
      ? db.from("staff_sales_rewards").select("id,profile_id,sale_date,threshold_amount,reward_amount,title,status,created_at").in("profile_id", staffIds).gte("sale_date", bounds.start.slice(0, 10)).order("sale_date", { ascending: false }).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    staffIds.length
      ? db.from("pos_sales").select("id,created_by,created_at,status,customer_id,crm_customer_id").in("created_by", staffIds).gte("created_at", bounds.start).lt("created_at", bounds.end).limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (rulesError) throw new Error(rulesError.message);
  if (rewardsResult.error) throw new Error(rewardsResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);

  const sales = (salesResult.data ?? []).filter((sale: any) => !VOID_STATUSES.has(String(sale.status ?? "completed")));
  const saleIds = sales.map((sale: any) => sale.id);
  const customerIds = Array.from(new Set(sales.map((sale: any) => sale.crm_customer_id ?? sale.customer_id).filter(Boolean))) as string[];
  const [{ data: paymentRows, error: paymentError }, { data: customerRows, error: customerError }] = await Promise.all([
    saleIds.length
      ? db.from("pos_sale_payment_details").select("sale_id,amount,payment_method").in("sale_id", saleIds).limit(10000)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? db.from("customers").select("id,customer_type").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentError) throw new Error(paymentError.message);
  if (customerError) throw new Error(customerError.message);

  const paymentsBySale = new Map<string, any[]>();
  for (const payment of paymentRows ?? []) {
    paymentsBySale.set(payment.sale_id, [...(paymentsBySale.get(payment.sale_id) ?? []), payment]);
  }
  const customerTypes = new Map((customerRows ?? []).map((customer: any) => [customer.id, customer.customer_type]));
  const cashByStaffDate = new Map<string, number>();
  for (const sale of sales) {
    const payments = paymentsBySale.get(sale.id) ?? [];
    if (!payments.length || payments.some((payment) => String(payment.payment_method).toLowerCase() !== "cash")) continue;
    const customerId = sale.crm_customer_id ?? sale.customer_id;
    if (customerId && customerTypes.get(customerId) === "wholesale_shop") continue;
    const amount = payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount ?? 0)), 0);
    const key = `${sale.created_by}:${pakistanDate(new Date(sale.created_at))}`;
    cashByStaffDate.set(key, (cashByStaffDate.get(key) ?? 0) + amount);
  }

  const rewardRows = (rewardsResult.data ?? []) as Reward[];
  const staffMap = new Map(visibleStaff.map((staff) => [staff.id, staff]));
  const activeRules: RewardRule[] = (rules ?? []).map((rule: any) => ({
    threshold: Number(rule.threshold_amount ?? 0),
    reward: Number(rule.reward_amount ?? 0),
    title: String(rule.title ?? "Cash reward"),
  }));
  const primaryTarget = activeRules[0]?.threshold ?? 30000;
  const myTodayCash = cashByStaffDate.get(`${user.id}:${today}`) ?? 0;
  const myMonthReward = rewardRows
    .filter((reward) => reward.profile_id === user.id && reward.status === "credited")
    .reduce((sum, reward) => sum + Number(reward.reward_amount ?? 0), 0);
  const nextRule = activeRules.find((rule) => rule.threshold > myTodayCash);
  const remaining = nextRule ? Math.max(0, nextRule.threshold - myTodayCash) : 0;

  const leaderboard = visibleStaff
    .map((staff) => {
      const todayCash = cashByStaffDate.get(`${staff.id}:${today}`) ?? 0;
      const monthReward = rewardRows
        .filter((reward) => reward.profile_id === staff.id && reward.status === "credited")
        .reduce((sum, reward) => sum + Number(reward.reward_amount ?? 0), 0);
      return { ...staff, todayCash, monthReward };
    })
    .sort((a, b) => b.todayCash - a.todayCash || b.monthReward - a.monthReward);

  return (
    <div>
      <PageHeader
        title="Staff Achievement"
        description="Sirf eligible retail cash sale ka target, reward aur verified history — ek jagah"
      />

      <div className="mb-4 rounded-card border border-brand-200 bg-brand-50 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
          <div>
            <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">Reward ka saaf qanoon</p>
            <p className="mt-1 text-xs leading-5 text-brand-800 dark:text-brand-200">
              Minimum {money(primaryTarget)} rozana retail cash sale. Wholesale customer, bank/card/wallet/khata aur mixed payment shamil nahi. Owner, Super Admin aur Admin par staff reward lagu nahi hota.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<Banknote className="h-5 w-5" />} label="Aaj ki eligible cash sale" value={money(myTodayCash)} tone="brand" />
        <Metric icon={<Target className="h-5 w-5" />} label="Agla target" value={nextRule ? money(nextRule.threshold) : "Sab target poore"} tone="amber" />
        <Metric icon={<Award className="h-5 w-5" />} label="Target tak baqi" value={remaining > 0 ? money(remaining) : "Mubarak!"} tone={remaining > 0 ? "red" : "green"} />
        <Metric icon={<Trophy className="h-5 w-5" />} label="Is mahine reward" value={money(myMonthReward)} tone="green" />
      </div>

      <Card className="mt-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
          <Target className="h-4 w-4 text-brand-600" /> Active reward levels
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeRules.map((rule) => (
            <div key={rule.threshold} className="rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-950/40">
              <p className="text-xs text-surface-500">Daily eligible retail cash sale</p>
              <p className="mt-1 text-lg font-semibold text-surface-900 dark:text-white">{money(rule.threshold)}</p>
              <p className="mt-2 text-sm font-medium text-brand-700 dark:text-brand-300">Reward: {money(rule.reward)}</p>
            </div>
          ))}
        </div>
      </Card>

      {isManager && (
        <Card className="mt-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
            <Users className="h-4 w-4 text-brand-600" /> Aaj ki staff ranking
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800">
                <th className="py-2">Rank</th><th className="py-2">Staff</th><th className="py-2">Role</th><th className="py-2 text-right">Eligible cash</th><th className="py-2 text-right">Month reward</th><th className="py-2 text-right">Progress</th>
              </tr></thead>
              <tbody>
                {leaderboard.map((staff, index) => (
                  <tr key={staff.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="py-2 font-semibold text-brand-700">#{index + 1}</td>
                    <td className="py-2 font-medium text-surface-900 dark:text-white">{staff.full_name}</td>
                    <td className="py-2 capitalize text-surface-500">{String(staff.role).replaceAll("_", " ")}</td>
                    <td className="py-2 text-right tabular-nums">{money(staff.todayCash)}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-700">{money(staff.monthReward)}</td>
                    <td className="py-2 text-right tabular-nums">{Math.min(100, Math.round((staff.todayCash / primaryTarget) * 100))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
          <Medal className="h-4 w-4 text-brand-600" /> Achievement history
        </p>
        {rewardRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-surface-500">Is mahine abhi koi verified reward record nahi hua.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800">
                <th className="py-2">Date</th>{isManager && <th className="py-2">Staff</th>}<th className="py-2">Achievement</th><th className="py-2 text-right">Target</th><th className="py-2 text-right">Reward</th><th className="py-2">Status</th>
              </tr></thead>
              <tbody>
                {rewardRows.map((reward) => (
                  <tr key={reward.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="py-2">{new Date(`${reward.sale_date}T00:00:00+05:00`).toLocaleDateString("en-GB")}</td>
                    {isManager && <td className="py-2 font-medium">{staffMap.get(reward.profile_id)?.full_name ?? "Unknown staff"}</td>}
                    <td className="py-2">{reward.title}</td>
                    <td className="py-2 text-right tabular-nums">{money(Number(reward.threshold_amount))}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-700">{money(Number(reward.reward_amount))}</td>
                    <td className="py-2"><span className={reward.status === "credited" ? "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800" : "rounded-full bg-red-100 px-2 py-1 text-xs text-red-800"}>{reward.status === "credited" ? "Credited" : "Reversed"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "brand" | "amber" | "red" | "green" }) {
  const colors = {
    brand: "text-brand-700 dark:text-brand-300",
    amber: "text-amber-700 dark:text-amber-300",
    red: "text-red-600 dark:text-red-400",
    green: "text-emerald-700 dark:text-emerald-300",
  };
  return <Card><div className={`flex items-center gap-2 ${colors[tone]}`}>{icon}<span className="text-[11px] font-medium uppercase tracking-wide">{label}</span></div><p className="mt-2 text-xl font-semibold text-surface-900 dark:text-white">{value}</p></Card>;
}
