"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { emailMachineryBookingSlip, type ActionState } from "@/actions/machinery-rental";
import { Printer, MessageCircle, Mail, ArrowLeft, X } from "lucide-react";

const initialState: ActionState = {};

interface Slip {
  id: string;
  bookingNumber: string;
  bookingDate: string;
  farmerName: string;
  farmerCode: string | null;
  farmerPhone: string | null;
  vendorName: string;
  machineLabel: string;
  quantityLabel: string;
  rateAmount: number;
  totalAmount: number;
  amountReceived: number;
  locationAddress: string | null;
}

export function MachinerySlipClient({ slip }: { slip: Slip }) {
  const [showEmail, setShowEmail] = useState(false);
  const shareText = `Al Rana Traders - Machinery Booking Slip ${slip.bookingNumber}\n${slip.farmerName}\n${slip.vendorName} - ${slip.machineLabel}\nTotal: Rs ${slip.totalAmount.toLocaleString()}\nReceived: Rs ${slip.amountReceived.toLocaleString()}\n\nDekhein: ${typeof window !== "undefined" ? window.location.href : ""}`;

  function handlePrint() {
    window.print();
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }

  const remaining = slip.totalAmount - slip.amountReceived;

  return (
    <div className="mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/machinery-rental" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Wapas
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> Print/Download
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
          <button onClick={() => setShowEmail(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card print:border-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b border-surface-200 pb-4">
          <div>
            <h1 className="font-display text-xl font-bold text-surface-900">Al Rana Traders</h1>
            <p className="text-sm text-surface-500">AgriBridge - Machinery Booking Slip</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-surface-700">{slip.bookingNumber}</p>
            <p className="text-xs text-surface-400">{new Date(slip.bookingDate).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Farmer</p>
          <p className="font-display text-lg font-semibold text-surface-900">{slip.farmerName}</p>
          {slip.farmerCode && <p className="text-xs text-surface-500">Code: {slip.farmerCode}</p>}
          {slip.farmerPhone && <p className="text-xs text-surface-500">Phone: {slip.farmerPhone}</p>}
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Vendor / Machine</p>
          <p className="text-base font-semibold text-surface-800">{slip.vendorName} - {slip.machineLabel}</p>
          {slip.locationAddress && <p className="text-xs text-surface-500">Location: {slip.locationAddress}</p>}
        </div>

        <div className="rounded-lg border border-green-100 bg-green-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-500">{slip.quantityLabel}</span>
            <span className="text-surface-500">Rate: Rs {slip.rateAmount.toLocaleString()}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-500">Total Amount</p>
              <p className="font-display text-2xl font-bold text-green-700">Rs {slip.totalAmount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-500">Received So Far</p>
              <p className="text-base font-semibold text-surface-800">Rs {slip.amountReceived.toLocaleString()}</p>
            </div>
          </div>
          {remaining > 0 && (
            <div className="mt-2 border-t border-green-200 pt-2 text-right text-sm font-semibold text-amber-600">
              Baaqi: Rs {remaining.toLocaleString()}
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-surface-100 pt-3">
          <p className="text-center text-[10px] text-surface-300">This is a computer-generated booking slip from the AgriBridge system.</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-surface-400">Software by ZR Technologies</p>
            <p className="text-xs text-surface-400">0312-6513294</p>
          </div>
        </div>
      </div>

      {showEmail && <EmailModal bookingId={slip.id} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function EmailModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(emailMachineryBookingSlip, initialState);
  if (state.success) setTimeout(onClose, 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Email Se Bhejein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Professional PDF slip seedha attachment ki tarah email mein chali jayegi.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Email bhej di gayi.</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="email" name="to_email" required placeholder="Email address" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
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