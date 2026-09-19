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

  // Farmer aur Customer ka statement ab EK hi jagah se banta hai (424)
  // -- Malik: "farmer ho ya customer, dono ek hi cheez honi chahiye."
  // Machine/GL + khad + doodh + POS, chaar sub-ledger ek fehrist mein
  // (sirf khad_baqi nahi, jaisa pehle is safhe par tha).
  const openingEnd = new Date(`${startDate}T00:00:00Z`);
  openingEnd.setUTCDate(openingEnd.getUTCDate() - 1);
  const [{ data: rawLedger }, { data: openingRows }] = await Promise.all([
    (supabase.rpc as any)("fn_farmer_combined_ledger", { p_farmer: farmerId, p_start: startDate, p_end: endDate }),
    (supabase.rpc as any)("fn_farmer_combined_ledger", { p_farmer: farmerId, p_start: null, p_end: openingEnd.toISOString().slice(0, 10) }),
  ]);

  type Entry = { date: string; description: string; debit: number; credit: number; runningBalance: number };
  let totalDebit = 0;
  let totalCredit = 0;
  let runningBalance = (openingRows ?? []).reduce((sum: number, r: any) => sum + Number(r.debit || 0) - Number(r.credit || 0), 0);
  const entries: Entry[] = (rawLedger ?? []).map((l: any) => {
    const debit = Number(l.debit ?? 0);
    const credit = Number(l.credit ?? 0);
    totalDebit += debit;
    totalCredit += credit;
    runningBalance += debit - credit;
    return {
      date: new Date(l.entry_date).toLocaleDateString(),
      description: `${l.module?.replace(/_/g, " ") ?? ""}${l.tafseel ? ` - ${l.tafseel}` : ""}`,
      debit,
      credit,
      runningBalance,
    };
  });

  const closingBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : runningBalance;

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