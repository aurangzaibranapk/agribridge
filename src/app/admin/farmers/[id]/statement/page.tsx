import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { FarmerStatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

export default async function FarmerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: farmerId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();
  const { data: farmer } = await supabase.from("farmers").select("id, full_name, farmer_code, phone_number").eq("id", farmerId).single();

  const { data: rawLedger } = await supabase
    .from("farmer_credit_ledger")
    .select("ledger_type, source_type, amount, balance_after, notes, created_at")
    .eq("farmer_id", farmerId)
    .gte("created_at", startDate)
    .lte("created_at", `${endDate}T23:59:59`)
    .order("created_at", { ascending: true });

  type Entry = { date: string; description: string; debit: number; credit: number; runningBalance: number };
  let totalDebit = 0;
  let totalCredit = 0;
  const entries: Entry[] = (rawLedger ?? []).map((l) => {
    const isDebit = l.ledger_type === "debit";
    const amount = Number(l.amount);
    if (isDebit) totalDebit += amount;
    else totalCredit += amount;
    return {
      date: new Date(l.created_at).toLocaleDateString(),
      description: `${l.source_type?.replace(/_/g, " ") ?? ""}${l.notes ? ` - ${l.notes}` : ""}`,
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      runningBalance: Number(l.balance_after ?? 0),
    };
  });

  const closingBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;

  return (
    <div>
      <PageHeader title={`${farmer?.full_name ?? "Farmer"} - Statement`} description="Credit/Debit ledger ki poori history" />
      <FarmerStatementClient
        farmerName={farmer?.full_name ?? "Farmer"}
        farmerCode={farmer?.farmer_code ?? null}
        startDate={startDate}
        endDate={endDate}
        entries={entries}
        totalDebit={totalDebit}
        totalCredit={totalCredit}
        closingBalance={closingBalance}
      />
    </div>
  );
}