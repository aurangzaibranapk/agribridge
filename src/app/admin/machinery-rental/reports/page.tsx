import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Machinery ki reports.
 *
 * Ye ek fehrist hai, naya hisaab nahi. Har report wo qatar kholti hai
 * jo pehle se maujood hai aur jise staff roz istemal karte hain --
 * kyunke report ka apna alag hisaab banana wohi cheez hai jis se kisi
 * din report aur safha do mukhtalif adad dikhate hain.
 *
 * Har qatar ke sath us ka apna adad, taake kholne se pehle pata ho ke
 * wahan kuch hai bhi ya nahi.
 */
interface ReportLink {
  href: string;
  title: TranslationKey;
  hint: TranslationKey;
  count?: number;
  amount?: number;
}

export default async function MachineryReportsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: control }, { data: farmers }, { data: vendors }, { data: due }, { data: diesel }] =
    await Promise.all([
      supabase.from("v_machinery_control").select("agla_kaam, baqi, harvest_area, kaam_mukammal"),
      supabase.from("v_machinery_farmer_statement").select("kul_baqi"),
      supabase.from("v_machinery_vendor_settlement").select("net_abhi_dena"),
      supabase.from("v_machinery_payment_due").select("baqi"),
      supabase.from("v_machinery_diesel_summary").select("amount, verification_status"),
    ]);

  const rows = control ?? [];
  const n = (v: unknown) => Number(v ?? 0);
  const count = (fn: (r: (typeof rows)[number]) => boolean) => rows.filter(fn).length;

  const reports: ReportLink[] = [
    {
      href: "/admin/machinery-rental/list",
      title: "mrp_bookings",
      hint: "mrp_bookings_hint",
      count: rows.length,
    },
    {
      href: "/admin/machinery-rental/list?card=rate_final_karein",
      title: "mrp_rate_pending",
      hint: "mrp_rate_pending_hint",
      count: count((r) => r.agla_kaam === "rate_final_karein"),
    },
    {
      href: "/admin/machinery-rental/schedule",
      title: "mrp_pending_work",
      hint: "mrp_pending_work_hint",
      count: count((r) => !r.kaam_mukammal && r.agla_kaam !== "cancelled"),
    },
    {
      href: "/admin/machinery-rental/work-claims",
      title: "mrp_verification",
      hint: "mrp_verification_hint",
    },
    {
      href: "/admin/machinery-rental/list?card=paisa_lena",
      title: "mrp_outstanding",
      hint: "mrp_outstanding_hint",
      amount: rows.reduce((s, r) => s + n(r.baqi), 0),
    },
    {
      href: "/admin/machinery-rental/reminders",
      title: "mrp_recovery",
      hint: "mrp_recovery_hint",
      count: (due ?? []).length,
    },
    {
      href: "/admin/machinery-rental/list#farmer-statement",
      title: "mrp_farmer_statement",
      hint: "mrp_farmer_statement_hint",
      amount: (farmers ?? []).reduce((s, r) => s + n(r.kul_baqi), 0),
    },
    {
      href: "/admin/machinery-rental/vendor-settlement",
      title: "mrp_vendor_settlement",
      hint: "mrp_vendor_settlement_hint",
      amount: (vendors ?? []).reduce((s, r) => s + n(r.net_abhi_dena), 0),
    },
    {
      href: "/admin/machinery-rental/vendor-cash",
      title: "mrp_vendor_cash",
      hint: "mrp_vendor_cash_hint",
    },
    {
      href: "/admin/machinery-rental/diesel",
      title: "mrp_diesel",
      hint: "mrp_diesel_hint",
      amount: (diesel ?? [])
        .filter((d) => d.verification_status === "verified")
        .reduce((s, d) => s + n(d.amount), 0),
    },
    {
      href: "/admin/machinery-rental/machines",
      title: "mrp_machines",
      hint: "mrp_machines_hint",
    },
    {
      href: "/admin/machinery-rental/pnl",
      title: "mrp_pnl",
      hint: "mrp_pnl_hint",
    },
    {
      href: "/admin/machinery-rental/farm-map",
      title: "mrp_farm_map",
      hint: "mrp_farm_map_hint",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mrp_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mrp_subtitle", lang)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-card border border-surface-200 bg-white p-4 shadow-card transition-colors hover:border-brand-400 dark:border-surface-800 dark:bg-surface-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">
                  {t(r.title, lang)}
                </p>
                <p className="mt-0.5 text-xs text-surface-500">{t(r.hint, lang)}</p>
              </div>
              {r.amount !== undefined ? (
                <span className="whitespace-nowrap font-display text-sm font-semibold text-surface-800 dark:text-surface-200">
                  Rs {r.amount.toLocaleString()}
                </span>
              ) : r.count !== undefined ? (
                <span className="whitespace-nowrap font-display text-sm font-semibold text-surface-800 dark:text-surface-200">
                  {r.count}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
