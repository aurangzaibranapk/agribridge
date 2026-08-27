import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SupplierStatementClient } from "./statement-client";
export const dynamic = "force-dynamic";
export default async function SupplierStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: supplierId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);
  const supabase = createClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, company_name, phone_number, bank_name, bank_account_title, bank_account_number, bank_iban")
    .eq("id", supplierId)
    .single();
  const { data: rawPurchases } = await supabase
    .from("purchases")
    .select("id, purchase_number, purchase_date, total_amount")
    .eq("supplier_id", supplierId)
    .gte("purchase_date", startDate)
    .lte("purchase_date", endDate)
    .order("purchase_date", { ascending: true });
  const { data: rawPayments } = await supabase
    .from("supplier_payments")
    .select("id, payment_date, amount, notes, slip_url")
    .eq("supplier_id", supplierId)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: true });
  type Entry = { date: string; description: string; debit: number; credit: number; slipUrl?: string | null };
  const entries: Entry[] = [
    ...(rawPurchases ?? []).map((p) => ({ date: p.purchase_date, description: `Purchase ${p.purchase_number}`, debit: Number(p.total_amount), credit: 0 })),
    ...(rawPayments ?? []).map((p) => ({ date: p.payment_date, description: `Payment${p.notes ? ` - ${p.notes}` : ""}`, debit: 0, credit: Number(p.amount), slipUrl: p.slip_url })),
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
      <PageHeader title={`${supplier?.name ?? "Supplier"} - Statement`} description="Purchases aur Payments ki poori history" />
      <SupplierStatementClient
        supplierId={supplierId}
        supplierName={supplier?.name ?? "Supplier"}
        companyName={supplier?.company_name ?? null}
        bankName={supplier?.bank_name ?? null}
        bankAccountTitle={supplier?.bank_account_title ?? null}
        bankAccountNumber={supplier?.bank_account_number ?? null}
        bankIban={supplier?.bank_iban ?? null}
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