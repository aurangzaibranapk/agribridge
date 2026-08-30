import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

/**
 * Machinery ka Command Dashboard.
 *
 * Pehle ye safha booking ke purane khanon (total_amount,
 * amount_received_from_farmer) se adad banata tha. Nayi zanjeer un
 * khanon ko haath hi nahi lagati -- paisa machinery_payments mein jata
 * hai aur raqam bill par banti hai. Nateeja ye tha ke safha poori
 * payment ke baad bhi "lena baqi hai" dikhata raha, aur naye acre kahin
 * nazar hi nahi aate the.
 *
 * Ab har adad v_machinery_control se aata hai -- wohi ek malik jis par
 * Live Board, kisan ka gosharah aur reminder chalte hain. Yahan koi
 * hisaab dobara nahi hota: sirf ginti aur jor.
 */

type Ctl = {
  booking_id: string;
  booking_number: string | null;
  preferred_date: string | null;
  farmer_name: string | null;
  farmer_phone: string | null;
  village: string | null;
  vendor_name: string | null;
  machine_type: string | null;
  harvest_area: number | null;
  kaam_hua: number | null;
  kaam_mukammal: boolean | null;
  machine_ja_chuki: boolean | null;
  kaam_ki_halat: string | null;
  paise_ki_halat: string | null;
  agla_kaam: string | null;
  baqi: number | null;
  zyada_diya: number | null;
  vendor_ka_baqi: number | null;
  hamara_commission: number | null;
  payment_promise_date: string | null;
  kattai_ki_tareekh_guzri: boolean | null;
};

const n = (v: unknown) => Number(v ?? 0);
const rs = (v: number) => `Rs ${Math.round(v).toLocaleString()}`;

/** Aaj ki tareekh Pakistan ke hisaab se -- server UTC par chalta hai. */
function todayISO(offsetDays = 0): string {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default async function MachineryDashboardPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [
    { data: control },
    { data: machines },
    { data: settlement },
    { data: diesel },
    { data: pnl },
    { data: workClaims },
    { data: advanceClaims },
    { data: fuelClaims },
    { data: collectionClaims },
    { data: requests },
  ] = await Promise.all([
    supabase.from("v_machinery_control").select("*"),
    supabase.from("v_machinery_machines").select("machine_id, status, is_available, chal_rahi_booking"),
    supabase.from("v_machinery_vendor_settlement").select("net_abhi_dena"),
    supabase.from("v_machinery_diesel_summary").select("litres, amount, verification_status"),
    supabase.from("v_machinery_pnl_booking").select("hamari_aamdani, munafa"),
    supabase.from("v_machinery_work_claims").select("work_record_id"),
    supabase.from("v_machinery_advance_claims").select("payment_id"),
    supabase.from("v_machinery_fuel_claims").select("fuel_log_id"),
    supabase.from("v_machinery_vendor_collection_claims").select("payment_id"),
    supabase.from("machinery_requests").select("id, status"),
  ]);

  const rows = (control ?? []) as unknown as Ctl[];
  const live = rows.filter((r) => r.kaam_ki_halat !== "cancelled");

  const today = todayISO();
  const week = todayISO(7);

  const kpi = {
    bookings: live.length,
    bookedAcres: live.reduce((s, r) => s + n(r.harvest_area), 0),
    doneAcres: live.reduce((s, r) => s + n(r.kaam_hua), 0),
    runningAcres: live
      .filter((r) => r.kaam_ki_halat === "chal_raha")
      .reduce((s, r) => s + Math.max(n(r.harvest_area) - n(r.kaam_hua), 0), 0),
    pendingAcres: live
      .filter((r) => !r.kaam_mukammal)
      .reduce((s, r) => s + Math.max(n(r.harvest_area) - n(r.kaam_hua), 0), 0),
    next7Acres: live
      .filter((r) => !r.kaam_mukammal && r.preferred_date && r.preferred_date >= today && r.preferred_date <= week)
      .reduce((s, r) => s + Math.max(n(r.harvest_area) - n(r.kaam_hua), 0), 0),
    ratePending: live.filter((r) => r.agla_kaam === "rate_final_karein").length,
    farmerDue: live.reduce((s, r) => s + n(r.baqi), 0),
    farmerRefund: live.reduce((s, r) => s + n(r.zyada_diya), 0),
    vendorDue: (settlement ?? []).reduce((s, r) => s + n(r.net_abhi_dena), 0),
    newRequests: (requests ?? []).filter((r) => !r.status || r.status === "pending").length,
  };

  const machinesActive = (machines ?? []).filter((m) => m.chal_rahi_booking).length;
  const machinesFree = (machines ?? []).filter((m) => m.is_available && !m.chal_rahi_booking).length;

  // Sirf tasdeeq shuda diesel gina jata hai -- dawa abhi kharcha nahi.
  const dieselVerified = (diesel ?? []).filter((d) => d.verification_status === "verified");
  const dieselLitres = dieselVerified.reduce((s, d) => s + n(d.litres), 0);
  const dieselCost = dieselVerified.reduce((s, d) => s + n(d.amount), 0);

  const income = (pnl ?? []).reduce((s, r) => s + n(r.hamari_aamdani), 0);
  const profit = (pnl ?? []).reduce((s, r) => s + n(r.munafa), 0);

  const claimsPending =
    (workClaims?.length ?? 0) + (advanceClaims?.length ?? 0) + (fuelClaims?.length ?? 0) + (collectionClaims?.length ?? 0);

  // Aaj ka kaam: aaj ki kattai, aur wo machinein jo bahar hain.
  const todayRows = live
    .filter((r) => (r.preferred_date === today && !r.kaam_mukammal) || (r.machine_ja_chuki && !r.kaam_mukammal))
    .sort((a, b) => (a.preferred_date ?? "").localeCompare(b.preferred_date ?? ""));

  // Tawajjo chahiye: har lakeer ki apni wajah, aur har wajah ek hi dafa.
  type Att = { id: string; bookingId: string; reason: string; tone: "red" | "amber"; label: string; amount?: number };
  const attention: Att[] = [];
  for (const r of live) {
    const label = `${r.booking_number ?? "-"} · ${r.farmer_name ?? "-"}`;
    if (r.kattai_ki_tareekh_guzri) {
      attention.push({ id: `${r.booking_id}-late`, bookingId: r.booking_id, reason: t("md_att_date_passed", lang), tone: "red", label });
    }
    if (n(r.zyada_diya) > 0) {
      attention.push({ id: `${r.booking_id}-refund`, bookingId: r.booking_id, reason: t("md_att_refund", lang), tone: "red", label, amount: n(r.zyada_diya) });
    }
    if (r.payment_promise_date && r.payment_promise_date <= today && n(r.baqi) > 0) {
      attention.push({ id: `${r.booking_id}-promise`, bookingId: r.booking_id, reason: t("md_att_promise_today", lang), tone: "amber", label, amount: n(r.baqi) });
    }
    if (r.agla_kaam === "rate_final_karein") {
      attention.push({ id: `${r.booking_id}-rate`, bookingId: r.booking_id, reason: t("md_att_rate", lang), tone: "amber", label });
    }
  }
  attention.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "red" ? -1 : 1));

  return (
    <div className="space-y-5">
      <PageHeader title={t("mc_dashboard_title", lang)} description={t("mc_dashboard_subtitle", lang)} />

      {/* Har card ek safhe par le jata hai -- adad dekh kar wahin se kaam shuru ho. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi href="/admin/machinery-rental/list" label={t("md_kpi_bookings", lang)} value={String(kpi.bookings)} />
        <Kpi href="/admin/machinery-rental/schedule" label={t("md_kpi_booked_acres", lang)} value={`${kpi.bookedAcres} ${t("md_acres_short", lang)}`} />
        <Kpi href="/admin/machinery-rental/work" label={t("md_kpi_done_acres", lang)} value={`${kpi.doneAcres} ${t("md_acres_short", lang)}`} tone="green" />
        <Kpi href="/admin/machinery-rental/schedule?view=week" label={t("md_kpi_next7_acres", lang)} value={`${kpi.next7Acres} ${t("md_acres_short", lang)}`} />

        <Kpi href="/admin/machinery-rental/work" label={t("md_kpi_running_acres", lang)} value={`${kpi.runningAcres} ${t("md_acres_short", lang)}`} />
        <Kpi href="/admin/machinery-rental/assign" label={t("md_kpi_pending_acres", lang)} value={`${kpi.pendingAcres} ${t("md_acres_short", lang)}`} tone="amber" />
        <Kpi href="/admin/machinery-rental/machines" label={t("md_kpi_machines_active", lang)} value={String(machinesActive)} />
        <Kpi href="/admin/machinery-rental/machines" label={t("md_kpi_machines_free", lang)} value={String(machinesFree)} />

        <Kpi href="/admin/machinery-rental/assign" label={t("md_kpi_rate_pending", lang)} value={String(kpi.ratePending)} tone={kpi.ratePending > 0 ? "amber" : undefined} />
        <Kpi href="/admin/machinery-rental/work-claims" label={t("md_kpi_claims_pending", lang)} value={String(claimsPending)} tone={claimsPending > 0 ? "amber" : undefined} />
        <Kpi href="/admin/machinery-rental/reminders" label={t("md_kpi_farmer_due", lang)} value={rs(kpi.farmerDue)} tone={kpi.farmerDue > 0 ? "amber" : undefined} />
        <Kpi href="/admin/machinery-rental/vendor-settlement" label={t("md_kpi_vendor_due", lang)} value={rs(kpi.vendorDue)} tone={kpi.vendorDue > 0 ? "amber" : undefined} />

        <Kpi href="/admin/machinery-rental/billing" label={t("md_kpi_farmer_refund", lang)} value={rs(kpi.farmerRefund)} tone={kpi.farmerRefund > 0 ? "red" : undefined} />
        <Kpi href="/admin/machinery-rental/diesel" label={t("md_kpi_diesel_litres", lang)} value={`${Math.round(dieselLitres * 100) / 100}`} />
        <Kpi href="/admin/machinery-rental/diesel" label={t("md_kpi_diesel_cost", lang)} value={rs(dieselCost)} />
        <Kpi href="/admin/machinery-rental/pnl" label={t("md_kpi_profit", lang)} value={rs(profit)} tone={profit >= 0 ? "green" : "red"} />
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-3 text-sm text-surface-600 shadow-card dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400">
        {t("md_kpi_income", lang)}: <strong className="text-surface-900 dark:text-white">{rs(income)}</strong>
        {kpi.newRequests > 0 && (
          <>
            {" · "}
            <Link href="/admin/machinery-rental/assign" className="font-medium text-brand-600 hover:underline">
              {kpi.newRequests} {t("mc_new_requests", lang)}
            </Link>
          </>
        )}
      </div>

      {/* Aaj ka kaam */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("md_today", lang)}</h2>
        <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("mc_farmer", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("mc_machine", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mc_acres", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("md_next_work", lang)}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {todayRows.map((r) => (
                <tr key={r.booking_id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">
                    {r.farmer_name ?? "-"}
                    <span className="block text-xs text-surface-400">{r.village ?? r.booking_number ?? ""}</span>
                  </td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                    {r.machine_type ?? "-"}
                    <span className="block text-xs text-surface-400">{r.vendor_name ?? ""}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                    {n(r.kaam_hua)} / {n(r.harvest_area)}
                  </td>
                  <td className="px-3 py-2 text-xs text-surface-600 dark:text-surface-400">{r.agla_kaam ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/machinery-rental/booking/${r.booking_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      {t("md_open_page", lang)}
                    </Link>
                  </td>
                </tr>
              ))}
              {todayRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-surface-400">
                    {t("md_today_none", lang)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tawajjo chahiye */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("md_attention", lang)}</h2>
        {attention.length === 0 ? (
          <div className="rounded-card border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300">
            {t("md_attention_none", lang)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {attention.map((a) => (
              <div
                key={a.id}
                className={
                  a.tone === "red"
                    ? "flex items-center justify-between rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900/40 dark:bg-red-950/20"
                    : "flex items-center justify-between rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/20"
                }
              >
                <span className={a.tone === "red" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}>
                  <strong>{a.label}</strong> — {a.reason}
                  {a.amount !== undefined && a.amount > 0 ? ` (${rs(a.amount)})` : ""}
                </span>
                <Link
                  href={`/admin/machinery-rental/booking/${a.bookingId}`}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                >
                  {t("md_open_page", lang)}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  tone?: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
        : tone === "red"
          ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
          : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900";
  const valueClass =
    tone === "green"
      ? "text-green-700 dark:text-green-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "red"
          ? "text-red-700 dark:text-red-300"
          : "text-surface-900 dark:text-white";
  return (
    <Link href={href} className={`block rounded-card border p-3 shadow-card transition-colors hover:border-brand-300 ${toneClass}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${valueClass}`}>{value}</p>
    </Link>
  );
}
