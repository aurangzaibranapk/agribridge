type Row = { transaction_type: string; transaction_date: string; amount: number };
/** Rows must be newest first. Walk all rows before filtering to retain historical balances. */
export function financeStatement<T extends Row>(rows: T[], currentBalance: number, from: string, to: string) {
  let balance = currentBalance;
  let closing = currentBalance;
  let credit = 0;
  let debit = 0;
  const selected = [] as (T & { balanceAfter: number; isCredit: boolean })[];
  for (const row of rows) {
    const isCredit = row.transaction_type === "income" || row.transaction_type === "transfer_in";
    const amount = Number(row.amount);
    const balanceAfter = balance;
    balance += isCredit ? -amount : amount;
    if (to && row.transaction_date > to) closing = balance;
    if ((!from || row.transaction_date >= from) && (!to || row.transaction_date <= to) && !(from && to && from > to)) {
      selected.push({ ...row, balanceAfter, isCredit });
      if (isCredit) credit += amount; else debit += amount;
    }
  }
  return { rows: selected, credit, debit, closing, opening: closing - credit + debit };
}
