import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatementClient } from "./statement-client";
import { trialBalance, accountLedger } from "@/lib/ledger/money-trail";

export const dynamic = "force-dynamic";

function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

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
    .select("id, name, account_number, gl_code")
    .eq("id", bankId)
    .single();

  // Statement ab seedha ledger (`journal_lines`) se -- `finance_transactions`
  // (purani cash book) mein machinery, Load/Bill, POS jaisi adhiktar
  // raqamein kabhi jati hi nahi thin, is liye statement adhoora dikhta
  // tha aur balance bhi purana (18 September, Easypaisa Rs 40,000 iska
  // sabse taaza saboot -- dekho `/admin/finance` ka fix).
  const glCode = bank?.gl_code ?? null;

  const [openingTb, ledgerLines] = await Promise.all([
    glCode ? trialBalance({ to: dayBefore(startDate) }) : Promise.resolve(null),
    glCode ? accountLedger(glCode, { from: startDate, to: endDate }, 500) : Promise.resolve([]),
  ]);

  const openingBalance = openingTb ? openingTb.rows.find((r) => r.code === glCode)?.balance ?? 0 : 0;

  let runningBalance = openingBalance;
  let totalCredit = 0;
  let totalDebit = 0;
  // Purane data mein bhi "transfer_in" ko aamad mana jata tha -- ledger
  // mein iski zaroorat nahi, kyunke debit-normal khate par debit hamesha
  // aamad hai, credit hamesha rawangi.
  const transactions = [...ledgerLines]
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.entryNumber.localeCompare(b.entryNumber))
    .map((line, index) => {
      const isCredit = line.debit > 0;
      const amount = isCredit ? line.debit : line.credit;
      if (isCredit) {
        totalCredit += amount;
        runningBalance += amount;
      } else {
        totalDebit += amount;
        runningBalance -= amount;
      }
      return {
        id: `${line.entryNumber}-${index}`,
        date: line.entryDate,
        description: line.memo || line.description,
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
        openingBalance={openingBalance}
        transactions={transactions}
        totalCredit={totalCredit}
        totalDebit={totalDebit}
        closingBalance={runningBalance}
      />
    </div>
  );
}
