"use client";
import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { useFormState, useFormStatus } from "react-dom";
import {
  recordAdvance,
  sendRateConfirmation,
  recordFarmerConfirmation,
  recordPaymentPromise,
  recordFuelEntry,
  createFollowUpBooking,
  overrideConfirmation,
  dispatchMachine,
  rescheduleBooking,
  undoAdvanceDeclined,
  markDieselNone,
  undoDieselNone,
  clearPaymentPromise,
  recordWorkCompletion,
  generateFinalBill,
  cancelFinalBill,
  recordFinalPayment,
  cancelBooking,
  closeBookingIfSettled,
  type ActionState,
} from "@/actions/machinery-lifecycle";
import { recordVendorPayout } from "@/actions/machinery-lifecycle";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import { LocationPicker } from "@/components/ui/location-picker";
import { CropLiftStep, type CropLiftInfo } from "./crop-lift-step";
import { CancelFuelButton } from "./cancel-fuel-button";
import { Check, Circle, Plus, X, Undo2, CheckCircle2 } from "lucide-react";

import { PaymentForm, Err, Submit, initialState } from "@/components/machinery/payment-form";

/**
 * Zanjeer ka poora nazara -- ek Booking ID ke neeche.
 *
 * Qadam wahi dikhta hai jis ka waqt aa gaya ho. Sare form ek sath dikha
 * dena staff ko ulta lagta hai: wo bill wala khana pehle bhar deta hai
 * aur asal kaam baad mein -- aur phir wohi purana masla, ke bill andaze
 * par ban gaya.
 */

/**
 * Booking ka safar -- malik ke apne alfaz mein (14 September, B.3).
 *
 * DB ke status bilkul nahi badle. `fn_machinery_booking_guard` wohi
 * purane naam (`new`, `confirmed`, `ready_for_harvest`, `in_progress`,
 * `bill_pending`, `payment_pending`, `closed`) parhta hai aur waise hi
 * rokta hai. Yahan sirf wo naam likhe hain jo malik screen par dekhna
 * chahte hain -- ek lafz ka farq, database par koi asar nahi.
 *
 * Do jagah DB ka status akela sach nahi bata pata, is liye do qatarein
 * indraj se banti hain, status se nahi:
 *
 *   "Machine Dispatched" aur "Work Started" DONO `in_progress` hain.
 *   Farq ye hai ke koi kaam darj hua ya nahi -- machine nikal to gayi
 *   magar abhi kuch kaata nahi. Ye farq status mein hai hi nahi, aur
 *   isay status se poochhna ghalat jawab deta.
 *
 *   "Confirmed" do status par phaila hai (`confirmed` aur
 *   `ready_for_harvest`) -- staff ke liye ye ek hi baat hai.
 */
const CHAIN = [
  { key: "new", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Machine Dispatched" },
  { key: "work_started", label: "Work Started" },
  { key: "work_done", label: "Work Completed" },
  { key: "payment_pending", label: "Payment Pending" },
  { key: "closed", label: "Closed" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  confirmed: "Confirmed",
  scheduled: "Confirmed",
  machine_assigned: "Confirmed",
  ready_for_harvest: "Confirmed",
  // `in_progress` do matlab rakhta hai -- `statusLabel()` neeche wala
  // farq karta hai. Ye sirf us soorat ka jawab hai jab kuch kaam darj
  // na ho.
  in_progress: "Machine Dispatched",
  completed: "Work Completed",
  bill_pending: "Work Completed",
  payment_pending: "Payment Pending",
  closed: "Closed",
  cancelled: "Cancelled",
};

/**
 * Badge par kaunsa naam. `in_progress` par kaam darj ho chuka ho to wo
 * "Work Started" hai, warna sirf "Machine Dispatched".
 */
function statusLabel(status: string, workCount: number): string {
  if (status === "in_progress" && workCount > 0) return "Work Started";
  return STATUS_LABEL[status] ?? status;
}

interface Booking {
  id: string;
  booking_number: string;
  status: string;
  booking_date: string;
  crop_type: string | null;
  field_ready: string | null;
  harvest_ready: string | null;
  village: string | null;
  location_address: string | null;
  harvest_area: number;
  machine_type_requested: string | null;
  machine_label: string | null;
  estimated_rate: number | null;
  final_rate: number | null;
  rate_status: string;
  /** Kattai ki qism (176). Null = purani booking, jis par qism darj hi nahi hui. */
  harvest_type: string | null;
  sabit_area: number | null;
  kutra_area: number | null;
  sabit_rate: number | null;
  kutra_rate: number | null;
  expected_harvest_date: string | null;
  rate_confirmation_sent_at: string | null;
  farmer_confirmed_at: string | null;
  payment_promise_date: string | null;
  advance_declined_at: string | null;
  diesel_none_at: string | null;
  follow_up_number: string | null;
  payment_promise_note: string | null;
  will_sell_to_us: boolean | null;
  farmer_confirmation_response: string | null;
  farmer_confirmation_channel: string | null;
  confirmation_override_reason: string | null;
  cancellation_reason: string | null;
  farmer_name: string;
  farmer_code: string;
  farmer_phone: string;
  farmer_village: string;
}

const READY_LABEL: Record<string, string> = { yes: "Haan", no: "Nahi", unknown: "Pata nahi" };
const READY_TONE: Record<string, "green" | "red" | "amber"> = { yes: "green", no: "red", unknown: "amber" };

export function BookingDetail({
  booking,
  payments,
  dispatches,
  fuelLogs,
  efficiency,
  work,
  bill,
  events,
  machines,
  harvestDate,
  reminders,
  accounts,
  advanceTotal,
  finalPaid,
  vendorName,
  paidToVendor,
  canOverride,
  willSellToUs,
  lifters,
  lift,
  liftBreakdown,
}: {
  booking: Booking;
  payments: Array<{ id: string; kind: string; amount: number; method: string; payment_date: string; reference: string | null; evidence_url: string | null; received_by_name: string | null; finance_account_id: string | null }>;
  dispatches: Array<{
    id: string;
    operator_name: string | null;
    departure_at: string;
    opening_meter: number | null;
  }>;
  fuelLogs: Array<{
    id: string;
    log_date: string;
    litres: number | null;
    rate_per_litre: number | null;
    amount: number;
    paid_by: string;
    vendor_recoverable: boolean;
    verification_status: string;
    cancelled_reason: string | null;
  }>;
  efficiency: {
    kulGhante: number | null;
    kulLitre: number | null;
    litrePerGhanta: number | null;
    acrePerGhanta: number | null;
    litrePerAcre: number | null;
  } | null;
  work: Array<{
    id: string;
    work_date: string;
    is_final: boolean;
    actual_area: number;
    started_at: string | null;
    finished_at: string | null;
    completion_photo_url: string | null;
    farmer_confirmed: boolean;
    location_lat: number | null;
    location_lng: number | null;
  }>;
  bill: { bill_number: string; bill_date: string; actual_area: number; rate_amount: number; gross_amount: number; discount_amount: number; discount_reason: string | null; advance_adjusted: number; previous_payment: number; balance_payable: number; commission_percentage: number; commission_amount: number; vendor_payable: number; diesel_deducted: number; sabit_area: number | null; kutra_area: number | null; sabit_rate: number | null; kutra_rate: number | null; sabit_amount: number | null; kutra_amount: number | null } | null;
  events: Array<{ id: string; event_type: string; note: string | null; to_status: string | null; created_at: string; actor_name: string | null }>;
  machines: Array<{
    id: string;
    label: string;
    driverName: string;
    driverPhone: string;
    /** Us din us machine ka bojh (180). Na maloom ho to null. */
    capacity: number | null;
    booked: number | null;
    free: number | null;
  }>;
  /** Booking ki kattai ki tareekh -- capacity isi din ki dikhti hai. */
  harvestDate: string | null;
  reminders: Array<{ id: string; status: string; error: string | null; sentAt: string; bySystem: boolean }>;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  advanceTotal: number;
  finalPaid: number;
  vendorName: string | null;
  paidToVendor: number;
  canOverride: boolean;
  /** Kisan ne booking par kaha tha ke fasal hamein bechega. */
  willSellToUs: boolean;
  lifters: Array<{ id: string; name: string; commission_rate: number }>;
  lift: CropLiftInfo | null;
  liftBreakdown: { kattai: number | null; purana: number | null; reliable: boolean; unposted: number | null };
}) {
  const lang = useLang();
  const confirmed = Boolean(booking.farmer_confirmed_at) || Boolean(booking.confirmation_override_reason);
  const balance = bill ? Math.round((bill.balance_payable - finalPaid) * 100) / 100 : null;
  const cancelled = booking.status === "cancelled";

  // Diesel do hisson mein: hamara kharcha, aur wo jo kisan/vendor ne
  // dala. Dono ek adad mein jorh dena hamare munafe ko jhoota kar deta.
  // ART ka diesel do qism ka hota hai, aur dono ka anjaam alag hai (170):
  //
  //   Vendor ki machine par diya hua diesel KHARCHA NAHI -- wo vendor ke
  //   hisse se wapas aata hai. Usay "kharcha" likhna machinery ka munafa
  //   jhooti tarah kam kar ke dikhata hai.
  //
  //   ART ki apni machine par diya hua diesel waqai hamara kharcha hai.
  //
  // Screen par pehle dono ek hi lakeer mein "hamara diesel (kharcha)"
  // likhe jate the. Adad theek tha, lafz ghalat -- aur usi lafz par
  // banda faisla karta hai.
  //
  // Mansookh shuda diesel kisi jor mein nahi aata (313). Safhe par wo
  // phir bhi nazar aata hai -- chhupa dene se ye sawal khara reh jata
  // hai ke "diesel to daala tha, gaya kahan".
  const ginneWaleFuel = fuelLogs.filter((f) => f.verification_status !== "cancelled");
  const ourFuelRecoverable = ginneWaleFuel
    .filter((f) => f.paid_by === "company" && f.vendor_recoverable)
    .reduce((s2, f) => s2 + f.amount, 0);
  const ourFuelExpense = ginneWaleFuel
    .filter((f) => f.paid_by === "company" && !f.vendor_recoverable)
    .reduce((s2, f) => s2 + f.amount, 0);
  const othersFuel = ginneWaleFuel.filter((f) => f.paid_by !== "company").reduce((s2, f) => s2 + f.amount, 0);

  // Kisan ka aakhri aitraaz -- sirf wo jo aakhri rate bhejne ke BAAD
  // aaya ho. Purana aitraaz naye rate par dikhana galat hai: wo bahes
  // khatam ho chuki hoti hai.
  const lastObjection = [...events]
    .reverse()
    .find(
      (e) =>
        e.event_type === "farmer_raised_issue" &&
        (!booking.rate_confirmation_sent_at ||
          new Date(e.created_at) >= new Date(booking.rate_confirmation_sent_at))
    );

  // Kaam ka jor -- bill isi se banta hai, kisi ek din se nahi.
  const workDone = Math.round(work.reduce((sum, w) => sum + w.actual_area, 0) * 10000) / 10000;
  const workFinished = work.some((w) => w.is_final);
  const workRemaining = Math.max(Math.round((booking.harvest_area - workDone) * 10000) / 10000, 0);
  const vendorRemaining = bill ? Math.round((bill.vendor_payable - paidToVendor) * 100) / 100 : 0;

  // ART ne is booking par vendor ke liye jo diesel diya. Wo adaigi ke
  // waqt khud wapas kat jata hai (170) -- yahan sirf dikhaya jata hai,
  // taake adaigi se pehle dono taraf ko pata ho.
  const artDiesel = Math.max(
    0,
    Math.round((ginneWaleFuel.filter((f) => f.vendor_recoverable).reduce((s2, f) => s2 + f.amount, 0) - paidToVendor) * 100) / 100
  );

  // Kisan se aaya hua poora paisa -- advance aur bill ki adaigi dono.
  // Ye do adad pehle safhe par do alag jagah pare the; malik ke mockup
  // mein "Paid" ek hi khana hai, aur wo dono ka jor hai.
  const paidTotal = Math.round((advanceTotal + finalPaid) * 100) / 100;

  // Hamara hissa. Bill bane baghair ye adad hota hi nahi -- aur us waqt
  // yahan "Rs 0" likh dena jhoot hai (sifar kehta hai "dekh liya, kuch
  // nahi bana", jab ke asal baat ye hai ke abhi hisaab hi nahi bana).
  const artProfit = bill ? bill.commission_amount : null;

  const accountName = (id: string | null) => (id ? accounts.find((a) => a.id === id)?.name ?? null : null);

  // Timeline ki har qatar. Teen qatarein status se nahi, INDRAJ se banti
  // hain -- kyunke `in_progress` ek hi status mein "machine nikal gayi"
  // aur "kaam shuru ho gaya" dono chhupe hue hain (B.3).
  const reached = [
    true,
    confirmed || ["confirmed", "ready_for_harvest", "in_progress", "bill_pending", "payment_pending", "closed"].includes(booking.status),
    dispatches.length > 0,
    work.length > 0,
    workFinished || ["bill_pending", "payment_pending", "closed"].includes(booking.status),
    Boolean(bill),
    booking.status === "closed",
  ];

  // Kaunsa khana khula hai. Chaar bade button apne apne khane kholte
  // hain -- safha khud khula hua koi form nahi rakhta. Yehi malik ki
  // asal shikayat thi: "har StepCard hamesha khula rehta hai, chahe
  // kaam ho chuka ho."
  const [modal, setModal] = useState<"payment" | "diesel" | "work" | "close" | null>(null);

  // Kisan ke khate se aane wala `#payment` link.
  //
  // Pehle wo link ek khule hue StepCard par utarta tha. Ab wahan koi
  // khula khana nahi -- is liye link khud adaigi ka khana khol deta
  // hai. Warna banda wahan pahunch kar khali safha dekhta aur samajhta
  // ke link toot gaya.
  useEffect(() => {
    // Cancel shuda booking par ye khana nahi khulta -- wahan adaigi ka
    // sawal hi khatam ho chuka.
    if (cancelled) return;
    if (typeof window !== "undefined" && window.location.hash === "#payment") setModal("payment");
  }, [cancelled]);

  return (
    <div className="space-y-4 pb-24">
      {/* ---------------------------------------------------------------
          1. Sarnama -- booking ka number, us ka darja, aur kone mein
          cancel ka raasta. Cancel bara button nahi hai (malik: "khatam
          nahi karna" -- magar wo rozana ka kaam bhi nahi).
          --------------------------------------------------------------- */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-bold text-brand-700 dark:text-brand-300">{booking.booking_number}</p>
            <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
              {booking.farmer_name}
              {booking.farmer_code && ` (${booking.farmer_code})`} — {booking.farmer_phone || "phone darj nahi"}
            </p>
            <p className="text-sm text-surface-500">
              {[booking.village || booking.farmer_village, booking.crop_type, booking.booking_date]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {/* Ye do jawab yahan sarnama par hain, kisi andar wale khane
                mein nahi: machine bhejne se pehle bande ne inhi ko dekhna
                hota hai. "Nahi" laal hai taake nazar se na guzre. */}
            {(booking.field_ready || booking.harvest_ready) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {booking.field_ready && (
                  <Badge tone={READY_TONE[booking.field_ready] ?? "gray"}>
                    Khet tayyar: {READY_LABEL[booking.field_ready] ?? booking.field_ready}
                  </Badge>
                )}
                {booking.harvest_ready && (
                  <Badge tone={READY_TONE[booking.harvest_ready] ?? "gray"}>
                    Fasal pakki: {READY_LABEL[booking.harvest_ready] ?? booking.harvest_ready}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={cancelled ? "red" : booking.status === "closed" ? "green" : "blue"}>
              {cancelled ? "Cancelled" : statusLabel(booking.status, work.length)}
            </Badge>
            {!cancelled && booking.status !== "closed" && (
              <CancelForm bookingId={booking.id} advanceTotal={advanceTotal} />
            )}
          </div>
        </div>

        {cancelled && booking.cancellation_reason && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            Cancel ki wajah: {booking.cancellation_reason}
          </p>
        )}
      </Card>

      {/* ---------------------------------------------------------------
          2. Ek nazar mein poori booking.
          --------------------------------------------------------------- */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Farmer" value={booking.farmer_name} hint={booking.farmer_code || undefined} />
          {/* Vendor dispatch ke waqt lagta hai (180). Us se pehle wo
              "abhi tay nahi" hai -- khali lakeer nahi. */}
          <Stat label="Vendor" value={vendorName ?? "Abhi tay nahi"} />
          <Stat value={booking.machine_label ?? booking.machine_type_requested ?? "Abhi tay nahi"} label="Machine" />
          {/* Raqba: kaam darj ho chuka ho to ASAL raqba, warna booking
              ka andaza -- aur dono par saaf likha hai ke kaun sa hai.
              Yehi wo farq hai jis ne 14 September ko "13 acre" ka ghalat
              jawab diya tha: andaze ko asal samajh liya gaya tha. */}
          <Stat
            label="Acres"
            value={`${workDone > 0 ? workDone : booking.harvest_area}`}
            hint={workDone > 0 ? "asal kaam" : "andaza"}
            tone={workDone > 0 ? "green" : "gray"}
          />
          <Stat
            label="Total Bill"
            value={bill ? `Rs ${bill.gross_amount.toLocaleString()}` : "Abhi nahi bana"}
          />
          <Stat label="Paid" value={`Rs ${paidTotal.toLocaleString()}`} hint="advance + adaigi" />
          <Stat
            label="Remaining"
            value={bill ? `Rs ${(balance ?? 0).toLocaleString()}` : "—"}
            tone={bill ? ((balance ?? 0) > 0 ? "red" : "green") : "gray"}
            hint={bill ? undefined : "bill ke baad"}
          />
          {/* ART = Al Rana Traders. Bill bane baghair hamara hissa bana
              hi nahi -- wahan sifar likhna ghalat hoga. */}
          <Stat
            label="ART Profit"
            value={artProfit === null ? "—" : `Rs ${artProfit.toLocaleString()}`}
            tone={artProfit === null ? "gray" : "green"}
            hint={artProfit === null ? "bill ke baad" : `commission ${bill?.commission_percentage}%`}
          />
        </div>
      </Card>

      {!cancelled && (
        <>
          {/* -----------------------------------------------------------
              3. Chaar bade button. Har ek apna khana kholta hai.
              ----------------------------------------------------------- */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <BigButton
              label="Add Payment"
              hint={bill ? `Baqi Rs ${(balance ?? 0).toLocaleString()}` : advanceTotal > 0 ? "Advance mil chuka" : "Advance ya adaigi"}
              onClick={() => setModal("payment")}
            />
            <BigButton
              label="Add Diesel"
              hint={confirmed ? "Litre aur us din ka rate" : "Pehle kisan ki tasdeeq"}
              disabled={!confirmed}
              onClick={() => setModal("diesel")}
            />
            <BigButton
              label="Mark Work Complete"
              hint={!confirmed ? "Pehle kisan ki tasdeeq" : workFinished ? "Kaam mukammal ho chuka" : `${workRemaining} acre baqi`}
              disabled={!confirmed || workFinished}
              onClick={() => setModal("work")}
            />
            <BigButton
              label="Close Booking"
              hint={booking.status === "closed" ? "Band ho chuki" : bill ? ((balance ?? 0) > 0 ? `Rs ${(balance ?? 0).toLocaleString()} baqi` : "Hisaab barabar") : "Pehle bill"}
              disabled={booking.status === "closed"}
              onClick={() => setModal("close")}
            />
          </div>

          {/* -----------------------------------------------------------
              Chhote khane -- jo mockup ke chaar button mein nahi hain
              magar hatae bhi nahi ja sakte.

              Rate ki tasdeeq ka gate (B.4) aur fasal uthane wala qadam
              (8) yahan band halat mein rehte hain: raasta khula hai,
              magar safha un se shuru nahi hota. Bill aur rawangi bhi
              isi tarah -- un ke baghair booking aage barh hi nahi
              sakti, magar wo rozana wala kaam nahi hain.
              ----------------------------------------------------------- */}
          <Compact
            title="Rate aur kisan ki tasdeeq"
            summary={
              confirmed
                ? `Tasdeeq ho chuki — Rs ${booking.final_rate?.toLocaleString() ?? "—"}/acre`
                : booking.rate_confirmation_sent_at
                ? "Bheja ja chuka — kisan ka jawab darj karein"
                : "Abhi tasdeeq nahi hui"
            }
            tone={confirmed ? "done" : "todo"}
            open={!confirmed}
          >
            {confirmed ? (
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-900/40 dark:bg-brand-950/20">
                {booking.farmer_confirmed_at ? (
                  <>
                    <p className="font-medium text-surface-900 dark:text-surface-100">
                      Kisan ne Rs {booking.final_rate?.toLocaleString()}/acre par tasdeeq ki
                    </p>
                    <p className="mt-1 text-surface-600 dark:text-surface-300">
                      {booking.farmer_confirmation_channel} · {new Date(booking.farmer_confirmed_at).toLocaleString()}
                    </p>
                    {booking.farmer_confirmation_response && (
                      <p className="mt-2 rounded bg-white/70 p-2 text-xs italic text-surface-700 dark:bg-surface-900/40 dark:text-surface-300">
                        &ldquo;{booking.farmer_confirmation_response}&rdquo;
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-amber-800 dark:text-amber-300">
                    Kisan ki tasdeeq ke baghair manager ne aage barhaya. Wajah: {booking.confirmation_override_reason}
                  </p>
                )}
                {/* Rate theek karne ka raasta.
                    Pehle ye khana tasdeeq ke baad bilkul band ho jata
                    tha. Ghalat rate likha jana koi anokhi baat nahi --
                    aur jab safhe par raasta na ho to log database tak
                    jate hain, yani theek us jagah jahan koi rok nahi.
                    Raasta khula hai magar chupke se nahi: naya rate
                    bhejte hi purani tasdeeq khatam ho jati hai aur
                    kisan se dobara haan leni parti hai (192). */}
                {bill ? (
                  <p className="mt-3 border-t border-brand-200 pt-2 text-xs text-surface-600 dark:border-brand-900/40 dark:text-surface-300">
                    Rate theek karna ho to pehle bill {bill.bill_number} mansookh karein — neeche Bill wale khane mein.
                  </p>
                ) : (
                  <details className="mt-3 border-t border-brand-200 pt-2 dark:border-brand-900/40">
                    <summary className="cursor-pointer text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">{t("mb_rate_wrong", lang)}</summary>
                    <div className="mt-3 space-y-3">
                      <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                        Naya rate bhejte hi upar wali tasdeeq khatam ho jayegi — kisan se dobara haan leni hogi. Jo
                        tasdeeq abhi darj hai wo timeline par apni jagah rahegi.
                      </p>
                      <RateConfirmationForm
                        bookingId={booking.id}
                        defaultRate={booking.final_rate ?? booking.estimated_rate}
                        harvestType={booking.harvest_type}
                        sabitArea={booking.sabit_area}
                        kutraArea={booking.kutra_area}
                        totalArea={booking.harvest_area}
                        defaultSabitRate={booking.sabit_rate}
                        defaultKutraRate={booking.kutra_rate}
                      />
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <RateConfirmationForm
                  bookingId={booking.id}
                  defaultRate={booking.final_rate ?? booking.estimated_rate}
                  harvestType={booking.harvest_type}
                  sabitArea={booking.sabit_area}
                  kutraArea={booking.kutra_area}
                  totalArea={booking.harvest_area}
                  defaultSabitRate={booking.sabit_rate}
                  defaultKutraRate={booking.kutra_rate}
                />
                {booking.rate_confirmation_sent_at && (
                  <>
                    <p className="text-xs text-surface-500">
                      Rs {booking.final_rate?.toLocaleString()}/acre par confirmation bheja ja chuka hai (
                      {new Date(booking.rate_confirmation_sent_at).toLocaleString()}). Kisan ka jawab yahan darj karein:
                    </p>
                    {/* Aitraaz aaya ho to wo yahan saamne rakha jata hai.
                        Warna staff ko sirf khula hua form nazar aata hai
                        aur wajah kahin nahi -- wo samajhta hai ke us ka
                        indraj gaya hi nahi, aur dobara bhejta rehta hai. */}
                    {lastObjection && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                          {t("mc_last_objection", lang)}
                        </p>
                        <p className="text-amber-800 dark:text-amber-300">{lastObjection.note}</p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          {new Date(lastObjection.created_at).toLocaleString()}
                          {lastObjection.actor_name ? ` · ${lastObjection.actor_name}` : ""}
                        </p>
                      </div>
                    )}
                    <FarmerResponseForm bookingId={booking.id} />
                    {canOverride && <OverrideForm bookingId={booking.id} />}
                  </>
                )}
              </div>
            )}
          </Compact>

          <Compact
            title="Machine ki rawangi"
            summary={
              dispatches.length > 0
                ? `${new Date(dispatches[0].departure_at).toLocaleString()}${dispatches[0].operator_name ? ` · ${dispatches[0].operator_name}` : ""}`
                : confirmed
                ? "Abhi nahi bheji gayi"
                : "Pehle kisan ki tasdeeq"
            }
            tone={dispatches.length > 0 ? "done" : "todo"}
            open={confirmed && dispatches.length === 0}
          >
            {dispatches.map((d) => (
              <p key={d.id} className="mb-2 text-sm text-surface-600 dark:text-surface-300">
                {new Date(d.departure_at).toLocaleString()} · {d.operator_name ?? "operator darj nahi"}
                {d.opening_meter !== null && ` · meter ${d.opening_meter}`}
              </p>
            ))}
            {/* Rawangi ek dafa. Dobara jaan boojh kar maangni parti hai
                -- pehle ye form khula rehta tha aur agla diesel likhne
                ke liye staff ise dobara bhar deta tha, jis se ek hi
                machine do dafa "bheji gayi". */}
            {confirmed ? (
              <DispatchForm
                bookingId={booking.id}
                machines={machines}
                already={dispatches.length > 0}
                harvestDate={harvestDate}
                bookingAcres={booking.harvest_area}
              />
            ) : (
              <p className="text-sm text-surface-500">{t("mb_gate_note", lang)}</p>
            )}
          </Compact>

          <Compact
            title="Bill"
            summary={bill ? `${bill.bill_number} — Rs ${bill.gross_amount.toLocaleString()}` : workFinished ? "Ab bill banaya ja sakta hai" : "Pehle kaam mukammal"}
            tone={bill ? "done" : "todo"}
            open={workFinished && !bill}
          >
            {bill ? (
              <div className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                <p className="mb-2 font-medium text-surface-900 dark:text-surface-100">{bill.bill_number}</p>
                {/* Do qism ka bill do lakeeron mein (176). Ek hi lakeer
                    mein aausat rate likh dena wo adad dikhata hai jis
                    par kabhi koi raazi hi nahi hua tha. */}
                {bill.sabit_rate !== null || bill.kutra_rate !== null ? (
                  <>
                    {Number(bill.sabit_area ?? 0) > 0 && (
                      <Row
                        label={`${t("mh_sabit", lang)} (${bill.sabit_area} acre × Rs ${Number(bill.sabit_rate ?? 0).toLocaleString()})`}
                        value={Number(bill.sabit_amount ?? 0)}
                      />
                    )}
                    {Number(bill.kutra_area ?? 0) > 0 && (
                      <Row
                        label={`${t("mh_kutra", lang)} (${bill.kutra_area} acre × Rs ${Number(bill.kutra_rate ?? 0).toLocaleString()})`}
                        value={Number(bill.kutra_amount ?? 0)}
                      />
                    )}
                  </>
                ) : (
                  <Row label={`Machinery charges (${bill.actual_area} acre × Rs ${bill.rate_amount.toLocaleString()})`} value={bill.gross_amount} />
                )}
                {/* Riayat. Ye lakeer commission aur vendor ke hisse se
                    UPAR hai, kyunke wohi us ka matlab hai: riayat pehle
                    katti hai, hissa us ke baad bantta hai (194). */}
                {bill.discount_amount > 0 && (
                  <>
                    <Row label={t("mb_discount", lang)} value={-bill.discount_amount} />
                    {bill.discount_reason && (
                      <p className="-mt-1 pl-1 text-xs italic text-surface-500">{bill.discount_reason}</p>
                    )}
                  </>
                )}
                {bill.diesel_deducted > 0 && (
                  <Row label={t("mc_diesel_from_bill", lang)} value={-bill.diesel_deducted} />
                )}
                <Row label={t("mc_advance_paid", lang)} value={-bill.advance_adjusted} />
                {bill.previous_payment > 0 && <Row label={t("mc_previous_payment", lang)} value={-bill.previous_payment} />}
                {finalPaid > 0 && <Row label={t("mc_received_so_far", lang)} value={-finalPaid} />}
                <div className="mt-2 flex justify-between border-t border-surface-200 pt-2 font-display font-semibold dark:border-surface-700">
                  <span>{t("mc_balance", lang)}</span>
                  <span className={balance && balance > 0 ? "text-red-600 dark:text-red-400" : "text-brand-700 dark:text-brand-300"}>
                    Rs {(balance ?? 0).toLocaleString()}
                  </span>
                </div>
                <CancelBillForm bookingId={booking.id} billNumber={bill.bill_number} paid={finalPaid} />
              </div>
            ) : workFinished ? (
              <BillForm bookingId={booking.id} />
            ) : (
              <p className="text-sm text-surface-500">{t("mb_gate_note", lang)}</p>
            )}
          </Compact>

          {/* Baqi kaam ki agli booking -- sirf us soorat mein jab kaam
              mukammal ho chuka ho magar poora raqba na kata ho. */}
          {workFinished && workRemaining > 0 && (
            <Compact
              title="Baqi raqba — agli booking"
              summary={`${workRemaining} acre baqi reh gaya`}
              tone="todo"
              open
            >
              <FollowUpForm
                bookingId={booking.id}
                remaining={workRemaining}
                alreadyMade={booking.follow_up_number}
              />
            </Compact>
          )}

          {/* Fasal kaun uthayega.
              Ye qadam SIRF us booking par aata hai jis par kisan ne kaha
              tha ke fasal hamein bechega. Baqi bookings par ye sawal
              bemaani hai, aur bemaani sawal har safhe par rakh dene se
              staff sab qadam parhna chhoR deta hai. */}
          {willSellToUs && (
            <Compact
              title={t("ar_step_title", lang)}
              summary={lift?.status === "lifted" ? "Fasal uth chuki" : bill ? "Abhi nahi uthi" : "Pehle bill"}
              tone={lift?.status === "lifted" ? "done" : "todo"}
              open={Boolean(bill) && lift?.status !== "lifted"}
            >
              {bill ? (
                <CropLiftStep bookingId={booking.id} lift={lift} lifters={lifters} breakdown={liftBreakdown} />
              ) : (
                <p className="text-sm text-surface-500">{t("mb_gate_note", lang)}</p>
              )}
            </Compact>
          )}

          {/* -----------------------------------------------------------
              4. Do tables -- jo ho chuka, wo saamne.
              ----------------------------------------------------------- */}
          <div id="payment" className="scroll-mt-20" />
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                Payment Records
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setModal("payment")}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-surface-400">Abhi koi adaigi darj nahi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-700">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Paid By</th>
                      <th className="py-2 pr-3 text-right font-medium">Amount</th>
                      <th className="py-2 pr-3 font-medium">Account / Khata</th>
                      <th className="py-2 pr-3 font-medium">Method</th>
                      <th className="py-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                        <td className="py-2 pr-3 text-surface-600 dark:text-surface-300">{p.payment_date}</td>
                        <td className="py-2 pr-3 text-surface-700 dark:text-surface-200">
                          {p.method === "vendor_collected" ? "Farmer → Vendor" : "Farmer"}
                          {p.kind === "advance" && <span className="text-surface-400"> · advance</span>}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium text-surface-900 dark:text-surface-100">
                          Rs {p.amount.toLocaleString()}
                        </td>
                        {/* Khata sirf wahan likha jata hai jahan waqai
                            koi khata hota hai. Cash lene wale ki jeb
                            mein hota hai, khata kisan ke apne hisaab
                            mein -- un par kisi khate ka naam likh dena
                            ye kehta hai ke paisa daftar pahunch gaya. */}
                        <td className="py-2 pr-3 text-surface-600 dark:text-surface-300">
                          {accountName(p.finance_account_id) ??
                            (p.method === "cash"
                              ? "Cash (lene wale ke paas)"
                              : p.method === "khata"
                              ? "Kisan ka khata"
                              : p.method === "vendor_collected"
                              ? "Vendor ke paas"
                              : "—")}
                        </td>
                        <td className="py-2 pr-3 text-surface-600 dark:text-surface-300">{p.method}</td>
                        <td className="py-2 text-surface-500">
                          <span className="flex flex-wrap items-center gap-2">
                            {p.reference && <span>{p.reference}</span>}
                            {p.received_by_name && <span className="text-xs">liya: {p.received_by_name}</span>}
                            {/* Har adaigi ki apni raseed -- ek booking par
                                kai adaigiyan hoti hain, aur kisan ko us
                                adaigi ka kaghaz chahiye jo us ne abhi ki. */}
                            <Link
                              href={`/admin/machinery-rental/receipt/${p.id}`}
                              className="text-xs text-brand-600 underline hover:text-brand-700"
                            >
                              {t("mr_receipt_link", lang)}
                            </Link>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                Diesel Records
              </h2>
              <Button type="button" variant="ghost" size="sm" disabled={!confirmed} onClick={() => setModal("diesel")}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {fuelLogs.length === 0 ? (
              <p className="text-sm text-surface-400">
                {booking.diesel_none_at ? t("mc_diesel_none_done", lang) : "Abhi koi diesel darj nahi."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-700">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Given By</th>
                      <th className="py-2 pr-3 text-right font-medium">Litres</th>
                      <th className="py-2 pr-3 text-right font-medium">Rate</th>
                      <th className="py-2 pr-3 text-right font-medium">Total</th>
                      <th className="py-2 pr-3 font-medium">Account / Khata</th>
                      <th className="py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {/* Mansookh shuda diesel kisi jor mein nahi aata (313).
                        Safhe par wo phir bhi nazar aata hai -- chhupa dene
                        se ye sawal khara reh jata hai ke "diesel to daala
                        tha, gaya kahan". */}
                    {fuelLogs.map((f) => {
                      const mansookh = f.verification_status === "cancelled";
                      const dim = mansookh ? "text-surface-400 line-through dark:text-surface-500" : "";
                      return (
                        <tr key={f.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                          <td className={`py-2 pr-3 text-surface-600 dark:text-surface-300 ${dim}`}>{f.log_date}</td>
                          <td className={`py-2 pr-3 text-surface-700 dark:text-surface-200 ${dim}`}>
                            {f.paid_by === "company"
                              ? t("mc_diesel_by_company", lang)
                              : f.paid_by === "vendor"
                              ? t("mc_diesel_by_vendor", lang)
                              : t("mc_diesel_by_farmer", lang)}
                          </td>
                          <td className={`py-2 pr-3 text-right ${dim}`}>{f.litres ?? "—"}</td>
                          <td className={`py-2 pr-3 text-right ${dim}`}>
                            {f.rate_per_litre === null ? "—" : `Rs ${f.rate_per_litre.toLocaleString()}`}
                          </td>
                          <td className={`py-2 pr-3 text-right font-medium text-surface-900 dark:text-surface-100 ${dim}`}>
                            Rs {f.amount.toLocaleString()}
                          </td>
                          {/* Khata staff se poochha NAHI jata (B.2) -- wo
                              khud tay hota hai. Yahan sirf dikhaya jata
                              hai, taake bande ko pata ho ke ye raqam
                              kahan gayi. */}
                          <td className={`py-2 pr-3 text-surface-600 dark:text-surface-300 ${dim}`}>
                            {f.paid_by === "company"
                              ? f.vendor_recoverable
                                ? "Vendor se wasooli"
                                : "ART ka diesel kharcha"
                              : f.paid_by === "vendor"
                              ? "Vendor ka apna"
                              : "Farmer ka apna — bill se katega"}
                          </td>
                          <td className="py-2 text-right">
                            {mansookh ? (
                              <span className="text-[11px] text-surface-400 dark:text-surface-500">
                                Mansookh{f.cancelled_reason ? ` — ${f.cancelled_reason}` : ""}
                              </span>
                            ) : (
                              /* Ghalti se do dafa darj ho jaye to us ka
                                 raasta yahin hona chahiye (5 September). */
                              <CancelFuelButton fuelId={f.id} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {ourFuelRecoverable > 0 && (
              <p className="mt-2 text-xs text-surface-500">
                {t("mc_fuel_recoverable", lang)}: Rs {ourFuelRecoverable.toLocaleString()}
              </p>
            )}
          </Card>

          {/* Machine ne kaisa kaam kiya. Ye adad kisi ke bharne se nahi
              bante -- waqt aur diesel ke indraj se khud nikalte hain.
              Isi liye in par bharosa kiya ja sakta hai. */}
          {efficiency && (efficiency.kulGhante || efficiency.kulLitre) && (
            <Card>
              <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                {t("mc_eff_title", lang)}
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {efficiency.kulGhante !== null && <Eff label={t("mc_eff_hours", lang)} value={`${efficiency.kulGhante}`} />}
                {efficiency.kulLitre !== null && <Eff label={t("mc_eff_litres", lang)} value={`${efficiency.kulLitre} L`} />}
                {efficiency.litrePerGhanta !== null && <Eff label={t("mc_eff_lph", lang)} value={`${efficiency.litrePerGhanta} L`} />}
                {efficiency.acrePerGhanta !== null && <Eff label={t("mc_eff_aph", lang)} value={`${efficiency.acrePerGhanta}`} />}
                {efficiency.litrePerAcre !== null && <Eff label={t("mc_eff_lpa", lang)} value={`${efficiency.litrePerAcre} L`} />}
              </div>
              <p className="mt-2 text-xs text-surface-500">{t("mc_eff_note", lang)}</p>
            </Card>
          )}

          {/* Jo kaam darj ho chuka. */}
          {work.length > 0 && (
            <Card>
              <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                {t("mc_step_work", lang)}
              </h2>
              <div className="space-y-1 text-sm">
                {work.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded border border-surface-100 px-2 py-1 dark:border-surface-800"
                  >
                    <span className="text-surface-600 dark:text-surface-300">
                      {new Date(w.work_date).toLocaleDateString()}
                      {w.is_final && ` · ${t("mc_work_done_flag", lang)}`}
                    </span>
                    <span className="flex items-center gap-2">
                      {/* Jis indraj ke sath jagah mehfooz hai us par nishan
                          aata hai -- "jahan jahan kattai hui" ka jawab in
                          nishanon se banta hai, kisi alag fehrist se nahi. */}
                      {w.location_lat != null && w.location_lng != null && (
                        <a
                          href={`https://www.google.com/maps?q=${w.location_lat},${w.location_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-700 underline dark:text-brand-300"
                        >
                          {t("mc_work_on_map", lang)}
                        </a>
                      )}
                      <span className="font-medium text-surface-900 dark:text-surface-100">{w.actual_area} acre</span>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-surface-200 pt-1 font-display font-semibold dark:border-surface-700">
                  <span>{t("mc_work_done_total", lang)}</span>
                  <span>{workDone} acre</span>
                </div>
                {!workFinished && (
                  <p className="text-amber-700 dark:text-amber-300">
                    {t("mc_work_remaining", lang)}: {workRemaining} acre — {t("mc_work_not_final_hint", lang)}
                  </p>
                )}
                {workFinished && booking.harvest_area !== workDone && (
                  <p className="text-amber-700 dark:text-amber-300">
                    Booking par andaza {booking.harvest_area} acre tha — bill asal {workDone} acre ka bana.
                  </p>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* -----------------------------------------------------------------
          5. Booking Timeline.
          ----------------------------------------------------------------- */}
      <Card>
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Booking Timeline
        </h2>
        <Timeline reached={reached} cancelled={cancelled} />
      </Card>

      {/* -----------------------------------------------------------------
          6. Settlement Summary -- koi nayi ginti nahi (B.6). Har adad
          wohi hai jo upar ke khanon mein bhi chal raha hai.
          ----------------------------------------------------------------- */}
      <Card>
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Settlement Summary
        </h2>
        <SettlementRows
          bill={bill}
          paidTotal={paidTotal}
          balance={balance}
          paidToVendor={paidToVendor}
          vendorRemaining={vendorRemaining}
          vendorName={vendorName}
          ourFuelExpense={ourFuelExpense}
          ourFuelRecoverable={ourFuelRecoverable}
          othersFuel={othersFuel}
        />
        {/* Kisan ka poora paisa hamari aamdani nahi. */}
        <p className="mt-3 border-t border-surface-100 pt-2 text-xs text-surface-500 dark:border-surface-800">
          Kisan ka poora paisa hamari aamdani nahi. Bill bante hi commission hamara aur baqi vendor ka ho jata hai — wo
          raqam sirf hamare paas se guzar rahi hoti hai.
        </p>
      </Card>

      {/* Kis ne kya kiya -- poora waqia, tarteeb se. */}
      <Card>
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          {t("mc_who_did_what", lang)}
        </h2>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <div>
                <p className="text-surface-800 dark:text-surface-200">{e.event_type.replace(/_/g, " ")}</p>
                {e.note && <p className="text-surface-500">{e.note}</p>}
                <p className="text-xs text-surface-400">
                  {new Date(e.created_at).toLocaleString()}
                  {e.actor_name && ` · ${e.actor_name}`}
                </p>
              </div>
            </li>
          ))}
          {events.length === 0 && <li className="text-sm text-surface-400">{t("mc_nothing_yet", lang)}</li>}
        </ul>
      </Card>

      {/* -----------------------------------------------------------------
          Chaar khane. Har ek ke andar WOHI purana form hai jo pehle
          StepCard mein khula rehta tha -- sirf jagah badli hai, kaam
          nahi. Koi naya action, koi nayi ginti nahi.
          ----------------------------------------------------------------- */}
      <Modal open={modal === "payment"} title="Add Payment" onClose={() => setModal(null)}>
        <AddPayment
          booking={booking}
          accounts={accounts}
          advanceTotal={advanceTotal}
          bill={bill}
          balance={balance}
          confirmed={confirmed}
          reminders={reminders}
          vendorName={vendorName}
          vendorRemaining={vendorRemaining}
          paidToVendor={paidToVendor}
        />
        {/* Malik (17 September): "Work Complete ke baad Diesel, phir
            Payment, phir Close — isi tarteeb se ho." Hisaab barabar ho
            chuka ho (bill ban chuka aur baqi sifar) to yahin se Close
            Booking ka raasta bhi mil jata hai — dobara top ke button
            tak wapas jane ki zaroorat nahi. */}
        {bill && (balance ?? 0) <= 0 && (
          <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
            <Button type="button" variant="secondary" className="w-full" onClick={() => setModal("close")}>
              Ab Booking Close karein →
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={modal === "diesel"} title="Add Diesel" onClose={() => setModal(null)}>
        {/* Wohi purana FuelForm -- `already` khali hai kyunke khana
            khud is button se khula hai, safhe par apne aap nahi. */}
        <FuelForm bookingId={booking.id} accounts={accounts} already={false} />
        {/* "Is booking par diesel dala hi nahi" -- ye bhi ek jawab hai,
            aur us ka darj hona zaroori hai: khali khana aur "nahi dala"
            ek cheez nahi. Pehla kehta hai "kisi ne poochha hi nahi",
            doosra kehta hai "poochha, aur jawab nahi tha". Booking us
            waqt tak "diesel darj karna" ki qatar mein khari rehti hai.
            Jawab pehle se darj ho to us ke wapis lene ka raasta. */}
        {booking.diesel_none_at ? (
          <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
            <DieselNone bookingId={booking.id} />
          </div>
        ) : (
          fuelLogs.length === 0 && (
            <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
              <MarkDieselNoneButton bookingId={booking.id} />
            </div>
          )
        )}
        {/* Diesel ke baad agla qadam Payment hai (malik ka tarteeb wala
            usool, 17 September) -- chahe diesel abhi darj hui ho ya
            "nahi dala" kaha ho, dono soorton mein agla sawal payment ka
            hai. */}
        <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
          <Button type="button" variant="secondary" className="w-full" onClick={() => setModal("payment")}>
            Ab Payment darj karein →
          </Button>
        </div>
      </Modal>

      <Modal open={modal === "work"} title="Mark Work Complete" onClose={() => setModal(null)}>
        {/* Wohi WorkForm -- farq sirf itna ke "kaam mukammal" ka nishan
            pehle se laga hua aata hai, kyunke button ka naam wohi keh
            raha hai. Banda chahe to utaar sakta hai (aadha din ka kaam
            darj karna ho to). */}
        <WorkForm
          bookingId={booking.id}
          estimated={booking.harvest_area}
          done={workDone}
          harvestType={booking.harvest_type}
          accounts={accounts}
          defaultFinal
        />
        {/* Malik (17 September): "Work Complete ke andar Diesel ka bhi
            sawal-jawab ho, phir Payment, phir Close" -- kaam mukammal
            darj hote hi agla qadam seedha yahin se, top ke chaar button
            mein se dhoondna na paray. */}
        <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
          <Button type="button" variant="secondary" className="w-full" onClick={() => setModal("diesel")}>
            Ab Diesel darj karein →
          </Button>
        </div>
      </Modal>

      <Modal open={modal === "close"} title="Close Booking" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <p className="text-sm text-surface-600 dark:text-surface-300">
            Band karne se pehle poora hisaab saamne — wohi adad jo Settlement Summary mein hain.
          </p>
          <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <SettlementRows
              bill={bill}
              paidTotal={paidTotal}
              balance={balance}
              paidToVendor={paidToVendor}
              vendorRemaining={vendorRemaining}
              vendorName={vendorName}
              ourFuelExpense={ourFuelExpense}
              ourFuelRecoverable={ourFuelRecoverable}
              othersFuel={othersFuel}
            />
          </div>
          <CloseBookingForm bookingId={booking.id} bill={Boolean(bill)} balance={balance} vendorRemaining={vendorRemaining} />
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------
// Chhote hissay
// ---------------------------------------------------------------------

/**
 * Booking Timeline -- malik ke mockup wali horizontal patti.
 *
 * Har qadam ka "ho gaya ya nahi" upar wale component mein tay hota hai,
 * yahan nahi. Wajah: teen qadam DB ke status se nahi, INDRAJ se bante
 * hain (machine nikli, kaam shuru hua) -- aur wo indraj us safhe ke paas
 * hain, is patti ke paas nahi.
 */
function Timeline({ reached, cancelled }: { reached: boolean[]; cancelled: boolean }) {
  if (cancelled) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
        Ye booking cancel ho chuki — safar yahin ruk gaya.
      </p>
    );
  }
  // Aakhri qadam jo ho chuka. Us se aage wale khali dikhte hain, aur
  // usi par nishan lagta hai ke booking abhi kahan khari hai.
  const current = reached.lastIndexOf(true);
  return (
    <ol className="flex flex-wrap items-start gap-x-1 gap-y-3">
      {CHAIN.map((step, i) => {
        const done = reached[i];
        const here = i === current;
        return (
          <li key={step.key} className="flex items-start">
            <div className="flex w-24 flex-col items-center text-center sm:w-28">
              <span
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 " +
                  (done
                    ? here
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-brand-500 bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "border-surface-200 bg-surface-50 text-surface-400 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-500")
                }
              >
                {done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
              </span>
              <span
                className={
                  "mt-1.5 text-[11px] leading-tight " +
                  (done
                    ? "font-medium text-surface-800 dark:text-surface-200"
                    : "text-surface-400 dark:text-surface-500")
                }
              >
                {step.label}
              </span>
            </div>
            {i < CHAIN.length - 1 && (
              <span
                className={
                  "mt-3.5 hidden h-0.5 w-4 sm:block " +
                  (reached[i + 1] ? "bg-brand-500" : "bg-surface-200 dark:bg-surface-700")
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Chaar bade button -- mockup ka asal hissa.
 *
 * Band button ghayab nahi hota, sirf wajah likh deta hai. Ghayab button
 * staff ko ye sochne par majboor karta hai ke raasta hai hi nahi, aur
 * phir wo kisi aur safhe par dhoondhne nikal jata hai.
 */
function BigButton({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "flex min-h-[76px] flex-col items-start justify-center gap-1 rounded-card border-2 px-4 py-3 text-left transition " +
        (disabled
          ? "cursor-not-allowed border-surface-200 bg-surface-50 text-surface-400 dark:border-surface-700 dark:bg-surface-800/50 dark:text-surface-500"
          : "border-brand-500 bg-brand-50 text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-200 dark:hover:bg-brand-900/40")
      }
    >
      <span className="font-display text-sm font-semibold leading-tight">{label}</span>
      {hint && <span className="text-xs font-normal opacity-80">{hint}</span>}
    </button>
  );
}

/**
 * Wo khane jo mockup ke chaar button mein nahi hain magar hatae bhi
 * nahi ja sakte (rate ki tasdeeq, rawangi, bill, fasal uthana).
 *
 * Band halat mein ek hi lakeer mein apna haal bata dete hain. Yehi
 * malik ki asal shikayat ka jawab hai: khana khula rakhna hi wo cheez
 * thi jo safhe ko "mushkil" bana rahi thi -- magar khana hata dena us
 * se bura hota, kyunke phir raasta hi na rehta.
 */
function Compact({
  title,
  summary,
  tone,
  open,
  children,
}: {
  title: string;
  summary: string;
  tone: "done" | "todo";
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <details open={open}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span
              className={
                "flex h-5 w-5 items-center justify-center rounded-full " +
                (tone === "done" ? "bg-brand-600 text-white" : "bg-surface-300 text-white dark:bg-surface-600")
              }
            >
              {tone === "done" ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
            </span>
            <span className="font-display text-sm font-semibold text-surface-900 dark:text-surface-100">{title}</span>
          </span>
          <span className="text-right text-xs text-surface-500">{summary}</span>
        </summary>
        <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">{children}</div>
      </details>
    </Card>
  );
}

/**
 * Ek khana jo button dabane par khulta hai.
 *
 * Andar koi naya form nahi banta -- wohi purane form yahan utar aate
 * hain. Is parat ka kaam sirf itna hai ke form us waqt saamne aaye jab
 * banda us ka naam khud dabaye.
 */
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Escape par band. Chhota sa raasta, magar us ke baghair mobile par
  // banda phansa hua mehsoos karta hai.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6">
      {/* Peeche dabane par band -- magar andar dabane par nahi, warna
          form bharte hue ek ghalat click sab mita deta hai. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 my-auto w-full max-w-2xl rounded-card border border-surface-200 bg-white p-4 shadow-xl dark:border-surface-700 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-surface-100 pb-2 dark:border-surface-800">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            aria-label="Band karein"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Add Payment ka andar wala hissa -- pehle ye poochha jata hai ke paisa
 * KIS raaste se aa raha hai, phir wohi purana form khulta hai.
 *
 * Har raasta apne mojooda action par jata hai (B.1 ka naqsha):
 *   Farmer se advance        -> `recordAdvance`
 *   Farmer se bill ki adaigi -> `recordFinalPayment` (khud PaymentForm)
 *   ART se Vendor ko         -> `recordVendorPayout`
 *
 * Jo raasta is waqt mumkin nahi wo fehrist mein aata hi nahi -- band
 * raasta dikha kar "kyun nahi" ka sawal khara karna staff ka waqt
 * khata hai.
 */
function AddPayment({
  booking,
  accounts,
  advanceTotal,
  bill,
  balance,
  confirmed,
  reminders,
  vendorName,
  vendorRemaining,
  paidToVendor,
}: {
  booking: Booking;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  advanceTotal: number;
  bill: { bill_number: string } | null;
  balance: number | null;
  confirmed: boolean;
  reminders: Array<{ id: string; status: string; error: string | null; sentAt: string; bySystem: boolean }>;
  vendorName: string | null;
  vendorRemaining: number;
  paidToVendor: number;
}) {
  const lang = useLang();
  // Advance ek hi dafa. Bill ban jane ke baad us ka darwaza band: us ke
  // baad jo paisa aata hai wo advance nahi, bill ki adaigi hai.
  const canAdvance = advanceTotal === 0 && !bill;
  // Baqi kuch na ho to adaigi ka khana nahi khulta -- bilkul waise hi
  // jaise pehle safhe par khulta hi nahi tha. Khula hua khana jahan
  // kuch dena hi na ho wahan sirf ek raasta banata hai: zyada paisa
  // darj ho jana, aur phir us ko wapas nikalna.
  const canFinal = Boolean(bill) && (balance ?? 0) > 0;
  const canVendor = Boolean(bill) && vendorRemaining > 0;

  const options: Array<{ key: string; label: string; hint: string }> = [];
  if (canAdvance) options.push({ key: "advance", label: "Farmer se advance", hint: "Bill se pehle" });
  if (canFinal) options.push({ key: "final", label: "Farmer se bill ki payment", hint: `Baqi Rs ${(balance ?? 0).toLocaleString()}` });
  if (canVendor)
    options.push({
      key: "vendor",
      label: `ART se ${vendorName ?? "Vendor"} ko`,
      hint: `Dena Rs ${vendorRemaining.toLocaleString()}`,
    });

  const [choice, setChoice] = useState<string | null>(options.length === 1 ? options[0].key : null);

  if (options.length === 0) {
    return (
      <div className="space-y-2 text-sm text-surface-600 dark:text-surface-300">
        {advanceTotal > 0 && !bill ? (
          <p>{t("mc_advance_already", lang)}</p>
        ) : bill ? (
          <p>Is booking par koi adaigi baqi nahi.</p>
        ) : (
          <p>{t("mc_advance_after_bill", lang)}</p>
        )}
        {!confirmed && <p className="text-xs text-surface-500">{t("mb_gate_note", lang)}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Paisa kis raaste se?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setChoice(o.key)}
                className={
                  "rounded-lg border px-3 py-2 text-left text-sm " +
                  (choice === o.key
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-200"
                    : "border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800")
                }
              >
                <span className="block font-medium">{o.label}</span>
                <span className="block text-xs text-surface-500">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {choice && <div className="border-t border-surface-100 pt-3 dark:border-surface-800" />}

      {/* Neeche har soorat mein WOHI purana form hai jo pehle StepCard
          mein khula rehta tha. Koi naya action nahi. */}
      {choice === "advance" &&
        (booking.advance_declined_at ? (
          /* Kisan ne booking par hi mana kar diya tha. Wo jawab mehfooz
             hai -- to sawal dobara nahi poochha jata. */
          <AdvanceDeclined bookingId={booking.id} accounts={accounts} />
        ) : (
          <AdvanceForm bookingId={booking.id} accounts={accounts} />
        ))}

      {choice === "final" && (
        <FinalPaymentStep
          bookingId={booking.id}
          accounts={accounts}
          remaining={balance ?? 0}
          promiseDate={booking.payment_promise_date}
          promiseNote={booking.payment_promise_note}
          willSell={booking.will_sell_to_us}
          reminders={reminders}
        />
      )}

      {choice === "vendor" && (
        <VendorPayoutForm
          bookingId={booking.id}
          accounts={accounts}
          remaining={vendorRemaining}
          paidSoFar={paidToVendor}
          vendorName={vendorName}
        />
      )}

      {/* Vendor ne hamein cash wapas diya ho to wo is booking ka nahi,
          vendor ke apne khate ka maamla hai -- aur wahan wo khud tasdeeq
          karta hai. Is liye yahan sirf raasta dikhaya jata hai, dobara
          khana nahi banaya jata. */}
      <p className="border-t border-surface-100 pt-2 text-xs text-surface-500 dark:border-surface-800">
        Vendor ne hamein paisa wapas diya ho to wo yahan nahi —{" "}
        <Link href="/admin/machinery-rental/vendor-cash" className="underline hover:text-surface-700">
          {t("mc_vendor_khata_link", lang)}
        </Link>
      </p>
    </div>
  );
}

/**
 * Settlement ki lakeerein -- EK jagah likhi hui.
 *
 * Yehi lakeerein safhe ke neeche wale panel mein bhi hain aur "Close
 * Booking" ke khane mein bhi. Do jagah likhna wohi purana masla banata
 * (A.3/A.4 usi ko theek kar rahi hai): ek din ek jagah ka adad badalta
 * aur doosri jagah ka nahi, aur phir koi nahi bata sakta ke sach kaun sa
 * hai.
 *
 * Yahan koi nayi ginti nahi hoti (B.6) -- sab adad upar se aate hain.
 */
function SettlementRows({
  bill,
  paidTotal,
  balance,
  paidToVendor,
  vendorRemaining,
  vendorName,
  ourFuelExpense,
  ourFuelRecoverable,
  othersFuel,
}: {
  bill: { gross_amount: number; commission_percentage: number; commission_amount: number; vendor_payable: number } | null;
  paidTotal: number;
  balance: number | null;
  paidToVendor: number;
  vendorRemaining: number;
  vendorName: string | null;
  ourFuelExpense: number;
  ourFuelRecoverable: number;
  othersFuel: number;
}) {
  const lang = useLang();
  return (
    <div className="text-sm">
      {bill ? (
        <Row label="Total Bill" value={bill.gross_amount} />
      ) : (
        <Missing label="Total Bill" note="bill abhi nahi bana" />
      )}
      <Row label="Total Paid (advance + adaigi)" value={paidTotal} />
      {bill ? (
        <div className="flex justify-between py-0.5 font-medium">
          <span className="text-surface-700 dark:text-surface-200">Farmer Balance</span>
          <span className={(balance ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-brand-700 dark:text-brand-300"}>
            Rs {(balance ?? 0).toLocaleString()}
          </span>
        </div>
      ) : (
        <Missing label="Farmer Balance" note="bill ke baad" />
      )}

      <div className="my-2 border-t border-surface-100 dark:border-surface-800" />

      {bill ? (
        <>
          <Row label={`${vendorName ?? "Vendor"} ko dena (vendor payable)`} value={bill.vendor_payable} />
          {paidToVendor > 0 && <Row label={t("mc_paid_so_far", lang)} value={-paidToVendor} />}
          <div className="flex justify-between py-0.5 font-medium">
            <span className="text-surface-700 dark:text-surface-200">Vendor Balance</span>
            <span className={vendorRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-brand-700 dark:text-brand-300"}>
              Rs {vendorRemaining.toLocaleString()}
            </span>
          </div>
        </>
      ) : (
        <Missing label="Vendor Payable" note="bill ke baad" />
      )}

      <div className="my-2 border-t border-surface-100 dark:border-surface-800" />

      {/* Diesel ek adad nahi, teen alag cheezein hain (170). Teenon ko
          jorh kar "Diesel Cost" likh dena hamare munafe ko jhoota kar
          deta hai: vendor ki machine par diya hua diesel hamara kharcha
          hai hi nahi -- wo us ke hisse se wapas aata hai. */}
      <Row label="Diesel — ART ka apna kharcha" value={ourFuelExpense} />
      <Row label="Diesel — vendor se wasool hona hai" value={ourFuelRecoverable} />
      <Row label="Diesel — farmer/vendor ka apna" value={othersFuel} />

      <div className="my-2 border-t border-surface-100 dark:border-surface-800" />

      {bill ? (
        <div className="flex justify-between py-0.5 font-display font-semibold">
          <span>ART Commission ({bill.commission_percentage}%)</span>
          <span className="text-brand-700 dark:text-brand-300">Rs {bill.commission_amount.toLocaleString()}</span>
        </div>
      ) : (
        <Missing label="ART Commission" note="bill ke baad" />
      )}
    </div>
  );
}

/**
 * Jis adad ka abhi wajood hi nahi, us ke saamne "Rs 0" likhna jhoot hai.
 * Sifar kehta hai "dekh liya, kuch nahi bana" -- yahan baat ye hai ke
 * hisaab abhi bana hi nahi.
 */
function Missing({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-surface-600 dark:text-surface-300">{label}</span>
      <span className="text-surface-400 dark:text-surface-500">— {note}</span>
    </div>
  );
}

/**
 * "Confirm & Close".
 *
 * Ye khud koi shart nahi parakhta. Band ho sakti hai ya nahi -- wo
 * faisla `fn_machinery_booking_guard` ka hai (bill maujood ho, aur
 * farmer ka balance sifar ho), aur wohi apne alfaz mein mana karta hai.
 * Wahi shart yahan dobara likhna do-jagah-hisaab ki shuruaat hoti.
 *
 * Upar summary pehle hi saara hisaab dikha chuki hoti hai, is liye rok
 * lagne par banda hairaan nahi hota -- wajah us ke saamne thi.
 *
 * Vendor ka balance band hone ki shart nahi hai (aaj bhi nahi) --
 * dikhta hai magar rokta nahi.
 */
function CloseBookingForm({
  bookingId,
  bill,
  balance,
  vendorRemaining,
}: {
  bookingId: string;
  bill: boolean;
  balance: number | null;
  vendorRemaining: number;
}) {
  const [state, action] = useFormState(closeBookingIfSettled, initialState);
  const settled = bill && (balance ?? 0) <= 0;
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      {!bill ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          Bill banaye baghair booking band nahi ki ja sakti.
        </p>
      ) : (balance ?? 0) > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          Kisan ka Rs {(balance ?? 0).toLocaleString()} abhi baqi hai — pehle wo adaigi darj karein.
        </p>
      ) : vendorRemaining > 0 ? (
        <p className="rounded-lg border border-surface-200 bg-surface-50 p-2 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/50 dark:text-surface-300">
          Kisan ka hisaab barabar hai. Vendor ka Rs {vendorRemaining.toLocaleString()} abhi baqi hai — ye booking band
          hone se nahi rokta, magar wo raqam vendor ke khate par khari rahegi.
        </p>
      ) : null}
      <Submit label="Confirm & Close" disabled={!settled} />
    </form>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "green" | "amber" | "red" | "gray"; hint?: string }) {
  const color =
    tone === "green" ? "text-brand-700 dark:text-brand-300"
    : tone === "amber" ? "text-wheat-600 dark:text-wheat-400"
    : tone === "red" ? "text-red-600 dark:text-red-400"
    : "text-surface-900 dark:text-surface-100";
  return (
    <div>
      <p className="text-xs text-surface-500">{label}</p>
      <p className={`font-display text-base font-semibold ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-surface-400">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  // Manfi sifar ko sifar likha jaye: kharche wali lakeerein `value={-x}`
  // bhejti hain, aur x sifar ho to JavaScript mein `-0` banta hai. `-0 < 0`
  // GHALAT hai, is liye neeche wali shart usay manfi nahi samajhti aur
  // seedha "-0" chhaap deti hai. Paise ke safhe par "Rs -0" parh kar banda
  // rukta hai aur sochta hai kya cheez manfi hai. Kuch bhi nahi.
  const v = value === 0 ? 0 : value;
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-surface-600 dark:text-surface-300">{label}</span>
      <span className={v < 0 ? "text-surface-500" : "text-surface-900 dark:text-surface-100"}>
        {v < 0 ? "−" : ""}Rs {Math.abs(v).toLocaleString()}
      </span>
    </div>
  );
}

/* `StepCard` yahan se hata diya gaya (14 September).
 *
 * Ye wo khana tha jo har qadam ke liye HAMESHA khula rehta tha -- aathon
 * ek sath, chahe kaam ho chuka ho. Malik ki asal shikayat wohi thi:
 * "booking wala kaam bohat mushkil bana diya hai." Us ki jagah ab teen
 * cheezein hain: chaar bade button (jo khana khud kholte hain), `Compact`
 * (jo band rehta hai aur ek lakeer mein apna haal bata deta hai), aur do
 * table (jo ho chuka wo dikhati hain).
 *
 * Andar ke saare form wohi hain -- ek bhi action nahi badla. */
function Eff({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-50 px-2 py-1.5 dark:bg-surface-800">
      <p className="text-xs text-surface-500">{label}</p>
      <p className="font-display font-semibold text-surface-900 dark:text-surface-100">{value}</p>
    </div>
  );
}


// ---------------------------------------------------------------------

/**
 * Kisan ne booking par kaha tha: advance nahi.
 *
 * Wo jawab aa chuka hai, is liye ye qadam poora hai -- khali nahi.
 * Safha wohi sawal dobara nahi poochhta: jo baat kisan pehle keh
 * chuka hai, us ko dobara poochhna staff ko ye shak deta hai ke
 * shayad pehle wala darj hi nahi hua, aur wohi shak ek hi raqam do
 * dafa likhwa deta hai.
 *
 * Phir bhi paisa aa jaye to raasta band nahi -- magar wo staff ke
 * kehne par khulta hai, safhe ke poochhne par nahi.
 */
/**
 * "Wapis" ka button.
 *
 * Sirf un jagahon par lagta hai jahan ek CLICK ne nishan laga diya tha
 * aur paisa hila hi nahi. Jahan paisa hil chuka ho wahan ye nahi aata
 * -- wahan reversal ka apna nizaam hai (156), jahan qatar mitai nahi
 * jati balke ulti qatar lagti hai.
 *
 * Poochh kar hi chalta hai: ye bhi ek hi click hai, aur wohi ghalti
 * dobara na ho.
 */
function DieselNone({ bookingId }: { bookingId: string }) {
  const lang = useLang();
  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/50 dark:text-surface-300">
        {t("mc_diesel_none_done", lang)}
      </p>
      {/* Yahan bhi paisa hila hi nahi -- sirf ek jawab likha gaya tha --
          is liye usay wapis lena mehfooz hai. */}
      <UndoButton bookingId={bookingId} action={undoDieselNone} label={t("mc_diesel_none_undo", lang)} />
    </div>
  );
}

function MarkDieselNoneButton({ bookingId }: { bookingId: string }) {
  const lang = useLang();
  const [state, formAction] = useFormState(markDieselNone, initialState);
  if (state.error) return <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>;
  return (
    <form action={formAction}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        className="flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
      >
        <CheckCircle2 className="h-4 w-4" />
        {t("mc_diesel_none_mark", lang)}
      </button>
    </form>
  );
}

function YesNo({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
      }
    >
      {children}
    </button>
  );
}

function UndoButton({
  bookingId,
  action,
  label,
}: {
  bookingId: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  label: string;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(action, initialState);
  const [asking, setAsking] = useState(false);

  if (state.error) {
    return <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>;
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="flex items-center gap-1 text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
      >
        <Undo2 className="h-3 w-3" />
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <span className="text-xs text-surface-600 dark:text-surface-400">{t("mc_undo_sure", lang)}</span>
      <Submit label={t("mc_undo_yes", lang)} />
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="text-xs text-surface-500 underline hover:text-surface-700"
      >
        {t("mc_undo_no", lang)}
      </button>
    </form>
  );
}

function AdvanceDeclined({
  bookingId,
  accounts,
}: {
  bookingId: string;
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);

  if (open) return <AdvanceForm bookingId={bookingId} accounts={accounts} />;

  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/50 dark:text-surface-300">
        {t("mc_advance_declined", lang)}
      </p>
      {/* Ghalti se laga hua nishan wapis. Yahan paisa hila hi nahi --
          sirf ek jawab likha gaya tha -- is liye wapis lena mehfooz
          hai. Jahan paisa hil chuka ho wahan ye button nahi aata. */}
      <UndoButton
        bookingId={bookingId}
        action={undoAdvanceDeclined}
        label={t("mc_undo_declined", lang)}
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
      >
        {t("mc_advance_came_later", lang)}
      </button>
    </div>
  );
}

function AdvanceForm({ bookingId, accounts }: { bookingId: string; accounts: Array<{ id: string; name: string; account_type: string }> }) {
  const lang = useLang();
  const [state, action] = useFormState(recordAdvance, initialState);
  const [method, setMethod] = useState("cash");
  const [evidence, setEvidence] = useState("");
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      {/* Advance lazmi nahi. Bohat si bookings bina advance ke hoti
          hain -- kisan kehta hai kaam ke baad de dunga. Ye qadam pehla
          hai is liye lagta tha ke ise bharay baghair aage nahi ja
          sakte, aur khali form bhejne par ek laal error milta tha jo is
          ghalat fehmi ko pakka kar deta. */}
      <p className="text-xs text-surface-500">{t("mc_advance_optional", lang)}</p>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="evidence_url" value={evidence} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_amount", lang)}</Label>
          <Input type="number" name="amount" step="0.01" />
        </div>
        <div>
          <Label>{t("mc_method", lang)}</Label>
          <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">{t("mc_cash", lang)}</option>
            <option value="bank">{t("mc_bank", lang)}</option>
            <option value="wallet">{t("mc_wallet", lang)}</option>
            <option value="other">{t("mc_other", lang)}</option>
          </Select>
        </div>
      </div>

      {/* Cash par khata nahi poochha jata -- wo lene wale ke naam par
          khara hota hai (171). Us ki jagah sirf ye poochha jata hai ke
          kahan liya. */}
      {method === "cash" ? (
        <div>
          <Label>{t("mc_cash_where", lang)}</Label>
          <Select name="received_location" defaultValue="office">
            <option value="office">{t("mc_cash_office", lang)}</option>
            <option value="field">{t("mc_cash_field", lang)}</option>
          </Select>
          <p className="mt-1 text-xs text-surface-500">{t("mc_cash_custody_note", lang)}</p>
        </div>
      ) : (
        <div>
          <Label>{t("mc_khata", lang)}</Label>
          <Select name="finance_account_id" defaultValue="">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.account_type})
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_date", lang)}</Label>
          <Input type="date" name="payment_date" defaultValue={aajKaKhana()} />
        </div>
        <div>
          <Label>{t("mc_reference", lang)}</Label>
          <Input name="reference" />
        </div>
      </div>
      <PaymentSlipUpload onUploaded={setEvidence} />
      <Submit label={t("mc_record_advance", lang)} />
    </form>
  );
}

function RateConfirmationForm({
  bookingId,
  defaultRate,
  harvestType,
  sabitArea,
  kutraArea,
  totalArea,
  defaultSabitRate,
  defaultKutraRate,
}: {
  bookingId: string;
  defaultRate: number | null;
  harvestType: string | null;
  sabitArea: number | null;
  kutraArea: number | null;
  totalArea: number | null;
  defaultSabitRate: number | null;
  defaultKutraRate: number | null;
}) {
  const lang = useLang();
  const [state, action] = useFormState(sendRateConfirmation, initialState);

  // Rate aksar booking BANATE WAQT hi tay ho chuka hota hai (177 ka
  // rate card, ya staff ka apna likha hua). Ye qadam use dobara nahi
  // poochhta -- wahi rate saamne rakhta hai, badalne ki gunjaish ke
  // sath, aur us se banne wala kul kharcha bhi.
  const isDono = harvestType === "dono";
  const [sRate, setSRate] = useState(String(defaultSabitRate ?? ""));
  const [kRate, setKRate] = useState(String(defaultKutraRate ?? ""));
  const [oneRate, setOneRate] = useState(String(defaultRate ?? ""));
  const [sendAs, setSendAs] = useState<"rate" | "total">("rate");

  const sA = Number(sabitArea ?? 0);
  const kA = Number(kutraArea ?? 0);
  const area = isDono ? sA + kA : Number(totalArea ?? 0);

  const sabitRaqam = Math.round(sA * (Number(sRate) || 0));
  const kutraRaqam = Math.round(kA * (Number(kRate) || 0));
  const total = isDono ? sabitRaqam + kutraRaqam : Math.round(area * (Number(oneRate) || 0));
  const avg = area > 0 ? Math.round((total / area) * 100) / 100 : 0;

  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="send_as" value={sendAs} />

      {isDono ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>
              {t("mh_sabit", lang)} — {sA} {t("md_acres_short", lang)}
            </Label>
            <Input type="number" name="sabit_rate" step="0.01" value={sRate} onChange={(e) => setSRate(e.target.value)} />
            <p className="mt-1 text-xs text-surface-500">Rs / {t("md_acres_short", lang)}</p>
          </div>
          <div>
            <Label>
              {t("mh_kutra", lang)} — {kA} {t("md_acres_short", lang)}
            </Label>
            <Input type="number" name="kutra_rate" step="0.01" value={kRate} onChange={(e) => setKRate(e.target.value)} />
            <p className="mt-1 text-xs text-surface-500">Rs / {t("md_acres_short", lang)}</p>
          </div>
        </div>
      ) : (
        <div>
          <Label>{t("mc_final_rate_per_acre", lang)}</Label>
          <Input type="number" name="final_rate" step="0.01" value={oneRate} onChange={(e) => setOneRate(e.target.value)} />
        </div>
      )}

      {(defaultSabitRate !== null || defaultRate !== null) && (
        <p className="text-xs text-surface-500">{t("mrx_from_booking", lang)}</p>
      )}

      {/* Kul kharcha saamne. Pehle sirf per acre rate dikhta tha, aur
          kisan ka pehla sawal hamesha "kitne paise banenge" hota hai. */}
      {total > 0 && (
        <div className="rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800">
          {isDono && (
            <>
              <div className="flex justify-between text-xs text-surface-600 dark:text-surface-400">
                <span>
                  {t("mh_sabit", lang)}: {sA} × Rs {(Number(sRate) || 0).toLocaleString()}
                </span>
                <span>Rs {sabitRaqam.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-surface-600 dark:text-surface-400">
                <span>
                  {t("mh_kutra", lang)}: {kA} × Rs {(Number(kRate) || 0).toLocaleString()}
                </span>
                <span>Rs {kutraRaqam.toLocaleString()}</span>
              </div>
              <div className="my-1 border-t border-surface-200 dark:border-surface-700" />
              <div className="flex justify-between text-xs text-surface-600 dark:text-surface-400">
                <span>{t("mrx_avg", lang)}</span>
                <span>Rs {avg.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-display font-semibold text-surface-900 dark:text-white">
            <span>{t("mrx_total", lang)}</span>
            <span>Rs {total.toLocaleString()}</span>
          </div>
          <p className="mt-1 text-xs text-surface-500">{t("mrx_on_booked", lang)}</p>
        </div>
      )}

      {/* Kuch kisan rate se samajhte hain, kuch sirf kul raqam se.
          Dono adad paighaam mein jate hain -- sirf pehli lakeer badalti
          hai, taake wo cheez upar ho jo us kisan ko samajh aati hai. */}
      <div>
        <Label>{t("mrx_send_as", lang)}</Label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSendAs("rate")}
            className={
              sendAs === "rate"
                ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg bg-surface-100 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"
            }
          >
            {t("mrx_send_rate", lang)}
          </button>
          <button
            type="button"
            onClick={() => setSendAs("total")}
            className={
              sendAs === "total"
                ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg bg-surface-100 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"
            }
          >
            {t("mrx_send_total", lang)}
          </button>
        </div>
        <p className="mt-1 text-xs text-surface-500">{t("mrx_both_go", lang)}</p>
      </div>

      <p className="text-xs text-surface-500">
        Bhejte hi purani tasdeeq (agar thi) khatam ho jayegi — warna kisan ne kisi aur rate par haan ki hoti aur record
        naye rate par &ldquo;tasdeeq shuda&rdquo; dikhata rehta.
      </p>
      <Submit label={t("mc_send_rate_confirmation", lang)} />
    </form>
  );
}

function FarmerResponseForm({ bookingId }: { bookingId: string }) {
  const lang = useLang();
  const [state, action] = useFormState(recordFarmerConfirmation, initialState);
  const [decision, setDecision] = useState("");
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="decision" value={decision} />

      {/* Faisla pehle, jumla baad mein.
          Kisan ne haan ki ya aitraaz -- ye us bande ko maloom hai jo
          phone par tha. Pehle ye jumle se andaza lagaya jata tha, aur
          "call" jaisa lafz aitraaz ban jata tha. */}
      <div>
        <Label>{t("mc_farmer_decision", lang)}</Label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setDecision("accept")}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              decision === "accept"
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30"
                : "border-surface-200 text-surface-500 dark:border-surface-700"
            }`}
          >
            {t("mc_farmer_said_yes", lang)}
          </button>
          <button
            type="button"
            onClick={() => setDecision("issue")}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              decision === "issue"
                ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30"
                : "border-surface-200 text-surface-500 dark:border-surface-700"
            }`}
          >
            {t("mc_farmer_objected", lang)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_how_reply_came", lang)}</Label>
          <Select name="channel" defaultValue="whatsapp">
            <option value="whatsapp">{t("at_whatsapp", lang)}</option>
            <option value="call">{t("mc_phone_call", lang)}</option>
            <option value="in_person">{t("mc_in_person", lang)}</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>{t("mc_what_farmer_said", lang)}</Label>
        <Textarea name="response" rows={2} placeholder={t("mc_what_farmer_said_hint", lang)} />
      </div>
      <Submit label={t("mc_record_reply", lang)} />
    </form>
  );
}

function OverrideForm({ bookingId }: { bookingId: string }) {
  const lang = useLang();
  const [state, action] = useFormState(overrideConfirmation, initialState);
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("mc_override_title", lang)}
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-lg border border-amber-200 p-3 dark:border-amber-900/40">
      <Err state={state} />
      <p className="text-sm text-amber-800 dark:text-amber-300">
        Ye kisan ki tasdeeq ke baghair aage barhna hai. Wajah aur saboot dono lazmi hain, aur ye admin ko ittila bhi
        bhejta hai.
      </p>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="evidence_url" value={evidence} />
      <div>
        <Label>{t("mc_reason", lang)}</Label>
        <Textarea name="reason" rows={2} placeholder={t("mc_override_placeholder", lang)} />
      </div>
      <PaymentSlipUpload onUploaded={setEvidence} />
      <div className="flex gap-2">
        <Submit label={t("mc_override_do", lang)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function DispatchForm({
  bookingId,
  machines,
  already,
  harvestDate,
  bookingAcres,
}: {
  bookingId: string;
  machines: Array<{
    id: string;
    label: string;
    driverName: string;
    driverPhone: string;
    /** Us din us machine ka bojh (180). Na maloom ho to null. */
    capacity: number | null;
    booked: number | null;
    free: number | null;
  }>;
  already: boolean;
  harvestDate: string | null;
  bookingAcres: number;
}) {
  const lang = useLang();
  const [state, action] = useFormState(dispatchMachine, initialState);
  const [again, setAgain] = useState(false);

  // Machine chunte hi us din ka bojh saamne (180). Pehle ye adad sirf
  // ERROR ki shakl mein milta tha -- yani form bhar chukne ke baad, aur
  // kisan saamne khaRa hota. Ab pehle se nazar aata hai, aur staff
  // wahin faisla kar leta hai: is machine par bhejein ya tareekh badlein.
  const [pickedMachine, setPickedMachine] = useState("");

  // Driver machine ke sath likha hua hai (162), is liye machine
  // chunte hi wo khud aa jata hai. Khane phir bhi khule hain: kisi
  // din koi doosra le jata hai, aur us din sach wohi hai jo yahan
  // likha jaye.
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  // Rawangi darj ho chuki ho to form band. Diesel ke liye neeche apna
  // qadam hai -- pehle log yahi form dobara bhar dete the.
  if (already && !again) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-surface-500">{t("mc_dispatch_done_hint", lang)}</p>
        <button
          type="button"
          onClick={() => setAgain(true)}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          {t("mc_dispatch_again", lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Err state={state} />

      {/* Machine us din bhari thi -- to agli khali tareekh sirf batayi
          nahi jati, wo yahin bhari ja sakti hai. System wo tareekh
          pehle se jaanta hai; use jumle mein likh kar bande se dobara
          likhwana wohi kaam do dafa karwana hai, aur ek adad ghalat
          likh dene ki gunjaish khuli chhorna hai. */}
      {state.nextFreeDate && <RescheduleForm bookingId={bookingId} nextFree={state.nextFreeDate} />}

      <form action={action} className="space-y-3">
        <input type="hidden" name="booking_id" value={bookingId} />
        {again && <input type="hidden" name="again" value="on" />}
      <div>
        <Label>{t("mc_machine", lang)}</Label>
        <Select
          name="machine_id"
          value={pickedMachine}
          onChange={(e) => {
            setPickedMachine(e.target.value);
            const m = machines.find((x) => x.id === e.target.value);
            setDriverName(m?.driverName ?? "");
            setDriverPhone(m?.driverPhone ?? "");
          }}
        >
          <option value="">—</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {/* Har machine ke naam ke sath us din ka bojh -- chunne se
                  pehle hi pata chal jaye ke kahan jagah hai. */}
              {m.capacity !== null ? `  ·  ${m.booked}/${m.capacity} acre bandhe` : ""}
            </option>
          ))}
        </Select>
        {/* Chuni hui machine ka us din ka poora hisaab -- saaf jumle
            mein, error se pehle. */}
        <MachineDayLoad
          machine={machines.find((m) => m.id === pickedMachine) ?? null}
          date={harvestDate}
          acres={bookingAcres}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_operator", lang)}</Label>
          <Input name="operator_name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
        </div>
        <div>
          <Label>{t("mc_driver_phone", lang)}</Label>
          <Input name="driver_phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
        </div>
      </div>
      {/* Shuru ka meter yahan se hata diya gaya.
          Kisi ne bhi wo kabhi nahi bhara -- machine nikalte waqt koi
          meter dekhne nahi jata. Aur us ki zaroorat bhi nahi: ghante
          kaam ke waqt se khud nikalte hain, aur machine ka meter kaam
          darj karte waqt likha jata hai. Jo khana hamesha khali rehta
          hai wo form ko lamba karta hai aur kuch nahi. */}
      <p className="text-xs text-surface-500">{t("mc_dispatch_no_diesel", lang)}</p>
        <Submit label={t("mc_record_dispatch", lang)} />
      </form>
    </div>
  );
}

/**
 * Agli khali tareekh par booking khiskana.
 *
 * Tareekh pehle se bhari hui hai -- wohi jo system ne nikali. Phir bhi
 * khana khula hai, kyunke agli khali tareekh sab se pehli mumkin
 * tareekh hai, hamesha sab se munasib nahi: kisan ki apni majboori ho
 * sakti hai. System tajweez deta hai, faisla insaan ka rehta hai.
 */
/**
 * Us machine par us din kitna bandha hua hai (180).
 *
 * Ye ROKTA nahi -- sirf batata hai. Malik ka faisla hai ke rok na ho;
 * manager kabhi doosri machine ka bandobast kar leta hai. Magar jo baat
 * DB error ke baad batayi jati thi, wo ab pehle nazar aa jati hai.
 */
/**
 * Waqt ka khana -- ek "Theek hai" ke sath.
 *
 * Browser ka apna calendar/ghari ka dabba hamara nahi hai; us ke andar
 * koi button daalna mumkin nahi. Magar us ko BAND karne ka saaf raasta
 * dena mumkin hai: "Theek hai" par khana chhoR diya jata hai aur dabba
 * apne aap band ho jata hai. Chuna hua waqt neeche saaf likha rehta hai
 * -- pehle wo sirf usi tang khane mein dikhta tha.
 */
function TimeField({
  name,
  value,
  onChange,
  min,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const lang = useLang();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex gap-2">
        <Input
          ref={ref}
          type="datetime-local"
          name={name}
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => ref.current?.blur()}
        >{t("mb_ok", lang)}</Button>
      </div>
      {value && (
        <p className="mt-1 text-xs text-surface-500">
          {new Date(value).toLocaleString(undefined, {
            weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}

function MachineDayLoad({
  machine,
  date,
  acres,
}: {
  machine: { label: string; capacity: number | null; booked: number | null; free: number | null } | null;
  date: string | null;
  acres: number;
}) {
  const lang = useLang();
  if (!machine || machine.capacity === null || !date) return null;

  const capacity = machine.capacity;
  const booked = machine.booked ?? 0;
  const free = machine.free ?? 0;

  if (capacity === 0) {
    return (
      <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">{t("mb_machine_unfit", lang)}</p>
    );
  }

  const fits = acres <= free + 0.001;
  const pct = Math.min(Math.round((booked / capacity) * 100), 100);

  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
        fits
          ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
          : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
      }`}
    >
      <p className={fits ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}>
        <strong>{date}</strong>{t("mb_on_this_machine", lang)}<strong>{booked} / {capacity} acre</strong> bandhe hain —{" "}
        <strong>{free} acre</strong> bachi hai. Ye booking {acres} acre ki hai.
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/70 dark:bg-surface-800">
        <div
          className={`h-full rounded-full ${fits ? "bg-green-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!fits && (
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          Jagah kam hai. Doosri machine ya doosri tareekh behtar hai — warna manager ki ijazat aur wajah darj karni
          hogi.
        </p>
      )}
    </div>
  );
}

function RescheduleForm({ bookingId, nextFree }: { bookingId: string; nextFree: string }) {
  const lang = useLang();
  const [state, action] = useFormState(rescheduleBooking, initialState);

  if (state.success) {
    return (
      <p className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-200">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <Label>{t("mc_move_to_date", lang)}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" name="preferred_date" defaultValue={nextFree} className="max-w-[200px]" />
        <Submit label={t("mc_move_booking", lang)} />
      </div>
    </form>
  );
}

/**
 * Diesel ka indraj -- jitni baar dala jaye.
 *
 * Ye alag qadam is liye hai ke diesel ek dafa nahi dala jata: 20 acre
 * ki kattai teen din chalti hai, beech mein hum daalte hain, agle din
 * kisan khud dalwa deta hai.
 */
function FuelForm({
  bookingId,
  accounts,
  already,
}: {
  bookingId: string;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  already: boolean;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordFuelEntry, initialState);

  // Raqam ka khana yahan se hata diya gaya.
  //
  // Ab litre aur us din ka rate poochhe jate hain, aur raqam khud
  // banti hai -- sirf dikhane ke liye yahan, aur asal mein DB par
  // (170). Haath se likhi hui raqam wo jagah hai jahan ek sifar
  // zyada lag jata hai aur kisi ko pata nahi chalta.
  //
  // Aur us se do adad kabhi nahi milte jo asal mein chahiye hote
  // hain: litre per acre, aur kis din kis rate par liya.
  const [litres, setLitres] = useState("");
  const [rate, setRate] = useState("");
  const total = Number(litres) > 0 && Number(rate) > 0 ? Number(litres) * Number(rate) : null;
  const [paidBy, setPaidBy] = useState("");
  const [more, setMore] = useState(false);

  // Ek dafa darj hone ke baad form band. Khula hua form wohi ghalti
  // dobara karwata hai jo rawangi par hui thi: aadmi samajhta hai ke
  // shayad pichhla gaya hi nahi, aur wohi diesel do dafa kharche mein
  // chala jata hai. Mazeed diesel dala ho to jaan boojh kar maangna
  // parta hai.
  const closed = (already || state.success) && !more;

  if (closed) {
    return (
      <div className="space-y-2">
        {state.notice && (
          <p className="rounded border border-brand-200 bg-brand-50 p-2 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300">
            {state.notice}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setMore(true);
            setPaidBy("");
          }}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          + {t("mc_fuel_add_more", lang)}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-xs text-surface-500">{t("mc_fuel_hint", lang)}</p>

      {/* Raqam saamne dikhti hai magar bhari nahi jati -- wo litre aur
          rate se khud banti hai. Banda dekh sakta hai ke jo wo likh
          raha hai us ka natija kya hoga, magar us natije ko haath
          nahi laga sakta. */}
      {total !== null && (
        <p className="rounded-lg bg-surface-50 px-3 py-2 text-sm dark:bg-surface-800">
          {litres} × Rs {rate} ={" "}
          <strong className="font-display">Rs {total.toLocaleString()}</strong>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_date", lang)}</Label>
          <Input type="date" name="log_date" defaultValue={aajKaKhana()} />
        </div>
        <div>
          <Label>{t("mc_diesel_litre", lang)} *</Label>
          <Input type="number" name="litres" step="0.01" value={litres} onChange={(e) => setLitres(e.target.value)} />
        </div>
        <div>
          <Label>{t("mc_diesel_rate", lang)} *</Label>
          <Input type="number" name="rate_per_litre" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div>
          <Label>{t("mc_diesel_paid_by", lang)}</Label>
          {/* "Driver" screen par alag dikhta hai magar peeche wohi
              `vendor` hai (B.2).

              Malik ne driver ko chautha payer maanga tha. Us ke liye
              `paid_by` mein naya qadar daalna sab se mehnga raasta hota:
              har wo view aur guard jo aaj `company | vendor | farmer`
              ginta hai (diesel ki wasooli, vendor settlement, P&L) chup
              chaap us qatar ko chhoR deta -- aur diesel gum ho jata.
              Driver vendor ka apna aadmi hai, us ka diya hua diesel
              vendor ke hisse se hi wapas aata hai, is liye hisaab dono
              soorton mein bilkul ek jaisa hai. Farq sirf lafz ka hai,
              aur lafz yahin rehta hai. */}
          <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="">—</option>
            <option value="farmer">{t("mc_diesel_by_farmer", lang)}</option>
            <option value="vendor">{t("mc_diesel_by_vendor", lang)}</option>
            <option value="driver">Driver</option>
            <option value="company">{t("mc_diesel_by_company", lang)}</option>
          </Select>
          <input type="hidden" name="paid_by" value={paidBy === "driver" ? "vendor" : paidBy} />
        </div>
      </div>
      {paidBy === "driver" && (
        <p className="text-xs text-surface-500">
          Driver ka diya hua diesel vendor ke khate mein darj hota hai — wo vendor ka apna aadmi hai, aur ye raqam usi
          ke hisse se wapas aati hai.
        </p>
      )}
      {paidBy === "company" && (
        <div>
          <Label>{t("mc_diesel_account", lang)}</Label>
          <Select name="finance_account_id" defaultValue="">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
      )}
      {paidBy && paidBy !== "company" && (
        <p className="text-xs text-surface-500">{t("mc_diesel_not_ours", lang)}</p>
      )}
      <div className="flex gap-2">
        <Submit label={t("mc_fuel_save", lang)} />
        {already && (
          <button
            type="button"
            onClick={() => setMore(false)}
            className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700"
          >
            {t("ac_cancel", lang)}
          </button>
        )}
      </div>
    </form>
  );
}

function WorkForm({
  bookingId,
  estimated,
  done,
  harvestType,
  accounts,
  defaultFinal,
}: {
  bookingId: string;
  estimated: number;
  done: number;
  harvestType: string | null;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  /**
   * "Mark Work Complete" wale khane se aaye to nishan pehle se laga hua
   * aata hai -- button ka naam wohi keh raha hai. Banda phir bhi utaar
   * sakta hai: aadha din ka kaam darj karna ho to wo bhi isi khane se
   * hota hai.
   */
  defaultFinal?: boolean;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordWorkCompletion, initialState);
  const [photo, setPhoto] = useState("");
  const [isFinal, setIsFinal] = useState(Boolean(defaultFinal));
  const [reminder, setReminder] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  // Baqi tafseel shuru mein band rehti hai. Wajah: is form mein sirf EK
  // cheez lazmi hai -- asal raqba. Waqt, meter aur tasveer madadgar hain
  // magar un ke baghair bhi kaam darj ho jata hai. Sab khane ek sath
  // saamne rakhne se banda samajhta hai ke sab bharna zaroori hai, aur
  // phir ya to andaze se bhar deta hai ya form chhoR deta hai. Dono
  // soorton mein record kharab hota hai.
  const [showMore, setShowMore] = useState(false);
  const [ourDiesel, setOurDiesel] = useState<"haan" | "nahi" | "">("");
  const [farmerDiesel, setFarmerDiesel] = useState<"haan" | "nahi" | "">("");

  // Do qism ki booking par ASAL kaam bhi do hisson mein likha jata hai
  // (176). Bill isi par banta hai -- booking par likhe andaze par nahi.
  const isDono = harvestType === "dono";
  const [acres, setAcres] = useState("");
  const [kanal, setKanal] = useState("");
  const [sabit, setSabit] = useState("");
  const [kutra, setKutra] = useState("");
  // Kanal alag se -- wohi wajah jo nayi booking wale form par likhi hai:
  // poora raqba acre aur kanal dono mein likha ja sakta hai, magar ye do
  // khane sirf acre maangte the.
  const [sabitK, setSabitK] = useState("");
  const [kutraK, setKutraK] = useState("");
  const total = Math.round(((Number(acres) || 0) + (Number(kanal) || 0) / 8) * 10000) / 10000;
  // Kanal ko acre mein badal kar jorte hain (8 kanal = 1 acre) -- taake
  // "do kanal kutra" likhne wale ko khud 0.25 nikalna na pare.
  const splitSabit = Math.round(((Number(sabit) || 0) + (Number(sabitK) || 0) / 8) * 10000) / 10000;
  const splitKutra = Math.round(((Number(kutra) || 0) + (Number(kutraK) || 0) / 8) * 10000) / 10000;
  const splitSum = Math.round((splitSabit + splitKutra) * 10000) / 10000;
  const splitOk = total > 0 && Math.round(splitSum * 10000) === Math.round(total * 10000);

  // Ghante haath se nahi likhe jate: shuru aur khatam ka waqt upar
  // likha ja chuka hai, aur do jagah likha hua ek hi adad kisi din
  // alag ho jata hai. Ye wahi hisaab hai jo database bhi karta hai
  // (155), yahan sirf likhte waqt saamne rakha ja raha hai.
  const hours =
    startAt && endAt && new Date(endAt) > new Date(startAt)
      ? Math.round(((new Date(endAt).getTime() - new Date(startAt).getTime()) / 3600000) * 100) / 100
      : null;

  // Waqt hamesha AAGE chalta hai. Khatam ka waqt shuru se pehle ho to
  // wo indraj sach ho hi nahi sakta -- aur DB bhi usay rok deta hai
  // (chk_machinery_work_time).
  //
  // Magar aksar ye ghalti nahi hoti: raat ka kaam adhi raat paar kar
  // jata hai. Raat 10 baje shuru aur "2 baje" khatam ka matlab AGLE DIN
  // ka 2 baje hai. Is liye yahan sirf rok nahi lagti -- agle din wala
  // waqt bana kar saamne rakh diya jata hai, ek click par lag jata hai.
  const backwards = !!startAt && !!endAt && new Date(endAt) <= new Date(startAt);
  const nextDayEnd =
    backwards && endAt
      ? (() => {
          const d = new Date(endAt);
          d.setDate(d.getDate() + 1);
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        })()
      : null;
  // Agle din ka waqt tabhi tajweez hota hai jab wo waqai maqool ho --
  // 24 ghante se lamba kaam ek din ka indraj nahi hai.
  const nextDayFits =
    nextDayEnd && startAt
      ? new Date(nextDayEnd).getTime() - new Date(startAt).getTime() <= 24 * 3600000
      : false;
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="completion_photo_url" value={photo} />
      <p className="text-xs text-surface-500">
        {done > 0
          ? `Booking par andaza ${estimated} acre tha, ab tak ${done} acre ho chuke. Yahan SIRF is din ka kaam likhein — jor khud ban jayega.`
          : `Booking par andaza ${estimated} acre tha. Yahan wohi likhein jo WAQAI kaata gaya — bill isi se banega.`}
      </p>
      {/* Sirf teen khane saamne: tareekh (khud bhari hui), aur asal
          raqba -- wohi ek cheez jis ke baghair indraj ban hi nahi
          sakta. Baqi sab neeche "aur tafseel" ke peeche hai. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_work_date", lang)}</Label>
          <Input type="date" name="work_date" defaultValue={aajKaKhana()} />
        </div>
        <div />
        <div>
          <Label>{t("mc_actual_area", lang)} *</Label>
          <Input
            type="number"
            name="actual_area_acres"
            step="0.01"
            value={acres}
            onChange={(e) => setAcres(e.target.value)}
          />
        </div>
        <div>
          <Label>{t("mc_kanal", lang)}</Label>
          <Input
            type="number"
            name="actual_area_kanal"
            step="0.01"
            value={kanal}
            onChange={(e) => setKanal(e.target.value)}
          />
        </div>
      </div>

      {/* Kattai kahan hui. Har indraj apni jagah ke sath mehfooz hota
          hai, is liye kaam kai jagah phaila ho to har din ka alag
          indraj apni apni pin rakhta hai -- aur "jahan jahan kattai
          hui" ka jawab khud ban jata hai.

          Ye khana khali chhoRa ja sakta hai. Jagah na maloom ho to
          khali rehna sach hai; koi andaze wali pin lagana us se bura
          hai, kyunke baad mein wo pin asal jagah samjhi jayegi. */}
      <div className="rounded-card border border-surface-200 p-3 dark:border-surface-700">
        <Label>{t("mc_work_where", lang)}</Label>
        <p className="mb-2 text-xs text-surface-500">{t("mc_work_where_hint", lang)}</p>
        <LocationPicker lang={lang} nameLat="location_lat" nameLng="location_lng" />
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
      >
        {showMore ? t("mc_work_less", lang) : t("mc_work_more", lang)}
      </button>

      {showMore && (
        <div className="grid grid-cols-2 gap-3 rounded-card border border-surface-200 p-3 dark:border-surface-700">
          <div>
            <Label>{t("mc_start", lang)}</Label>
            <TimeField name="started_at" value={startAt} onChange={setStartAt} />
          </div>
          <div>
            <Label>{t("mc_end", lang)}</Label>
            <TimeField name="finished_at" value={endAt} onChange={setEndAt} min={startAt || undefined} />
          </div>
          <div>
            <Label>{t("mc_meter_only", lang)}</Label>
            <Input type="number" name="meter_reading" step="0.01" />
            <p className="mt-1 text-xs text-surface-500">{t("mc_meter_only_hint", lang)}</p>
          </div>
          {/* Ghante haath se nahi likhe jate -- do waqt upar likhe ja
              chuke hain. Do jagah likha hua ek hi adad kisi din alag ho
              jata hai, aur phir koi nahi bata sakta ke sach kaun sa hai. */}
          <div>
            <Label>{t("mc_hours_worked", lang)}</Label>
            <p className="mt-1 rounded-lg border border-surface-200 bg-surface-50 p-2 text-sm dark:border-surface-700 dark:bg-surface-800">
              {hours !== null ? `${hours} ${t("mc_hours_unit", lang)}` : t("mc_hours_from_time", lang)}
            </p>
          </div>
          <div className="col-span-2">
            <PaymentSlipUpload onUploaded={setPhoto} />
          </div>
        </div>
      )}

      {/* Ulta waqt. Rok yahan bhi hai aur DB par bhi -- magar yahan us
          ke sath wo tareekh bhi hai jo staff ka asal matlab thi. */}
      {backwards && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-amber-800 dark:text-amber-300">{t("mb_time_backwards", lang)}</p>
          {nextDayEnd && nextDayFits && (
            <button
              type="button"
              onClick={() => setEndAt(nextDayEnd)}
              className="mt-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-brand-700 shadow-sm hover:bg-brand-50 dark:bg-surface-800 dark:text-brand-300"
            >
              Agle din ka {nextDayEnd.slice(11)} kar dein ({nextDayEnd.slice(0, 10)})
            </button>
          )}
        </div>
      )}

      {isDono && (
        <div className="space-y-2 rounded-card border border-surface-200 p-3 dark:border-surface-700">
          <p className="text-xs text-surface-500">{t("mh_split_hint", lang)}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("mh_actual_sabit", lang)}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.01" value={sabit} onChange={(e) => setSabit(e.target.value)} placeholder={t("md_acres_short", lang)} />
                <Input type="number" step="0.01" value={sabitK} onChange={(e) => setSabitK(e.target.value)} placeholder={t("mc_kanal", lang)} />
              </div>
              {/* Server ko sirf acre jata hai; kanal yahin badla jata hai. */}
              <input type="hidden" name="sabit_area" value={splitSabit || ""} />
            </div>
            <div>
              <Label>{t("mh_actual_kutra", lang)}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.01" value={kutra} onChange={(e) => setKutra(e.target.value)} placeholder={t("md_acres_short", lang)} />
                <Input type="number" step="0.01" value={kutraK} onChange={(e) => setKutraK(e.target.value)} placeholder={t("mc_kanal", lang)} />
              </div>
              <input type="hidden" name="kutra_area" value={splitKutra || ""} />
            </div>
          </div>
          <p className={splitOk ? "text-xs text-green-700 dark:text-green-400" : "text-xs text-amber-700 dark:text-amber-400"}>
            {t("mh_total_check", lang)}: {splitSum} / {total} {t("md_acres_short", lang)} —{" "}
            {splitOk ? t("mh_sum_ok", lang) : t("mh_sum_bad", lang)}
          </p>
        </div>
      )}

      {/* Diesel ka sawal ab yahin hai -- apne alag qadam mein nahi.
          Wahan wo booking bante hi khul jata tha, jab jawab kisi ke paas
          hota hi nahi tha. Do saaf sawal, dono haan/nahi. */}
      <div className="space-y-3 rounded-card border border-surface-200 p-3 dark:border-surface-700">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("mc_wd_heading", lang)}</p>
        <input type="hidden" name="diesel_asked" value="1" />

        <div>
          <p className="mb-1 text-sm text-surface-800 dark:text-surface-200">{t("mc_wd_our_q", lang)}</p>
          <div className="flex gap-2">
            <YesNo on={ourDiesel === "haan"} onClick={() => setOurDiesel("haan")}>{t("mc_yes", lang)}</YesNo>
            <YesNo on={ourDiesel === "nahi"} onClick={() => setOurDiesel("nahi")}>{t("mc_no", lang)}</YesNo>
          </div>
          <input type="hidden" name="our_diesel" value={ourDiesel} />
          {ourDiesel === "haan" && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <Label>{t("mc_diesel_litre", lang)}</Label>
                <Input type="number" name="our_diesel_litres" step="0.01" />
              </div>
              <div>
                <Label>{t("mc_diesel_rate", lang)}</Label>
                <Input type="number" name="our_diesel_rate" step="0.01" />
              </div>
              {/* Ye khana isi soorat mein aata hai. ART ka diesel hamare
                  kisi khate se nikalta hai -- wo khata likhe baghair
                  raqam ledger mein ja hi nahi sakti. */}
              <div className="col-span-2">
                <Label>{t("mc_diesel_account", lang)}</Label>
                <Select name="our_diesel_account" defaultValue="">
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm text-surface-800 dark:text-surface-200">{t("mc_wd_farmer_q", lang)}</p>
          <div className="flex gap-2">
            <YesNo on={farmerDiesel === "haan"} onClick={() => setFarmerDiesel("haan")}>{t("mc_yes", lang)}</YesNo>
            <YesNo on={farmerDiesel === "nahi"} onClick={() => setFarmerDiesel("nahi")}>{t("mc_no", lang)}</YesNo>
          </div>
          <input type="hidden" name="farmer_diesel" value={farmerDiesel} />
          {farmerDiesel === "haan" && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <Label>{t("mc_diesel_litre", lang)}</Label>
                <Input type="number" name="farmer_diesel_litres" step="0.01" />
              </div>
              <div>
                <Label>{t("mc_diesel_rate", lang)}</Label>
                <Input type="number" name="farmer_diesel_rate" step="0.01" />
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-surface-500">{t("mc_wd_hint", lang)}</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200">
        <input type="checkbox" name="farmer_confirmed" className="h-4 w-4" />
        {t("mc_farmer_verified_onsite", lang)}
      </label>
      {/* Kaam poora hone ka nishaan tareekh se nahi lagta -- tareekh ka
          andaza ghalat ho sakta hai, kaam poora hone ka nahi. Jab tak ye
          khali hai, booking "kaam darj karna" ki qatar mein khari rehti
          hai aur agle din khud yaad dilati hai. */}
      <label className="flex items-start gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <input
          type="checkbox"
          name="is_final"
          checked={isFinal}
          onChange={(e) => setIsFinal(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium text-surface-900 dark:text-surface-100">{t("mc_work_is_final", lang)}</span>
          <span className="block text-xs text-surface-500">{t("mc_work_is_final_hint", lang)}</span>
        </span>
      </label>

      {/* Agli fasal ka sawal yahin poochha jata hai -- booking ke waqt
          nahi. Us waqt kisan ne kaam dekha hi nahi hota; jawab abhi
          waqai jawab hai. */}
      {isFinal && (
        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <Label>{t("mc_next_season_q", lang)}</Label>
          <div className="mt-2 flex gap-2">
            {[
              { v: "yes", label: t("mc_yes", lang) },
              { v: "no", label: t("mc_no", lang) },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setReminder(o.v)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                  reminder === o.v
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30"
                    : "border-surface-200 text-surface-500 dark:border-surface-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="wants_next_season_reminder" value={reminder} />
          <p className="mt-2 text-xs text-surface-500">{t("mc_bill_auto_hint", lang)}</p>
        </div>
      )}

      <Submit label={t("mc_record_work", lang)} disabled={backwards} />
    </form>
  );
}

function BillForm({ bookingId }: { bookingId: string }) {
  const lang = useLang();
  const [state, action] = useFormState(generateFinalBill, initialState);
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-sm text-surface-600 dark:text-surface-300">
        Bill system khud banayega: asal raqba × wo rate jis par kisan raazi hua, minus poora advance. Koi raqam haath se
        nahi bhari jati.
      </p>

      {/* Riayat jaan boojh kar band (details) mein hai. Roz ka kaam bill
          banana hai, riayat dena nahi -- aur khula khana bharne ke liye
          bulata hai. Kholna ek click ka kaam hai; us ek click se ye
          faisla hosh mein hota hai. */}
      <details className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
        <summary className="cursor-pointer text-xs font-medium text-surface-700 dark:text-surface-300">{t("mb_give_discount", lang)}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-surface-500">
            Riayat sab se pehle katti hai, hissa us ke baad bantta hai — us raqam par hamara commission nahi banta aur wo
            vendor ke khate mein bhi nahi jati.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-700 dark:text-surface-300">{t("mb_how_much_discount", lang)}</label>
            <input
              type="number"
              name="discount_amount"
              min={0}
              step="0.01"
              defaultValue={0}
              className="w-40 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-700 dark:text-surface-300">{t("mb_reason_5", lang)}</label>
            <input
              type="text"
              name="discount_reason"
              placeholder={t("mb_discount_eg", lang)}
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
        </div>
      </details>

      <Submit label={t("mc_make_bill", lang)} />
    </form>
  );
}

/**
 * Bill mansookh karna.
 *
 * Ye khana jaan boojh kar band (details) rakha gaya hai aur bill ke
 * hisaab ke NEECHE hai. Wajah ye ke ye roz ka kaam nahi -- roz ka kaam
 * bill par paisa lena hai. Mansookhi ka button barabar mein khula khara
 * ho to kisi din wo ghalti se dab jayega.
 *
 * Wajah likhna lazmi hai aur wo hamesha ke liye darj rehti hai. Sirf
 * "theek karna tha" kaafi nahi -- kal jab koi ye qatar dekhega, usay
 * ye maloom hona chahiye ke Rs 30,000 ka bill kyun ulta gaya.
 */
function CancelBillForm({ bookingId, billNumber, paid }: { bookingId: string; billNumber: string; paid: number }) {
  const lang = useLang();
  const [state, action] = useFormState(cancelFinalBill, initialState);

  // Paisa aa chuka ho to mansookhi ka sawal hi nahi banta. Rok server
  // par bhi hai; yahan darwaza dikhana hi bemaani hai.
  if (paid > 0) {
    return (
      <p className="mt-3 border-t border-surface-200 pt-2 text-xs text-surface-500 dark:border-surface-700">
        Is bill par Rs {paid.toLocaleString()} aa chuke hain — bill mansookh karne se pehle wo adaigi Audit Trail se ulti
        karni hogi.
      </p>
    );
  }

  return (
    <details className="mt-3 border-t border-surface-200 pt-2 dark:border-surface-700">
      <summary className="cursor-pointer text-xs font-medium text-red-600 hover:underline dark:text-red-400">{t("mb_bill_wrong", lang)}</summary>
      <form action={action} className="mt-3 space-y-3">
        <Err state={state} />
        <input type="hidden" name="booking_id" value={bookingId} />
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          {billNumber} mansookh ho jayega aur us ka ledger ulta ja kar barabar ho jayega. Bill mitta nahi — wo mansookhi
          ke nishan ke sath apni jagah rahega. Vendor ko is bill par kuch de diya gaya ho to wo hisaab alag se barabar
          karna hoga.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-surface-700 dark:text-surface-300">{t("mb_reason_10", lang)}</label>
          <textarea
            name="reason"
            required
            minLength={10}
            rows={2}
            placeholder={t("mb_rate_eg", lang)}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          />
        </div>
        <Submit label={t("mb_cancel_bill", lang)} />
      </form>
    </details>
  );
}

/**
 * Qadam 7 -- sawal pehle, khana baad mein.
 *
 * Pehle dono khane ek sath khule khare rehte the: adaigi ka bhi aur
 * wade ka bhi. Wo do khane nahi the, ek sawal ka do jawab the -- aur
 * dono ek sath dikhana bande se ye poochhta hai ke wo khud tay kare
 * ke us ke saamne kaun sa haal hai.
 *
 * Sawal ek hi hai: kisan ne paisa diya ya nahi?
 *
 *   Diya   -> kitna diya, wo darj hota hai. Baqi khud nikal aata hai,
 *             aur agar baqi bacha to sath hi poochha jata hai ke wo
 *             kab dega.
 *   Nahi   -> to phir sirf ek baat poochhni hai: kab dega. Wo darj ho
 *             jati hai. Yahan kuch kata nahi jata -- poori raqam
 *             kisan ke zimme hi rehti hai.
 */
function FinalPaymentStep({
  bookingId,
  accounts,
  remaining,
  promiseDate,
  promiseNote,
  willSell,
  reminders,
}: {
  bookingId: string;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  remaining: number;
  promiseDate: string | null;
  promiseNote: string | null;
  willSell: boolean | null;
  reminders: Array<{ id: string; status: string; error: string | null; sentAt: string; bySystem: boolean }>;
}) {
  const lang = useLang();
  const [answer, setAnswer] = useState<"haan" | "nahi" | null>(null);
  const [paid, setPaid] = useState(false);

  // Baqi kab aayega -- ye tab poochha jata hai jab jawab aa chuka ho:
  // ya to paisa darj ho gaya aur kuch bacha hai, ya kisan ne saaf keh
  // diya ke abhi nahi de raha.
  const askPromise = answer === "nahi" || paid;

  return (
    <div className="space-y-3">
      <p className="text-sm text-surface-600 dark:text-surface-300">
        {t("mc_balance", lang)}: Rs {remaining.toLocaleString()}
      </p>

      {answer === null && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
            {t("mc_payment_q", lang)}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAnswer("haan")}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("mc_payment_yes", lang)}
            </button>
            <button
              type="button"
              onClick={() => setAnswer("nahi")}
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 dark:border-surface-700 dark:text-surface-300"
            >
              {t("mc_payment_no", lang)}
            </button>
          </div>
          {/* Wada pehle se darj ho to wo yahin dikh jata hai -- us ke
              liye sawal ka jawab dena zaroori nahi. */}
          {promiseDate && (
            <>
              <PromiseNote promiseDate={promiseDate} promiseNote={promiseNote} />
              {/* Wada koi raqam nahi -- sirf ek jumla. Us ka hatna
                  kisi hisaab ko nahi chherta. */}
              <UndoButton bookingId={bookingId} action={clearPaymentPromise} label={t("mc_undo_promise", lang)} />
            </>
          )}
        </div>
      )}

      {/* Jawab chunne ke baad wapis aane ka raasta.
          Pehle ye tha hi nahi: staff dekhne ke liye ek jawab chun leta
          tha aur phir doosre par nahi ja sakta tha -- safha dobara
          kholne ke ilawa koi chara nahi bachta tha.
          Paisa darj ho chuka ho to ye nahi aata: us waqt sawal ka
          jawab badalna bemaani hai, adaigi ho chuki hai. */}
      {answer !== null && !paid && (
        <button
          type="button"
          onClick={() => setAnswer(null)}
          className="flex items-center gap-1 text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
        >
          <Undo2 className="h-3 w-3" />
          {t("mc_back_to_question", lang)}
        </button>
      )}

      {answer === "haan" && (
        <PaymentForm
          bookingId={bookingId}
          accounts={accounts}
          remaining={remaining}
          onRecorded={() => setPaid(true)}
        />
      )}

      {askPromise && (
        <PromiseForm
          bookingId={bookingId}
          promiseDate={promiseDate}
          promiseNote={promiseNote}
          willSell={willSell}
          openByDefault={remaining > 0 && !promiseDate}
        />
      )}

      {/* Kis din, kis ke haath se yaad dilayi gayi. Ye us waqt kaam
          aata hai jab kisan kehta hai "mujhe kuch nahi aaya" -- aur
          us waqt yaad par bharosa karna kaam nahi aata. */}
      {reminders.length > 0 && (
        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <p className="mb-1 text-xs font-medium text-surface-600 dark:text-surface-300">
            {t("mr_reminders_on_booking", lang)}
          </p>
          <ul className="space-y-1 text-xs">
            {reminders.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2">
                <span className="text-surface-500">{new Date(r.sentAt).toLocaleString()}</span>
                <span className={r.status === "sent" ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}>
                  {r.status === "sent" ? t("mr_status_sent", lang) : t("mr_status_failed", lang)}
                </span>
                <span className="text-surface-400">
                  {r.bySystem ? t("mr_by_system", lang) : t("mr_by_staff", lang)}
                  {r.error ? ` · ${r.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Baqi kaam ki agli booking.
 *
 * Sirf tareekh maangi jati hai. Raqba, rate, kisan, khet -- sab pichli
 * booking se aate hain, kyunke wo badle nahi. Un ko dobara poochhna
 * staff ko wo cheez likhwana hai jo system pehle se jaanta hai, aur
 * wahin se galtiyan aati hain.
 */
function FollowUpForm({
  bookingId,
  remaining,
  alreadyMade,
}: {
  bookingId: string;
  remaining: number;
  alreadyMade: string | null;
}) {
  const lang = useLang();
  const [state, action] = useFormState(createFollowUpBooking, initialState);
  const [open, setOpen] = useState(false);

  if (alreadyMade && !state.success) {
    return (
      <p className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20">
        {t("mc_followup_done", lang)}: {alreadyMade}
      </p>
    );
  }

  if (state.success) {
    return (
      <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20">
        <p>{state.notice}</p>
        {state.bookingId && (
          <Link href={`/admin/machinery-rental/booking/${state.bookingId}`} className="font-medium underline">
            {state.bookingNumber}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
        {t("mc_followup_q", lang)} — {remaining} acre
      </p>
      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{t("mc_followup_hint", lang)}</p>

      {!open ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("mc_followup_yes", lang)}
          </button>
          <span className="self-center text-xs text-surface-500">{t("mc_followup_no", lang)}</span>
        </div>
      ) : (
        <form action={action} className="mt-2 space-y-2">
          <Err state={state} />
          <input type="hidden" name="booking_id" value={bookingId} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t("mc_followup_date", lang)}</Label>
              <Input type="date" name="preferred_date" min={aajKaKhana()} />
            </div>
            <div>
              <Label>{t("mc_followup_area", lang)}</Label>
              <Input type="number" name="remaining_acres" step="0.01" defaultValue={remaining} />
            </div>
          </div>
          <div className="flex gap-2">
            <Submit label={t("mc_followup_make", lang)} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700"
            >
              {t("ac_cancel", lang)}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Darj shuda wada -- sirf dikhane ke liye. */
function PromiseNote({ promiseDate, promiseNote }: { promiseDate: string; promiseNote: string | null }) {
  const lang = useLang();
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
      <p className="font-medium text-amber-800 dark:text-amber-300">
        {t("mc_promise_recorded", lang)}: {new Date(promiseDate).toLocaleDateString()}
      </p>
      {promiseNote && <p className="text-amber-800 dark:text-amber-300">{promiseNote}</p>}
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("mc_promise_still_due", lang)}</p>
    </div>
  );
}

function PromiseForm({
  bookingId,
  promiseDate,
  promiseNote,
  willSell,
  openByDefault,
}: {
  bookingId: string;
  promiseDate: string | null;
  promiseNote: string | null;
  willSell: boolean | null;
  openByDefault?: boolean;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordPaymentPromise, initialState);
  const [open, setOpen] = useState(Boolean(openByDefault));

  // Wada darj hote hi khana band. Bhara hua khana jawab dene ke baad
  // bhi khula rehna ye batata hai ke shayad jawab pahuncha hi nahi --
  // aur wohi shak ek hi baat do dafa likhwa deta hai.
  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <div className="mt-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
      {promiseDate && (
        <div className="mb-3">
          <PromiseNote promiseDate={promiseDate} promiseNote={promiseNote} />
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          {promiseDate ? t("mc_promise_change", lang) : t("mc_promise_open", lang)}
        </button>
      ) : (
        <form action={action} className="space-y-3">
          <Err state={state} />
          <input type="hidden" name="booking_id" value={bookingId} />
          <p className="text-xs text-surface-500">{t("mc_promise_hint", lang)}</p>
          {/* Booking ke waqt kisan ne kaha tha ke fasal hamein bechega.
              Wahi wo raasta hai jis se ye udhaar wapas aata hai, is liye
              yahan yaad dila dena kaam ka hai. */}
          {willSell === true && (
            <p className="rounded-lg bg-brand-50 px-2 py-1 text-xs text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
              {t("mc_promise_will_sell", lang)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("mc_promise_date", lang)}</Label>
              <Input
                type="date"
                name="promise_date"
                min={aajKaKhana()}
                defaultValue={promiseDate ?? ""}
              />
            </div>
          </div>
          <div>
            <Label>{t("mc_promise_note", lang)}</Label>
            <Input name="promise_note" defaultValue={promiseNote ?? ""} placeholder={t("mc_promise_note_hint", lang)} />
          </div>
          <div className="flex gap-2">
            <Submit label={t("mc_promise_save", lang)} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700"
            >
              {t("ac_cancel", lang)}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function VendorPayoutForm({
  bookingId,
  accounts,
  remaining,
  paidSoFar,
  vendorName,
}: {
  bookingId: string;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  remaining: number;
  paidSoFar: number;
  vendorName: string | null;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordVendorPayout, initialState);
  const [answer, setAnswer] = useState<"haan" | "nahi" | null>(null);

  // Sawal pehle, khana baad mein.
  //
  // Khula hua form jis mein raqam pehle se likhi ho ek jhoota sawal
  // hai: wo poochhta nahi, wo tajweez karta hai. Aur tajweez ka
  // jawab aksar "Enter" hota hai. Is liye pehle saaf sawal --
  // diya hai ya nahi -- aur raqam ka khana sirf "haan" ke baad.
  //
  // "Nahi" par kuch likha nahi jata, aur likhne ki zaroorat bhi
  // nahi: bill bante hi ye raqam vendor ke naam khari ho chuki hai
  // (supplier payable), yani paisa ART ke paas jama hai. "Nahi"
  // sirf us baat ko screen par kehta hai.
  if (answer !== "haan" && !state.success) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
          {t("mc_vendor_paid_q", lang)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAnswer("haan")}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("mc_vendor_paid_yes", lang)}
          </button>
          <button
            type="button"
            onClick={() => setAnswer("nahi")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              answer === "nahi"
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                : "border-surface-200 text-surface-700 dark:border-surface-700 dark:text-surface-300"
            }`}
          >
            {t("mc_vendor_paid_no", lang)}
          </button>
        </div>
        {answer === "nahi" ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t("mc_vendor_outstanding_note", lang)
              .replace("{amount}", `Rs ${remaining.toLocaleString()}`)
              .replace("{vendor}", vendorName ?? "Vendor")}
          </p>
        ) : (
          <p className="text-xs text-surface-500">
            {paidSoFar > 0 ? t("mc_vendor_paid_some", lang) : t("mc_vendor_paid_none", lang)}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_how_much_paid", lang)} (baqi Rs {remaining.toLocaleString()})</Label>
          {/* Khali chhora hai jaan boojh kar: sawal "kitna diya" hai,
              aur pehle se likhi hui poori raqam us sawal ka jawab de
              deti hai. Adha diya ho to wo adha yahin likha jayega. */}
          <Input type="number" name="amount" step="0.01" placeholder={String(remaining)} />
        </div>
        <div>
          <Label>{t("mc_which_account_from", lang)}</Label>
          <Select name="account_id" defaultValue="">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Submit label={t("mc_record_vendor_payout", lang)} />
        <button
          type="button"
          onClick={() => setAnswer(null)}
          className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700"
        >
          {t("ac_cancel", lang)}
        </button>
      </div>
    </form>
  );
}

function CancelForm({ bookingId, advanceTotal }: { bookingId: string; advanceTotal: number }) {
  const lang = useLang();
  const [state, action] = useFormState(cancelBooking, initialState);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("mc_cancel_booking", lang)}
      </Button>
    );
  }
  return (
    <Card>
      <form action={action} className="space-y-3">
        <Err state={state} />
        <input type="hidden" name="booking_id" value={bookingId} />
        <div>
          <Label>{t("mc_cancel_reason", lang)}</Label>
          <Textarea name="reason" rows={2} />
        </div>
        {advanceTotal > 0 && (
          <label className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
            <input type="checkbox" name="advance_handled" className="mt-1 h-4 w-4" />
            <span>
              Is booking par Rs {advanceTotal.toLocaleString()} advance mila hua hai. Tasdeeq karta hoon ke us ka faisla
              ho chuka (kisan ko wapas hua ya agli booking par raha).
            </span>
          </label>
        )}
        <div className="flex gap-2">
          <Submit label={t("mc_cancel_do", lang)} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
