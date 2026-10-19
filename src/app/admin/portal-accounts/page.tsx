import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { toAccount, summarize, templateConfig, type PortalAccountRow } from "@/lib/portal-accounts/core";
import { PortalAccountsTable } from "./table";

export const dynamic = "force-dynamic";

export default async function PortalAccountsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !["owner", "super_admin", "admin"].includes(String(me.role))) {
    return <div className="p-6"><PageHeader title="Portal Accounts" description="Ye safha sirf Owner aur Admin ke liye hai." /></div>;
  }
  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("fn_portal_accounts");
  const accounts = ((data ?? []) as PortalAccountRow[]).map((r) => toAccount(r));
  const stats = summarize(accounts);
  const cfg = templateConfig();
  return (
    <div className="space-y-5">
      <PageHeader title="Portal Accounts" description="Kisan, customer, dealer aur vendor ke login accounts — sirf Owner/Admin" />
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Kul accounts" value={stats.total} tone="from-brand-500 to-emerald-500" />
        <Kpi label="Kisan" value={stats.farmer} tone="from-emerald-500 to-lime-500" />
        <Kpi label="Customer / Dealer / Vendor" value={stats.other} tone="from-sky-500 to-indigo-500" />
        <Kpi label="Bina profile" value={stats.noProfile} tone="from-amber-500 to-orange-500" />
        <Kpi label="Band (suspended)" value={stats.suspended} tone="from-rose-500 to-red-500" />
      </div>
      <PortalAccountsTable accounts={accounts} meId={user!.id} templateReady={cfg.ready} templateName={cfg.name} />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-surface-900 dark:text-white">{value}</p>
    </div>
  );
}
