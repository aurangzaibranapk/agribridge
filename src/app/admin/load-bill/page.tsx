import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { LoadBillClient } from "./load-bill-client";
import { CounterTabs } from "@/components/pos/counter-tabs";

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
  const aaj = new Date().toISOString().slice(0, 10);

  const [{ data: providers }, { data: accounts }, { data: financeAccounts }] = await Promise.all([
    service.from("load_providers").select("id, key, name, kind, bill_category").eq("is_active", true).order("sort_order"),
    service.from("load_accounts").select("id, title, account_ref, provider_id, branch_id").eq("is_active", true).order("title"),
    service.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("name"),
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
    const { data, error } = await supabase.rpc("fn_load_float_balance", { p_account: a.id, p_upto: null });
    // Na mile to NULL -- sifar nahi. "Balance sifar hai" aur "balance
    // parha nahi ja saka" do alag baatein hain.
    floats.set(a.id as string, error ? null : Number(data ?? 0));
  }

  const { data: aajKiQatarein } = await service
    .from("load_transactions")
    .select(
      "id, txn_number, kind, reference, principal, service_charge, commission_expected, commission_status, payment_method, provider_tid, status, float_settled, customer_name, created_at, account_id, provider_id"
    )
    .gte("created_at", `${aaj}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(60);

  const providerName = new Map((providers ?? []).map((p) => [p.id as string, p.name as string]));

  // Counter par aane wala banda POS se yahan aata hai, is liye wohi teen
  // khane yahan bhi -- taake wo apni jagah pehchanta rahe.
  const shuruKind = searchParams.kind === "bill" ? "bill" : "load";

  return (
    <div>
      <CounterTabs active={shuruKind} />
      <PageHeader
        title="Load & Bill"
        description="Mobile load aur customer ke bill — float ke hisaab ke sath"
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
            providerId: a.provider_id as string,
            providerName: providerName.get(a.provider_id as string) ?? "—",
            float: floats.get(a.id as string) ?? null,
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
        />
      )}
    </div>
  );
}
