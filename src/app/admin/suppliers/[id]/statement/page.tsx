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
  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();
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
  const [{ data: rawPayments }, { data: posCounters }] = await Promise.all([
    supabase
      .from("supplier_payments")
      .select("id, payment_date, amount, notes, slip_url")
      .eq("supplier_id", supplierId)
      .gte("payment_date", startDate)
      .lte("payment_date", endDate)
      .order("payment_date", { ascending: true }),
    service.from("pos_counters").select("id, name").eq("is_active", true).order("name"),
  ]);
  // Bank statement convention: maal aya = Credit (balance barhta hai),
  // payment di = Debit (balance ghatata hai).
  type Entry = { date: string; description: string; debit: number; credit: number; slipUrl?: string | null };
  const entries: Entry[] = [
    ...(rawPurchases ?? []).map((p) => ({ date: p.purchase_date, description: `Purchase ${p.purchase_number}`, credit: Number(p.total_amount), debit: 0 })),
    ...(rawPayments ?? []).map((p) => ({ date: p.payment_date, description: `Payment${p.notes ? ` - ${p.notes}` : ""}`, debit: Number(p.amount), credit: 0, slipUrl: p.slip_url })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let runningBalance = 0;
  let totalCredit = 0;
  let totalDebit = 0;
  const entriesWithBalance = entries.map((e) => {
    runningBalance += e.credit - e.debit;
    totalCredit += e.credit;
    totalDebit += e.debit;
    return { ...e, runningBalance };
  });
  return (
    <div>
      <PageHeader title={`${supplier?.name ?? "Supplier"} - Statement`} description="Purchases aur Payments ki poori history" />
      <SupplierStatementClient
        supplierId={supplierId}
        supplierName={supplier?.name ?? "Supplier"}
        companyName={supplier?.company_name ?? null}
        phoneNumber={supplier?.phone_number ?? null}
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
        posCounters={(posCounters ?? []).map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}