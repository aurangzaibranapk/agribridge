"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { emailWalletStatement, type ActionState } from "@/actions/wallet-statement";
import { Printer, Download, MessageCircle, Mail, ArrowLeft, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Transaction {
  id: string;
  typeLabel: string;
  direction: string;
  amount: number;
  notes: string | null;
  date: string;
  balanceAfter: number;
}

interface FarmerInfo {
  id: string;
  name: string;
  code: string;
  phone: string | null;
}

export function WalletStatementClient({
  farmer,
  currentBalance,
  transactions,
}: {
  farmer: FarmerInfo;
  currentBalance: number;
  transactions: Transaction[];
}) {
  const [showEmail, setShowEmail] = useState(false);
  const lang = useLang();

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    window.open(`/api/wallets/${farmer.id}/statement-pdf`, "_blank");
  }
  function handleWhatsApp() {
    const lines = transactions
      .slice(-15)
      .map((t) => `${new Date(t.date).toLocaleDateString()} - ${t.typeLabel}: ${t.direction === "credit" ? "+" : "-"}Rs ${t.amount.toLocaleString()}`)
      .join("\n");
    const text = `Al Rana Traders - Wallet Statement\n${farmer.name} (${farmer.code})\nCurrent Balance: Rs ${currentBalance.toLocaleString()}\n\n${lines}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/wallets" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Wapas
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
          <button onClick={() => setShowEmail(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-6 shadow-card print:border-0 print:shadow-none">
        <div className="mb-4 flex items-center justify-between border-b border-surface-200 pb-3">
          <div>
            <h1 className="font-display text-lg font-bold text-surface-900">Al Rana Traders — {t("st_wallet_statement", lang)}</h1>
            <p className="text-sm text-surface-500">{farmer.name} ({farmer.code}){farmer.phone ? ` - ${farmer.phone}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-surface-400">{t("c_current_balance", lang)}</p>
            <p className={`font-display text-xl font-bold ${currentBalance >= 0 ? "text-green-700" : "text-red-600"}`}>Rs {currentBalance.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-200 text-left">
              <th className="py-1.5 pr-2 font-medium text-surface-500">{t("c_date", lang)}</th>
              <th className="py-1.5 pr-2 font-medium text-surface-500">{t("c_detail", lang)}</th>
              <th className="py-1.5 pr-2 text-right font-medium text-surface-500">{t("c_amount", lang)}</th>
              <th className="py-1.5 text-right font-medium text-surface-500">{t("c_balance", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-surface-100">
                <td className="py-1.5 pr-2 text-surface-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="py-1.5 pr-2 text-surface-700">
                  {t.typeLabel}
                  {t.notes && <span className="block text-[10px] text-surface-400">{t.notes}</span>}
                </td>
                <td className={`py-1.5 pr-2 text-right font-medium ${t.direction === "credit" ? "text-green-600" : "text-red-600"}`}>
                  {t.direction === "credit" ? "+" : "-"}Rs {t.amount.toLocaleString()}
                </td>
                <td className="py-1.5 text-right font-semibold text-surface-800">Rs {t.balanceAfter.toLocaleString()}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-surface-400">{t("st_no_transaction", lang)}</td></tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 border-t border-surface-100 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-surface-400">Software by ZR Technologies</p>
            <p className="text-xs text-surface-400">0312-6513294</p>
          </div>
        </div>
      </div>

      {showEmail && <EmailModal farmerId={farmer.id} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function EmailModal({ farmerId, onClose }: { farmerId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(emailWalletStatement, initialState);
  if (state.success) setTimeout(onClose, 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("c_send_email", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("c_email_sent", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="farmer_id" value={farmerId} />
          <input type="email" name="to_email" required placeholder={t("c_email_address", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Bhejein"}</button>;
}