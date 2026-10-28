import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ApproveBuyerPaymentForm, BuyerStatementClient } from "./statement-client";
import { isMoneyWriter } from "@/lib/finance/money-guards";
export const dynamic = "force-dynamic";
export default async function BuyerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: buyerId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);
  const supabase = createClient();

  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, business_name, phone_number, bank_name, bank_account_title, bank_account_number, bank_iban")
    .eq("id", buyerId)
    .single();

  const { data: rawOrders } = await (supabase as any)
    .from("produce_orders")
    .select("id, order_number, placed_at, subtotal")
    .eq("buyer_id", buyerId)
    .gte("placed_at", startDate)
    .lte("placed_at", endDate + "T23:59:59")
    .order("placed_at", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const { data: accounts } = await supabase.from("finance_accounts").select("id, name").eq("is_active", true).order("name");
  const { data: rawPayments } = await (supabase.from("buyer_payments") as any)
    .select("id, payment_date, amount, direction, notes, slip_url, status, created_by")
    .eq("buyer_id", buyerId)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: true });
  const postedPayments = (rawPayments ?? []).filter((p: { status?: string | null }) => !p.status || p.status === "posted");
  const pendingPayments = (rawPayments ?? []).filter((p: { status?: string }) => p.status === "pending" || p.status === "approving");

  type Entry = { date: string; description: string; debit: number; credit: number; slipUrl?: string | null };

  // Buyer order = buyer ne produce khareeda (buyer humein/farmer ko amount deta hai) -> credit (unhone diya)
  // Payment "we_paid" -> debit (hum ne diya), "they_paid" -> credit (unhone diya)
  const entries: Entry[] = [
    ...(rawOrders ?? []).map((o: any) => ({
      date: String(o.placed_at).slice(0, 10),
      description: `Order ${o.order_number}`,
      debit: 0,
      credit: Number(o.subtotal ?? 0),
    })),
    ...(postedPayments).map((p: { payment_date: string; amount: number; direction: string; notes: string | null; slip_url: string | null }) => ({
      date: p.payment_date,
      description: `Payment (${p.direction === "we_paid" ? "Hum ne diya" : "Unhone diya"})${p.notes ? ` - ${p.notes}` : ""}`,
      debit: p.direction === "we_paid" ? Number(p.amount) : 0,
      credit: p.direction === "they_paid" ? Number(p.amount) : 0,
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
      <PageHeader title={`${buyer?.business_name ?? "Buyer"} - Statement`} description="Orders aur Payments ki poori history" />
      {pendingPayments.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-2 font-medium text-amber-900">Manzoori baqi adaigiyan</p>
          <ul className="space-y-2">
            {pendingPayments.map((p: { id: string; payment_date: string; amount: number; direction: string; created_by: string | null }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{p.payment_date} — Rs {Number(p.amount).toLocaleString()} ({p.direction})</span>
                {isMoneyWriter(me?.role) && p.created_by !== user?.id && (
                  <ApproveBuyerPaymentForm paymentId={p.id} accounts={accounts ?? []} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <BuyerStatementClient
        buyerId={buyerId}
        buyerName={buyer?.business_name ?? "Buyer"}
        bankName={buyer?.bank_name ?? null}
        bankAccountTitle={buyer?.bank_account_title ?? null}
        bankAccountNumber={buyer?.bank_account_number ?? null}
        bankIban={buyer?.bank_iban ?? null}
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
