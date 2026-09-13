import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { KharcheClient } from "./kharche-client";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { billQismKaLabel } from "@/lib/kharche";
import { shopPaymentMethodBreakdown } from "@/lib/pos/shop-payment-methods";
import { ArrowDownCircle, ArrowUpCircle, Clock, Wallet } from "lucide-react";
import { LiveRefresh } from "@/components/live/live-refresh";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const MANZOORI_WALE = ["admin_assistant", "finance"];

/**
 * Kharche aur adaigi — din bhar ka har len-den ek jagah.
 *
 * Malik (6 September), pehle: *"Expense ka alag se tag hona chahiye
 * slide bar mein, jis mein daily koi bhi bill hai wo add kar sakein, jis
 * ki manzoori manager dega."*
 *
 * Aur phir naam par apna faisla:
 *
 *   *"Main 'Expense' naam nahi rakhunga, kyunke is screen mein sirf
 *   kharcha nahi hoga... Accounting mein farmer ko Rs 5,000 udhaar dena
 *   zaroori nahi ke expense ho. Mera recommended naam: Paisa & Khata."*
 *
 * Wo theek keh rahe the aur wajah bhi unhon ne khud likhi: "Expense"
 * rakhne se banda HAR cash-out ko kharcha samajhne lagta hai, aur wohi
 * ghalti P&L mein nafa kam dikhati hai.
 */
export default async function KharchePage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const role = String(me?.role ?? "");
  const sabKuchWala = UNRESTRICTED_ROLES.includes(role);
  const manzoorKarSakta =
    sabKuchWala || MANZOORI_WALE.includes(role) || (await canDo("kharche", "approve"));
  // Branch Manager: sirf apni branch ki tasdeeq (verify) -- final manzoori nahi.
  const taseeqKarSakta = !manzoorKarSakta && (await canDo("kharche", "verify"));
  const darjKarSakta = sabKuchWala || (await canDo("kharche", "create"));

  const service = createServiceClient();

  /**
   * Dukan par baithe bande ko us ki apni shaakh ka hisaab.
   *
   * Poore karobar ke kharche us ke saamne rakhna do wajhon se ghalat
   * hai: wo un ka zimmedar nahi, aur us ki apni fehrist un mein gum ho
   * jati hai.
   */
  let q = service
    .from("company_expense_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!sabKuchWala && me?.branch_id) q = q.eq("branch_id", me.branch_id);

  /**
   * Mazdoori ki qatarein bhi isi safhe par.
   *
   * Malik (6 September): *"Maine kaha tha shop par EK HI tag ho jis mein
   * Paisa & Khata ho — us mein koi kharcha hua add, kuch diya add, kuch
   * aaya add."*
   *
   * Wo theek keh rahe the. Mazdoori ka apna safha bana dena shop par
   * doosra tag khara kar deta hai, aur dukan par baitha banda har dafa
   * sochta hai ke kaunsa kholoon. Ab wo table apni jagah hai (us mein
   * ginti aur rate hain jo kharche ki qatar mein hote hi nahi), magar
   * DARWAZA ek hi hai.
   */
  const looseService = service as unknown as { from: (t: string) => any };
  let mq = looseService
    .from("labour_work_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!sabKuchWala && me?.branch_id) mq = mq.eq("branch_id", me.branch_id);

  const [
    { data: rawRows },
    { data: rawMazdoori },
    { data: khaate },
    { data: suppliers },
    { data: staff },
    { data: farmers },
    { data: customers },
  ] = await Promise.all([
      q,
      mq,
      // `current_balance` sirf Cash Book se banta hai (127) -- yehi wo
      // adad hai jo Finance ke safhe par nazar aata hai, is liye yahan
      // bhi wohi parha ja raha hai. Do jagah alag hisaab lagane se ek din
      // do alag jawab aate hain.
      service
        .from("finance_accounts")
        .select("id, name, gl_code, is_active, current_balance, account_type")
        .eq("is_active", true)
        .order("name"),
      service.from("suppliers").select("id, name").order("name").limit(500),
      service.from("profiles").select("id, full_name").eq("is_active", true).order("full_name").limit(500),
      service.from("farmers").select("id, full_name, phone_number").eq("is_deleted", false).order("full_name").limit(1000),
      service.from("customers").select("id, name, phone_number").order("name").limit(1000),
    ]);

  const rows = ((rawRows ?? []) as any[]).map((r) => ({
    id: r.id as string,
    expense_number: r.expense_number as string,
    kind: (r.kind as string | null) ?? "kharcha",
    category: r.category as string | null,
    categoryLabel: billQismKaLabel(r.category),
    amount: Number(r.amount ?? 0),
    description: (r.description as string | null) ?? "",
    status: (r.status as string) ?? "pending",
    rejection_reason: (r.rejection_reason as string | null) ?? null,
    party_type: (r.party_type as string | null) ?? null,
    party_id: (r.party_id as string | null) ?? null,
    party_name: (r.party_name as string | null) ?? null,
    document_url: (r.document_url as string | null) ?? null,
    expense_date: (r.expense_date as string | null) ?? (r.created_at as string).slice(0, 10),
    paid_from_account_id: (r.paid_from_account_id as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  const mazdooriRows = ((rawMazdoori ?? []) as any[]).map((r) => ({
    id: r.id as string,
    entry_number: r.entry_number as string,
    party_type: r.party_type as string,
    party_id: r.party_id as string,
    work_date: r.work_date as string,
    work_detail: r.work_detail as string,
    quantity: r.quantity != null ? Number(r.quantity) : null,
    unit: (r.unit as string | null) ?? null,
    rate: r.rate != null ? Number(r.rate) : null,
    amount: Number(r.amount ?? 0),
    advance_adjusted: Number(r.advance_adjusted ?? 0),
    payable_added: Number(r.payable_added ?? 0),
    received_by_name: (r.received_by_name as string | null) ?? null,
    status: (r.status as string) ?? "pending",
    rejection_reason: (r.rejection_reason as string | null) ?? null,
  }));

  // Bande ka naam har fehrist se -- taake qatar par id nahi, naam nazar
  // aaye. Id kisi ke kaam ki nahi.
  const naamMap = new Map<string, string>();
  (suppliers ?? []).forEach((s: any) => naamMap.set(s.id, s.name));
  (staff ?? []).forEach((s: any) => naamMap.set(s.id, s.full_name));
  (farmers ?? []).forEach((f: any) => naamMap.set(f.id, f.full_name));
  (customers ?? []).forEach((c: any) => naamMap.set(c.id, c.name));

  const khataNaam = new Map<string, string>();
  (khaate ?? []).forEach((k: any) => khataNaam.set(k.id, k.name));

  // 'verified' -- Branch Manager ki tasdeeq ho chuki, final manzoori
  // ka intezar hai (abhi bhi "intezar" mein ginna chahiye).
  const intezar = rows.filter((r) => r.status === "pending" || r.status === "verified");
  const manzoor = rows.filter((r) => r.status === "approved");

  // Aaj ka hisaab -- rukh ke hisaab se, "kharcha" aur "paisa gaya" ek
  // cheez nahi. (Qism ka rukh `lib/kharche.ts` mein likha hai.)
  const aaj = new Date().toISOString().slice(0, 10);
  const aajKe = manzoor.filter((r) => r.expense_date === aaj);
  const GAYE = ["kharcha", "supplier_ko_diya", "staff_ko_advance", "kisan_ko_advance"];
  const aajGaya = aajKe.filter((r) => GAYE.includes(r.kind)).reduce((s, r) => s + r.amount, 0);
  const aajAaya = aajKe.filter((r) => !GAYE.includes(r.kind)).reduce((s, r) => s + r.amount, 0);
  const intezarKiRaqam = intezar.reduce((s, r) => s + r.amount, 0);

  /**
   * Shop par baithe staff ke liye apni shop ka payment-method-wise
   * hisaab (malik, 8 September): "Is waqt khaton mein" poori company ka
   * combined balance hai, jo shop wale bande ke liye ghalat cheez hai --
   * us ki apni shop nahi. Ye hissa branch ka nahi, SIRF shop ka hai
   * (malik ne khud confirm kiya: ek branch mein ek se zyada shop hoti
   * hain).
   *
   * Date range khud chun sakte hain (malik: "filter ho, jab jo marzi ho
   * check kar lein") -- default AAJ.
   */
  const shopScoped = !sabKuchWala && Boolean(me?.shop_id);
  const todayStr = aaj;
  const fromDate = searchParams?.from || todayStr;
  const toDate = searchParams?.to || todayStr;
  const [shopBreakdown, shopRow] = shopScoped
    ? await Promise.all([
        shopPaymentMethodBreakdown(me!.shop_id as string, fromDate, toDate),
        service.from("shops").select("name").eq("id", me!.shop_id as string).maybeSingle(),
      ])
    : [null, null];
  const shopName = shopRow && "data" in shopRow ? (shopRow.data?.name as string | undefined) ?? null : null;

  return (
    <div>
      <PageHeader
        title={t("kh_page_title", lang)}
        description={t("kh_page_desc", lang)}
        actions={
          <LiveRefresh tables={["company_expense_requests", "labour_work_entries", "finance_transactions"]} />
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("kh_stat_aaj_gaya", lang)} value={`Rs. ${aajGaya.toLocaleString()}`} icon={ArrowDownCircle} tone="red" />
        <StatCard label={t("kh_stat_aaj_aaya", lang)} value={`Rs. ${aajAaya.toLocaleString()}`} icon={ArrowUpCircle} tone="green" />
        <StatCard
          label={`${t("kh_stat_manzoori_intezar", lang)} (${intezar.length})`}
          value={`Rs. ${intezarKiRaqam.toLocaleString()}`}
          icon={Clock}
          tone="warn"
        />
      </div>

      {shopScoped && (
        <Card className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
            <Wallet className="h-3.5 w-3.5" /> {shopName ?? t("kh_meri_dukan", lang)} {t("kh_shop_hisaab_suffix", lang)}
          </p>

          <form className="mb-3 flex flex-wrap items-end gap-2 text-sm" method="GET">
            <div>
              <label className="mb-1 block text-[11px] text-surface-500">{t("kh_se", lang)}</label>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-surface-500">{t("kh_tak", lang)}</label>
              <input
                type="date"
                name="to"
                defaultValue={toDate}
                className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("kh_dekhein", lang)}
            </button>
          </form>

          {shopBreakdown && shopBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
                    <th className="pb-1.5 pr-4">{t("kh_payment_method_col", lang)}</th>
                    <th className="pb-1.5 pr-4 text-right">{t("kh_sale_col", lang)}</th>
                    <th className="pb-1.5 pr-4 text-right">{t("kh_kharcha_adaigi_col", lang)}</th>
                    <th className="pb-1.5 text-right">{t("kh_bacha_col", lang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {shopBreakdown.map((r) => (
                    <tr key={r.method}>
                      <td className="py-1.5 pr-4">{r.label}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        Rs {r.sales.toLocaleString()}
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-surface-600 dark:text-surface-300">
                        {r.expenseNet >= 0 ? "+" : ""}
                        Rs {r.expenseNet.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-semibold text-surface-900 dark:text-surface-100">
                        Rs {r.net.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-surface-400">{t("kh_no_pos_sale_in_range", lang)}</p>
          )}

          <p className="mt-2 text-[11px] leading-snug text-surface-400">
            {t("kh_shop_footer_prefix", lang)} {shopName ?? t("kh_isi_dukan", lang)} {t("kh_shop_footer_suffix", lang)}
          </p>
        </Card>
      )}

      <KharcheClient
        rows={rows}
        mazdooriRows={mazdooriRows}
        showCompanyBalances={!shopScoped}
        khaate={(khaate ?? []).map((k: any) => ({
          id: k.id,
          name: k.name,
          gl_code: k.gl_code,
          balance: Number(k.current_balance ?? 0),
          account_type: k.account_type as string,
        }))}
        isUnrestricted={sabKuchWala}
        bande={{
          supplier: (suppliers ?? []).map((s: any) => ({ id: s.id, naam: s.name })),
          staff: (staff ?? []).map((s: any) => ({ id: s.id, naam: s.full_name })),
          farmer: (farmers ?? []).map((f: any) => ({
            id: f.id,
            naam: f.phone_number ? `${f.full_name} — ${f.phone_number}` : f.full_name,
          })),
          customer: (customers ?? []).map((c: any) => ({
            id: c.id,
            naam: c.phone_number ? `${c.name} — ${c.phone_number}` : c.name,
          })),
        }}
        naamMap={Object.fromEntries(naamMap)}
        khataNaam={Object.fromEntries(khataNaam)}
        darjKarSakta={darjKarSakta}
        manzoorKarSakta={manzoorKarSakta}
        taseeqKarSakta={taseeqKarSakta}
      />
    </div>
  );
}
