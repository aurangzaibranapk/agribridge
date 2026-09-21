"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, Clock, Lock, X, CheckCircle2, AlertTriangle, Receipt, Send, Repeat, ChevronDown, Landmark, User } from "lucide-react";
import { closeShift, getShiftSummary, shiftCashRecipients, type ActionState } from "@/actions/pos-counters";
import { sendCash, type ActionState as HandoverState } from "@/actions/cash-handover";
import { bankAccountsForCollectionDeposit, submitCollectionDeposit, type ActionState as DepositState } from "@/actions/pos-collection";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import type { ShiftCashSummary } from "@/lib/pos/shift-cash";

const KHALI: ActionState = {};
const HANDOVER_KHALI: HandoverState = {};
const DEPOSIT_KHALI: DepositState = {};

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

function SendButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
    >
      <Send className="h-4 w-4" />
      {pending ? "Bheja ja raha hai..." : "Cash Bhejein"}
    </button>
  );
}

function DepositButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
    >
      <Landmark className="h-4 w-4" />
      {pending ? "Jama ho raha hai..." : "Bank Mein Jama Karayein"}
    </button>
  );
}

/**
 * Shift band hone ke BAAD -- counted cash Manager/Finance ke hath
 * bhejna, ya khud bank mein jama kara kar slip lagana. Malik ka kaam #3
 * (8 September), aur 16 September ka izafa: "sare banks ana chahiye,
 * kis ke through cash bheja hai sab ana chahiye, aur us ki receipt bhi
 * upload karna chahiye."
 *
 * Bank wala raasta naya nahi -- `/admin/my-collection` (`pos-
 * collection.ts`) pehle se maujood hai. Yahan sirf usi ko is modal ke
 * andar la kar istemal kiya gaya hai, taake alag safhe par jana na
 * paray. `shift_id` (430) is deposit ko isi shift se jorta hai, taake
 * "cash bhejna baqi" wali patti is se bhi band ho jaye -- na sirf
 * kisi bande ke hath bhejne se.
 */
export function ShiftCashHandoverForm({
  shiftId,
  branchId,
  shopId,
  countedCash,
}: {
  shiftId: string;
  branchId: string | null;
  shopId: string | null;
  countedCash: number;
}) {
  const [mode, setMode] = useState<"person" | "bank">("person");
  const [recipients, setRecipients] = useState<{ id: string; name: string; role: string }[] | null>(null);
  const [banks, setBanks] = useState<{ id: string; name: string }[] | null>(null);
  const [handoverState, handoverAction] = useFormState(sendCash, HANDOVER_KHALI);
  const [depositState, depositAction] = useFormState(submitCollectionDeposit, DEPOSIT_KHALI);
  const [slipUrl, setSlipUrl] = useState("");

  useEffect(() => {
    shiftCashRecipients(branchId).then((r) => {
      if (!("error" in r)) setRecipients(r);
    });
    bankAccountsForCollectionDeposit().then((r) => {
      if (!("error" in r)) setBanks(r);
    });
  }, [branchId]);

  if (handoverState.success) {
    return (
      <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {handoverState.message}
      </p>
    );
  }
  if (depositState.success) {
    return (
      <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {depositState.message}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setMode("person")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium ${
            mode === "person"
              ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950/30 dark:text-brand-200"
              : "border-surface-200 text-surface-600 dark:border-surface-700 dark:text-surface-300"
          }`}
        >
          <User className="h-3.5 w-3.5" /> Manager/Finance
        </button>
        <button
          type="button"
          onClick={() => setMode("bank")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium ${
            mode === "bank"
              ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950/30 dark:text-brand-200"
              : "border-surface-200 text-surface-600 dark:border-surface-700 dark:text-surface-300"
          }`}
        >
          <Landmark className="h-3.5 w-3.5" /> Bank mein jama
        </button>
      </div>

      {mode === "person" ? (
        recipients === null ? null : recipients.length === 0 ? (
          <p className="text-xs text-surface-400">
            Is branch ka koi Manager ya Finance nahi mila — "Bank mein jama" try karein.
          </p>
        ) : (
          <form action={handoverAction} className="space-y-2 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
            <input type="hidden" name="from_source" value="my_custody" />
            <input type="hidden" name="amount" value={countedCash} />
            <input type="hidden" name="shift_id" value={shiftId} />
            <p className="text-xs font-medium text-surface-600 dark:text-surface-400">
              Yehi Rs {Math.round(countedCash).toLocaleString()} kis ko bhejein?
            </p>
            <select
              name="to_profile_id"
              required
              className="w-full rounded-lg border border-surface-200 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
            >
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.role === "manager" ? "Manager" : "Finance"})
                </option>
              ))}
            </select>
            <p className="text-xs font-medium text-surface-600 dark:text-surface-400">Kis tareeqe se bheja?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: "cash", label: "Cash (Haath se)" },
                { value: "jazzcash", label: "JazzCash" },
                { value: "easypaisa", label: "Easypaisa" },
                { value: "bank_transfer", label: "Bank Transfer" },
              ].map((m) => (
                <label key={m.value} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-200 px-2 py-1.5 text-xs has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:border-surface-700 dark:has-[:checked]:border-brand-600 dark:has-[:checked]:bg-brand-950/30">
                  <input type="radio" name="transfer_method" value={m.value} defaultChecked={m.value === "cash"} className="accent-brand-600" />
                  {m.label}
                </label>
              ))}
            </div>
            <input
              name="sent_note"
              placeholder="Note (agar ho)"
              className="w-full rounded-lg border border-surface-200 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
            />
            {handoverState.error && (
              <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {handoverState.error}
              </p>
            )}
            <SendButton />
          </form>
        )
      ) : !shopId ? (
        <p className="text-xs text-surface-400">Is counter ki shop maloom nahi — "Manager/Finance" try karein.</p>
      ) : banks === null ? null : (
        <form action={depositAction} className="space-y-2 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
          <input type="hidden" name="shop_id" value={shopId} />
          <input type="hidden" name="shift_id" value={shiftId} />
          <input type="hidden" name="amount" value={countedCash} />
          <input type="hidden" name="deposit_date" value={new Date().toISOString().slice(0, 10)} />
          <p className="text-xs font-medium text-surface-600 dark:text-surface-400">
            Rs {Math.round(countedCash).toLocaleString()} kis bank account mein jama karaya?
          </p>
          <select
            name="bank_account_id"
            required
            className="w-full rounded-lg border border-surface-200 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
          >
            <option value="">— chunein —</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input type="hidden" name="slip_url" value={slipUrl} />
          <PaymentSlipUpload onUploaded={setSlipUrl} />
          {!slipUrl && <p className="text-[11px] text-surface-400">Slip upload karna lazmi hai.</p>}
          {depositState.error && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {depositState.error}
            </p>
          )}
          <DepositButton />
        </form>
      )}
    </div>
  );
}

function CloseButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
    >
      <Lock className="h-4 w-4" />
      {pending ? "Band ho raha hai..." : "Shift Band Karein"}
    </button>
  );
}

/**
 * Doosre counters par jump karne ka button -- shift band kiye baghair
 * (423). Malik: "2/3 POS hon to shift close kiye baghair doosre pay ja
 * sakay, aur wahan wahi button ho wapis pehle wale pay aane ke liye."
 * Isi ek switcher se dono taraf switch hota hai -- jo counter khula hai
 * wahan seedha wapas jata hai, jahan shift khula nahi wahan Shift Open
 * ka form khulta hai.
 */
function CounterSwitcher({
  counters,
}: {
  counters: { id: string; name: string; shopName: string; hasOpenShift: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  if (counters.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 shadow-sm transition hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300"
      >
        <Repeat className="h-3 w-3" /> Doosra Counter <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-surface-200 bg-white py-1 shadow-lg dark:border-surface-700 dark:bg-surface-900">
            {counters.map((c) => (
              <Link
                key={c.id}
                href={`/admin/pos?counter=${c.id}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-surface-50 dark:hover:bg-surface-800"
              >
                <span className="min-w-0 truncate text-surface-700 dark:text-surface-300">
                  {c.shopName} · {c.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    c.hasOpenShift
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-surface-100 text-surface-500 dark:bg-surface-800"
                  }`}
                >
                  {c.hasOpenShift ? "Khula" : "Band"}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Shift ki patti -- POS ke sab se upar. Phase 6/17.
 *
 * Malik (8 September): "system ko khud balance batana chahiye, kya sale
 * howi hai" -- staff se pehle ginti mangwane ke bajaye, system khud
 * bataye ke ab tak kitni bikri hui aur golak mein kitna hona chahiye.
 * Design reference (Waseela POS): "Close" ek saaf modal se ho.
 */
export function ShiftBar({
  shiftId,
  shiftNumber,
  counterName,
  shopName,
  shopId,
  openingCash,
  openedAt,
  branchId,
  pendingHandover,
  otherCounters,
}: {
  shiftId: string;
  shiftNumber: string;
  counterName: string;
  shopName: string;
  shopId?: string | null;
  openingCash: number;
  openedAt: string;
  branchId: string | null;
  /** Saari band shifts ka total cash jo abhi Manager/Finance ko bheja nahi gaya. */
  pendingHandover?: { shiftId: string; countedCash: number; branchId: string | null; shopId?: string | null; pendingDepositAmount?: number | null; hasUnsubmittedShifts?: boolean } | null;
  /** Staff ke baaqi counters -- shift band kiye baghair switch karne ke liye (423). */
  otherCounters?: { id: string; name: string; shopName: string; hasOpenShift: boolean }[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [state, action] = useFormState(closeShift, KHALI);
  const [summary, setSummary] = useState<ShiftCashSummary | null>(null);

  const openedTime = new Date(openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  async function refreshSummary() {
    const result = await getShiftSummary(shiftId);
    if (!("error" in result)) setSummary(result);
  }

  // Bar khulte hi ek dafa, phir har 30 second baad -- taake bina kuch
  // kiye bhi "ab tak kitni sale hui" nazar mein rahe.
  useEffect(() => {
    refreshSummary();
    const id = setInterval(refreshSummary, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  // Modal khulte waqt bhi taaza karo -- close karne se theek pehle wala
  // adad hi maayne rakhta hai.
  useEffect(() => {
    if (modalOpen) refreshSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white px-4 py-2.5 print:hidden dark:border-brand-900/30 dark:from-brand-950/20 dark:to-surface-900">
        <div className="flex flex-wrap items-center gap-2 text-xs text-brand-900 dark:text-brand-300">
          <Link
            href="/admin/my-work"
            className="flex items-center gap-1 rounded-full bg-white px-2 py-1 font-medium text-brand-700 shadow-sm ring-1 ring-brand-100 hover:bg-brand-50 dark:bg-surface-900 dark:text-brand-300 dark:ring-brand-900/40"
          >
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <span className="text-brand-300">·</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-brand-100 dark:bg-surface-900 dark:ring-brand-900/40">
            <Clock className="h-3.5 w-3.5 text-brand-600" />
          </span>
          <span className="font-semibold">{shopName}</span>
          <span className="text-brand-300">·</span>
          <span>{counterName}</span>
          <span className="text-brand-300">·</span>
          <span className="font-mono text-[11px] text-surface-500">{shiftNumber}</span>
          <span className="text-brand-300">·</span>
          <span className="text-surface-500">khula {openedTime}</span>
          {summary && (
            <>
              <span className="text-brand-300">·</span>
              <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-brand-700 shadow-sm dark:bg-surface-900 dark:text-brand-300">
                <Receipt className="h-3 w-3" /> {summary.saleCount} sale · {rs(summary.totalSales)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {otherCounters && otherCounters.length > 0 && <CounterSwitcher counters={otherCounters} />}
          {pendingHandover && (
            <button
              onClick={() => setHandoverOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
              title="Band shifts ka cash abhi bhejna baqi hai"
            >
              <AlertTriangle className="h-3 w-3" />
              {pendingHandover.pendingDepositAmount && !pendingHandover.hasUnsubmittedShifts
                ? `Rs ${Math.round(pendingHandover.countedCash).toLocaleString()} — deposit pending`
                : `Rs ${Math.round(pendingHandover.countedCash).toLocaleString()} bhejna baqi`}
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-50 dark:border-red-900/40 dark:bg-surface-900"
          >
            <Lock className="h-3 w-3" /> Shift Band Karein
          </button>
        </div>
      </div>

      {pendingHandover && handoverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-surface-900">
            <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4 dark:border-surface-800">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">Purani Shift ka Cash Bhejein</p>
              <button
                onClick={() => setHandoverOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800"
                aria-label="Band karein"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="mb-3 text-xs font-medium text-amber-800 dark:text-amber-400">
                Total Rs {Math.round(pendingHandover.countedCash).toLocaleString()} abhi bhejna baqi hai (saari band shifts ka).
              </p>
              {pendingHandover.pendingDepositAmount && (
                <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Rs {Math.round(pendingHandover.pendingDepositAmount).toLocaleString()} ka deposit submit ho chuka hai — Finance ki tasdeeq ka intezar hai.
                </p>
              )}
              <ShiftCashHandoverForm
                shiftId={pendingHandover.shiftId}
                branchId={pendingHandover.branchId}
                shopId={pendingHandover.shopId ?? null}
                countedCash={pendingHandover.countedCash}
              />
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-surface-900">
            <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4 dark:border-surface-800">
              <div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">Shift Band Karein</p>
                <p className="text-xs text-surface-500">
                  {shopName} · {counterName}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800"
                aria-label="Band karein"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {state.success ? (
              <div className="px-5 py-6">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{state.message}</p>
                </div>
                {state.countedCash != null && state.countedCash > 0 && (
                  <div className="mt-3">
                    <ShiftCashHandoverForm shiftId={shiftId} branchId={branchId} shopId={shopId ?? null} countedCash={state.countedCash} />
                  </div>
                )}
                <p className="mt-3 text-center text-xs text-surface-400">Band karein — safha refresh ho jayega.</p>
              </div>
            ) : (
              <form action={action} className="space-y-4 px-5 py-5">
                <input type="hidden" name="shift_id" value={shiftId} />

                {/* System khud bataye -- staff se pehle sawal nahi. */}
                <div className="space-y-1.5 rounded-xl bg-surface-50 px-4 py-3 text-xs dark:bg-surface-800">
                  <div className="flex items-center justify-between text-surface-700 dark:text-surface-300">
                    <span className="font-medium">Total Sale ({summary?.saleCount ?? "…"})</span>
                    <span className="tabular-nums font-medium">{summary ? rs(summary.totalSales) : "…"}</span>
                  </div>
                  <div className="ml-2 flex items-center justify-between text-surface-500">
                    <span>— Cash</span>
                    <span className="tabular-nums">{summary ? rs(summary.cashSalesTotal) : "…"}</span>
                  </div>
                  {(summary?.digitalTotal ?? 0) > 0 && (
                    <div className="ml-2 flex items-center justify-between text-surface-500">
                      <span>— Digital (Bank/Easypaisa/JazzCash/Card)</span>
                      <span className="tabular-nums">{rs(summary!.digitalTotal)}</span>
                    </div>
                  )}
                  {(summary?.khataTotal ?? 0) > 0 && (
                    <div className="ml-2 flex items-center justify-between text-surface-500">
                      <span>— Khata (Outstanding)</span>
                      <span className="tabular-nums">{rs(summary!.khataTotal)}</span>
                    </div>
                  )}
                  {(summary?.cashReturnsTotal ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-surface-500">
                      <span>Cash Returns</span>
                      <span className="tabular-nums">− {rs(summary!.cashReturnsTotal)}</span>
                    </div>
                  )}
                  {/* Malik (18 September): "Bill, Load, Udhaar, Recovery
                      bhi golak ke hisaab mein aane chahiye" -- isi shift
                      (staff + shop, opened_at se ab tak) ke Load & Bill
                      aur Udhaar/Recovery ki CASH wali qatarein. */}
                  {(summary?.billTotal ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-surface-500">
                      <span>Bill Payment</span>
                      <span className="tabular-nums">{rs(summary!.billTotal)}</span>
                    </div>
                  )}
                  {(summary?.loadTotal ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-surface-500">
                      <span>Mobile Load</span>
                      <span className="tabular-nums">{rs(summary!.loadTotal)}</span>
                    </div>
                  )}
                  {(summary?.recoveryCashTotal ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-surface-500">
                      <span>Recovery (Cash)</span>
                      <span className="tabular-nums">+ {rs(summary!.recoveryCashTotal)}</span>
                    </div>
                  )}
                  {(summary?.udhaarGivenCashTotal ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-surface-500">
                      <span>Udhaar Diya (Cash)</span>
                      <span className="tabular-nums">− {rs(summary!.udhaarGivenCashTotal)}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between border-t border-surface-200 pt-1.5 text-surface-500 dark:border-surface-700">
                    <span>Opening Cash</span>
                    <span className="tabular-nums">{rs(openingCash)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-surface-200 pt-1.5 font-semibold text-surface-900 dark:border-surface-700 dark:text-white">
                    <span>Expected Cash (golak mein hona chahiye)</span>
                    <span className="tabular-nums">{summary ? rs(summary.expectedCash) : "…"}</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-400">
                    Ginti ki hui (physical) cash
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">Rs</span>
                    <input
                      name="counted_cash"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      autoFocus
                      className="w-full rounded-xl border border-surface-200 py-2.5 pl-9 pr-3 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-surface-700 dark:bg-surface-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-400">Note (agar ho)</label>
                  <input
                    name="closing_note"
                    className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-surface-700 dark:bg-surface-900"
                  />
                </div>
                {state.error && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.error}
                  </p>
                )}
                <CloseButton />
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
