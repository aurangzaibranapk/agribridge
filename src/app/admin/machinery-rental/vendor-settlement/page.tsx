import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Vendor ka settlement -- har raqam apne naam se.
 *
 * Ek "baqi" ka adad dikhana kaafi nahi, aur wohi jhagRe ki jarh hai.
 * Vendor ke liye ye ek adad nahi, teen alag baatein hain: jo hamare
 * paas jama hai, jo abhi kisan ke paas hai, aur jo mil chuka.
 *
 * "Ab dena banta hai" wo raqam hai jo waqai abhi di ja sakti hai:
 * hamare paas jama, mainus ART ka diesel. Kisan ke paas wali raqam
 * us mein nahi -- wo hamare paas aayi hi nahi.
 */
export default async function VendorSettlementPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("v_machinery_vendor_settlement")
    .select("*")
    .order("net_abhi_dena", { ascending: false });

  const vendors = rows ?? [];
  const n = (v: unknown) => Number(v ?? 0);
  const tot = (k: string) => vendors.reduce((s, r) => s + n((r as Record<string, unknown>)[k]), 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("vs_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("vs_subtitle", lang)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tile label={t("vs_with_art", lang)} value={tot("art_ke_paas_jama")} tone="brand" />
        <Tile label={t("vs_with_farmer", lang)} value={tot("kisan_ke_paas")} tone="amber" />
        <Tile label={t("vs_diesel_advance", lang)} value={tot("art_diesel_advance")} tone="red" />
        <Tile label={t("vs_extra_given", lang)} value={tot("zyada_diya")} tone="red" />
        <Tile label={t("vs_net_now", lang)} value={tot("net_abhi_dena")} tone="brand" />
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {vendors.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-surface-400">{t("vs_empty", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left dark:border-surface-800">
                  <Th>{t("mc_vendor", lang)}</Th>
                  <Th right>{t("vs_earned", lang)}</Th>
                  <Th right>{t("vs_paid", lang)}</Th>
                  <Th right>{t("vs_with_art", lang)}</Th>
                  <Th right>{t("vs_with_farmer", lang)}</Th>
                  <Th right>{t("vs_diesel_advance", lang)}</Th>
                  {/* Hisse se zyada diya hua paisa. Ye kisi booking ka
                      kharcha nahi -- wo vendor ke paas hamara paisa hai,
                      jo agli booking par katega. Chhupa dene se hisaab
                      ke waqt yaad hi nahi rehta. */}
                  <Th right>{t("vs_extra_given", lang)}</Th>
                  <Th right>{t("vs_net_now", lang)}</Th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.vendor_id as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2">
                      <p className="font-medium text-surface-800 dark:text-surface-200">{v.vendor_name ?? "—"}</p>
                      <p className="text-xs text-surface-400">
                        {n(v.kitni_bookings)} {t("mc_bookings", lang)}
                      </p>
                    </td>
                    <Td value={n(v.kul_hissa)} />
                    <Td value={n(v.kul_mila)} muted />
                    <Td value={n(v.art_ke_paas_jama)} tone="text-brand-700 dark:text-brand-300" />
                    <Td value={n(v.kisan_ke_paas)} tone="text-amber-700 dark:text-amber-300" />
                    <Td value={n(v.art_diesel_advance)} tone="text-red-600 dark:text-red-400" />
                    <Td value={n(v.zyada_diya)} tone="text-red-600 dark:text-red-400" />
                    <td className="px-3 py-2 text-right font-display font-semibold text-brand-700 dark:text-brand-300">
                      Rs {n(v.net_abhi_dena).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-surface-500">{t("vs_note", lang)}</p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-surface-500 ${right ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({ value, tone, muted }: { value: number; tone?: string; muted?: boolean }) {
  return (
    <td className={`px-3 py-2 text-right ${tone ?? (muted ? "text-surface-400" : "text-surface-700 dark:text-surface-300")}`}>
      {value > 0 ? `Rs ${value.toLocaleString()}` : "—"}
    </td>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "brand" | "amber" | "red" }) {
  const colour =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-brand-700 dark:text-brand-300";
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="text-xs text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${colour}`}>Rs {value.toLocaleString()}</p>
    </div>
  );
}
