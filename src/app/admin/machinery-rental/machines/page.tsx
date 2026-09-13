import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { key: string; tone: string }> = {
  available:   { key: "mm_available",   tone: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" },
  working:     { key: "mm_working",     tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  maintenance: { key: "mm_maintenance", tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  inactive:    { key: "mm_inactive",    tone: "bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400" },
};

/**
 * Machines ka apna safha.
 *
 * Machine abhi tak vendor ke neeche ek qatar thi. Us se wo sawal
 * kabhi nahi milte the jin par machine rakhne ka faisla hota hai:
 * is ne kitne acre kiye, kitna diesel piya, per acre kitna kharcha,
 * aur kitna diya.
 */
export default async function MachinesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("v_machinery_machines")
    .select("*")
    .order("season_ke_acre", { ascending: false });

  const machines = rows ?? [];
  const n = (v: unknown) => Number(v ?? 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mm_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mm_subtitle", lang)}</p>
      </div>

      {machines.length === 0 ? (
        <p className="rounded-card border border-surface-200 bg-white px-4 py-10 text-center text-sm text-surface-400 dark:border-surface-800 dark:bg-surface-900">
          {t("mm_empty", lang)}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {machines.map((m) => {
            const st = STATUS[(m.status as string) ?? "available"] ?? STATUS.available;
            return (
              <div
                key={m.machine_id as string}
                className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">
                      {m.machine_type as string}
                      {m.model ? ` (${m.model})` : ""}
                    </p>
                    <p className="text-xs text-surface-400">
                      {(m.machine_code as string | null) ?? "—"}
                      {m.registration_number ? ` · ${m.registration_number}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500">
                      {m.owner === "art" ? t("mm_owner_art", lang) : (m.vendor_name as string | null) ?? "—"}
                    </p>
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${st.tone}`}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(st.key as any, lang)}
                  </span>
                </div>

                {/* Chal rahi booking -- "abhi kahan hai" ka jawab. */}
                {m.chal_rahi_booking && (
                  <p className="mt-2 rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                    {t("mm_on_job", lang)}: {m.chal_rahi_booking as string}
                    {m.chal_raha_kisan ? ` · ${m.chal_raha_kisan}` : ""}
                  </p>
                )}

                {m.driver_name && (
                  <p className="mt-1 text-xs text-surface-500">
                    {t("mc_driver", lang)}: {m.driver_name as string}
                    {m.driver_phone ? ` · ${m.driver_phone}` : ""}
                  </p>
                )}

                {/* Season ke adad. Yahi wo cheez hai jo ab tak kahin
                    nahi thi -- aur jis par machine rakhne ka faisla
                    hota hai. */}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-surface-100 pt-3 text-center dark:border-surface-800">
                  <Cell label={t("mc_acres", lang)} value={String(n(m.season_ke_acre))} />
                  <Cell label={t("mm_diesel_pa", lang)} value={m.litre_per_acre ? `${n(m.litre_per_acre)} L` : "—"} />
                  <Cell
                    label={t("mm_billing_pa", lang)}
                    value={m.billing_per_acre ? `Rs ${n(m.billing_per_acre).toLocaleString()}` : "—"}
                  />
                </div>

                <div className="mt-2 flex justify-between text-xs text-surface-500">
                  <span>
                    {n(m.kitni_bookings)} {t("mc_bookings", lang)}
                  </span>
                  <span>
                    {t("mm_diesel_total", lang)}: {n(m.diesel_litre)} L · Rs {n(m.diesel_raqam).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-surface-400">{label}</p>
    </div>
  );
}
