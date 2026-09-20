import { DeskWorkspace } from "@/components/guided/desk-workspace";
import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
    .select("role, branch_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) redirect("/login");

  const service = createServiceClient();
  const aaj = aajKaKhana();
  const branchPromise = me.branch_id
    ? service.from("branches").select("name").eq("id", me.branch_id).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [{ data: providers }, { data: accounts }, { data: financeAccounts }, { data: customers }, { data: farmers }, { data: branch }] =
    await Promise.all([
      service.from("load_providers").select("id, key, name, kind, bill_category").eq("is_active", true).order("sort_order"),
      service.from("load_accounts").select("id, title, account_ref, provider_id, branch_id").eq("is_active", true)
        .or(me.branch_id ? `branch_id.is.null,branch_id.eq.${me.branch_id}` : "branch_id.is.null").order("title"),
      service.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("name"),
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
      branchPromise,
    ]);

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

  const loadTransactionsQuery = service
    .from("load_transactions")
    .select(
      "id, txn_number, kind, reference, bill_category, principal, service_charge, commission_expected, commission_confirmed, commission_status, payment_method, provider_tid, status, float_settled, customer_name, created_at, account_id, provider_id"
    )
    .gte("created_at", `${aaj}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(60);
  const loadTransactionsResult = me.branch_id
    ? await loadTransactionsQuery.eq("branch_id", me.branch_id)
    : { data: [], error: null };
  const aajKiQatarein = loadTransactionsResult.data;

  // Recovery and new udhaar are ledger events, not load_transactions.
  // Keep this list scoped to the signed-in staff member's branch. If no
  // branch is assigned, show the recovery figure as unavailable below.
  const ledgerResult = me.branch_id
    ? await service
        .from("journal_entries")
        .select("id, description, created_at, is_reversal, reversal_of")
        .eq("branch_id", me.branch_id)
        .eq("source_module", "customer_udhaar")
        .eq("entry_date", aaj)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [], error: null };
  const ledgerRows = ledgerResult.data ?? [];
  const ledgerIds = ledgerRows.map((row) => row.id as string);
  const ledgerLines = ledgerIds.length
    ? await service.from("journal_lines").select("entry_id, debit").in("entry_id", ledgerIds)
    : { data: [], error: null };
  const debitByEntry = new Map<string, number>();
  for (const line of ledgerLines.data ?? []) {
    debitByEntry.set(line.entry_id as string, (debitByEntry.get(line.entry_id as string) ?? 0) + Number(line.debit ?? 0));
  }
  const reversedLedgerIds = new Set(ledgerRows.map((row) => row.reversal_of as string | null).filter((id): id is string => Boolean(id)));
  const ledgerToday = ledgerRows
    .filter((row) => !row.is_reversal && !reversedLedgerIds.has(row.id as string))
    .map((row) => {
      const description = String(row.description ?? "");
      const isRecovery = /^(Udhaar ki wapsi|Udhaar wapas aaya)/i.test(description);
      return {
        id: row.id as string,
        description,
        amount: debitByEntry.get(row.id as string) ?? 0,
        createdAt: row.created_at as string,
        kind: (isRecovery ? "recovery" : "udhaar") as "recovery" | "udhaar",
      };
    });
  const recoveryToday = ledgerResult.error || ledgerLines.error || !me.branch_id
    ? null
    : ledgerToday.filter((row) => row.kind === "recovery").reduce((sum, row) => sum + row.amount, 0);

  const providerName = new Map((providers ?? []).map((p) => [p.id as string, p.name as string]));

  // Counter par aane wala banda POS se yahan aata hai, is liye wohi teen
  // khane yahan bhi -- taake wo apni jagah pehchanta rahe.
  const shuruKind = searchParams.kind === "bill" ? "bill" : "load";

  return (
    <DeskWorkspace className="desk-load">
      <PageHeader
        title="Staff Sales Desk"
        description={`Al Rana Traders  |  ${branch?.name ?? "Branch not assigned"}  ·  Mobile Load · Bill Payment · Udhaar · Recovery`}
        actions={
          <div className="flex flex-wrap gap-2">
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
            billCategory: (t.bill_category as string | null) ?? null,
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
          ledgerToday={ledgerToday}
          summary={{
            floatBalance: (accounts ?? []).length > 0 && (accounts ?? []).every((account) => floats.get(account.id as string) !== null && floats.has(account.id as string))
              ? (accounts ?? []).reduce((sum, account) => sum + (floats.get(account.id as string) ?? 0), 0)
              : null,
            cashReceived: !me.branch_id || loadTransactionsResult.error ? null : (aajKiQatarein ?? []).filter((row) => row.payment_method === "cash" && row.status !== "wapas")
              .reduce((sum, row) => sum + Number(row.principal ?? 0) + Number(row.service_charge ?? 0), 0),
            volume: !me.branch_id || loadTransactionsResult.error ? null : (aajKiQatarein ?? []).filter((row) => row.status !== "wapas")
              .reduce((sum, row) => sum + Number(row.principal ?? 0), 0),
            recovery: recoveryToday,
            pendingProof: !me.branch_id || loadTransactionsResult.error ? null : (aajKiQatarein ?? []).filter((row) => row.status === "saboot_baqi").length,
          }}
          canReverse={FLOAT_ROLES.includes(me.role)}
        />
      )}
    </DeskWorkspace>
  );
}
