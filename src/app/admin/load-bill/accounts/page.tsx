import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { FloatClient } from "./float-client";

export const dynamic = "force-dynamic";

const FLOAT_ROLES = ["owner", "super_admin", "admin", "finance", "manager"];

/**
 * Provider ke account aur un ka float.
 *
 * Float mein paisa daalna KHARCHA NAHI hai -- paisa bank/golak se nikal
 * kar provider ke account mein gaya, bas. Ye baat safhe par bhi likhi
 * hai, kyunki ye wohi ghalti hai jo is project mein machinery ke advance
 * par ho chuki hai: use kharcha likh dene se nafa nuqsan ka safha bilkul
 * ghalat tasveer dikhane lagta hai.
 */
export default async function LoadAccountsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) redirect("/login");

  if (!FLOAT_ROLES.includes(me.role)) {
    return (
      <div>
        <PageHeader title="Float aur account" />
        <Card>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Float mein paisa daalna aur account banana sirf Manager, Finance ya Admin ka kaam hai.
          </p>
          <Link href="/admin/load-bill" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
            Load & Bill par wapas →
          </Link>
        </Card>
      </div>
    );
  }

  const service = createServiceClient();

  const [{ data: providers }, { data: accounts }, { data: financeAccounts }] = await Promise.all([
    service.from("load_providers").select("id, name, kind").eq("is_active", true).order("sort_order"),
    service.from("load_accounts").select("id, title, account_ref, provider_id, opening_float, opened_on").eq("is_active", true).order("title"),
    service.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
  ]);

  const floats = new Map<string, number | null>();
  for (const a of accounts ?? []) {
    const { data, error } = await supabase.rpc("fn_load_float_balance", { p_account: a.id, p_upto: null });
    floats.set(a.id as string, error ? null : Number(data ?? 0));
  }

  const { data: moves } = await service
    .from("load_float_moves")
    .select("id, account_id, kind, amount, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const providerName = new Map((providers ?? []).map((p) => [p.id as string, p.name as string]));
  const accountTitle = new Map((accounts ?? []).map((a) => [a.id as string, a.title as string]));

  return (
    <div>
      <PageHeader
        title="Float aur account"
        description="Provider ke account, un ka float, aur float mein paisa daalna"
        actions={
          <Link
            href="/admin/load-bill"
            className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            Load & Bill
          </Link>
        }
      />
      <FloatClient
        providers={(providers ?? []).map((p) => ({ id: p.id as string, name: p.name as string }))}
        accounts={(accounts ?? []).map((a) => ({
          id: a.id as string,
          title: a.title as string,
          accountRef: (a.account_ref as string | null) ?? null,
          providerName: providerName.get(a.provider_id as string) ?? "—",
          float: floats.get(a.id as string) ?? null,
        }))}
        financeAccounts={(financeAccounts ?? []).map((f) => ({ id: f.id as string, name: f.name as string }))}
        moves={(moves ?? []).map((m) => ({
          id: m.id as string,
          account: accountTitle.get(m.account_id as string) ?? "—",
          kind: m.kind as string,
          amount: Number(m.amount),
          reason: (m.reason as string | null) ?? null,
          waqt: String(m.created_at),
        }))}
      />
    </div>
  );
}
