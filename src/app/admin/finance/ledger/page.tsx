import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { accountLedger } from "@/lib/ledger/reports";
import { ArrowLeft, Download } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function money(n: number) {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toLocaleString();
  return neg ? `(${s})` : s;
}

/** Business type → source_module mapping */
const BUSINESS_GROUPS: { key: string; label: string; modules: string[] }[] = [
  { key: "all",         label: "Sab (Poora Ledger)",          modules: [] },
  { key: "karyana",     label: "Karyana / POS",               modules: ["pos", "pos_return", "pos_shift_close"] },
  { key: "kisan_dukan", label: "Kisan Dukan / Load Bill",     modules: ["load_bill"] },
  { key: "machinery",   label: "Machinery Kiraya",            modules: ["machinery_bill", "machinery_payment", "machinery_vendor_payout", "machinery_advance", "machinery_correction", "machinery_reset", "machinery_fuel", "machinery_fuel_fix"] },
  { key: "kharid",      label: "Kharid / Suppliers",          modules: ["purchase", "supplier_payment", "supplier_payment_reversal", "purchase_correction"] },
  { key: "doodh",       label: "Doodh / Milk",                modules: ["milk_collection", "milk_payment"] },
  { key: "grain",       label: "Anaaj / Khaad / Pesticide",   modules: ["grain_procurement", "grain_payment", "grain_sale"] },
  { key: "udhaar",      label: "Udhaar / Customer Credit",    modules: ["customer_udhaar", "customer_udhaar_wapsi", "customer_import"] },
];

export default async function AccountLedgerPage({
  searchParams,
}: {
  searchParams: { account?: string; from?: string; to?: string; business?: string };
}) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("led_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const { data: accounts } = await service
    .from("gl_accounts")
    .select("code, name")
    .eq("is_active", true)
    .order("sort_order");

  const aaj = aajKaKhana();
  const saalShuru = `${new Date().getFullYear()}-01-01`;
  const from = searchParams.from ?? saalShuru;
  const to = searchParams.to ?? aaj;
  const code = searchParams.account ?? "";
  const bizKey = searchParams.business ?? "all";
  const selectedGroup = BUSINESS_GROUPS.find((g) => g.key === bizKey) ?? BUSINESS_GROUPS[0];
  const sourceModules = selectedGroup.modules.length > 0 ? selectedGroup.modules : null;

  const led = code ? await accountLedger(code, from, to, null, sourceModules) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("led_title", lang)}
        description={t("led_desc", lang)}
        actions={
          <Link
            href="/admin/finance/accounts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("led_back", lang)}
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-2" action="/admin/finance/ledger">
          <div>
            <label className="block text-xs text-surface-500" htmlFor="account">
              {t("led_account", lang)}
            </label>
            <select
              id="account"
              name="account"
              defaultValue={code}
              className="w-64 rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              <option value="">—</option>
              {(accounts ?? []).map((a) => (
                <option key={a.code as string} value={a.code as string}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-surface-500" htmlFor="business">
              Business / Shoba
            </label>
            <select
              id="business"
              name="business"
              defaultValue={bizKey}
              className="w-52 rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              {BUSINESS_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-surface-500" htmlFor="from">
              {t("led_from", lang)}
            </label>
            <input
              id="from"
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <div>
            <label className="block text-xs text-surface-500" htmlFor="to">
              {t("led_to", lang)}
            </label>
            <input
              id="to"
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            {t("led_show", lang)}
          </button>
          {led && !led.error && (
            <a
              href={`/admin/finance/ledger/export?account=${code}&from=${from}&to=${to}&business=${bizKey}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <Download className="h-4 w-4" /> CSV
            </a>
          )}
        </form>
      </Card>

      {!led && (
        <Card className="py-10 text-center text-sm text-surface-500">{t("led_pick", lang)}</Card>
      )}

      {led?.error && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("led_error", lang)}: {led.error}
        </Card>
      )}

      {led && !led.error && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs uppercase tracking-wide text-surface-500">{t("led_opening", lang)}</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums">{money(led.opening)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-surface-500">{t("led_debit", lang)}</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums">{money(led.totalDebit)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-surface-500">{t("led_credit", lang)}</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums">{money(led.totalCredit)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-surface-500">{t("led_closing", lang)}</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                {money(led.closing)}{" "}
                <span className="text-xs font-normal text-surface-400">
                  {led.closing === 0 ? "" : led.closing > 0 ? (led.normalSide === "debit" ? "Dr" : "Cr") : led.normalSide === "debit" ? "Cr" : "Dr"}
                </span>
              </p>
            </Card>
          </div>

          {bizKey !== "all" && (
            <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Filter: <strong>{selectedGroup.label}</strong> — Opening balance filtered period se pehle ka poora hisaab dikha raha hai (sab business mila kar).
            </div>
          )}

          <Card className="overflow-x-auto p-0">
            <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
              <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">
                <span className="font-mono text-xs text-surface-400">{led.code}</span> {led.name}
                {bizKey !== "all" && (
                  <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    {selectedGroup.label}
                  </span>
                )}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
                <tr>
                  <th className="px-4 py-2">{t("led_date", lang)}</th>
                  <th className="px-4 py-2">{t("led_entry", lang)}</th>
                  <th className="px-4 py-2">{t("led_what", lang)}</th>
                  <th className="px-4 py-2 text-right">{t("led_debit", lang)}</th>
                  <th className="px-4 py-2 text-right">{t("led_credit", lang)}</th>
                  <th className="px-4 py-2 text-right">{t("led_balance", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                <tr className="bg-surface-50/60 dark:bg-surface-800/30">
                  <td className="px-4 py-1.5 text-surface-500" colSpan={5}>
                    {t("led_opening_row", lang)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium tabular-nums">{money(led.opening)}</td>
                </tr>
                {led.lines.map((l, i) => (
                  <tr key={`${l.entryId}-${i}`}>
                    <td className="px-4 py-1.5 whitespace-nowrap text-surface-600 dark:text-surface-300">{l.entryDate}</td>
                    <td className="px-4 py-1.5 font-mono text-xs text-surface-500">{l.entryNumber}</td>
                    <td className="px-4 py-1.5 text-surface-900 dark:text-white">
                      {l.description}
                      {l.memo && <span className="block text-xs text-surface-400">{l.memo}</span>}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                    <td className="px-4 py-1.5 text-right font-medium tabular-nums">{money(l.balance)}</td>
                  </tr>
                ))}
                {led.lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                      {t("led_empty", lang)}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-600">
                  <td className="px-4 py-2" colSpan={3}>
                    {t("led_closing", lang)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(led.totalDebit)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(led.totalCredit)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(led.closing)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card className="text-xs text-surface-500 dark:text-surface-400">{t("led_note", lang)}</Card>
        </>
      )}
    </div>
  );
}
