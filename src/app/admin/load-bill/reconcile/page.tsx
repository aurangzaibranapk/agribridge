import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ReconcileClient } from "./reconcile-client";

export const dynamic = "force-dynamic";

const FLOAT_ROLES = ["owner", "super_admin", "admin", "finance", "manager"];

/**
 * Shaam ka milan — float ka.
 *
 * Kaghaz ka adad khud ko kabhi ghalat nahi kehta. Hamare hisaab se float
 * Rs 53,000 hona chahiye, magar wo sirf ek hisaab hai. Asal balance sirf
 * provider ki app mein dekh kar maloom hota hai. Yehi wo ek qadam hai jo
 * poore hisaab ko haqeeqat se bandhta hai -- is ke baghair sab kuch ek
 * khoobsurat, mukammal, aur mumkina tor par ghalat kahani hai.
 *
 * Malik ka usool, jo yahan taala ban kar laga hai:
 *   "Rs 1 ka farq ho sakta hai, lekin Rs 1 unexplained nahi rehna
 *    chahiye."
 *
 * Aur ek baat jo safhe par saaf likhi hai: `actual_closing` ka khali
 * rehna "sifar" nahi hai -- us ka matlab hai ke abhi dekha hi nahi gaya.
 */
export default async function LoadReconcilePage({
  searchParams,
}: {
  searchParams: { tareekh?: string; account?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) redirect("/login");

  const service = createServiceClient();
  const aaj = new Date().toISOString().slice(0, 10);
  const tareekh = searchParams.tareekh ?? aaj;

  const { data: accounts } = await service
    .from("load_accounts")
    .select("id, title, provider_id")
    .eq("is_active", true)
    .order("title");

  if (!accounts || accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Shaam ka milan" />
        <Card>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Abhi koi provider account nahi bana — milan kis cheez ka hoga.
          </p>
          <Link href="/admin/load-bill" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
            Load & Bill par jayein →
          </Link>
        </Card>
      </div>
    );
  }

  const accountId = searchParams.account ?? (accounts[0].id as string);

  const { data: providers } = await service.from("load_providers").select("id, name");
  const providerName = new Map((providers ?? []).map((p) => [p.id as string, p.name as string]));

  // Din ka hisaab SECURITY DEFINER function se -- taake ijazat wali rok
  // ke peeche khali jawab "sifar" na ban jaye.
  const { data: sumRows, error: sumErr } = await supabase.rpc("fn_load_day_summary", {
    p_account: accountId,
    p_date: tareekh,
  });
  const sum = Array.isArray(sumRows) ? sumRows[0] : sumRows;

  const { data: saved } = await service
    .from("load_reconciliations")
    .select("actual_closing, farq, reason, status, created_at")
    .eq("account_id", accountId)
    .eq("tareekh", tareekh)
    .maybeSingle();

  return (
    <div>
      <PageHeader
        title="Shaam ka milan"
        description="Hisaab kya kehta hai, aur provider ki app kya kehti hai"
        actions={
          <Link
            href="/admin/load-bill"
            className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            Load & Bill
          </Link>
        }
      />

      {sumErr ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Us din ka hisaab parha nahi ja saka: {sumErr.message}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Ye &ldquo;kuch nahi hua&rdquo; nahi hai — ye &ldquo;dekha nahi ja saka&rdquo; hai. In dono ko ek samajh
            lena is project mein pehle bhi ghalat adad de chuka hai.
          </p>
        </Card>
      ) : (
        <ReconcileClient
          tareekh={tareekh}
          aaj={aaj}
          accountId={accountId}
          accounts={accounts.map((a) => ({
            id: a.id as string,
            label: `${providerName.get(a.provider_id as string) ?? "—"} — ${a.title as string}`,
          }))}
          hisaab={{
            opening: Number(sum?.opening_float ?? 0),
            added: Number(sum?.float_added ?? 0),
            adjustments: Number(sum?.adjustments ?? 0),
            loadPrincipal: Number(sum?.load_principal ?? 0),
            billPrincipal: Number(sum?.bill_principal ?? 0),
            serviceCharge: Number(sum?.service_charge ?? 0),
            expected: Number(sum?.expected_closing ?? 0),
            count: Number(sum?.txn_count ?? 0),
            sabootBaqi: Number(sum?.saboot_baqi ?? 0),
          }}
          saved={
            saved
              ? {
                  actual: saved.actual_closing === null ? null : Number(saved.actual_closing),
                  farq: saved.farq === null ? null : Number(saved.farq),
                  reason: (saved.reason as string | null) ?? null,
                  status: saved.status as string,
                }
              : null
          }
          canApprove={FLOAT_ROLES.includes(me.role)}
        />
      )}
    </div>
  );
}
