import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ApproveDealerPaymentForm, DealerStatementClient } from "./statement-client";
import { isMoneyWriter } from "@/lib/finance/money-guards";

export const dynamic = "force-dynamic";

export default async function DealerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: dealerId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();

  const { data: dealer } = await supabase
    .from("dealers")
    .select("id, business_name, contact_person, bank_name, bank_account_title, bank_account_number, bank_iban")
    .eq("id", dealerId)
    .single();

  const { data: rawOrders } = await supabase
    .from("bridge_orders")
    .select("id, order_number, placed_at, commission_amount")
    .eq("assigned_dealer_id", dealerId)
    .gte("placed_at", startDate)
    .lte("placed_at", endDate + "T23:59:59")
    .gt("commission_amount", 0)
    .order("placed_at", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const { data: accounts } = await supabase.from("finance_accounts").select("id, name").eq("is_active", true).order("name");

  const { data: rawPayments } = await (supabase.from("dealer_payments") as any)
    .select("id, payment_date, amount, notes, slip_url, status, created_by")
    .eq("dealer_id", dealerId)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: true });
  const postedPayments = (rawPayments ?? []).filter((p: { status?: string | null }) => !p.status || p.status === "posted");
  const pendingPayments = (rawPayments ?? []).filter((p: { status?: string }) => p.status === "pending" || p.status === "approving");

  type Entry = { date: string; description: string; debit: number; credit: number; slipUrl?: string | null };
  const entries: Entry[] = [
    ...(rawOrders ?? []).map((o: any) => ({
      date: String(o.placed_at).slice(0, 10),
      description: `Commission - Order ${o.order_number ?? o.id.slice(0, 8)}`,
      debit: Number(o.commission_amount),
      credit: 0,
    })),
    ...(postedPayments).map((p: { payment_date: string; amount: number; notes: string | null; slip_url: string | null }) => ({
      date: p.payment_date,
      description: `Payment${p.notes ? ` - ${p.notes}` : ""}`,
      debit: 0,
      credit: Number(p.amount),
      slipUrl: p.slip_url,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const entriesWithBalance = entries.map((e) => {
    runningBalance += e.debit - e.credit;
    totalDebit += e.debit;
    totalCredit += e.credit;
    return { ...e, runningBalance };
  });

  return (
    <div>
      <PageHeader title={`${dealer?.business_name ?? "Dealer"} - Statement`} description="Commission aur Payments ki poori history" />
      {pendingPayments.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-2 font-medium text-amber-900">Manzoori baqi adaigiyan — abhi baqi nahi kati</p>
          <ul className="space-y-2">
            {pendingPayments.map((p: { id: string; payment_date: string; amount: number; created_by: string | null }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{p.payment_date} — Rs {Number(p.amount).toLocaleString()}</span>
                {isMoneyWriter(me?.role) && p.created_by !== user?.id && (
                  <ApproveDealerPaymentForm paymentId={p.id} accounts={accounts ?? []} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <DealerStatementClient
        dealerId={dealerId}
        dealerName={dealer?.business_name ?? "Dealer"}
        contactPerson={dealer?.contact_person ?? null}
        bankName={dealer?.bank_name ?? null}
        bankAccountTitle={dealer?.bank_account_title ?? null}
        bankAccountNumber={dealer?.bank_account_number ?? null}
        bankIban={dealer?.bank_iban ?? null}
        startDate={startDate}
        endDate={endDate}
        entries={entriesWithBalance}
        totalDebit={totalDebit}
        totalCredit={totalCredit}
        closingBalance={runningBalance}
      />
    </div>
  );
}