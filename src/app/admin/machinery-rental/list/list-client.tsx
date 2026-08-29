"use client";
import { useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { emailMachineryBookingsList, type ActionState } from "@/actions/machinery-rental";
import { Printer, Download, MessageCircle, Mail, ArrowLeft, X } from "lucide-react";

const initialState: ActionState = {};

interface Row {
  id: string;
  bookingNumber: string;
  bookingDate: string;
  farmerName: string;
  farmerPhone: string | null;
  machineLabel: string;
  totalAmount: number;
  amountReceived: number;
  status: string;
}

export function MachineryListClient({ rows }: { rows: Row[] }) {
  const lang = useLang();
  const [showEmail, setShowEmail] = useState(false);

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    window.open("/api/machinery/bookings-list-pdf", "_blank");
  }
  function handleWhatsApp() {
    const lines = rows
      .slice(0, 30)
      .map((r) => `${r.farmerName} - ${r.machineLabel} - Rs ${r.totalAmount.toLocaleString()} (${r.status})`)
      .join("\n");
    const text = `Al Rana Traders - Machinery Bookings List\nTotal: ${rows.length}\n\n${lines}${rows.length > 30 ? "\n...aur zyada" : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/machinery-rental" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> {t("mc_back", lang)}
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> {t("mc_print", lang)}
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200">
            <Download className="h-3.5 w-3.5" /> {t("mc_download", lang)}
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
        <div className="mb-4 border-b border-surface-200 pb-3">
          <h1 className="font-display text-lg font-bold text-surface-900">Al Rana Traders - Machinery Bookings List</h1>
          <p className="text-xs text-surface-400">Total Bookings: {rows.length}</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-200 text-left">
              <th className="py-1.5 pr-2 font-medium text-surface-500">{t("mc_booking_no", lang)}</th>
              <th className="py-1.5 pr-2 font-medium text-surface-500">{t("mc_date", lang)}</th>
              <th className="py-1.5 pr-2 font-medium text-surface-500">{t("mc_farmer", lang)}</th>
              <th className="py-1.5 pr-2 font-medium text-surface-500">{t("mc_phone", lang)}</th>
              <th className="py-1.5 pr-2 font-medium text-surface-500">{t("mc_machine", lang)}</th>
              <th className="py-1.5 pr-2 text-right font-medium text-surface-500">{t("mc_total_amount", lang)}</th>
              <th className="py-1.5 pr-2 text-right font-medium text-surface-500">{t("mc_received_so_far", lang)}</th>
              <th className="py-1.5 font-medium text-surface-500">{t("mc_status", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-surface-100">
                <td className="py-1.5 pr-2 font-mono text-surface-500">{r.bookingNumber}</td>
                <td className="py-1.5 pr-2 text-surface-600">{new Date(r.bookingDate).toLocaleDateString()}</td>
                <td className="py-1.5 pr-2 font-medium text-surface-800">{r.farmerName}</td>
                <td className="py-1.5 pr-2 text-surface-600">{r.farmerPhone ?? "-"}</td>
                <td className="py-1.5 pr-2 text-surface-600">{r.machineLabel}</td>
                <td className="py-1.5 pr-2 text-right text-surface-800">Rs {r.totalAmount.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-right text-surface-600">Rs {r.amountReceived.toLocaleString()}</td>
                <td className="py-1.5 capitalize text-surface-600">{r.status.replace(/_/g, " ")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-surface-400">{t("mc_no_bookings", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showEmail && <EmailModal onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function EmailModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(emailMachineryBookingsList, initialState);
  if (state.success) setTimeout(onClose, 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("mc_send_by_email", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("mc_email_sent", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <input type="email" name="to_email" required placeholder={t("mc_email_address", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
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