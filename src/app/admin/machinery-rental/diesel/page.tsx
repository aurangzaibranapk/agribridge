import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

const PAID_BY: Record<string, string> = {
  farmer: "md_by_farmer",
  vendor: "md_by_vendor",
  company: "md_by_art",
};

/**
 * Diesel ka poora naqsha.
 *
 * "Litre per acre" wo adad hai jis se pata chalta hai ke kisi machine
 * par kuch theek nahi -- aur wo adad ab tak kisi safhe par nahi tha.
 * Ek machine 4 litre per acre khaye aur doosri 9, to doosri par kuch
 * to hai: ya machine kharab hai, ya diesel kahin aur ja raha hai.
 */
export default async function DieselPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("v_machinery_diesel_summary")
    .select("*")
    .order("log_date", { ascending: false })
    .limit(300);

  const logs = rows ?? [];
  const n = (v: unknown) => Number(v ?? 0);
  const verified = logs.filter((l) => l.verification_status === "verified");

  const total = verified.reduce((s, l) => s + n(l.amount), 0);
  const litres = verified.reduce((s, l) => s + n(l.litres), 0);
  const by = (who: string) =>
    verified.filter((l) => l.paid_by === who).reduce((s, l) => s + n(l.amount), 0);

  // Machine ke hisaab se -- yahi wo qatar hai jo masla dikhati hai.
  const byMachine = new Map<string, { label: string; litres: number; acres: number; amount: number }>();
  for (const l of verified) {
    const key = (l.machine_id as string | null) ?? "none";
    const label = l.machine_type
      ? `${l.machine_type}${l.machine_model ? ` (${l.machine_model})` : ""}`
      : t("lb_machine_pending", lang);
    const e = byMachine.get(key) ?? { label, litres: 0, acres: 0, amount: 0 };
    e.litres += n(l.litres);
    e.amount += n(l.amount);
    e.acres += n(l.booking_ke_acre);
    byMachine.set(key, e);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("md_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("md_subtitle", lang)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tile label={t("md_total_litres", lang)} value={`${litres} L`} />
        <Tile label={t("md_total_cost", lang)} value={`Rs ${total.toLocaleString()}`} />
        <Tile label={t("md_by_farmer", lang)} value={`Rs ${by("farmer").toLocaleString()}`} tone="amber" />
        <Tile label={t("md_by_vendor", lang)} value={`Rs ${by("vendor").toLocaleString()}`} />
        <Tile label={t("md_by_art", lang)} value={`Rs ${by("company").toLocaleString()}`} tone="red" />
      </div>

      {/* Machine ke hisaab se. Litre per acre yahin dikhta hai. */}
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {t("md_by_machine", lang)}
          </h2>
          <p className="text-xs text-surface-500">{t("md_by_machine_hint", lang)}</p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[...byMachine.values()]
              .sort((a, b) => b.litres - a.litres)
              .map((m) => (
                <tr key={m.label} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{m.label}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{m.litres} L</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                    Rs {m.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-surface-900 dark:text-white">
                    {m.acres > 0 ? `${Math.round((m.litres / m.acres) * 100) / 100} L/acre` : "—"}
                  </td>
                </tr>
              ))}
            {byMachine.size === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-surface-400">
                  {t("md_empty", lang)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {t("md_entries", lang)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-surface-200 text-left dark:border-surface-800">
                <Th>{t("mc_date", lang)}</Th>
                <Th>{t("mc_booking_no", lang)}</Th>
                <Th>{t("mc_machine", lang)}</Th>
                <Th right>{t("mc_diesel_litre", lang)}</Th>
                <Th right>{t("mc_diesel_rate", lang)}</Th>
                <Th right>{t("mc_amount", lang)}</Th>
                <Th>{t("mc_diesel_paid_by", lang)}</Th>
                <Th right>L/acre</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.fuel_log_id as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 whitespace-nowrap text-surface-500">
                    {new Date(l.log_date as string).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/machinery-rental/booking/${l.booking_id}`}
                      className="text-surface-700 hover:underline dark:text-surface-300"
                    >
                      {(l.booking_number as string) ?? "—"}
                    </Link>
                    <p className="text-surface-400">{(l.farmer_name as string | null) ?? ""}</p>
                  </td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                    {l.machine_type ? `${l.machine_type}${l.machine_model ? ` (${l.machine_model})` : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                    {l.litres === null ? "—" : `${n(l.litres)} L`}
                  </td>
                  <td className="px-3 py-2 text-right text-surface-500">
                    {l.rate_per_litre === null ? "—" : `Rs ${n(l.rate_per_litre)}`}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-surface-800 dark:text-surface-200">
                    Rs {n(l.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <span className="text-surface-600 dark:text-surface-400">
                      {t((PAID_BY[(l.paid_by as string) ?? ""] ?? "mc_other") as any, lang)}
                    </span>
                    {l.vendor_recoverable && (
                      <span className="block text-[10px] text-red-600 dark:text-red-400">
                        {t("md_recoverable", lang)}
                      </span>
                    )}
                    {l.verification_status !== "verified" && (
                      <span className="block text-[10px] text-amber-600">{t("md_unverified", lang)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-surface-500">
                    {l.litre_per_acre === null ? "—" : n(l.litre_per_acre)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-surface-400">
                    {t("md_empty", lang)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-surface-500 ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" }) {
  const colour =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-surface-900 dark:text-white";
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="text-xs text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${colour}`}>{value}</p>
    </div>
  );
}
