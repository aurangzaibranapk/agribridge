import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { DealerStatementClient } from "./statement-client";

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
    .select("id, order_number, created_at, commission_amount")
    .eq("dealer_id", dealerId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .gt("commission_amount", 0)
    .order("created_at", { ascending: true });

  const { data: rawPayments } = await supabase
    .from("dealer_payments")
    .select("id, payment_date, amount, notes, slip_url")
    .eq("dealer_id", dealerId)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: true });

  type Entry = { date: string; description: string; debit: number; credit: number; slipUrl?: string | null };
  const entries: Entry[] = [
    ...(rawOrders ?? []).map((o: any) => ({
      date: String(o.created_at).slice(0, 10),
      description: `Commission - Order ${o.order_number ?? o.id.slice(0, 8)}`,
      debit: Number(o.commission_amount),
      credit: 0,
    })),
    ...(rawPayments ?? []).map((p) => ({
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