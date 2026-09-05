"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createFinanceAccount,
  recordFinanceTransaction,
  setOpeningBalance,
  transferBetweenAccounts,
  type ActionState,
} from "@/actions/finance";
import { BankLogo, getBankLogo } from "@/lib/bank-logos";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { Wallet, ArrowUpCircle, ArrowLeftRight, Plus } from "lucide-react";

interface Account {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
  /** Is khate ka shuruati balance darj ho chuka hai ya nahi. */
  shuruatiDarj?: boolean;
  bank_name?: string | null;
  account_title?: string | null;
  account_number?: string | null;
}

interface Transaction {
  id: string;
  account_id: string;
  transaction_type: string;
  category: string | null;
  amount: number;
  transaction_date: string;
  notes: string | null;
}

const initialState: ActionState = {};

/** Bank ka logo, ya jis account ka logo na ho (jaise Cash in Hand) us par wallet icon. */
function AccountIcon({ name, size = 16 }: { name: string; size?: number }) {
  if (getBankLogo(name)) return <BankLogo name={name} size={size} />;
  return <Wallet style={{ height: size, width: size }} className="shrink-0" />;
}

export function FinanceClient({ accounts, transactions }: { accounts: Account[]; transactions: Transaction[] }) {
  const lang = useLang();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [showNewAccount, setShowNewAccount] = useState(false);

  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + a.current_balance, 0), [accounts]);

  // Jin khaton ka shuru maloom hi nahi. In ka adad "balance" nahi hota.
  const binaShuruat = accounts.filter((a) => !a.shuruatiDarj);

  const filteredTxns = useMemo(() => {
    if (!selectedAccountId) return transactions;
    return transactions.filter((row) => row.account_id === selectedAccountId);
  }, [transactions, selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  let runningBalance = selectedAccount?.current_balance ?? 0;
  const rowsWithBalance = filteredTxns.map((row) => {
    const balanceAtThisRow = runningBalance;
    const isCredit = row.transaction_type === "income" || row.transaction_type === "transfer_in";
    runningBalance = isCredit ? runningBalance - row.amount : runningBalance + row.amount;
    return { ...row, balanceAfter: balanceAtThisRow, isCredit };
  });

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("fn_total_balance", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
            Rs {totalBalance.toLocaleString()}
          </p>
          {/* Manfi balance ki wajah adad mein nahi hoti, wo us baat mein
              hoti hai jo system ko batai hi nahi gayi. Malik ne 5
              September ko poocha "ye minus kahan se aaya" -- jawab yahi
              tha: khate sifar par bane the, aur paisa un mein se nikla.
              Ab wo sawal safhe par khara nahi rehta. */}
          {binaShuruat.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              {binaShuruat.map((a) => a.name).join(", ")} ka shuruati balance darj nahi. Ye adad us khate ka asal
              balance nahi — sirf us ke baad ki aamad-o-raft hai. Isi liye manfi nazar aata hai.
            </p>
          )}
        </Card>
        {/* Pehle yahan sirf DO khate aate the (`slice(0, 2)`) -- baqi
            safhe par kahin nazar hi nahi aate the. Malik ka sawal
            (5 September): "is se pata chalta hai ke kis kis account
            mein kitna balance hai" -- to sab dikhne chahiyein, aur har
            ek ke sath us ki pehchaan bhi. */}
        {accounts.map((a) => (
          <Card key={a.id} className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <div className="flex items-center gap-2 text-surface-500">
              <AccountIcon name={a.name} size={18} />
              <span className="text-xs font-medium uppercase tracking-wide">{a.name}</span>
            </div>
            <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
              Rs {a.current_balance.toLocaleString()}
            </p>
            {/* Jo tafseel darj hai wohi dikhti hai. Jo nahi darj, us ki
                jagah kuch bana kar nahi likha jata. */}
            {(a.bank_name || a.account_title || a.account_number) && (
              <p className="mt-1 text-[11px] leading-relaxed text-surface-500">
                {[a.bank_name, a.account_title, a.account_number].filter(Boolean).join(" · ")}
              </p>
            )}
            {!a.shuruatiDarj && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">shuruati balance darj nahi</p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {accounts.map((a) => {
                const isActive = a.id === selectedAccountId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAccountId(a.id)}
                    aria-pressed={isActive}
                    className={
                      isActive
                        ? "flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-2 py-1.5 text-xs font-semibold text-brand-800 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                        : "flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-surface-800"
                    }
                  >
                    <AccountIcon name={a.name} />
                    {a.name}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowNewAccount(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" /> {t("fn_new_account", lang)}
            </button>
          </div>

          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("fn_date", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("fn_description", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("fn_credit", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("fn_debit", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("fn_balance", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithBalance.map((row) => (
                  <tr key={row.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-500">{row.transaction_date}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">
                      {row.category ?? row.transaction_type} {row.notes && `- ${row.notes}`}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600">
                      {row.isCredit ? `Rs ${row.amount.toLocaleString()}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600">
                      {!row.isCredit ? `Rs ${row.amount.toLocaleString()}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-surface-900 dark:text-white">
                      Rs {row.balanceAfter.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rowsWithBalance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-surface-400">
                      {t("fn_no_txns", lang)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {/* Jo khate abhi tak apna shuru nahi bata sake, un ke liye --
              aur sirf un ke liye. Sab theek ho to ye form safhe par
              hota hi nahi. */}
          {binaShuruat.length > 0 && <OpeningBalanceForm accounts={binaShuruat} />}
          <TransactionForm accounts={accounts} />
          <TransferForm accounts={accounts} />
        </div>
      </div>

      {showNewAccount && <NewAccountModal onClose={() => setShowNewAccount(false)} />}
    </div>
  );
}

/**
 * Khate ka shuruati balance.
 *
 * Malik ka sawal (5 September): *"ye jo minus balance aa raha hai ye
 * kahan se aaya hai? Ise bhi set karein."*
 *
 * Charon khate sifar par bane the. Phir un mein se diesel ka paisa
 * nikla -- aur sifar mein se paisa nikle to adad manfi ho jata hai.
 * System ne kuch ghalat nahi kiya; use ye baat batai hi nahi gayi thi
 * ke un khaton mein pehle se kitna para tha.
 *
 * Ye ek dafa ka kaam hai. Raqam Cash Book mein bhi jati hai aur ledger
 * mein bhi ("Malik ka sarmaya" 3200 ke saamne) -- taake Trial Balance
 * usi lamhe barabar rahe.
 */
function OpeningBalanceForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useFormState(setOpeningBalance, initialState);

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50 p-4 shadow-card dark:border-amber-900/40 dark:bg-amber-950/20">
      <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-amber-900 dark:text-amber-200">
        <Wallet className="h-4 w-4" /> Shuruati balance darj karein
      </h3>
      <p className="mb-3 text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/80">
        Jis din se AgriBridge par hisaab shuru hua, us din is khate mein waqai kitna paisa para tha? Ye ek dafa
        likhna parta hai. Is ke baghair khate ka adad manfi rehta hai — paisa nikalta hai, magar system ke hisaab
        se khata khali tha.
      </p>
      {state.error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          Darj ho gaya — Cash Book aur ledger dono mein.
        </p>
      )}
      <form action={formAction} className="space-y-2">
        <Select name="account_id" required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Input type="number" step="0.01" min="0.01" name="amount" placeholder="Us din kitna paisa para tha" required />
        <div>
          <Label htmlFor="ob_as_of">Kis din tak</Label>
          <Input type="date" id="ob_as_of" name="as_of_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <OpeningSubmit />
      </form>
    </div>
  );
}

function OpeningSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "..." : "Shuruati balance darj karein"}
    </Button>
  );
}

function TransactionForm({ accounts }: { accounts: Account[] }) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordFinanceTransaction, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white">
        <ArrowUpCircle className="h-4 w-4 text-green-600" /> {t("fn_add_income_expense", lang)}
      </h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("fn_recorded", lang)}</p>}
      <form action={formAction} className="space-y-2">
        <Select name="account_id" required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select name="transaction_type" defaultValue="expense">
          <option value="income">{t("fn_income_credit", lang)}</option>
          <option value="expense">{t("fn_expense_debit", lang)}</option>
        </Select>
        <Input name="category" placeholder={t("fn_category_eg", lang)} />
        <Input type="number" step="0.01" name="amount" placeholder={t("fn_amount", lang)} required />
        <Input type="date" name="transaction_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <Textarea name="notes" rows={2} placeholder={t("fn_notes_optional", lang)} />
        <TxnSubmitButton />
      </form>
    </div>
  );
}

function TransferForm({ accounts }: { accounts: Account[] }) {
  const lang = useLang();
  const [state, formAction] = useFormState(transferBetweenAccounts, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white">
        <ArrowLeftRight className="h-4 w-4 text-blue-600" /> {t("fn_transfer_title", lang)}
      </h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("fn_transferred", lang)}</p>}
      <form action={formAction} className="space-y-2">
        <Select name="from_account_id" required>
          <option value="">{t("fn_from_account", lang)}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select name="to_account_id" required>
          <option value="">{t("fn_to_account", lang)}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Input type="number" step="0.01" name="amount" placeholder={t("fn_amount", lang)} required />
        <Input type="date" name="transaction_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <Textarea name="notes" rows={2} placeholder={t("fn_notes_optional", lang)} />
        <TransferSubmitButton />
      </form>
    </div>
  );
}

function NewAccountModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(createFinanceAccount, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("fn_new_account", lang)}</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {/* Sirf naam se kaam nahi chalta (malik, 5 September): ek hi
            bank mein do khate hon to "UBL" likha dekh kar koi nahi bata
            sakta ke ye kaun sa hai, aur bank ki statement se milan sirf
            title aur number se hota hai. Ye teen khane khali reh sakte
            hain -- cash box ka koi bank nahi hota. */}
        <form action={formAction} className="space-y-3">
          <Input name="name" placeholder={t("fn_account_name_eg", lang)} required />
          <Select name="account_type" defaultValue="cash">
            <option value="cash">{t("fn_cash", lang)}</option>
            <option value="bank">{t("fn_bank", lang)}</option>
            <option value="mobile_wallet">{t("fn_mobile_wallet", lang)}</option>
            <option value="other">{t("fn_other", lang)}</option>
          </Select>
          <Input name="bank_name" placeholder="Bank ka naam (UBL, Alfalah… — cash box par khali)" />
          <Input name="account_title" placeholder="Account title — khata kis ke naam par hai" />
          <Input name="account_number" placeholder="Account number" />
          <div>
            <Label htmlFor="na_opening">Shuruati balance</Label>
            <Input type="number" step="0.01" id="na_opening" name="opening_balance" placeholder={t("fn_opening_balance", lang)} />
            {/* Ye raqam ab Cash Book aur ledger DONO mein jati hai. Pehle
                wo sirf ek khane mein baithti thi aur Trial Balance ko
                us ki khabar hi nahi hoti thi. */}
            <p className="mt-1 text-[11px] text-surface-500">
              Is khate mein aaj waqai kitna paisa para hai. Cash Book aur ledger dono mein jayega.
            </p>
          </div>
          <Input type="date" name="as_of_date" defaultValue={new Date().toISOString().slice(0, 10)} />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">
              {t("fn_cancel", lang)}
            </button>
            <AccountSubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}

function TxnSubmitButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <Button type="submit" data-guide="finance-add-txn" disabled={pending} className="w-full">{pending ? t("fn_saving", lang) : t("fn_add_txn", lang)}</Button>;
}
function TransferSubmitButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? t("fn_transferring", lang) : t("fn_transfer", lang)}</Button>;
}
function AccountSubmitButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="flex-1">{pending ? t("fn_creating", lang) : t("fn_create", lang)}</Button>;
}