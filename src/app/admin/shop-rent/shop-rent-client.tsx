"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import {
  createRentAgreement,
  recordRentPayment,
  createShopBill,
  markBillPaid,
  uploadCompanyStamp,
  type ActionState,
} from "@/actions/shop-rent";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { Home, Plus, X, TrendingUp, TrendingDown, Zap, CheckCircle2, FileSignature, Stamp } from "lucide-react";

const initialState: ActionState = {};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Branch {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  payment_month: number;
  payment_year: number;
  amount_due: number;
  amount_paid: number;
  paid_date: string | null;
}

interface Agreement {
  id: string;
  branch_id: string;
  branch_name: string;
  landlord_name: string;
  landlord_contact: string | null;
  landlord_cnic: string | null;
  monthly_rent: number;
  due_day: number;
  agreement_start_date: string;
  agreement_end_date: string | null;
  agreement_document_url: string | null;
  advance_balance: number;
  current_month_paid: number;
  payments: Payment[];
}

interface Bill {
  id: string;
  branch_name: string;
  bill_type: string;
  bill_month: number;
  bill_year: number;
  amount: number;
  due_date: string | null;
  status: string;
  bill_image_url: string | null;
}

export function ShopRentClient({
  branches,
  agreements,
  bills,
  currentMonth,
  currentYear,
}: {
  branches: Branch[];
  agreements: Agreement[];
  bills: Bill[];
  currentMonth: number;
  currentYear: number;
}) {
  const [showAddAgreement, setShowAddAgreement] = useState(false);
  const lang = useLang();
  const [showAddBill, setShowAddBill] = useState(false);
  const [showStamp, setShowStamp] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button onClick={() => setShowStamp(true)} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">
          <Stamp className="h-4 w-4" />{t("sr_company_stamp_short", lang)}</button>
        <button onClick={() => setShowAddBill(true)} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">
          <Zap className="h-4 w-4" />{t("sr_add_bill", lang)}</button>
        <button onClick={() => setShowAddAgreement(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />{t("sr_make_agreement", lang)}</button>
      </div>

      {showAddAgreement && <AddAgreementModal branches={branches} onClose={() => setShowAddAgreement(false)} />}
      {showAddBill && <AddBillModal branches={branches} onClose={() => setShowAddBill(false)} />}
      {showStamp && <StampModal onClose={() => setShowStamp(false)} />}

      <div className="space-y-4">
        {agreements.map((a) => (
          <AgreementCard key={a.id} agreement={a} currentMonth={currentMonth} currentYear={currentYear} bills={bills.filter((b) => b.branch_name === a.branch_name)} />
        ))}
        {agreements.length === 0 && (
          <p className="rounded-card border border-dashed border-surface-200 bg-white p-10 text-center text-surface-400">{t("sr_none_yet", lang)}</p>
        )}
      </div>
    </div>
  );
}

function AgreementCard({ agreement, currentMonth, currentYear, bills }: { agreement: Agreement; currentMonth: number; currentYear: number; bills: Bill[] }) {
  const [showPay, setShowPay] = useState(false);
  const lang = useLang();
  const isPaidThisMonth = agreement.current_month_paid >= agreement.monthly_rent;

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 font-display text-base font-semibold text-surface-900 dark:text-white">
            <Home className="h-4 w-4" /> {agreement.branch_name}
          </h3>
          <p className="text-xs text-surface-500">Landlord: {agreement.landlord_name} {agreement.landlord_contact ? `(${agreement.landlord_contact})` : ""}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold text-surface-900 dark:text-white">Rs {agreement.monthly_rent.toLocaleString()}/mo</p>
          <p className="text-xs text-surface-400">Due: {agreement.due_day} har mahine</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className={`rounded-lg p-2 ${isPaidThisMonth ? "bg-green-50" : "bg-amber-50"}`}>
          <p className="text-xs text-surface-400">{t("sr_this_month", lang)}</p>
          <p className={`text-sm font-semibold ${isPaidThisMonth ? "text-green-700" : "text-amber-700"}`}>
            {isPaidThisMonth ? "Paid" : `Rs ${agreement.current_month_paid.toLocaleString()} / ${agreement.monthly_rent.toLocaleString()}`}
          </p>
        </div>
        <div className={`rounded-lg p-2 ${agreement.advance_balance >= 0 ? "bg-brand-50" : "bg-red-50"}`}>
          <p className="text-xs text-surface-400">{t("sr_advance_balance", lang)}</p>
          <p className={`flex items-center justify-center gap-1 text-sm font-semibold ${agreement.advance_balance >= 0 ? "text-brand-700" : "text-red-700"}`}>
            {agreement.advance_balance >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            Rs {Math.abs(agreement.advance_balance).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800">
          <p className="text-xs text-surface-400">{t("sr_bills_unpaid", lang)}</p>
          <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">{bills.filter((b) => b.status === "pending").length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowPay(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">{t("c_record_payment", lang)}</button>
        <Link href={`/admin/shop-rent/${agreement.id}/agreement`} className="flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
          <FileSignature className="h-3.5 w-3.5" />{t("sr_digital_agreement", lang)}</Link>
      </div>

      {bills.length > 0 && (
        <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sr_bills", lang)}</p>
          <div className="flex flex-wrap gap-1.5">
            {bills.slice(0, 6).map((b) => (
              <BillChip key={b.id} bill={b} />
            ))}
          </div>
        </div>
      )}

      {showPay && <PayModal agreement={agreement} currentMonth={currentMonth} currentYear={currentYear} onClose={() => setShowPay(false)} />}
    </div>
  );
}

function BillChip({ bill }: { bill: Bill }) {
  const [, formAction] = useFormState(markBillPaid, initialState);
  const lang = useLang();
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${bill.status === "paid" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {bill.bill_type} ({MONTHS[bill.bill_month - 1]}) Rs {bill.amount.toLocaleString()}
      {bill.status !== "paid" && (
        <form action={formAction}>
          <input type="hidden" name="bill_id" value={bill.id} />
          <button type="submit" title={t("sr_mark_paid", lang)}><CheckCircle2 className="h-3 w-3" /></button>
        </form>
      )}
    </span>
  );
}

function PayModal({ agreement, currentMonth, currentYear, onClose }: { agreement: Agreement; currentMonth: number; currentYear: number; onClose: () => void }) {
  const [state, formAction] = useFormState(recordRentPayment, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Rent Payment - {agreement.branch_name}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-surface-500">{t("sr_future_month", lang)}<strong>{t("c_advance_payment", lang)}</strong>{t("sr_can_also", lang)}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="agreement_id" value={agreement.id} />
          <div className="grid grid-cols-2 gap-2">
            <select name="payment_month" defaultValue={currentMonth} className="rounded-lg border border-surface-200 p-2 text-sm">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <input type="number" name="payment_year" defaultValue={currentYear} className="rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <input type="number" step="0.01" name="amount_due" defaultValue={agreement.monthly_rent} placeholder={t("sr_amount_due", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="amount_paid" defaultValue={agreement.monthly_rent} required placeholder={t("sr_amount_paid", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="payment_method" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="cash">{t("c_cash", lang)}</option>
            <option value="bank_transfer">{t("c_bank_transfer", lang)}</option>
            <option value="easypaisa">EasyPaisa</option>
            <option value="jazzcash">JazzCash</option>
          </select>
          <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={t("sr_save_payment", lang)} />
        </form>
      </div>
    </div>
  );
}

function StampModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(uploadCompanyStamp, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("sr_company_stamp", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-surface-500">{t("sr_stamp_note", lang)}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("sr_stamp_saved", lang)}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <input type="file" name="stamp_image" accept="image/*" required className="w-full text-sm" />
          <SubmitButton label={t("sr_upload_stamp", lang)} />
        </form>
      </div>
    </div>
  );
}

function AddAgreementModal({ branches, onClose }: { branches: Branch[]; onClose: () => void }) {
  const [state, formAction] = useFormState(createRentAgreement, initialState);
  const lang = useLang();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("sr_new_agreement", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && (
          <div className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            {t("sr_agreement_made", lang)}
            <button onClick={onClose} className="mt-2 block w-full rounded-lg bg-brand-600 py-1.5 text-center font-medium text-white">{t("c_close", lang)}</button>
          </div>
        )}
        {!state.success && (
          <form action={formAction} encType="multipart/form-data" className="space-y-2">
            <select name="branch_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">{t("sr_select_shop", lang)}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input name="shop_full_address" placeholder={t("sr_shop_address", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <input name="shop_size" placeholder={t("sr_shop_size", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

            <div className="border-t border-surface-100 pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sr_landlord", lang)}</div>
            <input name="landlord_name" required placeholder={t("sr_landlord_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <input name="landlord_contact" placeholder={t("sr_landlord_contact", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <input name="landlord_cnic" placeholder={t("sr_landlord_cnic", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

            <div className="border-t border-surface-100 pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sr_rent_duration", lang)}</div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.01" name="monthly_rent" required placeholder={t("sr_monthly_rent", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
              <input type="number" name="due_day" defaultValue="5" placeholder={t("sr_due_day", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.01" name="annual_increase_percent" defaultValue="10" placeholder={t("sr_annual_increase", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
              <input type="number" step="0.01" name="security_deposit" placeholder={t("sr_security_deposit", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" name="duration_years" defaultValue="5" placeholder={t("sr_duration_years", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
              <input type="number" name="renewal_years" defaultValue="4" placeholder={t("sr_renewal_years", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-surface-500">{t("sr_start_date", lang)}</label>
              <input type="date" name="agreement_start_date" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
            <input name="approved_use" placeholder={t("sr_approved_use", lang)} defaultValue="Office, Warehouse, Retail Outlet" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

            <div className="border-t border-surface-100 pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sr_payment_bank_details", lang)}</div>
            <input name="bank_account_title" placeholder={t("c_account_title", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input name="bank_name" placeholder={t("c_bank_name", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
              <input name="bank_account_number" placeholder={t("c_account_number", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            </div>

            <div className="border-t border-surface-100 pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sr_company_rep", lang)}</div>
            <div className="grid grid-cols-2 gap-2">
              <input name="company_rep_name" placeholder={t("sr_rep_name", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
              <input name="company_rep_title" placeholder={t("sr_rep_designation", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            </div>

            <div className="border-t border-surface-100 pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sr_witnesses", lang)}</div>
            <div className="grid grid-cols-2 gap-2">
              <input name="witness1_name" placeholder={t("sr_witness1_name", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
              <input name="witness1_cnic" placeholder={t("sr_witness1_cnic", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="witness2_name" placeholder={t("sr_witness2_name", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
              <input name="witness2_cnic" placeholder={t("sr_witness2_cnic", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            </div>

            <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <SubmitButton label={t("sr_create_agreement", lang)} />
          </form>
        )}
      </div>
    </div>
  );
}

function AddBillModal({ branches, onClose }: { branches: Branch[]; onClose: () => void }) {
  const [state, formAction] = useFormState(createShopBill, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);
  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("sr_add_bill", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("sr_bill_added", lang)}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <select name="branch_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">{t("sr_select_shop", lang)}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select name="bill_type" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="Electricity">{t("c_electricity", lang)}</option>
            <option value="Gas">{t("sr_gas", lang)}</option>
            <option value="Water">{t("sr_water", lang)}</option>
            <option value="Maintenance">{t("sr_maintenance", lang)}</option>
            <option value="Internet">{t("sr_internet", lang)}</option>
            <option value="Other">{t("c_other", lang)}</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select name="bill_month" defaultValue={now.getMonth() + 1} className="rounded-lg border border-surface-200 p-2 text-sm">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <input type="number" name="bill_year" defaultValue={now.getFullYear()} className="rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <input type="number" step="0.01" name="amount" required placeholder={t("c_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="date" name="due_date" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">{t("sr_bill_photo", lang)}</label>
            <input type="file" name="bill_image" accept="image/*" className="mt-1 w-full text-xs" />
          </div>
          <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={t("sr_save_bill", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}