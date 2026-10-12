# Recovery money workflow

The Recovery desk supports two explicit directions:

- **Receive Payment:** debit the selected cash/bank/wallet account and credit the selected party ledger account.
- **Pay Money:** debit the selected party payable/expense/advance account and credit the selected cash/bank/wallet account.

Every submission creates one `recovery_money_movements` audit row, one `finance_transactions` cash-book row, one balanced journal entry, and source links joining them. The form also records purpose, bill reference, optional beneficiary details, backdate reason, and optional receipt/screenshot proof.

In customer statements, **Debit** means the party took goods or money from us, **Credit** means the party paid us, and **Balance** is recalculated after every row. A positive balance is receivable (`Lena`); a negative balance is payable (`Dena`).

Outgoing payments are restricted to Owner, Super Admin, Admin, and Finance roles. Direct table writes are not granted to authenticated users; posting goes through the validated database function.
