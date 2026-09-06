import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import {
  Wallet,
  CreditCard,
  Landmark,
  ShoppingCart,
  ClipboardList,
  TrendingUp,
  Boxes,
  Receipt,
  Smartphone,
  ArrowDownCircle,
  Package,
  HandCoins,
  AlertTriangle,
  Hourglass,
} from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

/** Rs likhne ka ek hi tareeqa -- poore safhe par. */
function rs(n: number) {
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const lang = getLanguageFromCookies("rm");
  const { start, end } = getDateRange(range);
  const supabase = createClient();

  /**
   * Ye safha kis ka hai.
   *
   * Malik (6 September): *"reports view jo already bataya hai wo aana
   * chahiye -- kitna stock tha, kitna sale hua, kitna kis khaate mein
   * hai."*
   *
   * Dukan par baithe bande ko POORE karobar ka adad dena us ke kisi kaam
   * ka nahi -- aur ghalat fehmi ka sabab banta hai (wo samajhta hai
   * itna maal MERE paas hai). Is liye jis bande ki apni dukan maloom
   * hai, us ka safha usi dukan par band kar diya jata hai; owner /
   * admin ko sab kuch nazar aata hai kyunki wo kisi ek dukan ka nahi
   * hota.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, shop_id, branch_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));
  const meriDukan = !sabKuchWala ? ((me?.shop_id as string | null) ?? null) : null;
  const branchId = meriDukan ? "" : params.branch || "";

  const [{ data: branches }, { data: dukanein }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("shops").select("id, name, business_type, branch_id"),
  ]);

  const dukanKiQism = new Map<string, string>();
  const dukanKaNaam = new Map<string, string>();
  (dukanein ?? []).forEach((d) => {
    dukanKiQism.set(d.id, String(d.business_type ?? ""));
    dukanKaNaam.set(d.id, String(d.name ?? ""));
  });

  let salesQuery = supabase
    .from("pos_sales")
    .select(
      "id, total_amount, cash_paid, khata_amount, payment_mode, created_at, branch_id, shop_id, created_by, branches(name), dealers(business_name)"
    )
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });
  if (meriDukan) salesQuery = salesQuery.eq("shop_id", meriDukan);
  else if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);

  const { data: sales } = await salesQuery.limit(200);

  const cashierIds = [...new Set((sales ?? []).map((s) => s.created_by).filter(Boolean))];
  const { data: cashiers } = cashierIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", cashierIds)
    : { data: [] };
  const cashierMap = new Map((cashiers ?? []).map((c) => [c.id, c.full_name]));

  /**
   * Malik ka maanga hua "dukan ka poora din" (6 September):
   *
   *   *"is tarah ka sale report view staff ke paas aana chahiye, jis
   *   mein us ke paas yahan total stock value, kis kis khaate mein kya
   *   sale, kya udhaar diya, kitna load kia hai, QR se kitni sale hai,
   *   Easypaisa se kitna, JazzCash se kitna hai, Kisan Card se kitna,
   *   credit kitna hai, bill kitna — is tarah ka view aana chahiye
   *   sales staff ko. Karyana shop ho, agri inputs show ho, daily
   *   expenses kitne kia hain wo bhi — ye cards mein data aana chahiye."*
   *
   * -------------------------------------------------------------------
   * "KIS KHAATE MEIN" KA JAWAB `payment_mode` SE NAHI MILTA
   *
   * `pos_sales.payment_mode` sirf itna kehta hai: cash / khata / split /
   * bank / kisan_card. Us se ye sawal jawab nahi paata ke QR se kitna
   * aaya aur Easypaisa se kitna -- dono "bank" ke neeche chhup jate
   * hain, aur yehi wo sawal hai jo malik roz poochte hain.
   *
   * Asal tafseel `pos_sale_payment_details` mein hai (har adaigi ka apna
   * tareeqa aur raqam), aur us tareeqe ka khata
   * `payment_method_account_map` batata hai -- wohi naqsha jo ledger
   * istemal karta hai. Do jagah alag hisaab lagane se report aur kitab
   * alag adad dene lagte, is liye yahan bhi wohi naqsha parha ja raha
   * hai.
   */
  const saleIds = (sales ?? []).map((s) => s.id);

  const [{ data: adaigiyan }, { data: khataMap }, { data: loadRows }, { data: kharche }, { data: godaam }] =
    await Promise.all([
      saleIds.length > 0
        ? supabase.from("pos_sale_payment_details").select("sale_id, payment_method, amount").in("sale_id", saleIds)
        : Promise.resolve({ data: [] as { sale_id: string; payment_method: string; amount: number }[] }),
      supabase.from("payment_method_account_map").select("payment_method, finance_accounts(name)"),
      supabase
        .from("load_transactions")
        .select("kind, principal, service_charge, commission_confirmed, status, created_at, branch_id")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("finance_transactions")
        .select("amount, category, transaction_date")
        .eq("transaction_type", "expense")
        .gte("transaction_date", start.toISOString().slice(0, 10))
        .lte("transaction_date", end.toISOString().slice(0, 10)),
      supabase.from("warehouses").select("id, name, branch_id, shop_id"),
    ]);

  // Tareeqe ka naam -> khaate ka naam (wohi naqsha jo ledger parhta hai).
  const khataKaNaam = new Map<string, string>();
  for (const m of (khataMap ?? []) as {
    payment_method: string;
    finance_accounts: { name: string } | { name: string }[] | null;
  }[]) {
    const fa = Array.isArray(m.finance_accounts) ? m.finance_accounts[0] : m.finance_accounts;
    if (fa?.name) khataKaNaam.set(m.payment_method, fa.name);
  }

  const khaateWaliSale = new Map<string, number>();
  for (const a of (adaigiyan ?? []) as { payment_method: string; amount: number }[]) {
    const raqam = Number(a.amount ?? 0);
    if (raqam <= 0) continue;
    // Jis tareeqe ka khata darj nahi, usay CHUPCHAAP kisi khaate mein
    // nahi daala jata -- wo apne naam se nazar aata hai, taake mapping
    // ki kami saamne rahe.
    const naam = khataKaNaam.get(a.payment_method) ?? `${a.payment_method} (khata darj nahi)`;
    khaateWaliSale.set(naam, (khaateWaliSale.get(naam) ?? 0) + raqam);
  }
  const khaateKiFehrist = [...khaateWaliSale.entries()].sort((a, b) => b[1] - a[1]);

  // Udhaar (khata) -- bikri ka wo hissa jo abhi aaya hi nahi.
  const udhaarDiya = (sales ?? []).reduce((sum, s: any) => sum + Number(s.khata_amount ?? 0), 0);
  const naqadAaya = (sales ?? []).reduce((sum, s: any) => sum + Number(s.cash_paid ?? 0), 0);

  const chalteLoad = (loadRows ?? []).filter(
    (l: any) => l.status !== "wapas" && (!branchId || l.branch_id === branchId)
  );
  const loadKiRaqam = chalteLoad
    .filter((l: any) => l.kind === "load")
    .reduce((s2, l: any) => s2 + Number(l.principal ?? 0), 0);
  const billKiRaqam = chalteLoad
    .filter((l: any) => l.kind === "bill")
    .reduce((s2, l: any) => s2 + Number(l.principal ?? 0), 0);
  const loadKiAamdani = chalteLoad.reduce(
    (s2, l: any) => s2 + Number(l.service_charge ?? 0) + Number(l.commission_confirmed ?? 0),
    0
  );

  const kulKharche = (kharche ?? []).reduce((sum, k: any) => sum + Number(k.amount ?? 0), 0);
  const kharchKiQismein = new Map<string, number>();
  (kharche ?? []).forEach((k: any) => {
    const naam = String(k.category ?? "").trim() || "(qism likhi nahi)";
    kharchKiQismein.set(naam, (kharchKiQismein.get(naam) ?? 0) + Number(k.amount ?? 0));
  });
  const kharchKiFehrist = [...kharchKiQismein.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  /**
   * Stock ki qeemat -- aur wo bhi usi dukan ki.
   *
   * Godam ka `shop_id` batata hai ke maal kis dukan ka hai. Jis godam ka
   * `shop_id` khali hai wo HQ ka hai -- kisi dukan ka nahi -- aur usay
   * kisi dukan ke khaate mein daalna ghalat adad deta. Wo alag ginaa
   * jata hai.
   */
  const mereGodam = (godaam ?? []).filter((w: any) => {
    if (meriDukan) return w.shop_id === meriDukan;
    if (branchId) return w.branch_id === branchId;
    return true;
  });
  const godamKiDukan = new Map<string, string | null>();
  mereGodam.forEach((w: any) => godamKiDukan.set(w.id, (w.shop_id as string | null) ?? null));
  const godamIds = mereGodam.map((w: any) => w.id);

  const [{ data: stockRows }, { data: productRows }] = await Promise.all([
    godamIds.length > 0
      ? supabase.from("inventory").select("product_id, quantity_on_hand, warehouse_id, updated_at").in("warehouse_id", godamIds)
      : Promise.resolve({
          data: [] as { product_id: string; quantity_on_hand: number; warehouse_id: string; updated_at: string }[],
        }),
    supabase.from("products").select("id, purchase_price").eq("is_deleted", false),
  ]);

  const kharidQeemat = new Map<string, number>();
  (productRows ?? []).forEach((p: any) => kharidQeemat.set(p.id, Number(p.purchase_price ?? 0)));

  let kulStockQeemat = 0;
  let kulStockGinti = 0;
  const stockQismWar = new Map<string, number>();
  (stockRows ?? []).forEach((r: any) => {
    const ginti = Number(r.quantity_on_hand ?? 0);
    kulStockGinti += ginti;
    const qeemat = ginti * (kharidQeemat.get(r.product_id) ?? 0);
    if (qeemat === 0) return;
    kulStockQeemat += qeemat;
    const shopId = godamKiDukan.get(r.warehouse_id) ?? null;
    const qism = shopId ? dukanKiQism.get(shopId) || "(qism darj nahi)" : "HQ godam (kisi dukan ka nahi)";
    stockQismWar.set(qism, (stockQismWar.get(qism) ?? 0) + qeemat);
  });

  /**
   * Jo maal bahut arse se hila hi nahi.
   *
   * Ye "aging" ka takhmeena hai, naap nahi -- aur ye baat safhe par bhi
   * likhi hui hai. `inventory.updated_at` sirf itna kehta hai ke us
   * qatar ko aakhri dafa kab chhua gaya; maal kab AAYA tha wo batch aur
   * stock movements ki fehrist se aata hai. Is liye yahan daawa wohi
   * kiya ja raha hai jo ye khana waqai jaanta hai: "itne din se hili
   * nahi" -- "itne din purana maal" nahi.
   */
  const BEES_DIN = 20;
  const purani = new Date(Date.now() - BEES_DIN * 24 * 60 * 60 * 1000);
  const naHiliQatarein = (stockRows ?? []).filter(
    (r: any) => Number(r.quantity_on_hand ?? 0) > 0 && r.updated_at && new Date(r.updated_at) < purani
  ).length;

  /**
   * Kitna lena hai -- aur kis ki hadd bhar chuki hai.
   *
   * Khata branch ke sath juda hai, dukan ke sath nahi. Is liye dukan par
   * baithe bande ko us ki BRANCH ka lena nazar aata hai, aur ye baat
   * card par likhi hui hai -- warna wo samajhta hai ye sirf us ki dukan
   * ka hai.
   */
  const meriBranch = (me?.branch_id as string | null) ?? null;
  let khataQuery = supabase.from("khata_accounts").select("current_balance, credit_limit, branch_id");
  if (meriDukan && meriBranch) khataQuery = khataQuery.eq("branch_id", meriBranch);
  else if (branchId) khataQuery = khataQuery.eq("branch_id", branchId);
  const { data: khaate } = await khataQuery;

  const kulLena = (khaate ?? []).reduce((sum, k: any) => {
    const baqi = Number(k.current_balance ?? 0);
    return baqi > 0 ? sum + baqi : sum;
  }, 0);

  // Hadd 80% se ooper. Jis khaate ki hadd hi darj nahi, wo yahan nahi
  // ginta -- us ke saamne "0%" likhna wo jhoot hai jis se malik ne mana
  // kia hai: hadd na hone ka matlab "hadd sifar" nahi.
  const haddKeQareeb = (khaate ?? []).filter((k: any) => {
    const hadd = Number(k.credit_limit ?? 0);
    if (hadd <= 0) return false;
    return Number(k.current_balance ?? 0) / hadd > 0.8;
  }).length;
  const haddWaleKhaate = (khaate ?? []).filter((k: any) => Number(k.credit_limit ?? 0) > 0).length;

  /**
   * Karyana aur agri-inputs ka alag hisaab.
   *
   * Malik: *"karyana shop ho, agri inputs show ho."* Bikri ki qism
   * dukan se aati hai, maal ki category se nahi -- ek hi dukan mein
   * dono tarah ka maal aa sakta hai, magar din ka hisaab dukan ka banta
   * hai.
   *
   * Jis bikri par `shop_id` hi nahi, usay kisi dukan mein nahi ginaa
   * jata -- wo apne khaane mein nazar aati hai taake kami saamne rahe.
   */
  const bikriQismWar = new Map<string, { raqam: number; ginti: number }>();
  (sales ?? []).forEach((s: any) => {
    const qism = s.shop_id ? dukanKiQism.get(s.shop_id) || "(qism darj nahi)" : "Dukan darj nahi";
    const pehle = bikriQismWar.get(qism) ?? { raqam: 0, ginti: 0 };
    bikriQismWar.set(qism, { raqam: pehle.raqam + Number(s.total_amount ?? 0), ginti: pehle.ginti + 1 });
  });
  const qismKaNaam: Record<string, string> = {
    karyana: "Karyana",
    agri_inputs: "Agri Inputs / Wanda",
    dairy: "Dairy",
  };
  const bikriKiFehrist = [...bikriQismWar.entries()].sort((a, b) => b[1].raqam - a[1].raqam);

  const totalSales = (sales ?? []).reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const totalCount = (sales ?? []).length;
  const avgSale = totalCount > 0 ? totalSales / totalCount : 0;

  const rows = (sales ?? []).slice(0, 50).map((s: any) => {
    const branch = Array.isArray(s.branches) ? s.branches[0] : s.branches;
    const dealer = Array.isArray(s.dealers) ? s.dealers[0] : s.dealers;
    return {
      id: s.id,
      date: s.created_at,
      location: s.shop_id ? (dukanKaNaam.get(s.shop_id) ?? "-") : (branch?.name ?? dealer?.business_name ?? "-"),
      cashier: cashierMap.get(s.created_by) ?? "-",
      paymentMode: s.payment_mode,
      amount: Number(s.total_amount ?? 0),
    };
  });

  return (
    <div>
      <PageHeader
        title={t("rs_title", lang)}
        description={
          meriDukan
            ? `${dukanKaNaam.get(meriDukan) ?? "Aap ki dukan"} — is arse ka poora hisaab`
            : "Sales across all branches and dealers"
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter current={range} />
        {!meriDukan && <BranchFilter branches={branches ?? []} current={branchId} />}
      </div>

      {!sabKuchWala && !meriDukan && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-surface-800 dark:bg-surface-900 dark:text-amber-300">
          Aap ki dukan set nahi hai, is liye ye adad kisi ek dukan ke nahi — poore karobar ke hain. Admin se apni dukan
          set karwa lein.
        </p>
      )}

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">Aaj ka khulasa</p>
      <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Stock ki qeemat" value={rs(kulStockQeemat)} icon={Boxes} tone="purple" />
        <StatCard
          label="Stock ki ginti"
          value={`${kulStockGinti.toLocaleString()} units`}
          icon={Package}
          tone="blue"
        />
        <StatCard label={t("rs_total_sales", lang)} value={rs(totalSales)} icon={TrendingUp} tone="brand" />
        <StatCard label="Kul lena hai" value={rs(kulLena)} icon={HandCoins} tone="orange" />
      </div>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">Khabardar</p>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
                <Hourglass className="h-3.5 w-3.5" /> Maal jo {BEES_DIN} din se hila nahi
              </p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-200">
                {naHiliQatarein}
              </p>
            </div>
            <span className="rounded-full bg-amber-200/70 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:bg-surface-800 dark:text-amber-300">
              Stock dekhein
            </span>
          </div>
          {/* Daawa wohi jo ye khana waqai jaanta hai. */}
          <p className="mt-2 text-[11px] leading-snug text-amber-800/80 dark:text-amber-400/80">
            Ye ginti "kitne din se hili nahi" ki hai — "kitne din purana maal" ki nahi. Maal kab aaya tha, wo batch
            aur stock movement ki fehrist se aata hai.
          </p>
        </div>

        <div className="rounded-card border border-sky-200 bg-sky-50 p-4 dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 dark:text-sky-300">
                <AlertTriangle className="h-3.5 w-3.5" /> Udhaar ki hadd 80% se ooper
              </p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-sky-900 dark:text-sky-200">
                {haddWaleKhaate === 0 ? "—" : haddKeQareeb}
              </p>
            </div>
            <span className="rounded-full bg-sky-200/70 px-2.5 py-1 text-[11px] font-medium text-sky-900 dark:bg-surface-800 dark:text-sky-300">
              Hadd ke qareeb
            </span>
          </div>
          {/*
            Sifar aur "hisaab nahi rakha jata" ek cheez nahi. Jis khaate
            ki hadd hi darj nahi, wo is ginti mein aa hi nahi sakta -- is
            liye jab kisi khaate par hadd hai hi nahi to yahan "0" ki
            jagah "—" likha jata hai.
          */}
          <p className="mt-2 text-[11px] leading-snug text-sky-800/80 dark:text-sky-400/80">
            {haddWaleKhaate === 0
              ? "Kisi khaate par udhaar ki hadd darj hi nahi — is liye ye ginti banti nahi. Pehle hadd tay karein."
              : `${haddWaleKhaate} khaaton par hadd darj hai. Jin par hadd nahi, wo is ginti mein nahi.`}
          </p>
        </div>
      </div>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">Paisa</p>
      <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Naqad aaya" value={rs(naqadAaya)} icon={Wallet} tone="green" />
        <StatCard label="Udhaar diya" value={rs(udhaarDiya)} icon={CreditCard} tone="warn" />
        <StatCard label="Daily kharche" value={rs(kulKharche)} icon={ArrowDownCircle} tone="red" />
        <StatCard label={t("rs_transactions", lang)} value={String(totalCount)} icon={ClipboardList} tone="blue" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Kis khaate mein kitna aaya */}
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-1 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Kis khaate mein kitna aaya
          </h2>
          <p className="mb-4 text-xs text-surface-400">
            QR, Easypaisa, JazzCash, Kisan Card — har adaigi apne khaate ke sath. Wohi naqsha jo ledger parhta hai.
          </p>
          {khaateKiFehrist.length === 0 ? (
            <p className="text-sm text-surface-400">Is arse mein koi adaigi darj nahi hui.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {khaateKiFehrist.map(([naam, raqam]) => (
                  <tr key={naam} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{naam}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                      {rs(raqam)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-3 text-xs font-semibold uppercase tracking-wide text-surface-500">Udhaar (khata)</td>
                  <td className="pt-3 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {rs(udhaarDiya)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Karyana / Agri — dukan ki qism ke hisaab se */}
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-1 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Karyana aur Agri Inputs
          </h2>
          <p className="mb-4 text-xs text-surface-400">Bikri aur stock — dono dukan ki qism ke hisaab se.</p>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">Bikri</p>
          {bikriKiFehrist.length === 0 ? (
            <p className="text-sm text-surface-400">Is arse mein koi bikri nahi hui.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {bikriKiFehrist.map(([qism, v]) => (
                  <tr key={qism} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{qismKaNaam[qism] ?? qism}</td>
                    <td className="py-2 pr-3 text-right text-xs text-surface-400 tabular-nums">{v.ginti} parchi</td>
                    <td className="py-2 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                      {rs(v.raqam)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
            Stock ki qeemat (kharid par)
          </p>
          {stockQismWar.size === 0 ? (
            <p className="text-sm text-surface-400">Godam mein maal darj nahi.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {[...stockQismWar.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([qism, raqam]) => (
                    <tr key={qism} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                      <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{qismKaNaam[qism] ?? qism}</td>
                      <td className="py-2 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                        {rs(raqam)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Load aur Bill */}
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <Smartphone className="h-4 w-4 text-surface-400" /> Load aur Bill
          </h2>
          <p className="mb-4 text-xs text-surface-400">Wapas ki hui parchiyan is hisaab mein nahi hain.</p>
          <table className="w-full text-left text-sm">
            <tbody>
              <tr className="border-b border-surface-50 dark:border-surface-800">
                <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">Load kia (asal raqam)</td>
                <td className="py-2 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                  {rs(loadKiRaqam)}
                </td>
              </tr>
              <tr className="border-b border-surface-50 dark:border-surface-800">
                <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">Bill jama karwaye</td>
                <td className="py-2 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                  {rs(billKiRaqam)}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                  Hamari kamai (service charge + tasdeeq shuda commission)
                </td>
                <td className="py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {rs(loadKiAamdani)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Kharche */}
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <Receipt className="h-4 w-4 text-surface-400" /> Kharche
          </h2>
          <p className="mb-4 text-xs text-surface-400">Cash Book mein darj kharche — is arse ke.</p>
          {kharchKiFehrist.length === 0 ? (
            <p className="text-sm text-surface-400">Is arse mein koi kharcha darj nahi hua.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {kharchKiFehrist.map(([naam, raqam]) => (
                  <tr key={naam} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{naam}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                      {rs(raqam)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-3 text-xs font-semibold uppercase tracking-wide text-surface-500">Kul</td>
                  <td className="pt-3 text-right font-semibold tabular-nums text-red-700 dark:text-red-400">
                    {rs(kulKharche)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label={t("rs_avg_sale", lang)} value={rs(avgSale)} icon={ShoppingCart} tone="purple" />
        <StatCard label="Load + Bill" value={rs(loadKiRaqam + billKiRaqam)} icon={Landmark} tone="orange" />
        <StatCard label="Load ki kamai" value={rs(loadKiAamdani)} icon={TrendingUp} tone="green" />
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          {t("rs_recent_sales", lang)}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">{t("rs_no_sales_period", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">{t("c_date", lang)}</th>
                  <th className="py-2 pr-3">{t("c_location", lang)}</th>
                  <th className="py-2 pr-3">{t("rs_cashier", lang)}</th>
                  <th className="py-2 pr-3">{t("c_payment_mode", lang)}</th>
                  <th className="py-2 pr-3">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 text-surface-500">{new Date(r.date).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-surface-700">{r.location}</td>
                    <td className="py-2 pr-3 text-surface-700">{r.cashier}</td>
                    <td className="py-2 pr-3 capitalize text-surface-600">{r.paymentMode.replace("_", " ")}</td>
                    <td className="py-2 pr-3 font-medium text-surface-900">{rs(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
