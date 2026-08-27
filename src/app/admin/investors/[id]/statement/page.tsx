import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { InvestorStatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

export default async function InvestorStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: investorId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();
  const { data: investor } = await supabase
    .from("investors")
    .select("id, full_name, phone_number, total_invested")
    .eq("id", investorId)
    .single();

  const { data: rawInvestments } = await supabase
    .from("investor_investments")
    .select("id, investment_date, amount, notes")
    .eq("investor_id", investorId)
    .gte("investment_date", startDate)
    .lte("investment_date", endDate)
    .order("investment_date", { ascending: true });

  const { data: rawReturns } = await supabase
    .from("investor_returns")
    .select("id, return_date, amount, notes")
    .eq("investor_id", investorId)
    .gte("return_date", startDate)
    .lte("return_date", endDate)
    .order("return_date", { ascending: true });

  // Investment increases what's outstanding with the company (credit,
  // company owes it back eventually); a Return/Profit payout reduces
  // it (debit).
  type Entry = { date: string; description: string; debit: number; credit: number };
  const entries: Entry[] = [
    ...(rawInvestments ?? []).map((i) => ({
      date: (i.investment_date as string).slice(0, 10),
      description: `Investment${i.notes ? ` - ${i.notes}` : ""}`,
      debit: 0,
      credit: Number(i.amount),
    })),
    ...(rawReturns ?? []).map((r) => ({
      date: (r.return_date as string).slice(0, 10),
      description: `Profit/Return Diya Gaya${r.notes ? ` - ${r.notes}` : ""}`,
      debit: Number(r.amount),
      credit: 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let runningBalance = 0;
  let totalInvested = 0;
  let totalReturned = 0;
  const entriesWithBalance = entries.map((e) => {
    runningBalance += e.credit - e.debit;
    totalInvested += e.credit;
    totalReturned += e.debit;
    return { ...e, runningBalance };
  });

  return (
    <div>
      <PageHeader title={`${investor?.full_name ?? "Investor"} - Statement`} description="Investments aur Profit/Returns ki poori history" />
      <InvestorStatementClient
        investorId={investorId}
        investorName={investor?.full_name ?? "Investor"}
        totalInvestedOverall={Number(investor?.total_invested ?? 0)}
        startDate={startDate}
        endDate={endDate}
        entries={entriesWithBalance}
        totalInvested={totalInvested}
        totalReturned={totalReturned}
        closingBalance={runningBalance}
      />
    </div>
  );
}