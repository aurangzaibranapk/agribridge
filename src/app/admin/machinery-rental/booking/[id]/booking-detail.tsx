"use client";
import Link from "next/link";
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
  type ActionState,
} from "@/actions/machinery-lifecycle";
import { recordVendorPayout } from "@/actions/machinery-rental";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import { LocationPicker } from "@/components/ui/location-picker";
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

const CHAIN = [
  { key: "new", label: "Booking" },
  { key: "confirmed", label: "Advance" },
  { key: "ready_for_harvest", label: "Kisan ki Tasdeeq" },
  { key: "in_progress", label: "Machine Rawana" },
  { key: "bill_pending", label: "Asal Kaam" },
  { key: "payment_pending", label: "Bill" },
  { key: "closed", label: "Payment" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "Nayi",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  machine_assigned: "Machine tay",
  ready_for_harvest: "Kattai ke liye tayyar",
  in_progress: "Kaam jari",
  completed: "Mukammal",
  bill_pending: "Bill banna hai",
  payment_pending: "Payment baqi",
  closed: "Band",
  cancelled: "Cancel",
};

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
  total_area: number;
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
}: {
  booking: Booking;
  payments: Array<{ id: string; kind: string; amount: number; method: string; payment_date: string; reference: string | null; evidence_url: string | null; received_by_name: string | null }>;
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
  const ourFuelRecoverable = fuelLogs
    .filter((f) => f.paid_by === "company" && f.vendor_recoverable)
    .reduce((s2, f) => s2 + f.amount, 0);
  const ourFuelExpense = fuelLogs
    .filter((f) => f.paid_by === "company" && !f.vendor_recoverable)
    .reduce((s2, f) => s2 + f.amount, 0);
  const othersFuel = fuelLogs.filter((f) => f.paid_by !== "company").reduce((s2, f) => s2 + f.amount, 0);

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
    Math.round((fuelLogs.filter((f) => f.vendor_recoverable).reduce((s2, f) => s2 + f.amount, 0) - paidToVendor) * 100) / 100
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Sarnama */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-bold text-brand-700 dark:text-brand-300">{booking.booking_number}</p>
            <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
              {booking.farmer_name}
              {booking.farmer_code && ` (${booking.farmer_code})`} — {booking.farmer_phone || "phone darj nahi"}
            </p>
            <p className="text-sm text-surface-500">
              {[booking.village || booking.farmer_village, booking.crop_type, `${booking.harvest_area} acre`]
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
          <Badge tone={cancelled ? "red" : booking.status === "closed" ? "green" : "blue"}>
            {STATUS_LABEL[booking.status] ?? booking.status}
          </Badge>
        </div>

        {cancelled && booking.cancellation_reason && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            Cancel ki wajah: {booking.cancellation_reason}
          </p>
        )}

        <ChainStrip status={booking.status} />
      </Card>

      {/* Paise ka khulasa -- teen alag concepts, teen alag khane */}
      <Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("mc_estimated_rate", lang)} value={booking.estimated_rate ? `Rs ${booking.estimated_rate.toLocaleString()}/acre` : "—"} />
          <Stat
            label={t("mc_final_rate", lang)}
            value={booking.final_rate ? `Rs ${booking.final_rate.toLocaleString()}/acre` : "—"}
            tone={booking.rate_status === "final" ? "green" : booking.rate_status === "agreed" ? "amber" : "gray"}
            hint={booking.rate_status}
          />
          <Stat label={t("mc_step_advance", lang)} value={`Rs ${advanceTotal.toLocaleString()}`} />
          <Stat
            label={bill ? "Baqi" : "Bill"}
            value={bill ? `Rs ${(balance ?? 0).toLocaleString()}` : "Abhi nahi bana"}
            tone={bill && (balance ?? 0) > 0 ? "red" : "green"}
          />
        </div>
      </Card>

      {!cancelled && (
        <>
          {/* Advance */}
          <StepCard n={1} title={t("mc_advance", lang)} done={advanceTotal > 0 || Boolean(booking.advance_declined_at)}>
            {payments.filter((p) => p.kind === "advance").length > 0 && (
              <ul className="mb-3 space-y-1 text-sm">
                {payments
                  .filter((p) => p.kind === "advance")
                  .map((p) => (
                    <li key={p.id} className="flex justify-between rounded border border-surface-100 px-2 py-1 dark:border-surface-800">
                      <span>
                        {p.payment_date} · {p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                        {p.received_by_name && (
                          <span className="text-surface-500"> · liya: {p.received_by_name}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium">Rs {p.amount.toLocaleString()}</span>
                        {/* Har adaigi ki apni raseed. Booking ki slip
                            kaafi nahi -- ek booking par kai adaigiyan
                            hoti hain, aur kisan ko us adaigi ka kaghaz
                            chahiye jo us ne abhi ki hai. */}
                        <Link
                          href={`/admin/machinery-rental/receipt/${p.id}`}
                          className="text-xs text-brand-600 underline hover:text-brand-700"
                        >
                          {t("mr_receipt_link", lang)}
                        </Link>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            {/* Advance ek hi dafa poochha jata hai -- booking ke form par.
                Yahan wo form sirf us soorat mein khulta hai jab booking ke
                waqt advance nahi liya gaya tha (kisan ne baad mein dene ka
                kaha ho). Advance aa chuka ho to dobara poochhna staff ko
                ye shak deta hai ke shayad pehle wala darj hi nahi hua, aur
                wohi ek hi raqam do dafa likhwa deta hai.

                Bill ban jane ke baad advance ka darwaza band: us ke baad
                jo paisa aata hai wo advance nahi, bill ki adaigi hai --
                aur us ki apni jagah neeche hai. */}
            {advanceTotal > 0 ? (
              <p className="text-xs text-surface-500">
                {t("mc_advance_already", lang)}
              </p>
            ) : bill ? (
              <p className="text-xs text-surface-500">{t("mc_advance_after_bill", lang)}</p>
            ) : booking.advance_declined_at ? (
              /* Kisan ne booking par hi mana kar diya tha. Wo jawab
                 mehfooz hai -- to sawal dobara nahi poochha jata.
                 Baad mein de de to darwaza khulta hai, magar us ke
                 kehne par, safhe ke poochhne par nahi. */
              <AdvanceDeclined bookingId={booking.id} accounts={accounts} />
            ) : (
              <AdvanceForm bookingId={booking.id} accounts={accounts} />
            )}
          </StepCard>

          {/* Kisan ki tasdeeq */}
          <StepCard n={2} title={t("mc_step_confirm", lang)} done={confirmed}>
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
          </StepCard>

          {/* Machine rawangi */}
          <StepCard n={3} title={t("mc_step_dispatch", lang)} done={dispatches.length > 0} locked={!confirmed}>
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
            {confirmed && <DispatchForm
                bookingId={booking.id}
                machines={machines}
                already={dispatches.length > 0}
                harvestDate={harvestDate}
                bookingAcres={booking.harvest_area}
              />}
          </StepCard>

          {/* Diesel -- jitni baar dala jaye */}
          {/* Diesel ka apna qadam yahan se hata diya gaya.

              Wo booking bante hi khul jata tha aur poore safhe par
              khara rehta tha -- jabke diesel ka jawab us waqt kisi
              ke paas hota hi nahi. Har dafa safha kholne par wohi
              adhoora khana saamne aata tha.

              Ab diesel ka sawal wahin poochha jata hai jahan us ka
              jawab maujood hota hai: kaam mukammal darj karte waqt
              (qadam 5). Do saaf sawal, dono haan/nahi. */}


          {/* Asal kaam -- ek din ka nahi, jitne din laga utne din ka */}
          <StepCard n={4} title={t("mc_step_work", lang)} done={workFinished} locked={!confirmed}>
            {work.length > 0 && (
              <div className="mb-3 space-y-1 text-sm">
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
                          aata hai. Ek booking par kai indraj hote hain, is
                          liye "jahan jahan kattai hui" ka jawab in nishanon
                          se banta hai -- kisi alag fehrist se nahi. */}
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
                    Booking par andaza {booking.harvest_area} acre tha — bill asal {workDone} acre ka banega.
                  </p>
                )}
              </div>
            )}
            {/* Machine ne kaisa kaam kiya. Ye adad kisi ke bharne se
                nahi bante -- waqt aur diesel ke indraj se khud nikalte
                hain. Isi liye in par bharosa kiya ja sakta hai. */}
            {efficiency && (efficiency.kulGhante || efficiency.kulLitre) && (
              <div className="mb-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                <p className="mb-2 text-xs font-medium text-surface-700 dark:text-surface-300">
                  {t("mc_eff_title", lang)}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {efficiency.kulGhante !== null && (
                    <Eff label={t("mc_eff_hours", lang)} value={`${efficiency.kulGhante}`} />
                  )}
                  {efficiency.kulLitre !== null && (
                    <Eff label={t("mc_eff_litres", lang)} value={`${efficiency.kulLitre} L`} />
                  )}
                  {efficiency.litrePerGhanta !== null && (
                    <Eff label={t("mc_eff_lph", lang)} value={`${efficiency.litrePerGhanta} L`} />
                  )}
                  {efficiency.acrePerGhanta !== null && (
                    <Eff label={t("mc_eff_aph", lang)} value={`${efficiency.acrePerGhanta}`} />
                  )}
                  {efficiency.litrePerAcre !== null && (
                    <Eff label={t("mc_eff_lpa", lang)} value={`${efficiency.litrePerAcre} L`} />
                  )}
                </div>
                <p className="mt-2 text-xs text-surface-500">{t("mc_eff_note", lang)}</p>
              </div>
            )}
              {/* Jo diesel darj ho chuka. Pehle ye apne qadam mein tha; ab
                kaam ke sath hai, kyunke diesel usi kaam ka kharcha hai. */}
            {fuelLogs.length > 0 && (
              <div className="mb-3 space-y-1 rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                {fuelLogs.map((f) => (
                  <div key={f.id} className="flex justify-between">
                    <span className="text-surface-600 dark:text-surface-300">
                      {f.litres} L ·{" "}
                      {f.paid_by === "company"
                        ? t("mc_diesel_by_company", lang)
                        : f.paid_by === "vendor"
                        ? t("mc_diesel_by_vendor", lang)
                        : t("mc_diesel_by_farmer", lang)}
                    </span>
                    <span className="font-medium">Rs {f.amount.toLocaleString()}</span>
                  </div>
                ))}
                {ourFuelRecoverable > 0 && (
                  <div className="flex justify-between border-t border-surface-200 pt-1 text-xs dark:border-surface-700">
                    <span className="text-surface-500">{t("mc_fuel_recoverable", lang)}</span>
                    <span className="font-medium">Rs {ourFuelRecoverable.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
            {fuelLogs.length === 0 && booking.diesel_none_at && (
              <p className="mb-3 rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/50 dark:text-surface-300">
                {t("mc_diesel_none_done", lang)}
              </p>
            )}
            {confirmed && !workFinished && (
            <WorkForm
                bookingId={booking.id}
                estimated={booking.harvest_area}
                done={workDone}
                harvestType={booking.harvest_type}
                accounts={accounts}
              />
            )}

            {/* Kaam mukammal ho gaya magar booking ka poora raqba nahi
                kata. Ye maamool hai -- fasal kachi thi, ya machine kisi
                aur khet chali gayi. Baqi ek NAYA kaam hai: nayi
                tareekh, naya bill. Kisan aur khet wohi rehte hain. */}
            {workFinished && workRemaining > 0 && (
              <FollowUpForm
                bookingId={booking.id}
                remaining={workRemaining}
                alreadyMade={booking.follow_up_number}
              />
            )}
          </StepCard>

          {/* Bill */}
          <StepCard n={5} title={t("mc_step_bill", lang)} done={Boolean(bill)} locked={!workFinished}>
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
                {/* Kisan ka apna diesel. Ye us ke bill se katta hai --
                    aur us ka naam saaf likha jata hai, warna kisan
                    poochhta hai ke "ye kam kyun hai" aur jawab kisi ke
                    paas nahi hota. */}
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
            ) : (
              workFinished && <BillForm bookingId={booking.id} />
            )}
          </StepCard>

          {/* Kisan se aayi hui payments -- kis ne li, ye saamne */}
          {payments.filter((p) => p.kind === "final").length > 0 && (
            <Card>
              <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                {t("mc_payments_from_farmer", lang)}
              </h2>
              <ul className="space-y-1 text-sm">
                {payments
                  .filter((p) => p.kind === "final")
                  .map((p) => (
                    <li key={p.id} className="flex justify-between rounded border border-surface-100 px-2 py-1 dark:border-surface-800">
                      <span>
                        {p.payment_date} · {p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                        {p.received_by_name && (
                          <span className="text-surface-500"> · liya: {p.received_by_name}</span>
                        )}
                      </span>
                      <span className="font-medium">Rs {p.amount.toLocaleString()}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          {/* Final payment.

              Pata (id="payment") shart se BAHAR hai, taake kisan ke
              khate se aane wala link us soorat mein bhi theek jagah
              utre jab yahan koi baqi na bacha ho -- warna link chup
              chaap safhe ke shuru mein utar deta aur banda samajhta ke
              kuch khula hi nahi. */}
          <div id="payment" className="scroll-mt-20" />
          {bill && (balance ?? 0) > 0 && (
            <StepCard n={6} title={t("mc_step_final_payment", lang)} done={false}>
              <FinalPaymentStep
                bookingId={booking.id}
                accounts={accounts}
                remaining={balance ?? 0}
                promiseDate={booking.payment_promise_date}
                promiseNote={booking.payment_promise_note}
                willSell={booking.will_sell_to_us}
                reminders={reminders}
              />
            </StepCard>
          )}

          {/* Vendor ka hissa -- ye kisan wale hisaab se alag hai */}
          {bill && (
            <StepCard n={7} title={t("mc_step_vendor_share", lang)} done={vendorRemaining <= 0}>
              <div className="mb-3 rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                <Row label={`Gross bill (${bill.actual_area} acre)`} value={bill.gross_amount} />
                <Row label={`Hamara commission (${bill.commission_percentage}%)`} value={-bill.commission_amount} />
                <div className="mt-1 flex justify-between border-t border-surface-200 pt-1 font-medium dark:border-surface-700">
                  <span>{vendorName ?? "Vendor"} ko dena</span>
                  <span>Rs {bill.vendor_payable.toLocaleString()}</span>
                </div>
                {/* Kisan ka apna diesel vendor ke hisse se kata --
                    kyunke rate mein diesel shamil tha aur wo kharcha
                    vendor ka bacha, hamara nahi. */}
                {bill.diesel_deducted > 0 && (
                  <p className="mt-1 text-xs text-surface-500">
                    {t("mc_vendor_diesel_note", lang).replace(
                      "{amount}",
                      `Rs ${bill.diesel_deducted.toLocaleString()}`
                    )}
                  </p>
                )}
                {artDiesel > 0 && (
                  <Row label={t("mc_diesel_recoverable", lang)} value={-artDiesel} />
                )}
                {paidToVendor > 0 && <Row label={t("mc_paid_so_far", lang)} value={-paidToVendor} />}
                <div className="mt-1 flex justify-between font-display font-semibold">
                  <span>{t("mc_balance", lang)}</span>
                  <span className={vendorRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-brand-700 dark:text-brand-300"}>
                    Rs {vendorRemaining.toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="mb-3 text-xs text-surface-500">
                Kisan ka poora paisa hamari aamdani nahi. Bill bante hi commission hamara aur baqi vendor ka ho jata
                hai — wo raqam sirf hamare paas se guzar rahi hoti hai.
              </p>
              {vendorRemaining > 0 && (
                <VendorPayoutForm
                  bookingId={booking.id}
                  accounts={accounts}
                  remaining={vendorRemaining}
                  paidSoFar={paidToVendor}
                  vendorName={vendorName}
                />
              )}
            </StepCard>
          )}

          {booking.status !== "closed" && <CancelForm bookingId={booking.id} advanceTotal={advanceTotal} />}
        </>
      )}

      {/* Timeline */}
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
    </div>
  );
}

// ---------------------------------------------------------------------
// Chhote hissay
// ---------------------------------------------------------------------

function ChainStrip({ status }: { status: string }) {
  const order = ["new", "confirmed", "ready_for_harvest", "in_progress", "bill_pending", "payment_pending", "closed"];
  const current = order.indexOf(status);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {CHAIN.map((step, i) => {
        const done = current >= 0 && i <= current;
        return (
          <span
            key={step.key}
            className={
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs " +
              (done
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                : "bg-surface-100 text-surface-400 dark:bg-surface-800 dark:text-surface-500")
            }
          >
            {done ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
            {step.label}
          </span>
        );
      })}
    </div>
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

function StepCard({
  n,
  title,
  done,
  locked,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const lang = useLang();
  return (
    <Card className={locked ? "opacity-60" : undefined}>
      <div className="mb-3 flex items-center gap-2 border-b border-surface-100 pb-2 dark:border-surface-800">
        <span
          className={
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white " +
            (done ? "bg-brand-600" : "bg-surface-400")
          }
        >
          {done ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{title}</h2>
      </div>
      {locked ? (
        <p className="text-sm text-surface-500">{t("mb_gate_note", lang)}</p>
      ) : (
        children
      )}
    </Card>
  );
}


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
          <Input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} />
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
            <option value="whatsapp">WhatsApp</option>
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
          <Input type="date" name="log_date" defaultValue={new Date().toISOString().slice(0, 10)} />
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
          <Select name="paid_by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="">—</option>
            <option value="farmer">{t("mc_diesel_by_farmer", lang)}</option>
            <option value="vendor">{t("mc_diesel_by_vendor", lang)}</option>
            <option value="company">{t("mc_diesel_by_company", lang)}</option>
          </Select>
        </div>
      </div>
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
}: {
  bookingId: string;
  estimated: number;
  done: number;
  harvestType: string | null;
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordWorkCompletion, initialState);
  const [photo, setPhoto] = useState("");
  const [isFinal, setIsFinal] = useState(false);
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
          <Input type="date" name="work_date" defaultValue={new Date().toISOString().slice(0, 10)} />
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
              <Input type="date" name="preferred_date" min={new Date().toISOString().slice(0, 10)} />
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
                min={new Date().toISOString().slice(0, 10)}
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
