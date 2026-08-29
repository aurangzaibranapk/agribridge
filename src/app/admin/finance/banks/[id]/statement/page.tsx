import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

export default async function BankStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: bankId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();
  const { data: bank } = await supabase
    .from("finance_accounts")
    .select("id, name, account_number, opening_balance, current_balance")
    .eq("id", bankId)
    .single();

  // Teen naam ghalat the: description/type/created_at. Table mein wo
  // notes/transaction_type/transaction_date hain -- is liye ye poora
  // select fail hota tha aur statement hamesha khali aata tha.
  //
  // Tareekh ab transaction_date se chhanti hai, created_at se nahi:
  // raat ko 11 baje darj ki gayi kal ki entry kal hi ki hai, aaj ki
  // nahi. Bank statement mein ye farq maini rakhta hai.
  const { data: rawTxns } = await supabase
    .from("finance_transactions")
    .select("id, transaction_date, notes, category, amount, transaction_type")
    .eq("account_id", bankId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  let runningBalance = Number(bank?.opening_balance ?? 0);
  let totalCredit = 0;
  let totalDebit = 0;
  // transfer_in bhi aamad hai. Pehle sirf "income" ko aamad mana jata
  // tha, is liye ek khate se doosre mein aayi hui raqam statement par
  // kharch bun kar dikhti -- aur closing balance ghalat aata.
  const transactions = (rawTxns ?? []).map((row) => {
    const amount = Number(row.amount);
    const isCredit = row.transaction_type === "income" || row.transaction_type === "transfer_in";
    if (isCredit) {
      totalCredit += amount;
      runningBalance += amount;
    } else {
      totalDebit += amount;
      runningBalance -= amount;
    }
    return {
      id: row.id,
      date: row.transaction_date,
      description: row.notes ?? row.category ?? row.transaction_type,
      amount,
      isCredit,
      runningBalance,
    };
  });

  return (
    <div>
      <PageHeader title={`${bank?.name ?? "Bank"} - Statement`} description="Date range se transaction history dekhein" />
      <StatementClient
        bankName={bank?.name ?? "Bank"}
        accountNumber={bank?.account_number ?? null}
        startDate={startDate}
        endDate={endDate}
        openingBalance={Number(bank?.opening_balance ?? 0)}
        transactions={transactions}
        totalCredit={totalCredit}
        totalDebit={totalDebit}
        closingBalance={runningBalance}
      />
    </div>
  );
}