import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Coins,
  CreditCard,
  Droplets,
  HandCoins,
  LandPlot,
  MapPin,
  PackageSearch,
  PawPrint,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Tractor,
  TrendingUp,
  UserCircle,
  Wallet,
  Wheat,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import { ForecastWidget } from "@/components/dashboard/forecast-widget";
import { getMachineryReminders, MachineryReminderBanner } from "@/components/portal/machinery-reminder";
import { getWateringReminders, WateringReminderBanner } from "@/components/portal/watering-reminder";
import { HerdDonut, MilkAreaChart, MonthBarsChart } from "@/components/portal/munshi/charts";
import { loadMunshiDashboard } from "@/lib/portal/munshi-dashboard-load";
import { pct, rs, type ActivityKind, type TaskItem } from "@/lib/portal/munshi-dashboard";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(String(iso).length <= 10 ? `${iso}T00:00:00Z` : String(iso));
  return Number.isNaN(d.getTime()) ? "" : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/**
 * Kisan ka "Digital Munshi" -- ghar ka safha.
 *
 * Har card ab wahan se parhta hai jahan asal record hai (dekhein
 * lib/portal/munshi-dashboard.ts). Charts mein namoona kuch nahi: data na
 * ho to saaf likha aata hai ke kyun khali hai.
 */
export default async function FarmerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase.from("farmers").select("*").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  const pref = (farmer as any).preferred_language;
  const lang: Lang = getLanguageFromCookies(pref === "en" || pref === "rm" || pref === "ur" ? pref : "ur");
  const L = (k: TranslationKey) => t(k, lang);

  const d = await loadMunshiDashboard(farmer);

  const now = new Date();
  // Hafte ka din English mein aa jata tha ("Saturday") -- sirf tareekh, har zaban mein ek jaisi.
  const pk = new Date(now.getTime() + 5 * 3_600_000);
  const dateLine = `${pk.getUTCDate()} ${MONTHS[pk.getUTCMonth()]} ${pk.getUTCFullYear()}`;
  const place = [farmer.village, farmer.district].filter(Boolean).join(", ");
  const campaignDays = d.campaign?.deadline
    ? Math.max(0, Math.round((new Date(d.campaign.deadline).getTime() - now.getTime()) / 86_400_000))
    : null;

  const ls = d.livestock;
  const verifiedFarms = d.farms.filter((f) => f.verified).length;
  const used = pct(d.khata.owed, d.creditLimit);
  const bandKey = d.score.band ? (`pmd_band_${d.score.band}` as TranslationKey) : null;
  const levelKey = d.score.level ? (`pmd_level_${d.score.level}` as TranslationKey) : null;

  const machineryReminders = getMachineryReminders(d.allCrops as any);
  const wateringReminders = getWateringReminders(d.allCrops as any);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6">
      <WateringReminderBanner reminders={wateringReminders} />
      <MachineryReminderBanner reminders={machineryReminders} />

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-emerald-800 via-green-700 to-yellow-600 px-6 py-6 text-white shadow-lg dark:from-emerald-950 dark:via-green-900 dark:to-yellow-800 sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-white/85">
              {dateLine}
              {place ? ` · ${place}` : ""}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {L("pmd_greeting")}
              {farmer.full_name ? `, ${farmer.full_name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-white/85">{L("pmd_subtitle")}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <HeroPill>
                {farmer.farmer_code} · {farmer.is_verified ? `✓ ${L("pmd_verified")}` : L("pmd_unverified")}
              </HeroPill>
              {d.campaign && (
                <HeroPill>
                  🌾 {d.campaign.name} · {L("pmd_booking_open")}
                  {campaignDays !== null ? ` · ${campaignDays} ${L("pmd_days_left")}` : ""}
                </HeroPill>
              )}
              <HeroPill>
                {L("pmd_profile")} {d.completion.isComplete ? `✓ ${L("pmd_complete")}` : `${d.completion.percent}%`}
              </HeroPill>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/wallet" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow hover:bg-emerald-50">
              <Wallet className="h-4 w-4" /> {L("pmd_btn_khata")}
            </Link>
            <Link href="/portal/campaigns" className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25">
              <CalendarClock className="h-4 w-4" /> {L("pmd_btn_booking")}
            </Link>
          </div>
        </div>
      </section>

      {/* ---- KPI cards ---- */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi href="/portal/wallet" tone="rose" icon={<Wallet className="h-4 w-4" />} label={L("pmd_kpi_khata")}
          value={d.khata.hasLinkedCustomer || d.khata.owed > 0 ? rs(d.khata.owed) : "—"}
          sub={
            d.khata.promise
              ? `${L("pmd_promise")}: ${rs(d.khata.promise.amount)} · ${shortDate(d.khata.promise.date)}`
              : d.khata.late > 0
              ? `${rs(d.khata.late)} ${L("pmd_over_30")}`
              : d.khata.hasLinkedCustomer
              ? d.khata.owed > 0 ? "" : L("pmd_khata_clear")
              : L("pmd_khata_none")
          } />
        <Kpi href="/portal/services/livestock" tone="sky" icon={<Droplets className="h-4 w-4" />} label={L("pmd_kpi_milk")}
          value={d.milk.hasRecord ? `${Math.round(d.milk.total30)} L` : ls.litersPerDay > 0 ? `${ls.litersPerDay} L` : "—"}
          sub={
            d.milk.hasRecord
              ? `${L("pmd_last_30")}${d.milk.rate ? ` · Rs ${d.milk.rate}/L` : ""}`
              : ls.litersPerDay > 0
              ? `${L("pmd_per_day_self")}${d.milk.rate ? ` · Rs ${d.milk.rate}/L` : ""}`
              : ""
          } />
        <Kpi href="/portal/services/livestock" tone="violet" icon={<PawPrint className="h-4 w-4" />} label={L("pmd_kpi_livestock")}
          value={ls.total > 0 ? String(ls.total) : "0"}
          sub={ls.total > 0 ? `${ls.milking} ${L("pmd_milking")} · ${ls.dry} ${L("pmd_dry")}${ls.calves ? ` · ${ls.calves} ${L("pmd_calves")}` : ""}` : L("pmd_no_animals")} />
        <Kpi href="/portal/farms" tone="teal" icon={<LandPlot className="h-4 w-4" />} label={L("pmd_kpi_land")}
          value={`${d.totalAcres} ${L("pmd_acres")}`}
          sub={`${d.farms.length} ${L("pmd_farms")} · ${verifiedFarms} ${L("pmd_verified_n")}`} />
        <Kpi href="/portal/crops" tone="lime" icon={<Wheat className="h-4 w-4" />} label={L("pmd_kpi_crops")}
          value={String(d.crops.count)}
          sub={d.crops.count ? d.crops.byName.map(([n, c]) => `${n} ${c}`).join(" · ") : L("pmd_no_crops")} />
        <Kpi href="/portal/wallet" tone="amber" icon={<ShieldCheck className="h-4 w-4" />} label={L("pmd_kpi_credit")}
          value={d.creditLimit > 0 ? rs(d.creditLimit) : "—"}
          sub={[d.creditLimit > 0 ? `${L("pmd_used")} ${used}%` : L("pmd_no_limit"), bandKey ? L(bandKey) : null].filter(Boolean).join(" · ")} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi href="/portal/services/fertilizer" icon={<Sprout className="h-4 w-4" />} color="text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300"
          label={L("pmd_kpi_fert")} value={String(d.fert.total)}
          sub={d.fert.needsReply ? `${d.fert.needsReply} ${L("pmd_needs_reply")}` : `${d.fert.open} ${L("pmd_open")}`} />
        <MiniKpi href="/portal/services/machinery" icon={<Tractor className="h-4 w-4" />} color="text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300"
          label={L("pmd_kpi_mach")} value={String(d.mach.total)} sub={`${d.mach.open} ${L("pmd_active")}`} />
        <MiniKpi href="/portal/harvest" icon={<TrendingUp className="h-4 w-4" />}
          color={d.profit.net < 0 ? "text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" : "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300"}
          label={L("pmd_kpi_profit")} value={d.profit.hasData ? rs(d.profit.net) : "Rs 0"}
          sub={d.profit.hasData ? `${L("pmd_income")} ${rs(d.profit.revenue)} · ${L("pmd_cost")} ${rs(d.profit.expense)}` : L("pmd_no_entries")} />
        <MiniKpi href="/portal/profile" icon={<UserCircle className="h-4 w-4" />}
          color={d.completion.isComplete ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300" : "text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300"}
          label={L("pmd_profile")} value={d.completion.isComplete ? L("pmd_complete") : `${d.completion.percent}%`}
          sub={farmer.is_verified ? L("pmd_verified") : L("pmd_unverified")} />
      </section>

      {/* ---- Milk chart + tasks ---- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHead title={L("pmd_milk_chart")} sub={L("pmd_liters_day")} />
          {d.milk.hasRecord ? (
            <MilkAreaChart data={d.milk.days} />
          ) : (
            <Empty icon={<Droplets className="h-6 w-6" />} text={L("pmd_milk_empty")}
              extra={ls.litersPerDay > 0 ? `${ls.litersPerDay} ${L("pmd_per_day_self")}` : undefined} />
          )}
        </Card>
        <Card>
          <CardHead title={L("pmd_tasks")} right={d.tasks.length ? <Badge tone="rose">{d.tasks.length} {L("pmd_pending")}</Badge> : null} />
          {d.tasks.length === 0 ? (
            <Empty icon={<BadgeCheck className="h-6 w-6" />} text={L("pmd_no_tasks")} />
          ) : (
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {d.tasks.slice(0, 5).map((task, i) => (
                <TaskRow key={i} task={task} L={L} />
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ---- Month bars + herd + quick ---- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title={L("pmd_month_chart")} />
          {d.months.some((m) => m.udhaar || m.adaigi || m.milk || m.kharcha) ? (
            <MonthBarsChart data={d.months} labels={{ udhaar: L("pmd_udhaar"), adaigi: L("pmd_adaigi"), milk: L("pmd_milk_income"), kharcha: L("pmd_crop_cost") }} />
          ) : (
            <Empty icon={<Coins className="h-6 w-6" />} text={L("pmd_month_empty")} />
          )}
        </Card>
        <Card>
          <CardHead title={L("pmd_herd")} sub={L("pmd_from_record")} />
          {ls.total > 0 ? (
            <HerdDonut
              centerLabel={L("pmd_animals")}
              parts={[
                { name: L("pmd_milking"), value: ls.milking, color: "#0ea5e9" },
                { name: L("pmd_dry"), value: ls.dry, color: "#f59e0b" },
                { name: L("pmd_calves"), value: ls.calves, color: "#22c55e" },
              ]}
            />
          ) : (
            <Empty icon={<PawPrint className="h-6 w-6" />} text={L("pmd_herd_empty")} />
          )}
        </Card>
        <Card>
          <CardHead title={L("pmd_quick")} />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Quick href="/portal/wallet" icon={<Wallet className="h-4 w-4" />} c="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300" label={L("pmd_q_khata")} />
            <Quick href="/portal/campaigns" icon={<CalendarClock className="h-4 w-4" />} c="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" label={L("pmd_q_booking")} />
            <Quick href="/portal/demand" icon={<PackageSearch className="h-4 w-4" />} c="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300" label={L("pmd_q_demand")} />
            <Quick href="/portal/services/fertilizer" icon={<Sprout className="h-4 w-4" />} c="bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300" label={L("pmd_q_fert")} />
            <Quick href="/portal/services/machinery" icon={<Tractor className="h-4 w-4" />} c="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300" label={L("pmd_q_mach")} />
            <Quick href="/portal/services/livestock" icon={<PawPrint className="h-4 w-4" />} c="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300" label={L("pmd_q_livestock")} />
          </div>
        </Card>
      </section>

      {/* ---- Activity + farms ---- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title={L("pmd_activity")} sub={L("pmd_activity_sub")} />
          {d.activity.length === 0 ? (
            <Empty icon={<ShoppingBag className="h-6 w-6" />} text={L("pmd_no_activity")} />
          ) : (
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {d.activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5">
                  <ActIcon kind={a.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">
                      {L(ACT_TITLE[a.kind])}
                      {a.amount ? ` · ${rs(a.amount)}` : ""}
                    </p>
                    {a.kind === "khata_udhaar" ? (
                      <p className="truncate text-xs text-surface-500 dark:text-slate-400">Al Rana Traders{Number(a.detail) > 1 ? ` · ${a.detail} bill` : ""}</p>
                    ) : a.detail ? (
                      <p className="truncate text-xs text-surface-500 dark:text-slate-400">{a.detail}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-surface-400 dark:text-slate-500">{shortDate(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHead title={L("pmd_my_land")} right={<Link href="/portal/farms" className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-slate-200 dark:hover:bg-surface-800">{L("pmd_add_farm")}</Link>} />
          {d.farms.length === 0 ? (
            <Empty icon={<LandPlot className="h-6 w-6" />} text={L("pmd_no_farms")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-surface-500 dark:text-slate-400">
                    <th className="py-2 pr-2 font-semibold">{L("pmd_col_farm")}</th>
                    <th className="py-2 pr-2 font-semibold">{L("pmd_col_acres")}</th>
                    <th className="py-2 pr-2 font-semibold">{L("pmd_col_crop")}</th>
                    <th className="py-2 pr-2 font-semibold">{L("pmd_col_loc")}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {d.farms.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5 pr-2 font-semibold text-surface-900 dark:text-white">{f.name}</td>
                      <td className="py-2.5 pr-2 text-surface-700 dark:text-slate-300">{f.acres}</td>
                      <td className="py-2.5 pr-2 text-surface-700 dark:text-slate-300">{f.crop ?? "—"}</td>
                      <td className="py-2.5 pr-2">
                        {f.pinned ? (
                          <span className="inline-flex items-center gap-1 text-xs text-surface-600 dark:text-slate-300"><MapPin className="h-3.5 w-3.5 text-rose-500" />{L("pmd_pin_set")}</span>
                        ) : (
                          <Badge tone="amber">{L("pmd_pin_missing")}</Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right">{f.verified ? <Badge tone="green">{L("pmd_verified")}</Badge> : <Badge tone="slate">{L("pmd_unverified")}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-surface-500 dark:text-slate-400">{L("pmd_next_season")}</p>
        </Card>
      </section>

      {/* ---- Official score + weather ---- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHead title={L("pmd_score_title")} right={d.score.snapshotDate ? <span className="text-xs text-surface-400">{L("pmd_score_updated")}: {shortDate(d.score.snapshotDate)}</span> : null} />
          {d.score.score === null ? (
            <Empty icon={<CreditCard className="h-6 w-6" />} text={L("pmd_score_none")} />
          ) : (
            <div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold tracking-tight text-surface-900 dark:text-white">{d.score.score}</span>
                <span className="pb-1 text-sm text-surface-500">/ 100</span>
                {bandKey && <Badge tone={BAND_TONE[d.score.band ?? ""] ?? "slate"}>{L(bandKey)}</Badge>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-lime-500 to-emerald-600" style={{ width: `${Math.max(0, Math.min(100, d.score.score))}%` }} />
              </div>
              {levelKey && (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-slate-200">
                  <HandCoins className="h-4 w-4 text-emerald-600" /> {L(levelKey)}
                </p>
              )}
              <p className="mt-1 text-xs text-surface-500 dark:text-slate-400">{L("pmd_score_hint")}</p>
            </div>
          )}
        </Card>
        <ForecastWidget fixedDistrict={farmer.district} title={`${farmer.district ? `${farmer.district} · ` : ""}${L("pmd_forecast")}`} />
      </section>
    </div>
  );
}

const ACT_TITLE: Record<ActivityKind, TranslationKey> = {
  khata_udhaar: "pmd_act_udhaar",
  khata_adaigi: "pmd_act_adaigi",
  milk: "pmd_act_milk",
  milk_payment: "pmd_act_milk_pay",
  fertilizer: "pmd_act_fert",
  machinery: "pmd_act_mach",
  demand: "pmd_act_demand",
  crop: "pmd_act_crop",
  harvest: "pmd_act_harvest",
  livestock_loan: "pmd_act_loan",
  campaign: "pmd_act_campaign",
};

const ACT_STYLE: Record<ActivityKind, [string, React.ReactNode]> = {
  khata_udhaar: ["bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300", <ShoppingBag key="i" className="h-4 w-4" />],
  khata_adaigi: ["bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300", <HandCoins key="i" className="h-4 w-4" />],
  milk: ["bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300", <Droplets key="i" className="h-4 w-4" />],
  milk_payment: ["bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300", <Coins key="i" className="h-4 w-4" />],
  fertilizer: ["bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", <Sprout key="i" className="h-4 w-4" />],
  machinery: ["bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300", <Tractor key="i" className="h-4 w-4" />],
  demand: ["bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300", <PackageSearch key="i" className="h-4 w-4" />],
  crop: ["bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300", <Wheat key="i" className="h-4 w-4" />],
  harvest: ["bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300", <Wheat key="i" className="h-4 w-4" />],
  livestock_loan: ["bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300", <PawPrint key="i" className="h-4 w-4" />],
  campaign: ["bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300", <CalendarClock key="i" className="h-4 w-4" />],
};

function ActIcon({ kind }: { kind: ActivityKind }) {
  const [c, icon] = ACT_STYLE[kind];
  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c}`}>{icon}</span>;
}

const TASK_STYLE: Record<TaskItem["kind"], [string, React.ReactNode, TranslationKey]> = {
  late: ["bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300", <AlertTriangle key="i" className="h-4 w-4" />, "pmd_task_late"],
  promise: ["bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300", <HandCoins key="i" className="h-4 w-4" />, "pmd_task_promise"],
  fert_reply: ["bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", <Sprout key="i" className="h-4 w-4" />, "pmd_task_fert"],
  mach_pay: ["bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300", <Tractor key="i" className="h-4 w-4" />, "pmd_task_mach"],
  campaign: ["bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300", <Wheat key="i" className="h-4 w-4" />, "pmd_task_campaign"],
  profile: ["bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300", <UserCircle key="i" className="h-4 w-4" />, "pmd_task_profile"],
  pin: ["bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", <MapPin key="i" className="h-4 w-4" />, "pmd_task_pin"],
};

const TASK_HREF: Record<TaskItem["kind"], string> = {
  late: "/portal/wallet",
  promise: "/portal/wallet",
  fert_reply: "/portal/services/fertilizer",
  mach_pay: "/portal/services/machinery",
  campaign: "/portal/campaigns",
  profile: "/portal/profile",
  pin: "/portal/farms",
};

function TaskRow({ task, L }: { task: TaskItem; L: (k: TranslationKey) => string }) {
  const [c, icon, key] = TASK_STYLE[task.kind];
  const sub =
    task.kind === "late"
      ? `${rs(task.amount ?? 0)} · ${L("pmd_task_late_sub")}`
      : task.kind === "promise"
      ? rs(task.amount ?? 0)
      : task.kind === "campaign"
      ? `${task.subject} · ${L("pmd_task_campaign_sub")}`
      : task.subject ?? "";
  return (
    <li>
      <Link href={TASK_HREF[task.kind]} className="flex items-center gap-3 py-2.5 hover:opacity-90">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">{L(key)}</p>
          {sub && <p className="truncate text-xs text-surface-500 dark:text-slate-400">{sub}</p>}
        </div>
        {task.date ? (
          <Badge tone={task.urgent ? "rose" : "indigo"}>{shortDate(task.date)}</Badge>
        ) : task.urgent ? (
          <Badge tone="rose">{L("pmd_today")}</Badge>
        ) : (
          <ArrowRight className="h-4 w-4 text-surface-300" />
        )}
      </Link>
    </li>
  );
}

const TONES: Record<string, string> = {
  rose: "from-rose-500 to-rose-700",
  sky: "from-sky-500 to-cyan-700",
  violet: "from-violet-500 to-purple-700",
  teal: "from-teal-500 to-teal-700",
  lime: "from-lime-500 to-green-700",
  amber: "from-amber-500 to-orange-700",
};

function Kpi({ href, tone, icon, label, value, sub }: { href: string; tone: string; icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Link href={href} className={`group relative block min-h-[118px] overflow-hidden rounded-2xl bg-gradient-to-br ${TONES[tone]} p-4 text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,.45)] transition hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 truncate text-[11.5px] text-white/90" title={sub}>{sub}</p>}
      <span className="pointer-events-none absolute -bottom-6 -right-5 h-20 w-20 rounded-full bg-white/12 bg-white/10" />
    </Link>
  );
}

function MiniKpi({ href, icon, color, label, value, sub }: { href: string; icon: React.ReactNode; color: string; label: string; value: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white p-3.5 shadow-sm transition hover:shadow-md dark:border-surface-800 dark:bg-surface-900">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-surface-900 dark:text-white">{value}</p>
        <p className="truncate text-xs text-surface-500 dark:text-slate-400" title={sub}>{sub}</p>
      </div>
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">{children}</div>;
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white">{title}</h3>
        {sub && <p className="text-xs text-surface-500 dark:text-slate-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Empty({ icon, text, extra }: { icon: React.ReactNode; text: string; extra?: string }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-surface-200 bg-surface-50/60 px-6 py-6 text-center dark:border-surface-700 dark:bg-surface-800/40">
      <span className="mb-2 text-surface-400 dark:text-slate-500">{icon}</span>
      <p className="max-w-sm text-sm text-surface-500 dark:text-slate-400">{text}</p>
      {extra && <p className="mt-2 text-sm font-semibold text-sky-600 dark:text-sky-300">{extra}</p>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  slate: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-slate-200",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
};
const BAND_TONE: Record<string, string> = { platinum: "violet", gold: "amber", silver: "slate", bronze: "amber", low: "rose" };

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE[tone] ?? BADGE.slate}`}>{children}</span>;
}

function HeroPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/35 bg-white/15 px-3 py-1">{children}</span>;
}

function Quick({ href, icon, c, label }: { href: string; icon: React.ReactNode; c: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl border border-surface-200 bg-surface-50 p-3 text-[12.5px] font-semibold text-surface-800 transition hover:border-green-300 hover:bg-white dark:border-surface-700 dark:bg-surface-800/60 dark:text-slate-100 dark:hover:bg-surface-800">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c}`}>{icon}</span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}
