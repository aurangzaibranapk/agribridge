import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
import { AlertTriangle, CalendarClock, MessageCircle, ReceiptText, WalletCards } from "lucide-react";

export const dynamic = "force-dynamic";

function rs(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase.from("customers")
    .select("id,name,phone_number,email,current_balance,payment_due_days,is_active")
    .eq("is_deleted", false)
    .gt("current_balance", 0)
    .order("current_balance", { ascending: false });
  if (sp.q?.trim()) query = query.ilike("name", `%${sp.q.trim()}%`);
  const { data } = await query;
  const customers = (data ?? []).map((c) => ({ ...c, current_balance: Number(c.current_balance || 0) }));
  const total = customers.reduce((sum, c) => sum + c.current_balance, 0);
  const withoutContact = customers.filter((c) => !c.phone_number && !c.email).length;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <PageHeader title="Khata & Recovery" description="Outstanding customers, statements aur payment follow-up — ek jagah." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="py-3"><WalletCards className="mb-2 h-5 w-5 text-red-600" /><p className="text-xs text-surface-500">Total Receivable</p><p className="text-xl font-semibold text-red-700">{rs(total)}</p></Card>
        <Card className="py-3"><ReceiptText className="mb-2 h-5 w-5 text-emerald-600" /><p className="text-xs text-surface-500">Outstanding Accounts</p><p className="text-xl font-semibold">{customers.length}</p></Card>
        <Card className="py-3"><CalendarClock className="mb-2 h-5 w-5 text-amber-600" /><p className="text-xs text-surface-500">Reminder Ready</p><p className="text-xl font-semibold">{customers.filter((c) => c.phone_number).length}</p></Card>
        <Card className="py-3"><AlertTriangle className="mb-2 h-5 w-5 text-orange-600" /><p className="text-xs text-surface-500">Contact Missing</p><p className="text-xl font-semibold">{withoutContact}</p></Card>
      </div>

      <Card className="flex min-h-0 flex-col p-0">
        <form className="flex flex-wrap gap-2 border-b border-surface-100 p-3 dark:border-surface-800">
          <input name="q" defaultValue={sp.q} placeholder="Customer search..." className="min-w-64 rounded-lg border border-surface-200 bg-transparent px-3 py-2 text-sm" />
          <button className="rounded-lg bg-surface-800 px-4 py-2 text-sm text-white">Search</button>
        </form>
        <div className="max-h-[calc(100vh-22rem)] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800">
              <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3">Credit Terms</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-surface-500"><span className="block">{c.phone_number || "Phone missing"}</span><span className="text-xs">{c.email || "Email missing"}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">{rs(c.current_balance)}</td>
                  <td className="px-4 py-3 text-surface-500">{Number(c.payment_due_days || 0)} days</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">
                    <Link href={`/admin/crm/${c.id}/statement`} className="rounded-lg border border-surface-200 px-3 py-1.5">Statement</Link>
                    <Link href={`/admin/crm/${c.id}/statement`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-white"><MessageCircle className="h-3.5 w-3.5" /> Send</Link>
                  </div></td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-surface-500">Koi outstanding customer nahi mila.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
