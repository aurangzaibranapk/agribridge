import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { LoadBillClient } from "./load-bill-client";

export const dynamic = "force-dynamic";

const FLOAT_ROLES = ["owner", "super_admin", "admin", "finance", "manager"];

/**
 * Load & Bill — mobile load aur customer ke bill.
 *
 * Malik ka kehna (5 September): ye POS ka hissa ho, magar "normal
 * product sale ki tarah treat na karein -- kyunki is mein stock product
 * nahi, provider account ka digital balance (Float) use hota hai."
 *
 * -------------------------------------------------------------------
 * SAB SE AHEM BAAT, JO SAFHE PAR BHI LIKHI HAI:
 *
 * **AgriBridge load BHEJTA NAHI -- DARJ KARTA HAI.**
 *
 * Load Jazz/Easypaisa ki apni app se jata hai. Hamare paas un ka API
 * nahi. Agar yahan koi aisa button hota jo ye dawa karta ke us ne load
 * kar diya, to ek din wo dawa jhoota nikalta: banda samajhta ho gaya,
 * customer se paisa le leta, aur load jata hi nahi.
 *
 * Is liye button "Load karein" nahi, **"Load ho gaya — darj karein"**
 * hai, aur us ke sath provider ki apni TID ka khana hai. Wohi saboot
 * hai. Jis qatar par TID na ho wo "nakaam" nahi kehlati -- wo
 * "saboot baqi" hoti hai, aur safha us ko alag rang mein dikhata hai.
 *
 * -------------------------------------------------------------------
 * DOOSRI BAAT: aamdani sirf service charge hai.
 *
 * Rs 1,000 ka load AAMDANI NAHI. Wo customer ka paisa hai jo provider
 * tak ja raha hai. Aamdani wo Rs 20 hai jo customer se extra liya, aur
 * wo commission jo company baad mein degi -- magar commission tab tak
 * "muntazir" rehti hai jab tak statement us ki tasdeeq na kar de.
 */
export default async function LoadBillPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) redirect("/login");

  const service = createServiceClient();
  const aaj = aajKaKhana();
  const unrestricted = UNRESTRICTED_ROLES.includes(me.role);

  const [{ data: providers }, { data: accounts }, { data: financeAccounts }, { data: customers }, { data: farmers }, { data: shops }] =
    await Promise.all([
      service.from("load_providers").select("id, key, name, kind, bill_category").eq("is_active", true).order("sort_order"),
      service.from("load_accounts").select("id, title, account_ref, provider_id, branch_id").eq("is_active", true).order("title"),
      service.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
      // Khata (udhaar) ke liye. Pehle ye laaye hi nahi jate the, aur
      // form mein customer chunne ka khana tha hi nahi -- is liye
      // "Khata" chunne par server hamesha "customer chunna zaroori hai"
      // keh kar rok deta tha. Wo khana MARA HUA tha.
      service.from("customers").select("id, name, current_balance").order("name"),
      // Malik (7 September): udhaar kisan ko bhi milta hai, sirf dukan
      // ke customer ko nahi. Naam ke ilawa mobile aur CNIC bhi laate
      // hain taake picker un se bhi dhoond sake — sirf naam se dhoondna
      // sainkron kisanon mein kaam nahi karta.
      service.from("farmers").select("id, full_name, farmer_code, phone_number, cnic, credit_limit").eq("is_deleted", false).order("full_name"),
      // Shop (425): "load bill her shop k ana chaye" -- branch kaafi
      // nahi, ek branch mein kai shops hoti hain. Manager/staff sirf
      // apni branch ki shops, owner/admin sab.
      unrestricted
        ? service.from("shops").select("id, name, branch_id").eq("is_active", true).order("name")
        : me.branch_id
          ? service.from("shops").select("id, name, branch_id").eq("is_active", true).eq("branch_id", me.branch_id).order("name")
          : Promise.resolve({ data: [] as { id: string; name: string; branch_id: string }[] }),
    ]);

  // Kaam kahan ho raha hai -- POS wale isi tarah pehchane jate hain
  // (dekhein admin/pos/page.tsx): pehle khuli hui shift ka counter,
  // warna profile ki apni shop.
  let defaultShopId: string | null = me.shop_id ?? null;
  const { data: khulaShift } = await supabase
    .from("pos_shifts")
    .select("pos_counters(shop_id)")
    .eq("staff_id", user.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  const shiftShop = khulaShift?.pos_counters as { shop_id?: string } | { shop_id?: string }[] | null;
  const shiftShopId = Array.isArray(shiftShop) ? shiftShop[0]?.shop_id : shiftShop?.shop_id;
  if (shiftShopId) defaultShopId = shiftShopId;

  // Har account ka float SEEDHA journal se. Koi alag rakha hua balance
  // nahi, is liye do adad ban hi nahi sakte.
  //
  // Ye RPC service client se NAHI bulaya jata: fn_load_float_balance
  // andar `fn_is_any_staff()` poochta hai, aur service client ka koi
  // auth.uid() hota hi nahi -- us se har dafa inkaar milta. Bulawa
  // logged-in bande ke naam par jata hai; RLS ka masla nahi, kyunki
  // function khud SECURITY DEFINER hai.
  const floats = new Map<string, number | null>();
  for (const a of accounts ?? []) {
    const { data, error } = await supabase.rpc("fn_load_float_balance", { p_account: a.id, p_upto: undefined });
    // Na mile to NULL -- sifar nahi. "Balance sifar hai" aur "balance
    // parha nahi ja saka" do alag baatein hain.
    floats.set(a.id as string, error ? null : Number(data ?? 0));
  }

  const { data: aajKiQatarein } = await service
    .from("load_transactions")
    .select(
      "id, txn_number, kind, reference, principal, service_charge, commission_expected, commission_confirmed, commission_status, payment_method, provider_tid, status, float_settled, customer_name, created_at, account_id, provider_id"
    )
    .gte("created_at", `${aaj}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(60);

  // "Aaj ki Recovery" — Udhaar/Recovery is table mein hain hi nahi (upar
  // ka comment dekhein), is liye seedha ledger se: customer/farmer ke
  // "lena" khate (1100/1150) par jitna CREDIT customer_udhaar module se
  // aaj laga, wohi wapasi hai (udhaar dene par isi khate par DEBIT lagta
  // hai, is liye "credit hi wapasi hai" ka farq khud theek hai).
  const { data: recoveryLines } = await service
    .from("journal_lines")
    .select("credit, journal_entries!inner(entry_date, source_module)")
    .in("account_code", ["1100", "1150"])
    .eq("journal_entries.source_module", "customer_udhaar")
    .eq("journal_entries.entry_date", aaj)
    .gt("credit", 0);
  const todayRecovery = (recoveryLines ?? []).reduce((s, r) => s + Number(r.credit), 0);

  // "Aaj ki qatarein" mein Udhaar aur Recovery bhi -- warna is desk se
  // hui har dusri qism ki adaigi table mein kabhi nazar hi nahi aati
  // thi, sirf Load/Bill dikhte the (18 September, mockup ka takaza).
  // Ledger mein shop_id nahi hota (sirf branch_id, jaisa Cash in Hand ke
  // comment mein bhi likha hai) -- is liye ye do qism sirf BRANCH se
  // chhanti hain, Load/Bill jitni theek shop-scoped nahi ho saktin.
  let udhaarQuery = service
    .from("journal_lines")
    .select("id, debit, credit, party_type, party_id, memo, journal_entries!inner(created_at, entry_date, branch_id, source_module)")
    .in("account_code", ["1100", "1150"])
    .eq("journal_entries.source_module", "customer_udhaar")
    .eq("journal_entries.entry_date", aaj);
  if (!unrestricted && me.branch_id) udhaarQuery = udhaarQuery.eq("journal_entries.branch_id", me.branch_id);
  const { data: udhaarRows } = await udhaarQuery;

  const customerNameById = new Map((customers ?? []).map((c) => [c.id as string, (c.name as string | null) ?? "—"]));
  const farmerNameById = new Map((farmers ?? []).map((f) => [f.id as string, (f.full_name as string | null) ?? "—"]));
  const partyName = (type: string, id: string) => (type === "farmer" ? farmerNameById.get(id) : customerNameById.get(id)) ?? "—";

  const todayUdhaarTxns = (udhaarRows ?? []).map((r: any) => {
    const entry = Array.isArray(r.journal_entries) ? r.journal_entries[0] : r.journal_entries;
    const giving = Number(r.debit) > 0;
    return {
      id: r.id as string,
      kind: (giving ? "udhaar" : "recovery") as "udhaar" | "recovery",
      customer: partyName(r.party_type, r.party_id),
      amount: giving ? Number(r.debit) : Number(r.credit),
      waqt: String(entry?.created_at ?? `${aaj}T00:00:00`),
    };
  });

  // Cash in Hand -- SIRF is shop ka, poori company ka nahi.
  //
  // 18 September: malik ne poocha "ye adad kahan se aa raha hai" -- pehle
  // ye ledger ke GL 1000 (Cash in Hand) ka poora jama tha, jo HAR shop ki
  // POS bikri aur Load/Bill ka mila-jula hisaab hai. Us se Karyana shop
  // wala staff doosri shops ka cash bhi apna samajh sakta tha. Ledger mein
  // shop_id hai hi nahi (sirf branch_id), is liye `fn_shop_day_summary`
  // istemal kiya -- wahi function jo "Shop ka hisaab" (shaam ka milan)
  // safhe par pehle se load/bill aur POS dono ko shop_id se chhanta hai.
  // "Aaj ka" hai, hamesha ka running balance nahi -- isi tarah jaisa poora
  // shaam ka hisaab roz ka hota hai, kal ka paisa handover/deposit se nikal
  // chuka maana jata hai.
  let cashInHand = 0;
  if (defaultShopId) {
    const { data: shopDay } = await supabase.rpc("fn_shop_day_summary", { p_shop: defaultShopId, p_date: aaj });
    const row = Array.isArray(shopDay) ? shopDay[0] : shopDay;
    cashInHand = row ? Number(row.lb_cash ?? 0) + Number(row.pos_cash ?? 0) : 0;
  }

  const providerName = new Map((providers ?? []).map((p) => [p.id as string, p.name as string]));

  // Counter par aane wala banda POS se yahan aata hai, is liye wohi teen
  // khane yahan bhi -- taake wo apni jagah pehchanta rahe.
  const shuruKind = searchParams.kind === "bill" ? "bill" : "load";

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col">
      <PageHeader
        title="Staff Sales Desk"
        description="Al Rana Traders  |  Load & Bill"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/load-bill/shop-summary"
              className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              Shop ka hisaab
            </Link>
            <Link
              href="/admin/load-bill/reconcile"
              className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              Shaam ka milan
            </Link>
            {FLOAT_ROLES.includes(me.role) && (
              <Link
                href="/admin/load-bill/accounts"
                className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
              >
                Float aur account
              </Link>
            )}
          </div>
        }
      />

      {(accounts ?? []).length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-surface-900 dark:text-white">Abhi koi provider account nahi bana.</p>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            Load ya bill darj karne se pehle kam az kam ek provider account (Jazz retailer, Easypaisa, UBL Omni…)
            banana zaroori hai — kyunki har qatar kisi na kisi account ke float se katti hai.
          </p>
          {FLOAT_ROLES.includes(me.role) ? (
            <Link href="/admin/load-bill/accounts" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
              Account banayein →
            </Link>
          ) : (
            <p className="mt-3 text-sm text-surface-500">Ye kaam Manager, Finance ya Admin karte hain.</p>
          )}
        </Card>
      ) : (
        <LoadBillClient
          shuruKind={shuruKind}
          shops={(shops ?? []).map((s) => ({ id: s.id as string, name: s.name as string }))}
          defaultShopId={defaultShopId}
          providers={(providers ?? []).map((p) => ({
            id: p.id as string,
            name: p.name as string,
            kind: p.kind as string,
            billCategory: (p.bill_category as string | null) ?? null,
          }))}
          accounts={(accounts ?? []).map((a) => ({
            id: a.id as string,
            title: a.title as string,
            accountRef: (a.account_ref as string | null) ?? null,
            providerId: (a.provider_id as string | null) ?? null,
            providerName: a.provider_id ? providerName.get(a.provider_id as string) ?? "—" : "—",
            float: floats.get(a.id as string) ?? null,
          }))}
          customers={(customers ?? []).map((c) => ({
            id: c.id as string,
            name: (c.name as string | null) ?? "—",
            // NULL = is customer ka hisaab shuru hi nahi hua. Us ko
            // sifar likh dena "dekh liya, kuch nahi" kehna hai -- aur
            // wo baat yahan sach nahi.
            balance: c.current_balance == null ? null : Number(c.current_balance),
          }))}
          farmers={(farmers ?? []).map((f) => ({
            id: f.id as string,
            name: (f.full_name as string | null) ?? (f.farmer_code as string),
            phone: (f.phone_number as string | null) ?? null,
            cnic: (f.cnic as string | null) ?? null,
            farmerCode: f.farmer_code as string,
          }))}
          financeAccounts={(financeAccounts ?? []).map((f) => ({
            id: f.id as string,
            name: f.name as string,
          }))}
          today={(aajKiQatarein ?? []).map((t) => ({
            id: t.id as string,
            number: t.txn_number as string,
            kind: t.kind as string,
            reference: t.reference as string,
            principal: Number(t.principal),
            serviceCharge: t.service_charge === null ? null : Number(t.service_charge),
            commissionExpected: t.commission_expected === null ? null : Number(t.commission_expected),
            commissionConfirmed: t.commission_confirmed === null ? null : Number(t.commission_confirmed),
            commissionStatus: t.commission_status as string,
            method: t.payment_method as string,
            tid: (t.provider_tid as string | null) ?? null,
            status: t.status as string,
            settled: Boolean(t.float_settled),
            customer: (t.customer_name as string | null) ?? null,
            waqt: String(t.created_at),
            provider: providerName.get(t.provider_id as string) ?? "—",
          }))}
          canReverse={FLOAT_ROLES.includes(me.role)}
          cashInHand={cashInHand}
          todayRecovery={todayRecovery}
          todayUdhaarTxns={todayUdhaarTxns}
        />
      )}
    </div>
  );
}
