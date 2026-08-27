import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BuyerStatementClient } from "./statement-client";
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

  const { data: rawOrders } = await supabase
    .from("produce_orders")
    .select("id, order_number, created_at, subtotal")
    .eq("buyer_id", buyerId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: true });

  const { data: rawPayments } = await supabase
    .from("buyer_payments")
    .select("id, payment_date, amount, direction, notes, slip_url")
    .eq("buyer_id", buyerId)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: true });

  type Entry = { date: string; description: string; debit: number; credit: number; slipUrl?: string | null };

  // Buyer order = buyer ne produce khareeda (buyer humein/farmer ko amount deta hai) -> credit (unhone diya)
  // Payment "we_paid" -> debit (hum ne diya), "they_paid" -> credit (unhone diya)
  const entries: Entry[] = [
    ...(rawOrders ?? []).map((o) => ({
      date: String(o.created_at).slice(0, 10),
      description: `Order ${o.order_number}`,
      debit: 0,
      credit: Number(o.subtotal ?? 0),
    })),
    ...(rawPayments ?? []).map((p) => ({
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