"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Tractor, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { submitVendorWork, type VendorActionState } from "@/actions/vendor-portal";

const initialState: VendorActionState = {};

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  bookingDate: string;
  farmerName: string;
  billNumber: string | null;
  area: number | null;
  rate: number | null;
  gross: number | null;
  commissionPct: number | null;
  commission: number | null;
  payable: number | null;
  paid: number;
  outstanding: number;
  claimed: number;
  rejected: Array<{ id: string; rejection_reason: string | null }>;
  verifiedArea: number;
  workDone: boolean;
}

// Vendor ke liye halat us ki apni zabaan mein. Andar ke naam
// (bill_pending waghera) hamare nizam ke liye hain, us ke liye nahi.
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "Rate tay ho raha hai", color: "bg-surface-100 text-surface-600" },
  ready_for_harvest: { label: "Machine bhejni hai", color: "bg-blue-50 text-blue-700" },
  in_progress: { label: "Kaam chal raha hai", color: "bg-purple-50 text-purple-700" },
  bill_pending: { label: "Bill ban raha hai", color: "bg-amber-50 text-amber-700" },
  payment_pending: { label: "Kisan se paisa aana hai", color: "bg-amber-50 text-amber-700" },
  closed: { label: "Hisaab poora", color: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancel", color: "bg-red-50 text-red-700" },
};

export function VendorDashboardClient({
  vendorName,
  totalOutstanding,
  totalEarned,
  awaitingCheck,
  bookings,
}: {
  vendorName: string;
  totalOutstanding: number;
  totalEarned: number;
  awaitingCheck: number;
  bookings: Booking[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Tractor className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-surface-900">{vendorName}</h1>
          <p className="text-sm text-surface-500">Machinery Vendor Portal</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat icon={<Wallet className="h-5 w-5 text-green-600" />} value={`Rs ${totalOutstanding.toLocaleString()}`} label="Aap ka baqi" />
        <Stat icon={<CheckCircle2 className="h-5 w-5 text-brand-600" />} value={`Rs ${totalEarned.toLocaleString()}`} label="Kul bana" />
        <Stat icon={<Clock className="h-5 w-5 text-amber-500" />} value={String(awaitingCheck)} label="Tasdeeq ke intezar mein" />
      </div>

      <div className="space-y-3">
        {bookings.map((b) => (
          <BookingCard key={b.id} booking={b} />
        ))}
        {bookings.length === 0 && (
          <p className="rounded-card border border-surface-200 bg-white px-3 py-8 text-center text-surface-400">
            Abhi koi booking nahi.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card">
      {icon}
      <p className="mt-1 font-display text-lg font-bold text-surface-900">{value}</p>
      <p className="text-xs text-surface-500">{label}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[booking.status] ?? { label: booking.status, color: "bg-surface-100 text-surface-600" };
  const canSubmitWork = ["ready_for_harvest", "in_progress"].includes(booking.status) && !booking.workDone;

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-surface-400">{booking.bookingNumber}</p>
          <p className="font-medium text-surface-900">{booking.farmerName}</p>
          <p className="text-xs text-surface-500">{new Date(booking.bookingDate).toLocaleDateString()}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>{status.label}</span>
      </div>

      {/* Paisa: kitna bana, commission kitna kata, kitna mila, kitna
          baqi. Commission chhupana ghalat hoga -- wo un ke apne bill ka
          hissa hai aur wo waise bhi poochhte hain. */}
      {booking.gross !== null && (
        <div className="mt-3 space-y-0.5 border-t border-surface-100 pt-2 text-sm">
          <Row label={`Kaam: ${booking.area} acre × Rs ${(booking.rate ?? 0).toLocaleString()}`} value={booking.gross} />
          <Row label={`AgriBridge commission (${booking.commissionPct}%)`} value={-(booking.commission ?? 0)} />
          <div className="flex justify-between border-t border-surface-100 pt-1 font-medium">
            <span>Aap ka hissa</span>
            <span>Rs {(booking.payable ?? 0).toLocaleString()}</span>
          </div>
          {booking.paid > 0 && <Row label="Mil chuka" value={-booking.paid} />}
          <div className="flex justify-between font-display font-semibold">
            <span>Baqi</span>
            <span className={booking.outstanding > 0 ? "text-amber-700" : "text-brand-700"}>
              Rs {booking.outstanding.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {booking.claimed > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Aap ka bheja hua kaam AgriBridge ki tasdeeq ke intezar mein hai. Tasdeeq ke baad hi wo bill ka hissa banega.
        </p>
      )}

      {booking.rejected.map((r) => (
        <p key={r.id} className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
          Ek indraj rad hua: {r.rejection_reason ?? "wajah nahi likhi"}
        </p>
      ))}

      {canSubmitWork && (
        <div className="mt-3">
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Kattai ki tafseel bhejein
            </button>
          ) : (
            <WorkForm bookingId={booking.id} onClose={() => setOpen(false)} />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-surface-600">
      <span>{label}</span>
      <span>{value < 0 ? `- Rs ${Math.abs(value).toLocaleString()}` : `Rs ${value.toLocaleString()}`}</span>
    </div>
  );
}

function WorkForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [state, action] = useFormState(submitVendorWork, initialState);

  if (state.success) {
    return (
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{state.notice}</p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-surface-200 p-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-xs text-surface-500">
        Jo WAQAI kaata gaya wohi likhein. AgriBridge ki team ise dekh kar tasdeeq karegi — tasdeeq ke baad hi ye bill
        mein aayega.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-surface-600">Kaam ki tareekh</label>
          <input
            type="date"
            name="work_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Meter / ghante</label>
          <input type="number" step="0.01" name="meter_reading" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Kitne acre</label>
          <input type="number" step="0.01" name="actual_area_acres" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Kanal</label>
          <input type="number" step="0.01" name="actual_area_kanal" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-surface-600">Kuch aur batana ho</label>
        <input name="notes" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </div>
      <label className="flex items-start gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 p-3 text-sm">
        <input type="checkbox" name="is_final" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium text-surface-900">Kaam poora ho gaya</span>
          <span className="block text-xs text-surface-500">
            Sirf aakhri din nishaan lagayein. Kaam kai din chale to har din ka alag indraj bhejein.
          </span>
        </span>
      </label>
      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500">
          Rehne dein
        </button>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Bhej raha hai..." : "Bhejein"}
    </button>
  );
}
