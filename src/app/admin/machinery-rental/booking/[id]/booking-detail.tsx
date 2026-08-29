"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  recordAdvance,
  sendRateConfirmation,
  recordFarmerConfirmation,
  overrideConfirmation,
  dispatchMachine,
  recordWorkCompletion,
  generateFinalBill,
  recordFinalPayment,
  cancelBooking,
  type ActionState,
} from "@/actions/machinery-lifecycle";
import { recordVendorPayout } from "@/actions/machinery-rental";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import { Check, Circle, Plus, X } from "lucide-react";

const initialState: ActionState = {};

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
  village: string | null;
  location_address: string | null;
  harvest_area: number;
  total_area: number;
  machine_type_requested: string | null;
  machine_label: string | null;
  estimated_rate: number | null;
  final_rate: number | null;
  rate_status: string;
  expected_harvest_date: string | null;
  rate_confirmation_sent_at: string | null;
  farmer_confirmed_at: string | null;
  farmer_confirmation_response: string | null;
  farmer_confirmation_channel: string | null;
  confirmation_override_reason: string | null;
  cancellation_reason: string | null;
  farmer_name: string;
  farmer_code: string;
  farmer_phone: string;
  farmer_village: string;
}

export function BookingDetail({
  booking,
  payments,
  dispatches,
  work,
  bill,
  events,
  machines,
  accounts,
  advanceTotal,
  finalPaid,
  vendorName,
  paidToVendor,
  canOverride,
}: {
  booking: Booking;
  payments: Array<{ id: string; kind: string; amount: number; method: string; payment_date: string; reference: string | null; evidence_url: string | null }>;
  dispatches: Array<{ id: string; operator_name: string | null; departure_at: string; opening_meter: number | null; fuel_litres: number | null }>;
  work: { actual_area: number; started_at: string | null; finished_at: string | null; completion_photo_url: string | null; farmer_confirmed: boolean } | null;
  bill: { bill_number: string; bill_date: string; actual_area: number; rate_amount: number; gross_amount: number; advance_adjusted: number; previous_payment: number; balance_payable: number; commission_percentage: number; commission_amount: number; vendor_payable: number } | null;
  events: Array<{ id: string; event_type: string; note: string | null; to_status: string | null; created_at: string }>;
  machines: Array<{ id: string; label: string }>;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  advanceTotal: number;
  finalPaid: number;
  vendorName: string | null;
  paidToVendor: number;
  canOverride: boolean;
}) {
  const confirmed = Boolean(booking.farmer_confirmed_at) || Boolean(booking.confirmation_override_reason);
  const balance = bill ? Math.round((bill.balance_payable - finalPaid) * 100) / 100 : null;
  const cancelled = booking.status === "cancelled";
  const vendorRemaining = bill ? Math.round((bill.vendor_payable - paidToVendor) * 100) / 100 : 0;

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
          <Stat label="Andaza (booking)" value={booking.estimated_rate ? `Rs ${booking.estimated_rate.toLocaleString()}/acre` : "—"} />
          <Stat
            label="Final rate"
            value={booking.final_rate ? `Rs ${booking.final_rate.toLocaleString()}/acre` : "—"}
            tone={booking.rate_status === "final" ? "green" : booking.rate_status === "agreed" ? "amber" : "gray"}
            hint={booking.rate_status}
          />
          <Stat label="Advance mila" value={`Rs ${advanceTotal.toLocaleString()}`} />
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
          <StepCard n={1} title="Advance" done={advanceTotal > 0}>
            {payments.filter((p) => p.kind === "advance").length > 0 && (
              <ul className="mb-3 space-y-1 text-sm">
                {payments
                  .filter((p) => p.kind === "advance")
                  .map((p) => (
                    <li key={p.id} className="flex justify-between rounded border border-surface-100 px-2 py-1 dark:border-surface-800">
                      <span>
                        {p.payment_date} · {p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                      <span className="font-medium">Rs {p.amount.toLocaleString()}</span>
                    </li>
                  ))}
              </ul>
            )}
            <AdvanceForm bookingId={booking.id} accounts={accounts} />
          </StepCard>

          {/* Kisan ki tasdeeq */}
          <StepCard n={2} title="Kisan ki Tasdeeq (final rate)" done={confirmed}>
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
              </div>
            ) : (
              <div className="space-y-4">
                <RateConfirmationForm bookingId={booking.id} defaultRate={booking.final_rate ?? booking.estimated_rate} />
                {booking.rate_confirmation_sent_at && (
                  <>
                    <p className="text-xs text-surface-500">
                      Rs {booking.final_rate?.toLocaleString()}/acre par confirmation bheja ja chuka hai (
                      {new Date(booking.rate_confirmation_sent_at).toLocaleString()}). Kisan ka jawab yahan darj karein:
                    </p>
                    <FarmerResponseForm bookingId={booking.id} />
                    {canOverride && <OverrideForm bookingId={booking.id} />}
                  </>
                )}
              </div>
            )}
          </StepCard>

          {/* Machine rawangi */}
          <StepCard n={3} title="Machine Rawangi" done={dispatches.length > 0} locked={!confirmed}>
            {dispatches.map((d) => (
              <p key={d.id} className="mb-2 text-sm text-surface-600 dark:text-surface-300">
                {new Date(d.departure_at).toLocaleString()} · {d.operator_name ?? "operator darj nahi"}
                {d.opening_meter !== null && ` · meter ${d.opening_meter}`}
                {d.fuel_litres !== null && ` · ${d.fuel_litres} L`}
              </p>
            ))}
            {confirmed && <DispatchForm bookingId={booking.id} machines={machines} />}
          </StepCard>

          {/* Asal kaam */}
          <StepCard n={4} title="Asal Kaam (kattai ke baad)" done={Boolean(work)} locked={!confirmed}>
            {work ? (
              <div className="text-sm">
                <p className="font-medium text-surface-900 dark:text-surface-100">{work.actual_area} acre waqai kaate gaye</p>
                {booking.harvest_area !== work.actual_area && (
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    Booking par andaza {booking.harvest_area} acre tha — bill asal {work.actual_area} acre ka banega.
                  </p>
                )}
                {work.started_at && work.finished_at && (
                  <p className="text-surface-500">
                    {new Date(work.started_at).toLocaleTimeString()} se {new Date(work.finished_at).toLocaleTimeString()}
                  </p>
                )}
                {work.completion_photo_url && (
                  <a href={work.completion_photo_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    Khet ki tasveer
                  </a>
                )}
              </div>
            ) : (
              confirmed && <WorkForm bookingId={booking.id} estimated={booking.harvest_area} />
            )}
          </StepCard>

          {/* Bill */}
          <StepCard n={5} title="Final Bill" done={Boolean(bill)} locked={!work}>
            {bill ? (
              <div className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                <p className="mb-2 font-medium text-surface-900 dark:text-surface-100">{bill.bill_number}</p>
                <Row label={`Machinery charges (${bill.actual_area} acre × Rs ${bill.rate_amount.toLocaleString()})`} value={bill.gross_amount} />
                <Row label="Advance paid" value={-bill.advance_adjusted} />
                {bill.previous_payment > 0 && <Row label="Previous payment" value={-bill.previous_payment} />}
                {finalPaid > 0 && <Row label="Ab tak mila" value={-finalPaid} />}
                <div className="mt-2 flex justify-between border-t border-surface-200 pt-2 font-display font-semibold dark:border-surface-700">
                  <span>Balance</span>
                  <span className={balance && balance > 0 ? "text-red-600 dark:text-red-400" : "text-brand-700 dark:text-brand-300"}>
                    Rs {(balance ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              work && <BillForm bookingId={booking.id} />
            )}
          </StepCard>

          {/* Vendor ka hissa -- ye kisan wale hisaab se alag hai */}
          {bill && (
            <StepCard n={7} title="Vendor ka Hissa" done={vendorRemaining <= 0}>
              <div className="mb-3 rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                <Row label={`Gross bill (${bill.actual_area} acre)`} value={bill.gross_amount} />
                <Row label={`Hamara commission (${bill.commission_percentage}%)`} value={-bill.commission_amount} />
                <div className="mt-1 flex justify-between border-t border-surface-200 pt-1 font-medium dark:border-surface-700">
                  <span>{vendorName ?? "Vendor"} ko dena</span>
                  <span>Rs {bill.vendor_payable.toLocaleString()}</span>
                </div>
                {paidToVendor > 0 && <Row label="Ab tak diya" value={-paidToVendor} />}
                <div className="mt-1 flex justify-between font-display font-semibold">
                  <span>Baqi</span>
                  <span className={vendorRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-brand-700 dark:text-brand-300"}>
                    Rs {vendorRemaining.toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="mb-3 text-xs text-surface-500">
                Kisan ka poora paisa hamari aamdani nahi. Bill bante hi commission hamara aur baqi vendor ka ho jata
                hai — wo raqam sirf hamare paas se guzar rahi hoti hai.
              </p>
              {vendorRemaining > 0 && <VendorPayoutForm bookingId={booking.id} accounts={accounts} remaining={vendorRemaining} />}
            </StepCard>
          )}

          {/* Final payment */}
          {bill && (balance ?? 0) > 0 && (
            <StepCard n={6} title="Final Payment" done={false}>
              <PaymentForm bookingId={booking.id} accounts={accounts} remaining={balance ?? 0} />
            </StepCard>
          )}

          {booking.status !== "closed" && <CancelForm bookingId={booking.id} advanceTotal={advanceTotal} />}
        </>
      )}

      {/* Timeline */}
      <Card>
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Kis ne kya kiya
        </h2>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <div>
                <p className="text-surface-800 dark:text-surface-200">{e.event_type.replace(/_/g, " ")}</p>
                {e.note && <p className="text-surface-500">{e.note}</p>}
                <p className="text-xs text-surface-400">{new Date(e.created_at).toLocaleString()}</p>
              </div>
            </li>
          ))}
          {events.length === 0 && <li className="text-sm text-surface-400">Abhi kuch nahi.</li>}
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
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-surface-600 dark:text-surface-300">{label}</span>
      <span className={value < 0 ? "text-surface-500" : "text-surface-900 dark:text-surface-100"}>
        {value < 0 ? "−" : ""}Rs {Math.abs(value).toLocaleString()}
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
        <p className="text-sm text-surface-500">
          Ye qadam kisan ki tasdeeq ke baad khulta hai — rok database mein lagi hui hai, sirf yahan nahi.
        </p>
      ) : (
        children
      )}
    </Card>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

function Err({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <p className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
      {state.error}
    </p>
  );
}

// ---------------------------------------------------------------------

function AdvanceForm({ bookingId, accounts }: { bookingId: string; accounts: Array<{ id: string; name: string; account_type: string }> }) {
  const [state, action] = useFormState(recordAdvance, initialState);
  const [evidence, setEvidence] = useState("");
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="evidence_url" value={evidence} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Raqam</Label>
          <Input type="number" name="amount" step="0.01" />
        </div>
        <div>
          <Label>Tareeqa</Label>
          <Select name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="wallet">Wallet</option>
            <option value="other">Deegar</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>Khata</Label>
        <Select name="finance_account_id" defaultValue="">
          <option value="">—</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.account_type})
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tareekh</Label>
          <Input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label>Reference</Label>
          <Input name="reference" />
        </div>
      </div>
      <PaymentSlipUpload onUploaded={setEvidence} />
      <Submit label="Advance darj karein" />
    </form>
  );
}

function RateConfirmationForm({ bookingId, defaultRate }: { bookingId: string; defaultRate: number | null }) {
  const [state, action] = useFormState(sendRateConfirmation, initialState);
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <Label>Final rate (Rs per acre)</Label>
        <Input type="number" name="final_rate" step="0.01" defaultValue={defaultRate ?? ""} />
      </div>
      <p className="text-xs text-surface-500">
        Bhejte hi purani tasdeeq (agar thi) khatam ho jayegi — warna kisan ne kisi aur rate par haan ki hoti aur record
        naye rate par &ldquo;tasdeeq shuda&rdquo; dikhata rehta.
      </p>
      <Submit label="Rate confirmation bhejein" />
    </form>
  );
}

function FarmerResponseForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useFormState(recordFarmerConfirmation, initialState);
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Jawab kaise aaya</Label>
          <Select name="channel" defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="call">Phone call</option>
            <option value="in_person">Rubaru</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>Kisan ne kya kaha (jaisa kaha, waisa likhein)</Label>
        <Textarea name="response" rows={2} placeholder="CONFIRM" />
      </div>
      <Submit label="Jawab darj karein" />
    </form>
  );
}

function OverrideForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useFormState(overrideConfirmation, initialState);
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Kisan ka jawab nahi aa raha — manager override
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
        <Label>Wajah</Label>
        <Textarea name="reason" rows={2} placeholder="Kisan ka phone band hai, machine khet par khari hai..." />
      </div>
      <PaymentSlipUpload onUploaded={setEvidence} />
      <div className="flex gap-2">
        <Submit label="Override karein" />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function DispatchForm({ bookingId, machines }: { bookingId: string; machines: Array<{ id: string; label: string }> }) {
  const [state, action] = useFormState(dispatchMachine, initialState);
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <Label>Machine</Label>
        <Select name="machine_id" defaultValue="">
          <option value="">—</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Operator / Driver</Label>
          <Input name="operator_name" />
        </div>
        <div>
          <Label>Driver ka phone</Label>
          <Input name="driver_phone" />
        </div>
        <div>
          <Label>Opening meter / hours</Label>
          <Input type="number" name="opening_meter" step="0.01" />
        </div>
        <div>
          <Label>Diesel (litre)</Label>
          <Input type="number" name="fuel_litres" step="0.01" />
        </div>
      </div>
      <Submit label="Rawangi darj karein" />
    </form>
  );
}

function WorkForm({ bookingId, estimated }: { bookingId: string; estimated: number }) {
  const [state, action] = useFormState(recordWorkCompletion, initialState);
  const [photo, setPhoto] = useState("");
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="completion_photo_url" value={photo} />
      <p className="text-xs text-surface-500">
        Booking par andaza {estimated} acre tha. Yahan wohi likhein jo WAQAI kaata gaya — bill isi se banega.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Asal raqba (acre)</Label>
          <Input type="number" name="actual_area_acres" step="0.01" />
        </div>
        <div>
          <Label>Kanal</Label>
          <Input type="number" name="actual_area_kanal" step="0.01" />
        </div>
        <div>
          <Label>Shuru</Label>
          <Input type="datetime-local" name="started_at" />
        </div>
        <div>
          <Label>Khatam</Label>
          <Input type="datetime-local" name="finished_at" />
        </div>
        <div>
          <Label>Meter / hours</Label>
          <Input type="number" name="meter_reading" step="0.01" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200">
        <input type="checkbox" name="farmer_confirmed" className="h-4 w-4" />
        Kisan ne mauqe par kaam ki tasdeeq ki
      </label>
      <PaymentSlipUpload onUploaded={setPhoto} />
      <Submit label="Kaam darj karein" />
    </form>
  );
}

function BillForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useFormState(generateFinalBill, initialState);
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-sm text-surface-600 dark:text-surface-300">
        Bill system khud banayega: asal raqba × wo rate jis par kisan raazi hua, minus poora advance. Koi raqam haath se
        nahi bhari jati.
      </p>
      <Submit label="Bill banayein" />
    </form>
  );
}

function PaymentForm({
  bookingId,
  accounts,
  remaining,
}: {
  bookingId: string;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  remaining: number;
}) {
  const [state, action] = useFormState(recordFinalPayment, initialState);
  const [lines, setLines] = useState([0]);
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-sm text-surface-600 dark:text-surface-300">Baqi: Rs {remaining.toLocaleString()}</p>

      {lines.map((i) => (
        <div key={i} className="grid grid-cols-3 gap-2 rounded-lg border border-surface-200 p-2 dark:border-surface-700">
          <div>
            <Label>Tareeqa</Label>
            <Select name={`line_${i}_method`} defaultValue="cash">
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="wallet">Wallet</option>
              <option value="khata">Khata (udhaar)</option>
            </Select>
          </div>
          <div>
            <Label>Raqam</Label>
            <Input type="number" name={`line_${i}_amount`} step="0.01" />
          </div>
          <div>
            <Label>Khata</Label>
            <Select name={`line_${i}_account_id`} defaultValue="">
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ))}

      {lines.length < 5 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setLines([...lines, lines.length])}>
          <Plus className="h-4 w-4" /> Split payment add karein
        </Button>
      )}

      <p className="text-xs text-surface-500">
        Khata par daali gayi raqam ka koi cash/bank entry nahi banta — wo kisan ke khate mein hi pari rehti hai. Baqi har
        raaste ka apna khata hona zaroori hai, warna paisa aa to gaya magar pahuncha kahin nahi.
      </p>
      <div>
        <Label>Tareekh</Label>
        <Input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <Submit label="Payment darj karein" />
    </form>
  );
}

function VendorPayoutForm({
  bookingId,
  accounts,
  remaining,
}: {
  bookingId: string;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  remaining: number;
}) {
  const [state, action] = useFormState(recordVendorPayout, initialState);
  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Raqam (baqi Rs {remaining.toLocaleString()})</Label>
          <Input type="number" name="amount" step="0.01" />
        </div>
        <div>
          <Label>Kis khate se</Label>
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
      <Submit label="Vendor ko payout darj karein" />
    </form>
  );
}

function CancelForm({ bookingId, advanceTotal }: { bookingId: string; advanceTotal: number }) {
  const [state, action] = useFormState(cancelBooking, initialState);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Booking cancel karein
      </Button>
    );
  }
  return (
    <Card>
      <form action={action} className="space-y-3">
        <Err state={state} />
        <input type="hidden" name="booking_id" value={bookingId} />
        <div>
          <Label>Cancel ki wajah</Label>
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
          <Submit label="Cancel karein" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
