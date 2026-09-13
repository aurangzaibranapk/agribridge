import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
import { AlertTriangle, CalendarClock, ReceiptText, WalletCards } from "lucide-react";
import { RecoveryClient } from "./recovery-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

function rs(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loose = supabase as any;
  const [{ data }, { count: scheduled }, { count: promises }, { count: failed }] = await Promise.all([
    loose.rpc("fn_recovery_outstanding", { p_search: sp.q?.trim() || null }),
    loose.from("payment_reminders").select("id", { count: "exact", head: true }).eq("delivery_status", "scheduled"),
    loose.from("payment_promises").select("id", { count: "exact", head: true }).in("status", ["open", "due_today"]),
    loose.from("payment_reminders").select("id", { count: "exact", head: true }).eq("delivery_status", "failed"),
  ]);
  const parties = (data ?? []).map((p: any) => ({ type:p.party_type,id:p.party_id,name:p.party_name,phone:p.phone,email:p.email,outstanding:Number(p.outstanding||0),lastActivity:p.last_activity }));
  const total = parties.reduce((sum: number, p: any) => sum + p.outstanding, 0);
  const withoutContact = parties.filter((p: any) => !p.phone && !p.email).length;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <PageHeader title="Khata & Recovery" description="Outstanding customers, statements aur payment follow-up — ek jagah." />
      <div className="flex gap-2"><Link href="/admin/finance/recovery/history" className="rounded-lg border px-3 py-2 text-sm">Reminder History</Link><Link href="/admin/finance/recovery/promises" className="rounded-lg border px-3 py-2 text-sm">Promise to Pay</Link></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="py-3"><WalletCards className="mb-2 h-5 w-5 text-red-600" /><p className="text-xs text-surface-500">Total Receivable</p><p className="text-xl font-semibold text-red-700">{rs(total)}</p></Card>
        <Card className="py-3"><ReceiptText className="mb-2 h-5 w-5 text-emerald-600" /><p className="text-xs text-surface-500">Outstanding Accounts</p><p className="text-xl font-semibold">{parties.length}</p></Card>
        <Card className="py-3"><CalendarClock className="mb-2 h-5 w-5 text-amber-600" /><p className="text-xs text-surface-500">Scheduled / Promises</p><p className="text-xl font-semibold">{scheduled ?? 0} / {promises ?? 0}</p></Card>
        <Card className="py-3"><AlertTriangle className="mb-2 h-5 w-5 text-orange-600" /><p className="text-xs text-surface-500">Failed / Contact Missing</p><p className="text-xl font-semibold">{failed ?? 0} / {withoutContact}</p></Card>
      </div>

      <Card className="flex min-h-0 flex-col p-0">
        <form className="flex flex-wrap gap-2 border-b border-surface-100 p-3 dark:border-surface-800">
          <input name="q" defaultValue={sp.q} placeholder="Customer search..." className="min-w-64 rounded-lg border border-surface-200 bg-transparent px-3 py-2 text-sm" />
          <button className="rounded-lg bg-surface-800 px-4 py-2 text-sm text-white">Search</button>
        </form>
        <RecoveryClient parties={parties} />
      </Card>
    </div>
  );
}
