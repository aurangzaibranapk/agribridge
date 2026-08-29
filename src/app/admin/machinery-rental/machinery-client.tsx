"use client";
import { useState, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createMachineryVendor,
  createVendorMachine,
  updateBookingStatus,
  completeMachineryBooking,
  recordFarmerPayment,
  recordVendorPayout,
  type ActionState,
} from "@/actions/machinery-rental";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { LiveBoard } from "./live-board";
import Link from "next/link";
import { Plus, X, Share2 } from "lucide-react";

const initialState: ActionState = {};

interface Vendor { id: string; vendor_name: string; contact_person: string | null; phone: string | null; }
interface Machine {
  id: string;
  vendor_id: string;
  vendor_name: string;
  machine_type: string;
  model: string | null;
  rate_type: string;
  rate_amount: number;
  commission_percentage: number;
}
interface Farmer { id: string; full_name: string; farmer_code: string; booking_link_token?: string; }
interface FinanceAccount { id: string; name: string; account_type: string; }
interface Booking {
  id: string;
  booking_number: string;
  booking_date: string;
  farmer_name: string;
  vendor_name: string;
  machine_label: string;
  acres: number | null;
  hours: number | null;
  days: number | null;
  total_amount: number;
  commission_amount: number;
  vendor_payable: number;
  amount_received_from_farmer: number;
  amount_paid_to_vendor: number;
  status: string;
}

const RATE_TYPE_LABELS: Record<string, string> = { per_acre: "Per Acre", per_hour: "Per Hour", per_day: "Per Day" };
const STATUS_OPTIONS = ["pending", "confirmed", "in_progress", "completed", "cancelled"];

export function MachineryClient({
  vendors,
  machines,
  farmers,
  financeAccounts,
  bookings,
  defaultFarmerId,
  defaultRequestId,
  defaultAcres,
  defaultLocation,
}: {
  vendors: Vendor[];
  machines: Machine[];
  farmers: Farmer[];
  financeAccounts: FinanceAccount[];
  bookings: Booking[];
  defaultFarmerId?: string;
  defaultRequestId?: string;
  defaultAcres?: string;
  defaultLocation?: string;
}) {
  const [tab, setTabState] = useState<"live" | "vendors" | "bookings">("live");
  useEffect(() => {
    const saved = sessionStorage.getItem("machinery_active_tab");
    // "booking" ab tab nahi raha -- wo apne safhe par chala gaya. Purani
    // session mein wo mehfooz ho to use nazarandaz kar dein.
    if (saved === "live" || saved === "vendors" || saved === "bookings") setTabState(saved);
  }, []);
  function setTab(next: "live" | "vendors" | "bookings") {
    setTabState(next);
    sessionStorage.setItem("machinery_active_tab", next);
  }
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [showNewMachine, setShowNewMachine] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [payingBooking, setPayingBooking] = useState<{ booking: Booking; type: "farmer" | "vendor" } | null>(null);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);

  return (
    <div>
      {defaultRequestId && (
        <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
          Farmer ki request se Booking bana rahe hain - Machine aur Rate select karein.
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-surface-200 dark:border-surface-800">
        <div className="flex gap-2">
          <TabButton active={tab === "live"} onClick={() => setTab("live")}>Live Board</TabButton>
          <Link
            href="/admin/machinery-rental/booking/new"
            className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-surface-500 hover:text-brand-700 dark:hover:text-brand-300"
          >
            Nayi Booking
          </Link>
          <TabButton active={tab === "vendors"} onClick={() => setTab("vendors")}>Vendors & Machines</TabButton>
          <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")}>Poori Bookings</TabButton>
        </div>
        <button onClick={() => setShowShareLink(true)} className="mb-2 flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
          <Share2 className="h-3.5 w-3.5" /> Farmer Ko Link Bhejein
        </button>
      </div>

      {tab === "live" && <LiveBoard />}

      {tab === "vendors" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setShowNewVendor(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Naya Vendor
            </button>
            <button onClick={() => setShowNewMachine(true)} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">
              <Plus className="h-4 w-4" /> Nayi Machine
            </button>
          </div>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Vendor</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Machine</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Rate</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Commission %</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{m.vendor_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{m.machine_type}{m.model ? ` (${m.model})` : ""}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">Rs {m.rate_amount.toLocaleString()} / {RATE_TYPE_LABELS[m.rate_type]}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{m.commission_percentage}%</td>
                  </tr>
                ))}
                {machines.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-surface-400">Koi machine nahi hai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "bookings" && (
        <BookingsTab bookings={bookings} setPayingBooking={setPayingBooking} setCompletingBookingId={setCompletingBookingId} />
      )}

      {showNewVendor && <NewVendorModal onClose={() => setShowNewVendor(false)} />}
      {showNewMachine && <NewMachineModal vendors={vendors} onClose={() => setShowNewMachine(false)} />}
      {showShareLink && <ShareLinkModal farmers={farmers} onClose={() => setShowShareLink(false)} />}
      {payingBooking && (
        <PaymentModal booking={payingBooking.booking} type={payingBooking.type} financeAccounts={financeAccounts} onClose={() => setPayingBooking(null)} />
      )}
      {completingBookingId && (
        <CompleteBookingModal bookingId={completingBookingId} financeAccounts={financeAccounts} onClose={() => setCompletingBookingId(null)} />
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function StatusBadge({ status }: { status: string }) {
  const isDone = status === "confirmed" || status === "in_progress" || status === "completed";
  const isCancelled = status === "cancelled";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isCancelled
          ? "bg-surface-200 text-surface-500"
          : isDone
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {isDone ? "\u2713" : isCancelled ? "\u2715" : "\u25CF"} {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function BookingsTab({
  bookings,
  setPayingBooking,
  setCompletingBookingId,
}: {
  bookings: Booking[];
  setPayingBooking: (v: { booking: Booking; type: "farmer" | "vendor" } | null) => void;
  setCompletingBookingId: (id: string | null) => void;
}) {
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "completed" | "cancelled">("all");

  const now = new Date();
  const todayStr = now.toDateString();
  const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const filtered = bookings.filter((b) => {
    const bDate = new Date(b.booking_date);
    if (dateFilter === "today" && bDate.toDateString() !== todayStr) return false;
    if (dateFilter === "yesterday" && bDate.toDateString() !== yesterdayStr) return false;
    if (dateFilter === "week" && bDate.getTime() < weekAgo) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "confirmed" && !["confirmed", "in_progress"].includes(b.status)) return false;
      if (statusFilter !== "confirmed" && b.status !== statusFilter) return false;
    }
    return true;
  });

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const confirmedCount = bookings.filter((b) => ["confirmed", "in_progress", "completed"].includes(b.status)).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["all", "today", "yesterday", "week"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${dateFilter === f ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
            >
              {f === "all" ? "Sab" : f === "today" ? "Aaj" : f === "yesterday" ? "Kal" : "Is Hafte"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${statusFilter === f ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
            >
              {f === "all" ? "Har Status" : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-3 text-xs text-surface-500">
          <span><strong className="text-red-600">{pendingCount}</strong> Pending</span>
          <span><strong className="text-green-600">{confirmedCount}</strong> Confirmed</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">No.</th>
              <th className="px-3 py-2 font-medium text-surface-500">Date</th>
              <th className="px-3 py-2 font-medium text-surface-500">Farmer</th>
              <th className="px-3 py-2 font-medium text-surface-500">Vendor / Machine</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Total</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Commission</th>
              <th className="px-3 py-2 font-medium text-surface-500">Status</th>
              <th className="px-3 py-2 font-medium text-surface-500">Payments</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const farmerRemaining = b.total_amount - b.amount_received_from_farmer;
              const vendorRemaining = b.vendor_payable - b.amount_paid_to_vendor;
              return (
                <tr key={b.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/admin/machinery-rental/booking/${b.id}`} className="text-brand-600 hover:underline">
                      {b.booking_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-surface-500">{new Date(b.booking_date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{b.farmer_name}</td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{b.vendor_name} - {b.machine_label}</td>
                  <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {b.total_amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-green-600">Rs {b.commission_amount.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={b.status} />
                      <StatusForm bookingId={b.id} currentStatus={b.status} onWantsComplete={() => setCompletingBookingId(b.id)} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {farmerRemaining > 0 && (
                        <button onClick={() => setPayingBooking({ booking: b, type: "farmer" })} className="text-left text-xs font-medium text-brand-600 hover:underline">
                          Farmer Se Lena: Rs {farmerRemaining.toLocaleString()}
                        </button>
                      )}
                      {vendorRemaining > 0 && b.amount_received_from_farmer > 0 && (
                        <button onClick={() => setPayingBooking({ booking: b, type: "vendor" })} className="text-left text-xs font-medium text-amber-600 hover:underline">
                          Vendor Ko Dena: Rs {vendorRemaining.toLocaleString()}
                        </button>
                      )}
                      {farmerRemaining <= 0 && vendorRemaining <= 0 && <Badge tone="green">Poora Settle</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/machinery-rental/booking-slip/${b.id}`} className="text-xs font-medium text-brand-600 hover:underline">Slip</Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-surface-400">Is filter mein koi booking nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-surface-500 hover:text-surface-700"}`}>
      {children}
    </button>
  );
}

function StatusForm({ bookingId, currentStatus, onWantsComplete }: { bookingId: string; currentStatus: string; onWantsComplete: () => void }) {
  const [state, formAction] = useFormState(updateBookingStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => {
          if (e.target.value === "completed") {
            onWantsComplete();
            e.target.value = currentStatus;
            return;
          }
          e.target.form?.requestSubmit();
        }}
        className="rounded-lg border border-surface-200 p-1.5 text-xs"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
    </form>
  );
}

function CompleteBookingModal({ bookingId, financeAccounts, onClose }: { bookingId: string; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const [state, formAction] = useFormState(completeMachineryBooking, initialState);
  const [willSell, setWillSell] = useState<"" | "yes" | "no">("");
  const [wantsReminder, setWantsReminder] = useState<"" | "yes" | "no">("");
  const [dieselAmount, setDieselAmount] = useState("0");
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div dir="rtl" className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">بکنگ مکمل کریں</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">مکمل ہو گیا۔</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="will_sell_to_us" value={willSell} />
          <input type="hidden" name="wants_next_season_reminder" value={wantsReminder} />

          <div className={`rounded-lg border-2 p-3 ${willSell === "" ? "border-red-300 bg-red-50" : "border-surface-200"}`}>
            <label className="block text-sm font-medium text-surface-700">کیا فارمر ہمیں فصل بیچے گا؟ *</label>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setWillSell("yes")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${willSell === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>ہاں</button>
              <button type="button" onClick={() => setWillSell("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${willSell === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>نہیں</button>
            </div>
          </div>

          <div className={`rounded-lg border-2 p-3 ${wantsReminder === "" ? "border-red-300 bg-red-50" : "border-surface-200"}`}>
            <label className="block text-sm font-medium text-surface-700">کیا اگلی فصل کے لیے مشینری بکنگ کی یاد دہانی چاہیے؟ *</label>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setWantsReminder("yes")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${wantsReminder === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>ہاں</button>
              <button type="button" onClick={() => setWantsReminder("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${wantsReminder === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>نہیں</button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-surface-500">ڈیزل کتنا دیا؟ (روپے)</label>
            <input type="number" step="0.01" name="diesel_amount" value={dieselAmount} onChange={(e) => setDieselAmount(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-surface-500">ڈیزل ریٹ (فی لیٹر)</label>
            <input type="number" step="0.01" name="diesel_rate" placeholder="0" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          {parseFloat(dieselAmount) > 0 && (
            <div>
              <label className="block text-xs text-surface-500">کون سا اکاؤنٹ سے ادا کیا *</label>
              <select name="diesel_account_id" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">- منتخب کریں -</option>
                {financeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
          <SubmitButtonUrdu disabled={willSell === "" || wantsReminder === ""} />
        </form>
      </div>
    </div>
  );
}

function PaymentModal({
  booking,
  type,
  financeAccounts,
  onClose,
}: {
  booking: Booking;
  type: "farmer" | "vendor";
  financeAccounts: FinanceAccount[];
  onClose: () => void;
}) {
  const action = type === "farmer" ? recordFarmerPayment : recordVendorPayout;
  const [state, formAction] = useFormState(action, initialState);
  const remaining = type === "farmer" ? booking.total_amount - booking.amount_received_from_farmer : booking.vendor_payable - booking.amount_paid_to_vendor;
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {type === "farmer" ? "Farmer Se Payment Lena" : "Vendor Ko Payment Dena"}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-surface-500">
          {type === "farmer" ? booking.farmer_name : booking.vendor_name} - Baaqi: Rs {remaining.toLocaleString()}
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Record ho gaya.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="booking_id" value={booking.id} />
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input type="number" step="0.01" name="amount" max={remaining} defaultValue={remaining} required />
          </div>
          <div>
            <Label>Konsa Account *</Label>
            <Select name="account_id" required>
              <option value="">- select -</option>
              {financeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <SubmitButton label="Record Karein" />
        </form>
      </div>
    </div>
  );
}

function NewVendorModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(createMachineryVendor, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Naya Vendor Banayein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Input name="vendor_name" required placeholder="Vendor ka Naam *" />
          <Input name="contact_person" placeholder="Contact Person" />
          <Input name="phone" placeholder="Phone" />
          <Input name="cnic" placeholder="CNIC (optional)" />
          <Textarea name="address" rows={2} placeholder="Address" />
          <SubmitButton label="Vendor Banayein" />
        </form>
      </div>
    </div>
  );
}

function NewMachineModal({ vendors, onClose }: { vendors: Vendor[]; onClose: () => void }) {
  const [state, formAction] = useFormState(createVendorMachine, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Nayi Machine Add Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Select name="vendor_id" required>
            <option value="">- Vendor Select Karein -</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.vendor_name}</option>
            ))}
          </Select>
          <Input name="machine_type" required placeholder="Machine Type (Tractor, Thresher, wagera) *" />
          <Input name="model" placeholder="Model (optional)" />
          <Select name="rate_type" required>
            <option value="">- Rate Type Select Karein -</option>
            <option value="per_acre">Per Acre</option>
            <option value="per_hour">Per Hour</option>
            <option value="per_day">Per Day</option>
          </Select>
          <Input type="number" step="0.01" name="rate_amount" required placeholder="Rate Amount (Rs) *" />
          <Input type="number" step="0.01" name="commission_percentage" placeholder="AgriBridge Commission % (jaise 10)" />
          <Textarea name="notes" rows={2} placeholder="Notes (optional)" />
          <SubmitButton label="Machine Add Karein" />
        </form>
      </div>
    </div>
  );
}

function ShareLinkModal({ farmers, onClose }: { farmers: (Farmer & { booking_link_token?: string })[]; onClose: () => void }) {
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [copied, setCopied] = useState(false);
  const farmer = farmers.find((f) => f.id === selectedFarmer);
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const bookingLink = farmer?.booking_link_token ? `${siteUrl}/machinery-booking/${farmer.booking_link_token}` : "";
  const shareText = farmer ? `Assalam-o-Alaikum ${farmer.full_name}, Machinery Booking ke liye ye link kholein:\n${bookingLink}` : "";

  function handleCopy() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Farmer Ko Booking Link Bhejein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-surface-500">Farmer Select Karein</label>
            <select value={selectedFarmer} onChange={(e) => setSelectedFarmer(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </select>
          </div>
          {farmer && (
            <>
              <div className="rounded-lg bg-surface-50 p-2 text-xs text-surface-600 break-all">{bookingLink}</div>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="flex-1 rounded-lg bg-surface-100 py-2 text-xs font-medium text-surface-700 hover:bg-surface-200">
                  {copied ? "Copy Ho Gaya!" : "Link Copy Karein"}
                </button>
                <button onClick={handleWhatsApp} className="flex-1 rounded-lg bg-green-600 py-2 text-xs font-medium text-white hover:bg-green-700">
                  WhatsApp Se Bhejein
                </button>
              </div>
              <p className="text-[11px] text-surface-400">Ye link is Farmer ke liye hamesha wahi rahega - jitni marzi booking, isi link se aati rahengi.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : label}</Button>;
}

function SubmitButtonUrdu({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabled} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "محفوظ کریں"}</button>;
}