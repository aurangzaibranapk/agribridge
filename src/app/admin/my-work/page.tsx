import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { shopStockPosition, shopWhereIsMyMoney, shopTodayFlow } from "@/lib/pos/shop-360";
import { shopPaymentMethodBreakdown } from "@/lib/pos/shop-payment-methods";
import { computeShiftCash } from "@/lib/pos/shift-cash";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { loadNeedsAttention, filterAttention } from "@/lib/access/needs-attention";
import { NeedsAttention } from "@/components/guided/needs-attention";
import {
  buildMyWork,
  defaultDashboardForRole,
  loadFourthKpi,
  loadPaymentBreakdown,
  loadOrderFunnel,
  loadCustomerHealth,
  loadFarmersToVerify,
} from "@/lib/access/my-work";
import { MyWorkBody } from "@/components/guided/work-cards";
import { PaymentDonut } from "@/components/guided/payment-donut";
import { VerifyFarmerButton } from "@/app/admin/farmers/verify-farmer-button";
import { LiveNotificationsPanel } from "@/components/guided/live-notifications-panel";
import { InPageWorkspace } from "@/components/guided/in-page-workspace";
import { TrainingBanner } from "@/components/guided/training-banner";
import { departmentForRole } from "@/lib/departments";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Mera Kaam -- staff ka pehla safha (Staff Command Center, 277).
 *
 * Malik ka faisla: staff ko 100+ features ka sidebar dene ke bajaye
 * CARDS milein, aur sirf wohi jo usay assign hue hon.
 *
 *   Login  ->  Mera Kaam  ->  card  ->  us ka apna kaam  ->  wapas
 *
 * ---------------------------------------------------------------------
 * Card ab KAAM ka hai, department ka nahi (250)
 * ---------------------------------------------------------------------
 * Pehle card department ka tha -- "Finance" par click karo, phir andar
 * fehrist mein se apna safha dhoondo. Counter par khare bande ke liye
 * wo do qadam hain jahan ek chahiye tha: usay "POS" chahiye, "Finance"
 * nahi.
 *
 * Ab har card ek kaam hai (POS, Products, Hazri...), aur department
 * sirf sarkhi reh gaya hai jis ke neeche wo cards baithe hain. Ijazat
 * ka hisaab wohi purana hai -- loadNav() sirf wohi cheezein deta hai jo
 * is bande ko khulti hain. Yahan koi nayi ijazat nahi banti.
 *
 * ---------------------------------------------------------------------
 * Safha ab lambi fehrist nahi, ek naqsha hai (277)
 * ---------------------------------------------------------------------
 * Malik ka aitraaz: Manager ke login par 50 ek jaise safaid dabbe khul
 * jate the -- har card ki ahmiyat barabar lagti thi, aur wohi feature
 * chaar department mein dobara nazar aata tha.
 *
 *   Kya baqi hai  ->  Aaj ka kaam  ->  Department  ->  us ke auzaar
 *
 * Ginti, tarteeb aur "ek feature ek jagah" ka poora hisaab
 * lib/access/my-work.ts mein hai; kholna/band karna aur haal hi mein
 * khole gaye safhe components/guided/work-cards.tsx mein. Safha khud
 * sirf jorta hai.
 *
 * ---------------------------------------------------------------------
 * Score ka chip
 * ---------------------------------------------------------------------
 * Apna score upar nazar aata hai -- magar wahan SIFAR kabhi nahi likha
 * jata. Engine jab tak hisaab bana raha hai, "Hisaab ban raha hai"
 * likha aata hai; aur agar visibility ka qanoon jawab hi na de to chip
 * hi nahi aata. "Kuch nahi mila" ko sifar samajh lena is project mein
 * teen dafa ghalat adad de chuka hai.
 */

interface ScoreChip {
  score: number | null;
  band: string | null;
  state: string | null;
}

const BAND_TONE: Record<string, string> = {
  platinum: "bg-surface-800 text-white",
  gold: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  silver: "bg-surface-200 text-surface-800 dark:bg-surface-700 dark:text-surface-100",
  bronze: "bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200",
};

export default async function MyWorkPage({ searchParams }: { searchParams?: { all?: string } }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role, training_mode, branch_id, shop_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  // Shop kahan se maloom hoti hai -- POS ki tarah: pehle khuli hui
  // shift ka counter, warna profile ki apni shop (Load & Bill isi
  // tarah karta hai, dekhein admin/load-bill/page.tsx).
  let myShopId: string | null = me.shop_id ?? null;
  const { data: khulaShift } = await supabase
    .from("pos_shifts")
    .select("id, opening_cash, pos_counters(shop_id)")
    .eq("staff_id", user.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  const shiftShop = khulaShift?.pos_counters as { shop_id?: string } | { shop_id?: string }[] | null;
  const shiftShopId = Array.isArray(shiftShop) ? shiftShop[0]?.shop_id : shiftShop?.shop_id;
  if (shiftShopId) myShopId = shiftShopId;
  const myOpenShiftId = (khulaShift?.id as string | undefined) ?? null;
  const myOpenShiftOpeningCash = Number(khulaShift?.opening_cash ?? 0);

  // Training Mode (D): apne department ka module -- pehle N kaam.
  const dept = departmentForRole(me.role);

  // Role ka naam bande ki zaban mein. Database mein wo "sales_staff"
  // jaisa likha hota hai -- wo nizam ke liye theek hai, magar safhe par
  // wohi likh dena us bande ko apna hi laqab ajnabi lagta hai.
  const roleLabel = me.role
    ? me.role
        .split("_")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : null;
  const { data: trainingModule } = me.training_mode
    ? await supabase.from("training_modules").select("key, title, steps, try_route").eq("department_key", dept?.key ?? "").eq("is_active", true).maybeSingle()
    : { data: null };

  const [nav, scoreRes] = await Promise.all([
    loadNav(user.id, me.role, lang),
    // Apna score. Visibility ka faisla database par hai (fn_score_visible)
    // -- yahan sirf jo aaye wo dikhaya jata hai. Kuch na aaye to chip
    // hi nahi banta.
    supabase.rpc("fn_score_for", { p_subject_type: "staff", p_subject_id: user.id }),
  ]);

  const scoreRow = (Array.isArray(scoreRes.data) ? scoreRes.data[0] : null) as ScoreChip | null;

  const allowed = nav.unrestricted ? null : nav.allowedRoutes;
  const groups = nav.groups.filter((g) => g.items.length > 0);
  const model = await buildMyWork(groups, allowed, me.role, lang);

  // "Needs attention" -- pehle teen alag dabbon mein tha, ab MyWorkBody
  // ki chhoti patti ka pehla hissa hai (malik, 7 September). Tarteeb
  // wahi jo pehle NeedsAttention component ke andar thi.
  const attentionOrder = { red: 0, amber: 1, blue: 2, gray: 3 } as const;
  const attentionItems = filterAttention(await loadNeedsAttention(), allowed).sort(
    (a, b) => attentionOrder[a.tone] - attentionOrder[b.tone]
  );
  const showAllAttention = searchParams?.all === "1";
  const attentionTop = (showAllAttention ? attentionItems : attentionItems.slice(0, 4)).map((it) => ({
    key: it.key,
    label: t(it.label, lang),
    count: it.count,
    tone: it.tone,
    href: it.href,
  }));

  const { data: branch } = me.branch_id
    ? await supabase.from("branches").select("name").eq("id", me.branch_id).maybeSingle()
    : { data: null };
  const branchName = branch?.name ?? null;

  // Quick Actions aur Payment Breakdown dono ko chahiye -- yahan upar
  // le aaya gaya taake neeche Promise.all mein bhi istemal ho sake.
  const canRoute = (path: string) => allowed === null || routeAllowed(allowed, path);

  // KPI patti (7 September ka spec): teen fixed + ek role-specific khana.
  // Pehli teen wahi Needs Attention ke rang se nikalti hain -- koi nayi
  // ginti nahi banti, sirf usi asal data ko chaar chhote number mein
  // dobara dikhaya ja raha hai.
  const aaj = new Date().toISOString().slice(0, 10);
  const service = createServiceClient();

  const [
    fourthKpi,
    paymentBreakdown,
    { data: initialNotifications },
    orderFunnel,
    customerHealth,
    farmersToVerify,
    shopStock,
    shopSales,
    shopMoney,
    shopFlow,
    { data: udhaarDiyaRows },
    shiftCash,
  ] = await Promise.all([
    loadFourthKpi(me.branch_id, allowed, lang),
    // Malik (16 September): "cash sale kitna, card se kitna, QR se
    // kitna, bank se kitna, easypaisa se kitna, load se kitna, phir
    // total balance bhi." Sirf jin ke paas POS khulta hai -- baqi ke
    // liye ye sawal hi nahi banta.
    canRoute("/admin/pos") ? loadPaymentBreakdown(user.id) : Promise.resolve(null),
    // Live Notifications panel ka shuruati data -- baad mein ye khud
    // Realtime se taaza hoti hai (LiveNotificationsPanel), safha dobara
    // nahi parhta.
    supabase
      .from("notifications")
      .select("id, title, message, link_url, is_read, created_at")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    loadOrderFunnel(me.branch_id, allowed),
    loadCustomerHealth(me.branch_id, allowed),
    loadFarmersToVerify(me.branch_id, allowed),
    // 18 September, malik: "jo uske paas stock hai, value aani chahiye" --
    // is shop ka asal stock, FIFO cost se (Shop 360 jo hisaab pehle se
    // istemal karta hai, koi naya nahi banaya).
    myShopId && canRoute("/admin/pos") ? shopStockPosition(myShopId, aaj, aaj) : Promise.resolve(null),
    // "kis kis method se kya sale hui" -- is shop ki aaj ki, poore
    // 8 method (sale na ho to us method ka Rs 0, fake nahi -- sach mein
    // aaj us se kuch nahi hua).
    myShopId && canRoute("/admin/pos") ? shopPaymentMethodBreakdown(myShopId, aaj, aaj) : Promise.resolve(null),
    // "pending payment kitni hai" -- receivable, branch tak (shop tak
    // udhaar/wasooli darj nahi hoti, dekhein shopWhereIsMyMoney ka note).
    myShopId ? shopWhereIsMyMoney(myShopId) : Promise.resolve(null),
    // "aaj ki recovery kahan hai" -- isi shop ki aaj ki wasooli.
    myShopId ? shopTodayFlow(myShopId, aaj) : Promise.resolve(null),
    // "udhaar diya hai to kahan hai" -- ledger se, is branch ki aaj ki
    // udhaar-dene wali (debit) qatarein. Shop_id ledger mein nahi hota
    // (Load & Bill ke Cash-in-Hand comment mein bhi likha hai), is liye
    // branch tak.
    me.branch_id
      ? service
          .from("journal_lines")
          .select("debit, journal_entries!inner(entry_date, source_module, branch_id)")
          .in("account_code", ["1100", "1150"])
          .eq("journal_entries.source_module", "customer_udhaar")
          .eq("journal_entries.branch_id", me.branch_id)
          .eq("journal_entries.entry_date", aaj)
          .gt("debit", 0)
      : Promise.resolve({ data: [] as { debit: number }[] }),
    // Malik (18 September): "yahan par Expected Cash nahi aa raha" --
    // Shift Band Karein wahi hisaab (opening + cash sale − returns +
    // load/bill cash + recovery cash − udhaar diya cash) yahan bhi,
    // isi khuli shift se.
    myOpenShiftId ? computeShiftCash(myOpenShiftId, myOpenShiftOpeningCash) : Promise.resolve(null),
  ]);
  const udhaarDiyaAajTotal = (udhaarDiyaRows ?? []).reduce((s, r) => s + Number(r.debit), 0);

  const now = new Date();
  const nowDate = new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", {
    timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric",
  }).format(now);
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(now);

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? "mw_hello_morning" : hour < 17 ? "mw_hello_afternoon" : "mw_hello_evening";

  return (
    <InPageWorkspace>
    <div className="mx-auto w-full max-w-[1100px]">
      {/* Malik (7 September): safhe ka oopri hissa bahut jagah khata tha --
          greeting, date/time aur score teen alag boxon mein. Ab ek hi
          patti: naam+role+branch baayen, tareekh/waqt/score daayen, ek
          satar mein -- taake neeche asal kaam ke liye jagah bache. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-surface-200 bg-white px-5 py-3 dark:border-surface-700 dark:bg-surface-900">
        <div className="min-w-0">
          <h1 className="font-display text-[19px] font-semibold leading-tight text-surface-900 dark:text-surface-100">
            {t(greetKey, lang)}, {me.full_name}
          </h1>
          {/* Naam ke neeche: banda kaun hai, kis department mein hai, aur
              kis shaakh par. Malik ka usool (5 September): "Neeche uska
              Role + Department + Branch."

              Jo hissa maloom na ho wo LIKHA HI NAHI jata -- khali jagah
              bhar dene ke liye "—" ya koi bana hua naam daal dena us
              bande ko ghalat maloomat deta hai. */}
          <p className="mt-0.5 truncate text-[13px] text-surface-500">
            {[roleLabel, dept?.label ?? null, branchName].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {scoreRow && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-surface-400">{t("mw_my_score", lang)}</p>
              {scoreRow.score == null ? (
                // Sifar nahi. Engine ne abhi faisla kiya hi nahi.
                <p className="text-[13px] font-medium text-surface-600 dark:text-surface-300">
                  {t("mw_score_building", lang)}
                </p>
              ) : (
                <p className="flex items-center justify-end gap-1.5">
                  <span className="text-base font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                    {scoreRow.score}
                  </span>
                  {scoreRow.band && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        BAND_TONE[scoreRow.band] ?? "bg-surface-100 text-surface-700"
                      }`}
                    >
                      {scoreRow.band}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
          {/* Waqt Pakistan ka -- server kahin bhi ho, banda apni ghari se
              milata hai. */}
          <div className="flex items-center gap-2 border-l border-surface-200 pl-4 dark:border-surface-700">
            <CalendarDays className="h-4 w-4 shrink-0 text-surface-400" />
            <p className="whitespace-nowrap text-[13px] font-medium text-surface-700 dark:text-surface-200">
              {nowDate} · {nowTime}
            </p>
          </div>
        </div>
      </div>

      {me.training_mode && (
        <div className="mb-4">
          <TrainingBanner
            lang={lang}
            name={me.full_name}
            department={dept?.label ?? null}
            steps={trainingModule?.steps ?? []}
            tryRoute={trainingModule?.try_route ?? null}
            moduleTitle={trainingModule?.title ?? null}
            moduleKey={trainingModule?.key ?? null}
          />
        </div>
      )}

      {/* Chaar bade dabbe -- 18 September, mockup ka andaz liya gaya hai
          (rangeen border, icon, bada adad), magar har adad wahi asal
          hisaab hai jo pehle bhi is safhe par tha (KPI patti + Payment
          Breakdown) -- koi nayi/jhooti ginti nahi bani, sirf dikhane ka
          tareeqa upgrade hua. Jis card ka sawal is bande par laagu nahi
          hota (jaise Order Funnel jis ke paas Ordering nahi khulta), wo
          card sirey se nahi banta -- khali dabba nahi dikhaya jata. */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(shopSales || paymentBreakdown) && (
          <div className="rounded-card border-2 border-emerald-200 bg-white p-4 dark:border-emerald-900/40 dark:bg-surface-900 lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <Icons.Wallet className="h-3.5 w-3.5" /> Aaj ka Ledger
              </p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Live Ledger
              </span>
            </div>
            {(() => {
              // Malik (18 September): "load jo cash par hua hai wo humein
              // alag dikh raha ho... cash mein itni hai, bank mein itni
              // hai" -- `shopPaymentMethodBreakdown` ab is shop ka Load +
              // Bill bhi apne payment_method (cash/bank/wallet/khata) ke
              // hisaab se cash/bank_transfer/khata/wallet buckets mein
              // shamil karta hai (shop-payment-methods.ts dekhein) -- is
              // liye `shopSales` maujood ho to load alag se jama nahi
              // karna, warna do dafa gin liya jayega. Sirf jab shopSales
              // na ho (koi shop hi nahi mila) tab `paymentBreakdown` ka
              // apna flat loadAmount fallback ke tor par dikhaya jata hai.
              const baseSlices = shopSales
                ? shopSales.map((r) => ({ key: r.method, label: r.label, amount: r.sales }))
                : (paymentBreakdown?.methods ?? []);
              const slices = shopSales
                ? baseSlices
                : [
                    ...baseSlices,
                    ...(paymentBreakdown && paymentBreakdown.loadAmount > 0
                      ? [{ key: "load", label: "Mobile Load", amount: paymentBreakdown.loadAmount }]
                      : []),
                  ];
              const total = slices.reduce((s, r) => s + r.amount, 0);
              // Malik (18 September, reference image): total ke neeche
              // Cash vs Digital ka chhota split -- "Digital" yahan
              // Khata (abhi paisa mila hi nahi) chhoR kar baqi saare
              // tareeqon (Bank/Card/JazzCash/Easypaisa/QR/Waseela/Load)
              // ka jama hai.
              const cashAmt = slices.find((s) => s.key === "cash")?.amount ?? 0;
              const khataAmt = slices.find((s) => s.key === "khata")?.amount ?? 0;
              const digitalAmt = total - cashAmt - khataAmt;
              return (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl font-bold tabular-nums text-surface-900 dark:text-white">
                      Rs {total.toLocaleString()}
                    </p>
                    {/* Malik (18 September): "kis kis method se kya sale ki hai
                        ye pata chalna chahiye" -- is shop ke POS ke saare 8
                        tareeqe, jis se aaj kuch hua hi nahi us ka Rs 0 (sach,
                        fake nahi -- Shop 360 ka pehle se banaya hisaab). */}
                    <p className="text-[11px] text-surface-500">Aaj kis tareeqe se kitna aaya</p>
                    <div className="mt-1.5 flex gap-4 text-xs">
                      <p className="text-surface-700 dark:text-surface-300">
                        Cash <span className="font-semibold tabular-nums text-surface-900 dark:text-white">Rs {cashAmt.toLocaleString()}</span>
                      </p>
                      <p className="text-surface-700 dark:text-surface-300">
                        Digital <span className="font-semibold tabular-nums text-surface-900 dark:text-white">Rs {digitalAmt.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                  <PaymentDonut slices={slices} />
                </div>
              );
            })()}
            {/* Malik (18 September): "stock ki value, pending payment,
                aaj ki recovery, udhaar diya -- ye sab ana chahiye." Sab
                Shop 360/ledger ke pehle se bane hisaab se -- koi naya
                hisaab nahi bana. */}
            {(shopStock || shopMoney || shopFlow || udhaarDiyaAajTotal > 0 || shiftCash) && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-100 pt-3 dark:border-emerald-900/40 sm:grid-cols-4">
                <div>
                  <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                    {shopStock?.stockValueFifo == null ? "—" : `Rs ${shopStock.stockValueFifo.toLocaleString()}`}
                  </p>
                  <p className="text-[10px] text-surface-500">Stock Value</p>
                </div>
                <div>
                  <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                    {shopMoney?.receivableBranchLevel == null ? "—" : `Rs ${shopMoney.receivableBranchLevel.toLocaleString()}`}
                  </p>
                  <p className="text-[10px] text-surface-500">Pending Payment</p>
                </div>
                {/* Malik (18 September): "aaj Rs 300 recovery aayi thi,
                    wo nazar nahi aa rahi" -- `shopFlow.recovery` sirf
                    Paisa & Khata module (company_expense_requests) ki
                    recovery dekhta hai; Customer Udhaar module (journal
                    se, jo Live Notifications mein "Recovery darj" dikhata
                    hai) alag table mein hoti hai. Dono jama -- warna
                    ek qism ki recovery hamesha chupi rehti. */}
                <div>
                  <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                    {shopFlow || shiftCash
                      ? `Rs ${((shopFlow?.recovery.total ?? 0) + (shiftCash?.recoveryCashTotal ?? 0)).toLocaleString()}`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-surface-500">Aaj ki Recovery</p>
                </div>
                <div>
                  <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                    Rs {udhaarDiyaAajTotal.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-surface-500">Udhaar Diya Aaj</p>
                </div>
                {/* Malik (18 September): "yahan par Expected Cash nahi a
                    raha" -- Shift Band Karein jaisa hi hisaab, khuli
                    shift ho tabhi (band shift ke liye ye sawal nahi
                    banta). */}
                {shiftCash && (
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                      Rs {shiftCash.expectedCash.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500">Expected Cash (golak)</p>
                  </div>
                )}
                {/* Malik (18 September): "Load ya Bill ke tags nazar
                    nahi aa rahe" -- ye ab payment donut ke Cash/Bank
                    buckets mein chup jate hain (asal cash-in-hand ke
                    liye zaroori tha), is liye yahan alag se dikha dete
                    hain -- sirf isi khuli shift ki Bill/Load, jab hui ho. */}
                {shiftCash && shiftCash.billTotal > 0 && (
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                      Rs {shiftCash.billTotal.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500">Bill Payment</p>
                  </div>
                )}
                {shiftCash && shiftCash.loadTotal > 0 && (
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                      Rs {shiftCash.loadTotal.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500">Mobile Load</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {orderFunnel && (
          <div className="rounded-card border-2 border-sky-200 bg-white p-4 dark:border-sky-900/40 dark:bg-surface-900">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
              <Icons.PackageSearch className="h-3.5 w-3.5" /> Order Funnel
            </p>
            <div className="mt-2 space-y-1">
              <p className="flex items-baseline justify-between">
                <span className="font-display text-xl font-bold tabular-nums text-surface-900 dark:text-white">{orderFunnel.naye}</span>
                <span className="text-[11px] text-surface-500">Naye</span>
              </p>
              <p className="flex items-baseline justify-between">
                <span className="font-display text-xl font-bold tabular-nums text-surface-900 dark:text-white">{orderFunnel.processing}</span>
                <span className="text-[11px] text-surface-500">Processing</span>
              </p>
              <p className="flex items-baseline justify-between">
                <span className={`font-display text-xl font-bold tabular-nums ${orderFunnel.masla > 0 ? "text-red-600" : "text-surface-900 dark:text-white"}`}>
                  {orderFunnel.masla}
                </span>
                <span className="text-[11px] text-surface-500">Masla</span>
              </p>
            </div>
          </div>
        )}
        {customerHealth && (
          <div className="rounded-card border-2 border-violet-200 bg-white p-4 dark:border-violet-900/40 dark:bg-surface-900">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
              <Icons.Users className="h-3.5 w-3.5" /> Customer Health
            </p>
            <div className="mt-2 space-y-1">
              <p className="flex items-baseline justify-between">
                <span className="font-display text-xl font-bold tabular-nums text-surface-900 dark:text-white">{customerHealth.dueParties}</span>
                <span className="text-[11px] text-surface-500">Due/Overdue Khate</span>
              </p>
              <p className="flex items-baseline justify-between">
                <span className="font-display text-xl font-bold tabular-nums text-surface-900 dark:text-white">{customerHealth.newFarmersWeek}</span>
                <span className="text-[11px] text-surface-500">Naye farmers (7 din)</span>
              </p>
              {fourthKpi && (
                <p className="flex items-baseline justify-between border-t border-surface-100 pt-1 dark:border-surface-800">
                  <span className="text-sm font-semibold tabular-nums text-surface-700 dark:text-surface-200">{fourthKpi.value ?? "—"}</span>
                  <span className="text-[11px] text-surface-500">{fourthKpi.label}</span>
                </p>
              )}
            </div>
          </div>
        )}
        <div className="rounded-card border-2 border-surface-300 bg-white p-4 dark:border-surface-600 dark:bg-surface-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
            <Icons.AlertTriangle className="h-3.5 w-3.5" /> Urgent Approvals
          </p>
          <div className="mt-2 space-y-1">
            <p className="flex items-baseline justify-between">
              <span className="font-display text-xl font-bold tabular-nums text-amber-600">
                {attentionItems.filter((i) => i.tone === "amber").length}
              </span>
              <span className="text-[11px] text-surface-500">Pending</span>
            </p>
            <p className="flex items-baseline justify-between">
              <span className="font-display text-xl font-bold tabular-nums text-red-600">
                {attentionItems.filter((i) => i.tone === "red").length}
              </span>
              <span className="text-[11px] text-surface-500">Urgent</span>
            </p>
          </div>
        </div>
      </div>

      {model.totalCards === 0 ? (
        // Ye soorat chhupai nahi jati. Khali safha dekh kar banda samajhta
        // hai ke nizam kharab hai; asal baat ye hoti hai ke usay abhi tak
        // kuch assign hi nahi hua -- aur us ka hal us ke manager ke paas
        // hai, us ke paas nahi.
        <div className="rounded-card border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <Icons.Inbox className="mx-auto h-8 w-8 text-amber-600" />
          <p className="mt-3 font-medium text-amber-900 dark:text-amber-200">{t("mw_nothing_assigned", lang)}</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{t("mw_nothing_assigned_hint", lang)}</p>
        </div>
      ) : (
        <MyWorkBody
          lang={lang}
          quick={model.quick}
          // Jis banday ki ijazat mehdood hai, us ka HAR kaam sidebar ki
          // "Quick Access" mein ek hi flat fehrist mein pehle se hai
          // (admin/layout.tsx). Yahan wohi cheezein department cards mein
          // dobara dikhana ("AgriBridge Ordering" sidebar mein bhi, yahan
          // bhi) sirf duplicate aur confusion banata hai (malik, 11
          // September). Department cards sirf un ke liye jin ke paas
          // itna kaam hai ke browse karna zaroori ho -- Owner/Admin/
          // Manager.
          departments={nav.unrestricted ? model.departments : []}
          defaultDept={defaultDashboardForRole(me.role)}
          attention={attentionTop}
          attentionTotal={attentionItems.length}
          attentionAllHref={showAllAttention ? null : "/admin/my-work?all=1"}
        />
      )}

      {/* Aaj ke kaam (poori fehrist) + Jaldi wale kaam, aur Haal ka
          len-den -- maujooda systems (Needs Attention, permitted routes,
          asal transactions) se, koi nayi table nahi. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <h2 className="flex items-center gap-2 border-b border-surface-100 px-5 py-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500 dark:border-surface-800">
            <Icons.ClipboardList className="h-4 w-4" /> {t("mw_tasks_title", lang)}
          </h2>
          {/* Malik (8 September): "page kabhi scroll na karni paRe." Is
              fehrist ki lambai yahan tak seemit -- agar zyada items hon
              to sirf ISI dabbe ke andar scroll ho, poora safha nahi. */}
          <div className="overflow-y-auto p-4" style={{ maxHeight: "min(30vh, 260px)" }}>
            <NeedsAttention lang={lang} allowedRoutes={allowed} variant="list" compact />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <LiveNotificationsPanel
            initial={(initialNotifications ?? []).map((n) => ({
              id: n.id as string,
              title: n.title as string,
              message: n.message as string,
              link_url: (n.link_url as string | null) ?? null,
              is_read: Boolean(n.is_read),
              created_at: String(n.created_at),
            }))}
          />

          {/* Farmers at a Glance -- jin ki profile poori hai magar
              tasdeeq baqi hai, is liye un ki udhaar hadd abhi nahi
              barh sakti (341). Yehi fehrist ne 18 September ko
              Aurangzaib ka masla pakra tha -- ab har roz yahan nazar
              aayegi, kisi ko alag se khoj nahi karni paRegi. */}
          {farmersToVerify.length > 0 && (
            <div className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <h2 className="flex items-center gap-2 border-b border-surface-100 px-5 py-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500 dark:border-surface-800">
                <Icons.Sprout className="h-4 w-4" /> Farmers at a Glance
              </h2>
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {farmersToVerify.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-surface-800 dark:text-surface-100">{f.name}</p>
                      <p className="text-[12px] text-surface-500">{f.code ?? "profile poori, tasdeeq baqi"}</p>
                    </div>
                    <VerifyFarmerButton id={f.id} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </InPageWorkspace>
  );
}
