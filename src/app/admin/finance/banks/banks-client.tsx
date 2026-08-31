"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { deleteBankAccount, type ActionState } from "@/actions/bank-management";
import AddBankModal from "./add-bank-modal";
import EditBankModal from "./edit-bank-modal";
import { Plus, Edit, Trash2, Landmark } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Bank {
  id: string;
  name: string;
  account_number: string | null;
  logo_url: string | null;
  opening_balance: number;
  current_balance: number;
}

export function BanksClient({ banks }: { banks: Bank[] }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const lang = useLang();
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Bank
        </button>
      </div>

      {banks.length === 0 ? (
        <div className="rounded-card border border-dashed border-surface-200 bg-white p-10 text-center dark:border-surface-800 dark:bg-surface-900">
          <p className="mb-3 text-surface-400">{t("fb_none_yet", lang)}</p>
          <button onClick={() => setShowAddModal(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">{t("fb_add_first", lang)}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank) => (
            <div key={bank.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card transition hover:shadow-md dark:border-surface-800 dark:bg-surface-900">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {bank.logo_url ? (
                    <img src={bank.logo_url} alt={bank.name} className="mb-2 h-10 object-contain" />
                  ) : (
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-400 dark:bg-surface-800">
                      <Landmark className="h-5 w-5" />
                    </div>
                  )}
                  <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{bank.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingBank(bank)} className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-50" title={t("c_edit", lang)}>
                    <Edit className="h-4 w-4" />
                  </button>
                  <DeleteButton bankId={bank.id} />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {bank.account_number && (
                  <div>
                    <p className="text-xs text-surface-400">{t("c_account_number", lang)}</p>
                    <p className="font-mono text-sm text-surface-700 dark:text-surface-300">{bank.account_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-surface-400">{t("c_current_balance", lang)}</p>
                  <p className="font-display text-lg font-bold text-green-600">Rs {bank.current_balance.toLocaleString()}</p>
                </div>
                <Link
                  href={`/admin/finance/banks/${bank.id}/statement`}
                  className="block w-full rounded-lg border border-surface-200 py-2 text-center text-sm font-medium text-surface-600 hover:bg-surface-50"
                >
                  View Statement
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <AddBankModal onClose={() => setShowAddModal(false)} />}
      {editingBank && <EditBankModal bank={editingBank} onClose={() => setEditingBank(null)} />}
    </div>
  );
}

function DeleteButton({ bankId }: { bankId: string }) {
  const lang = useLang();
  const [, formAction] = useFormState(deleteBankAccount, initialState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Kya aap is bank ko delete karna chahte hain?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="bank_id" value={bankId} />
      <button type="submit" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title={t("c_delete", lang)}>
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}