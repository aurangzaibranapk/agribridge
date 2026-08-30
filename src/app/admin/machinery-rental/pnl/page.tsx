import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Machinery ka apna P&L.
 *
 * Poore karobar ka P&L pehle se hai, magar us se ye sawal nahi milta:
 * "machinery se hum ne waqai kitna kamaya?"
 *
 * Aur us sawal ka ek jaal hai jo aksar ghalat jawab deta hai: ART ka
 * diya hua diesel jo VENDOR se wapas aata hai, wo kharcha NAHI hai.
 * Usay kharche mein ginna machinery ka munafa jhooti tarah kam kar ke
 * dikhata hai -- aur usi adad par machine rakhne ya na rakhne ka
 * faisla hota hai.
 */
export default async function MachineryPnlPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: byMachine }, { data: byVendor }, { data: byCrop }, { data: byMonth }] = await Promise.all([
    supabase.from("v_machinery_pnl_machine").select("*").order("munafa", { ascending: false }),
    supabase.from("v_machinery_pnl_vendor").select("*").order("munafa", { ascending: false }),
    supabase.from("v_machinery_pnl_crop").select("*").order("munafa", { ascending: false }),
    supabase.from("v_machinery_pnl_month").select("*").order("maheena", { ascending: false }).limit(12),
  ]);

  const n = (v: unknown) => Number(v ?? 0);
  const months = byMonth ?? [];
  const total = {
    gross: months.reduce((s, r) => s + n(r.gross_billing), 0),
    vendor: months.reduce((s, r) => s + n(r.vendor_ka_hissa), 0),
    ours: months.reduce((s, r) => s + n(r.hamari_aamdani), 0),
    diesel: months.reduce((s, r) => s + n(r.hamara_diesel), 0),
    profit: months.reduce((s, r) => s + n(r.munafa), 0),
    acre: months.reduce((s, r) => s + n(r.acre), 0),
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mp_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mp_subtitle", lang)}</p>
      </div>

      {/* Poora hisaab ek qatar mein -- aur har lakeer ka apna naam. */}
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <Row label={t("mp_gross", lang)} value={total.gross} />
        <Row label={t("mp_vendor_share", lang)} value={-total.vendor} />
        <div className="my-1 border-t border-surface-100 dark:border-surface-800" />
        <Row label={t("mp_our_income", lang)} value={total.ours} strong />
        <Row label={t("mp_our_diesel", lang)} value={-total.diesel} />
        <div className="mt-2 flex justify-between border-t-2 border-surface-200 pt-2 font-display text-lg font-bold dark:border-surface-700">
          <span>{t("mp_profit", lang)}</span>
          <span className={total.profit >= 0 ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}>
            Rs {total.profit.toLocaleString()}
          </span>
        </div>
        {total.acre > 0 && (
          <p className="mt-1 text-right text-xs text-surface-500">
            {total.acre} {t("mc_acres", lang)} · Rs {Math.round((total.profit / total.acre) * 100) / 100}{" "}
            {t("mp_per_acre", lang)}
          </p>
        )}
      </div>

      <p className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300">
        {t("mp_diesel_note", lang)}
      </p>

      <Section title={t("mp_by_machine", lang)}>
        <table className="w-full text-xs">
          <tbody>
            {(byMachine ?? []).map((r) => (
              <tr key={r.machine_id as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2">
                  <p className="font-medium text-surface-800 dark:text-surface-200">
                    {r.machine_type as string}
                    {r.machine_code ? ` · ${r.machine_code}` : ""}
                  </p>
                  <p className="text-surface-400">
                    {r.machine_owner === "art" ? t("mm_owner_art", lang) : (r.vendor_name as string | null) ?? "—"}
                  </p>
                </td>
                <td className="px-3 py-2 text-right text-surface-500">{n(r.acre)} acre</td>
                <td className="px-3 py-2 text-right font-semibold text-brand-700 dark:text-brand-300">
                  Rs {n(r.munafa).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-surface-500">
                  {r.munafa_per_acre ? `Rs ${n(r.munafa_per_acre)}/acre` : "—"}
                </td>
              </tr>
            ))}
            {(byMachine ?? []).length === 0 && <Empty lang={lang} />}
          </tbody>
        </table>
      </Section>

      <Section title={t("mp_by_vendor", lang)}>
        <table className="w-full text-xs">
          <tbody>
            {(byVendor ?? []).map((r) => (
              <tr key={r.vendor_id as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{r.vendor_name as string}</td>
                <td className="px-3 py-2 text-right text-surface-500">{n(r.acre)} acre</td>
                <td className="px-3 py-2 text-right text-surface-500">
                  Rs {n(r.vendor_ka_hissa).toLocaleString()} {t("mp_to_vendor", lang)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-brand-700 dark:text-brand-300">
                  Rs {n(r.munafa).toLocaleString()}
                </td>
              </tr>
            ))}
            {(byVendor ?? []).length === 0 && <Empty lang={lang} />}
          </tbody>
        </table>
      </Section>

      <Section title={t("mp_by_crop", lang)}>
        <table className="w-full text-xs">
          <tbody>
            {(byCrop ?? []).map((r) => (
              <tr key={r.crop_type as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{r.crop_type as string}</td>
                <td className="px-3 py-2 text-right text-surface-500">{n(r.acre)} acre</td>
                <td className="px-3 py-2 text-right font-semibold text-brand-700 dark:text-brand-300">
                  Rs {n(r.munafa).toLocaleString()}
                </td>
              </tr>
            ))}
            {(byCrop ?? []).length === 0 && <Empty lang={lang} />}
          </tbody>
        </table>
      </Section>

      <Section title={t("mp_by_month", lang)}>
        <table className="w-full text-xs">
          <tbody>
            {months.map((r) => (
              <tr key={r.maheena as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">
                  {new Date(r.maheena as string).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                </td>
                <td className="px-3 py-2 text-right text-surface-500">{n(r.acre)} acre</td>
                <td className="px-3 py-2 text-right text-surface-500">Rs {n(r.gross_billing).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-semibold text-brand-700 dark:text-brand-300">
                  Rs {n(r.munafa).toLocaleString()}
                </td>
              </tr>
            ))}
            {months.length === 0 && <Empty lang={lang} />}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  // Manfi sifar ko sifar likha jaye.
  //
  // Kharche wali lakeerein `value={-total.diesel}` bhejti hain. Diesel
  // sifar ho to JavaScript mein `-0` banta hai, aur `-0 < 0` GHALAT hai
  // -- to neeche wali shart sifar ko manfi nahi samajhti aur seedha
  // `(-0).toLocaleString()` chhaap deti hai, yani "Rs -0".
  //
  // Paise ke safhe par "Rs -0" parh kar banda rukta hai aur sochta hai
  // ke kya cheez manfi hai. Kuch bhi nahi -- sirf sifar hai.
  const v = value === 0 ? 0 : value;
  return (
    <div className={`flex justify-between text-sm ${strong ? "font-medium" : ""}`}>
      <span className="text-surface-600 dark:text-surface-300">{label}</span>
      <span className="text-surface-800 dark:text-surface-200">
        {v < 0 ? `- Rs ${Math.abs(v).toLocaleString()}` : `Rs ${v.toLocaleString()}`}
      </span>
    </div>
  );
}

function Empty({ lang }: { lang: "en" | "rm" | "ur" }) {
  return (
    <tr>
      <td colSpan={4} className="px-3 py-8 text-center text-surface-400">
        {t("mp_empty", lang)}
      </td>
    </tr>
  );
}
