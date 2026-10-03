Warning: truncated output (original token count: 38551)
Total output lines: 3611

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
import { Check, Circle, Plus, X, Undo2, CheckCircle2, Wallet, Fuel, Flag, ChevronRight } from "lucide-react";

import { PaymentForm, Err, Submit, initialState } from "@/components/machinery/payment-form";
import { enqueue, type QueuedAction } from "@/lib/offline/queue";
import { registerSender } from "@/lib/offline/sync";

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
      <p className="text-xs text-surface-500">
        <Link href="/admin/dashboard" className="hover:underline">
          Home
        </Link>{" "}
        &gt;{" "}
        <Link href="/admin/machinery-rental" className="hover:underline">
          Machinery
        </Link>{" "}
        &gt; Booking
      </p>
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
              icon={Wallet}
              tone="green"
              label="Add Payment"
              hint={bill ? `Baqi Rs ${(balance ?? 0).toLocaleString()}` : advanceTotal > 0 ? "Advance mil chuka" : "Advance ya adaigi"}
              onClick={() => setModal("payment")}
            />
            <BigButton
              icon={Fuel}
              tone="blue"
              label="Add Diesel"
              hint={confirmed ? "Litre aur us din ka rate" : "Pehle kisan ki tasdeeq"}
              disabled={!confirmed}
              onClick={() => setModal("diesel")}
            />
            <BigButton
              icon={CheckCircle2}
              tone="amber"
              label="Mark Work Complete"
              hint={!confirmed ? "Pehle kisan ki tasdeeq" : workFinished ? "Kaam mukammal ho chuka" : `${workRemaining} acre baqi`}
              disabled={!confirmed || workFinished}
              onClick={() => setModal("work")}
            />
            <BigButton
              icon={Flag}
              tone="green"
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
                      <th className="py-2 pr-3 text-right font-medium">Rate</th>…18551 tokens truncated…kta hai: aadha din ka kaam darj karna ho to wo bhi isi khane se
   * hota hai.
   */
  defaultFinal?: boolean;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordWorkCompletion, initialState);
  const [offlineNotice, setOfflineNotice] = useState("");
  const [clientActionId] = useState(() => crypto.randomUUID());
  useMachineryOfflineSender("machinery.work");
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
    <form action={action} className="space-y-3" onSubmit={async (event) => {
      if (typeof navigator === "undefined" || navigator.onLine !== false) return;
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      form.set("client_action_id", clientActionId);
      const fields = Object.fromEntries(form.entries());
      await enqueue({ actionType: "machinery.work", entityType: "machinery_work_records", payload: { fields }, clientActionId });
      setOfflineNotice("Work completion device par save ho gaya; internet aate hi sync hoga.");
    }}>
      {offlineNotice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{offlineNotice}</p>}
      <input type="hidden" name="client_action_id" value={clientActionId} />
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
