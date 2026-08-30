"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Tractor, Wallet, Clock, CheckCircle2, MapPin, Phone, Fuel, HandCoins, Calendar } from "lucide-react";
import {
  submitVendorWork,
  submitVendorFuel,
  submitVendorCollection,
  type VendorActionState,
} from "@/actions/vendor-portal";

const initialState: VendorActionState = {};

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  bookingDate: string;
  farmerName: string;
  farmerPhone: string | null;
  harvestDate: string | null;
  harvestTime: string | null;
  cropType: string | null;
  bookedArea: number | null;
  finalRate: number | null;
  rateFinal: boolean;
  locationAddress: string | null;
  village: string | null;
  lat: number | null;
  lng: number | null;
  machineLabel: string | null;
  fuelClaimed: number;
  fuelRejected: Array<{ id: string; rejection_reason: string | null }>;
  collections: Array<{ id: string; amount: number; date: string; settlement: string | null; status: string; reason: string | null }>;
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
  const [open, setOpen] = useState<null | "work" | "fuel" | "cash">(null);
  const status = STATUS[booking.status] ?? { label: booking.status, color: "bg-surface-100 text-surface-600" };
  const canSubmitWork = ["ready_for_harvest", "in_progress"].includes(booking.status) && !booking.workDone;

  // Diesel aur kisan se li hui raqam booking ke poore arse mein darj
  // ho sakti hain -- diesel kai dafa parta hai, aur kisan kabhi kabhi
  // kaam ke hafton baad paisa deta hai. Sirf band aur cancel booking
  // par darwaza band.
  const live = !["closed", "cancelled"].includes(booking.status);

  const mapLink =
    booking.lat !== null && booking.lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${booking.lat},${booking.lng}`
      : null;

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

      {/* Kaam se pehle ki tafseel.
          Ye sab WhatsApp par ek dafa jata hai -- ek dafa. Do din baad
          wo paighaam bees paighaamon ke neeche dab chuka hota hai, aur
          phir vendor phone karta hai aur hamara banda wohi baat dobara
          batata hai. Yahan wo hamesha maujood rehti hai. */}
      <div className="mt-3 space-y-1.5 rounded-lg border border-surface-100 bg-surface-50 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-surface-700">
          {booking.harvestDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-surface-400" />
              {new Date(booking.harvestDate).toLocaleDateString()}
              {booking.harvestTime ? ` — ${booking.harvestTime}` : ""}
            </span>
          )}
          {booking.bookedArea !== null && (
            <span>
              {booking.bookedArea} acre{booking.cropType ? ` — ${booking.cropType}` : ""}
            </span>
          )}
          {booking.machineLabel && <span className="text-surface-500">{booking.machineLabel}</span>}
        </div>

        {/* Rate. Vendor ko ye pehle se maloom hona chahiye -- khet par
            pahunch kar rate poochhna wo jagah hai jahan se jhagRe
            shuru hote hain. */}
        {booking.finalRate !== null && booking.rateFinal && (
          <p className="font-medium text-surface-800">Rate: Rs {booking.finalRate.toLocaleString()} per acre (final)</p>
        )}

        {(booking.locationAddress || booking.village) && (
          <p className="text-surface-600">{[booking.locationAddress, booking.village].filter(Boolean).join(", ")}</p>
        )}

        <div className="flex flex-wrap gap-3 pt-0.5">
          {mapLink && (
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" /> Khet ka naqsha
            </a>
          )}
          {booking.farmerPhone && (
            <a
              href={`tel:${booking.farmerPhone}`}
              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {booking.farmerPhone}
            </a>
          )}
        </div>
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

      {booking.fuelClaimed > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Diesel ka {booking.fuelClaimed} indraj tasdeeq ke intezar mein hai.
        </p>
      )}

      {booking.fuelRejected.map((r) => (
        <p key={r.id} className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
          Diesel ka ek indraj rad hua: {r.rejection_reason ?? "wajah nahi likhi"}
        </p>
      ))}

      {/* Kisan se li hui raqam -- apna bheja hua indraj saamne rehna
          chahiye, warna vendor samajhta hai ke gaya hi nahi aur dobara
          bhejta hai. */}
      {booking.collections.map((c) => (
        <p
          key={c.id}
          className={`mt-2 rounded-lg px-2 py-1 text-xs ${
            c.status === "verified"
              ? "bg-brand-50 text-brand-800"
              : c.status === "rejected"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          Kisan se Rs {c.amount.toLocaleString()} ({new Date(c.date).toLocaleDateString()}) —{" "}
          {c.settlement === "kept" ? "aap ne rakhe" : "hamein de rahe hain"} —{" "}
          {c.status === "verified"
            ? "tasdeeq ho gayi"
            : c.status === "rejected"
              ? `rad: ${c.reason ?? "wajah nahi likhi"}`
              : "tasdeeq baqi"}
        </p>
      ))}

      {live && (
        <div className="mt-3">
          {open === null ? (
            <div className="flex flex-wrap gap-2">
              {canSubmitWork && (
                <button
                  onClick={() => setOpen("work")}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Kattai ki tafseel bhejein
                </button>
              )}
              <button
                onClick={() => setOpen("fuel")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700"
              >
                <Fuel className="h-4 w-4" /> Diesel darj karein
              </button>
              <button
                onClick={() => setOpen("cash")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700"
              >
                <HandCoins className="h-4 w-4" /> Kisan ne paisa diya
              </button>
            </div>
          ) : open === "work" ? (
            <WorkForm bookingId={booking.id} onClose={() => setOpen(null)} />
          ) : open === "fuel" ? (
            <FuelForm bookingId={booking.id} onClose={() => setOpen(null)} />
          ) : (
            <CollectionForm bookingId={booking.id} onClose={() => setOpen(null)} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Diesel ka indraj.
 *
 * "Kis ne dala" sab se ahem sawal hai aur sab se aasani se bhoola
 * jata hai. Kisan ne apne paise se dala ho aur hum us ka kharcha
 * likh lein, to wo raqam do dafa gin li jati hai -- ek dafa diesel
 * ke kharche mein aur ek dafa bill mein.
 */
function FuelForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [state, action] = useFormState(submitVendorFuel, initialState);

  if (state.success) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.notice}</p>;
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-surface-200 p-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state.error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Tareekh">
          <input type="date" name="log_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </Field>
        <Field label="Kitne litre">
          <input type="number" step="0.1" name="litres" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </Field>
      </div>

      <Field label="Kitne ka (Rs) *">
        <input type="number" step="0.01" name="amount" required className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </Field>

      <Field label="Kis ne dala? *">
        <select name="paid_by" required defaultValue="" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">—</option>
          <option value="farmer">Kisan ne</option>
          <option value="vendor">Main ne (vendor)</option>
          <option value="company">Al Rana Traders ne</option>
        </select>
      </Field>

      <Field label="Koi baat (marzi se)">
        <input name="notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </Field>

      <p className="text-xs text-surface-500">
        Tasdeeq ke baad hi ye hisaab mein aayega. Diesel jitni dafa dala jaye, utni dafa darj karein.
      </p>

      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500">
          Rehne dein
        </button>
      </div>
    </form>
  );
}

/**
 * Kisan ne mujhe paisa diya.
 *
 * Doosra sawal us pehle jitna hi ahem hai: wo paisa aap ne apne hisse
 * mein rakh liya, ya hamein de rahe hain? Hisaab mein ye do bilkul
 * alag baatein hain, aur baad mein poochho to kisi ko theek yaad
 * nahi rehta.
 */
function CollectionForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [state, action] = useFormState(submitVendorCollection, initialState);

  if (state.success) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.notice}</p>;
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-surface-200 p-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state.error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Kitna diya (Rs) *">
          <input type="number" step="0.01" name="amount" required className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </Field>
        <Field label="Kab diya">
          <input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </Field>
      </div>

      <Field label="Us paise ka kya kiya? *">
        <select name="settlement" required defaultValue="" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">—</option>
          <option value="kept">Apne hisse mein rakh liya</option>
          <option value="handed_over">Al Rana Traders ko de raha hoon</option>
        </select>
      </Field>

      <Field label="Koi nishani (marzi se)">
        <input name="reference" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </Field>

      <p className="text-xs text-surface-500">
        Ye abhi sirf aap ki baat hai — tasdeeq ke baad hi kisan ka baqi kam hoga.
      </p>

      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500">
          Rehne dein
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-600">{label}</label>
      <div className="mt-1">{children}</div>
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
