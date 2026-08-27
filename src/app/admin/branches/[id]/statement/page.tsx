import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BranchStatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

export default async function BranchStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: branchId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();
  const { data: branch } = await supabase.from("branches").select("id, name, district").eq("id", branchId).single();

  const { data: rawTxns } = await supabase
    .from("branch_credit_transactions")
    .select("transaction_type, amount, notes, created_at")
    .eq("branch_id", branchId)
    .gte("created_at", startDate)
    .lte("created_at", `${endDate}T23:59:59`)
    .order("created_at", { ascending: true });

  type Entry = { date: string; description: string; debit: number; credit: number };
  const entries: Entry[] = (rawTxns ?? []).map((t) => ({
    date: new Date(t.created_at).toLocaleDateString(),
    description: `${t.transaction_type.replace(/_/g, " ")}${t.notes ? ` - ${t.notes}` : ""}`,
    debit: t.transaction_type === "order_charge" ? Number(t.amount) : 0,
    credit: t.transaction_type === "advance_payment" || t.transaction_type === "refund" ? Number(t.amount) : 0,
  }));

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
      <PageHeader title={`${branch?.name ?? "Branch"} - Statement`} description="Order charges aur advance payments ki poori history" />
      <BranchStatementClient
        branchName={branch?.name ?? "Branch"}
        district={branch?.district ?? null}
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