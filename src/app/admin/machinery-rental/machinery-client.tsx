"use client";
import { useState, useEffect } from "react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { useFormState, useFormStatus } from "react-dom";
import {
  createMachineryVendor,
  createVendorMachine,
  recordVendorPayout,
  type ActionState,
} from "@/actions/machinery-rental";
import { setMachineryCommissionRate } from "@/actions/machinery-lifecycle";
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
}
interface Farmer { id: string; full_name: string; farmer_code: string; booking_link_token?: string; }
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
  farmer_remaining: number;
  vendor_remaining: number;
  has_bill: boolean;
}

const RATE_TYPE_LABELS: Record<string, string> = { per_acre: "Per Acre", per_hour: "Per Hour", per_day: "Per Day" };

export function MachineryClient({
  vendors,
  machines,
  farmers,
  bookings,
  commissionRate,
  canEditCommission,
  defaultFarmerId,
  defaultRequestId,
  defaultAcres,
  defaultLocation,
}: {
  vendors: Vendor[];
  machines: Machine[];
  farmers: Farmer[];
  bookings: Booking[];
  commissionRate: number;
  canEditCommission: boolean;
  defaultFarmerId?: string;
  defaultRequestId?: string;
  defaultAcres?: string;
  defaultLocation?: string;
}) {
  const lang = useLang();
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

  return (
    <div>
      {defaultRequestId && (
        <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
          Farmer ki request se Booking bana rahe hain - Machine aur Rate select karein.
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-surface-200 dark:border-surface-800">
        <div className="flex gap-2">
          <TabButton active={tab === "live"} onClick={() => setTab("live")}>{t("mc_live_board", lang)}</TabButton>
          <Link
            href="/admin/machinery-rental/booking/new"
            className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-surface-500 hover:text-brand-700 dark:hover:text-brand-300"
          >
            {t("mc_new_booking", lang)}
          </Link>
          <TabButton active={tab === "vendors"} onClick={() => setTab("vendors")}>{t("mc_vendors_machines", lang)}</TabButton>
          <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")}>{t("mc_all_bookings", lang)}</TabButton>
        </div>
        <button onClick={() => setShowShareLink(true)} className="mb-2 flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
          <Share2 className="h-3.5 w-3.5" /> {t("mc_send_link_to_farmer", lang)}
        </button>
      </div>

      {tab === "live" && <LiveBoard />}

      {tab === "vendors" && (
        <div className="space-y-4">
          <CommissionRateCard rate={commissionRate} canEdit={canEditCommission} />
          <div className="flex gap-2">
            <button onClick={() => setShowNewVendor(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" /> {t("mc_new_vendor", lang)}
            </button>
            <button onClick={() => setShowNewMachine(true)} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">
              <Plus className="h-4 w-4" /> {t("mc_new_machine", lang)}
            </button>
          </div>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("mc_vendor", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("mc_machine", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("mc_rate", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{m.vendor_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{m.machine_type}{m.model ? ` (${m.model})` : ""}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">Rs {m.rate_amount.toLocaleString()} / {RATE_TYPE_LABELS[m.rate_type]}</td>
                  </tr>
                ))}
                {machines.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-surface-400">{t("mc_no_machines", lang)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "bookings" && (
        <BookingsTab bookings={bookings} />
      )}

      {showNewVendor && <NewVendorModal onClose={() => setShowNewVendor(false)} />}
      {showNewMachine && <NewMachineModal vendors={vendors} onClose={() => setShowNewMachine(false)} />}
      {showShareLink && <ShareLinkModal farmers={farmers} onClose={() => setShowShareLink(false)} />}
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

function BookingsTab({ bookings }: { bookings: Booking[] }) {
  const lang = useLang();
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
          <span><strong className="text-red-600">{pendingCount}</strong> {t("mc_pending", lang)}</span>
          <span><strong className="text-green-600">{confirmedCount}</strong> {t("mc_confirmed", lang)}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">No.</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_date", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_farmer", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_vendor_machine", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mc_total_amount", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mc_commission", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_status", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_payments", lang)}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const farmerRemaining = b.farmer_remaining;
              const vendorRemaining = b.vendor_remaining;
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
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {/* Paisa yahan se NAHI liya jata.
                          Booking ke safhe par poori zanjeer hai -- bill,
                          advance ka adjustment, split payment, vendor ka
                          hissa. Do jagah payment lene ka matlab hota ek
                          hi raqam do dafa darj ho jana. */}
                      {!b.has_bill && <span className="text-xs text-surface-400">{t("mc_bill_not_made", lang)}</span>}
                      {b.has_bill && farmerRemaining > 0 && (
                        <Link href={`/admin/machinery-rental/booking/${b.id}`} className="text-left text-xs font-medium text-brand-600 hover:underline">
                          Farmer Se Lena: Rs {farmerRemaining.toLocaleString()}
                        </Link>
                      )}
                      {b.has_bill && vendorRemaining > 0 && (
                        <Link href={`/admin/machinery-rental/booking/${b.id}`} className="text-left text-xs font-medium text-amber-600 hover:underline">
                          Vendor Ko Dena: Rs {vendorRemaining.toLocaleString()}
                        </Link>
                      )}
                      {b.has_bill && farmerRemaining <= 0 && vendorRemaining <= 0 && <Badge tone="green">{t("mc_fully_settled", lang)}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/machinery-rental/booking-slip/${b.id}`} className="text-xs font-medium text-brand-600 hover:underline">{t("mc_slip", lang)}</Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-surface-400">{t("mc_no_booking_filter", lang)}</td></tr>
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

function NewVendorModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(createMachineryVendor, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("mc_create_vendor", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Input name="vendor_name" required placeholder={t("mc_vendor_name_req", lang)} />
          <Input name="contact_person" placeholder={t("mc_contact_person", lang)} />
          <Input name="phone" placeholder={t("mc_phone", lang)} />
          <Input name="cnic" placeholder={t("mc_cnic_optional", lang)} />
          <Textarea name="address" rows={2} placeholder={t("mc_address", lang)} />
          <SubmitButton label={t("mc_create_vendor", lang)} />
        </form>
      </div>
    </div>
  );
}

function NewMachineModal({ vendors, onClose }: { vendors: Vendor[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(createVendorMachine, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("mc_add_machine", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Select name="vendor_id" required>
            <option value="">{t("mc_select_vendor", lang)}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.vendor_name}</option>
            ))}
          </Select>
          <Input name="machine_type" required placeholder={t("mc_machine_type_field", lang)} />
          <Input name="model" placeholder={t("mc_model_optional", lang)} />
          <Select name="rate_type" required>
            <option value="">{t("mc_select_rate_type", lang)}</option>
            <option value="per_acre">{t("mc_per_acre", lang)}</option>
            <option value="per_hour">{t("mc_per_hour", lang)}</option>
            <option value="per_day">{t("mc_per_day", lang)}</option>
          </Select>
          <Input type="number" step="0.01" name="rate_amount" required placeholder={t("mc_rate_amount_req", lang)} />
          <Textarea name="notes" rows={2} placeholder={t("mc_notes_optional", lang)} />
          <SubmitButton label={t("mc_add_machine", lang)} />
        </form>
      </div>
    </div>
  );
}

/**
 * Commission ka rate -- poori company ke liye ek hi.
 *
 * Pehle ye har machine par alag para tha aur kisi hisaab mein aata nahi
 * tha: screen 10% dikhati thi aur bill 12% ka banta tha. Ab ek hi jagah
 * hai, aur wahi bill par lagti hai.
 */
function CommissionRateCard({ rate, canEdit }: { rate: number; canEdit: boolean }) {
  const lang = useLang();
  const [state, formAction] = useFormState(setMachineryCommissionRate, initialState);
  return (
    <div className="mb-4 rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-surface-500">{t("mc_our_commission", lang)}</p>
          <p className="font-display text-2xl font-semibold text-brand-700 dark:text-brand-300">{rate}%</p>
          <p className="mt-1 text-xs text-surface-500">
            Har booking ke final bill par lagta hai — asal kaam ke gross par. Baqi {100 - rate}% vendor ka.
          </p>
        </div>
        {canEdit && (
          <form action={formAction} className="flex items-end gap-2">
            <div>
              <Label>{t("mc_new_rate_pct", lang)}</Label>
              <Input type="number" name="rate" step="0.01" min={0} max={100} defaultValue={rate} className="w-28" />
            </div>
            <SubmitButton label={t("mc_change", lang)} />
          </form>
        )}
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-brand-700 dark:text-brand-300">{t("mc_rate_changed", lang)}</p>}
      <p className="mt-3 border-t border-surface-100 pt-2 text-xs text-surface-500 dark:border-surface-800">
        {t("mc_rate_change_note", lang)}
      </p>
    </div>
  );
}

function ShareLinkModal({ farmers, onClose }: { farmers: (Farmer & { booking_link_token?: string })[]; onClose: () => void }) {
  const lang = useLang();
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
          <h3 className="font-display text-base font-semibold text-surface-900">{t("mc_send_booking_link", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-surface-500">{t("mc_select_farmer", lang)}</label>
            <select value={selectedFarmer} onChange={(e) => setSelectedFarmer(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">{t("mc_select", lang)}</option>
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
                  {t("mc_send_on_whatsapp", lang)}
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