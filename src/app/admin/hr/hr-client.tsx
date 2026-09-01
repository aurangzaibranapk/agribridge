"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveStaffDetails,
  markAttendance,
  recordSalaryPayment,
  markSalaryPaid,
  inviteStaffMember,
  bulkDeactivateStaff,
  type ActionState,
} from "@/actions/hr";
import { DEPARTMENTS } from "@/lib/departments";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Plus, X, CheckSquare, UserPlus } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface StaffDetails {
  designation: string | null;
  cnic: string | null;
  phone: string | null;
  address: string | null;
  hire_date: string | null;
  basic_salary: number | null;
  bank_account: string | null;
}

interface Staff {
  id: string;
  full_name: string;
  role: string;
  details: StaffDetails | null;
}

interface Attendance {
  id: string;
  profile_id: string;
  attendance_date: string;
  status: string;
  staff_name: string;
}

interface Salary {
  id: string;
  profile_id: string;
  pay_month: number;
  pay_year: number;
  basic_salary: number;
  bonus: number;
  deductions: number;
  advance_deduction: number;
  net_salary: number;
  status: string;
  staff_name: string;
}

interface Branch { id: string; name: string; }

/** Hazri ki halat database mein jo likhi hai, us ka lafz kahan se aaye. */
const ATTENDANCE_KEY = {
  present: "hr_present",
  absent: "hr_absent",
  leave: "hr_leave",
  half_day: "hr_half_day",
} as const satisfies Record<string, "hr_present" | "hr_absent" | "hr_leave" | "hr_half_day">;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  sales_staff: "Sales Staff",
};

export function HRClient({
  staff,
  attendance,
  salaries,
  branches,
  accounts,
}: {
  staff: Staff[];
  attendance: Attendance[];
  salaries: Salary[];
  branches: Branch[];
  /** Tankhwah kis khate se nikle -- us ke baghair paisa kisi kitab mein nahi jata. */
  accounts: { id: string; name: string }[];
}) {
  const lang = useLang();
  const [tab, setTab] = useState<"staff" | "attendance" | "salary">("staff");
  const [selected, setSelected] = useState<string[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);
  const [showSalaryForm, setShowSalaryForm] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleSelectAll() {
    setSelected(selected.length === staff.length ? [] : staff.map((s) => s.id));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-surface-200 dark:border-surface-800">
        <div className="flex gap-2">
          <TabButton active={tab === "staff"} onClick={() => setTab("staff")}>{t("hr_tab_staff", lang)}</TabButton>
          <TabButton active={tab === "attendance"} onClick={() => setTab("attendance")}>{t("hr_tab_attendance", lang)}</TabButton>
          <TabButton active={tab === "salary"} onClick={() => setTab("salary")}>{t("hr_tab_salary", lang)}</TabButton>
        </div>
        {tab === "staff" && (
          <button onClick={() => setShowInvite(true)} className="mb-2 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <UserPlus className="h-3.5 w-3.5" /> {t("hr_invite_staff", lang)}
          </button>
        )}
      </div>

      {tab === "staff" && (
        <div>
          {selected.length > 0 && <BulkActionBar selectedIds={selected} onDone={() => setSelected([])} />}
          <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={selected.length === staff.length && staff.length > 0} onChange={toggleSelectAll} />
                  </th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_name", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_role", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_designation", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_phone", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("hr_basic_salary", lang)}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{s.full_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{ROLE_LABELS[s.role] ?? s.role}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{s.details?.designation ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{s.details?.phone ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-surface-800 dark:text-surface-200">{s.details?.basic_salary ? `Rs ${s.details.basic_salary.toLocaleString()}` : "-"}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => setEditingStaff(s)} className="text-xs font-medium text-brand-600 hover:underline">{t("hr_edit", lang)}</button>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">{t("hr_no_staff", lang)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div>
          <button onClick={() => setShowMarkAttendance(true)} className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> {t("hr_mark_attendance", lang)}
          </button>
          <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_staff", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_date", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_status", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{a.staff_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{a.attendance_date}</td>
                    <td className="px-3 py-2">
                      <Badge tone={a.status === "present" ? "green" : a.status === "absent" ? "red" : "amber"}>{t(ATTENDANCE_KEY[a.status as keyof typeof ATTENDANCE_KEY] ?? "hr_status", lang)}</Badge>
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-surface-400">{t("hr_no_record", lang)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "salary" && (
        <div>
          <button onClick={() => setShowSalaryForm(true)} className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> {t("hr_record_salary", lang)}
          </button>
          <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_staff", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_month_year", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("hr_net_salary", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("hr_status", lang)}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((s) => (
                  <tr key={s.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{s.staff_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{s.pay_month}/{s.pay_year}</td>
                    <td className="px-3 py-2 text-right text-surface-800 dark:text-surface-200">Rs {s.net_salary.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Badge tone={s.status === "paid" ? "green" : "amber"}>{t(s.status === "paid" ? "hr_paid" : "hr_pending", lang)}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {s.status !== "paid" && <MarkPaidButton paymentId={s.id} accounts={accounts} />}
                    </td>
                  </tr>
                ))}
                {salaries.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-surface-400">{t("hr_no_record", lang)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvite && <InviteStaffModal branches={branches} onClose={() => setShowInvite(false)} />}
      {editingStaff && <EditStaffModal staff={editingStaff} onClose={() => setEditingStaff(null)} />}
      {showMarkAttendance && <MarkAttendanceModal staff={staff} onClose={() => setShowMarkAttendance(false)} />}
      {showSalaryForm && <SalaryFormModal staff={staff} onClose={() => setShowSalaryForm(false)} />}
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

function BulkActionBar({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(bulkDeactivateStaff, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
      <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
        <CheckSquare className="h-4 w-4" /> {selectedIds.length} {t("hr_selected", lang)}
      </span>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`${selectedIds.length} — ${t("hr_confirm_deactivate", lang)}`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <button type="submit" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">{t("hr_deactivate", lang)}</button>
      </form>
      <button onClick={onDone} className="ml-auto text-xs text-surface-500 hover:text-surface-700">{t("hr_cancel", lang)}</button>
    </div>
  );
}

function InviteStaffModal({ branches, onClose }: { branches: Branch[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(inviteStaffMember, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("hr_invite_staff", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("hr_invite_sent", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <Input name="full_name" required placeholder={t("hr_name_req", lang)} />
          <Input type="email" name="email" required placeholder={t("hr_email_req", lang)} />
          {/* Role yani DEPARTMENT. Yahan pehle sirf teen option the --
              is liye Machinery, HR, Procurement ya Dairy ka banda bulaya
              hi nahi ja sakta tha, aur /admin/departments par un ke
              saamne hamesha "0 banday" likha aata tha. Ab fehrist
              DEPARTMENTS se banti hai. */}
          <Select name="role" required defaultValue="sales_staff">
            {DEPARTMENTS.map((d) => (
              <option key={d.role} value={d.role}>{d.label}</option>
            ))}
            <option value="admin">{t("at_admin", lang)}</option>
          </Select>
          <Select name="branch_id">
            <option value="">{t("hr_branch_optional", lang)}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Input name="designation" placeholder={t("hr_designation_optional", lang)} />
          <Input type="number" step="0.01" name="basic_salary" placeholder={t("hr_basic_salary_optional", lang)} />
          <SubmitButton label={t("hr_invite", lang)} />
        </form>
      </div>
    </div>
  );
}

function EditStaffModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(saveStaffDetails, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{staff.full_name} — {t("hr_details", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="profile_id" value={staff.id} />
          <Input name="designation" defaultValue={staff.details?.designation ?? ""} placeholder={t("hr_designation", lang)} />
          <Input name="cnic" defaultValue={staff.details?.cnic ?? ""} placeholder={t("hr_cnic", lang)} />
          <Input name="phone" defaultValue={staff.details?.phone ?? ""} placeholder={t("hr_phone", lang)} />
          <Textarea name="address" defaultValue={staff.details?.address ?? ""} rows={2} placeholder={t("hr_address", lang)} />
          <div>
            <Label>{t("hr_hire_date", lang)}</Label>
            <Input type="date" name="hire_date" defaultValue={staff.details?.hire_date ?? ""} />
          </div>
          <Input type="number" step="0.01" name="basic_salary" defaultValue={staff.details?.basic_salary ?? ""} placeholder={t("hr_basic_salary", lang)} />
          <Input name="bank_account" defaultValue={staff.details?.bank_account ?? ""} placeholder={t("hr_bank_account", lang)} />
          <SubmitButton label={t("hr_save", lang)} />
        </form>
      </div>
    </div>
  );
}

function MarkAttendanceModal({ staff, onClose }: { staff: Staff[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(markAttendance, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("hr_mark_attendance", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Select name="profile_id" required>
            <option value="">{t("hr_pick_staff", lang)}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </Select>
          <Input type="date" name="attendance_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          <Select name="status" required>
            <option value="present">{t("hr_present", lang)}</option>
            <option value="absent">{t("hr_absent", lang)}</option>
            <option value="leave">{t("hr_leave", lang)}</option>
            <option value="half_day">{t("hr_half_day", lang)}</option>
          </Select>
          <Textarea name="notes" rows={2} placeholder={t("at_notes_opt", lang)} />
          <SubmitButton label={t("hr_mark", lang)} />
        </form>
      </div>
    </div>
  );
}

function SalaryFormModal({ staff, onClose }: { staff: Staff[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordSalaryPayment, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("hr_record_salary", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Select name="profile_id" required>
            <option value="">{t("hr_pick_staff", lang)}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input type="number" name="pay_month" min="1" max="12" defaultValue={now.getMonth() + 1} required placeholder={t("hr_month", lang)} />
            <Input type="number" name="pay_year" defaultValue={now.getFullYear()} required placeholder={t("hr_year", lang)} />
          </div>
          <Input type="number" step="0.01" name="basic_salary" required placeholder={t("hr_basic_salary_req", lang)} />
          <Input type="number" step="0.01" name="bonus" placeholder={t("hr_bonus", lang)} />
          <Input type="number" step="0.01" name="deductions" placeholder={t("hr_deductions", lang)} />
          <Input type="number" step="0.01" name="advance_deduction" placeholder={t("hr_advance_deduction", lang)} />
          <Textarea name="notes" rows={2} placeholder={t("at_notes_opt", lang)} />
          <SubmitButton label={t("hr_record", lang)} />
        </form>
      </div>
    </div>
  );
}

/**
 * Tankhwah dena -- ab khata poochh kar.
 *
 * Pehle ye ek button tha jo sirf nishan laga deta tha. Paisa nikalta tha
 * aur kisi kitab mein nahi aata tha. Ab ye poochhta hai ke kis khate se
 * nikla, kyunke us ke baghair raat ki ginti mein farq nikal aata hai
 * jis ki wajah nahi milti.
 */
function MarkPaidButton({ paymentId, accounts }: { paymentId: string; accounts: { id: string; name: string }[] }) {
  const lang = useLang();
  const [state, formAction] = useFormState(markSalaryPaid, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 600);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="payment_id" value={paymentId} />
      <select
        name="account_id"
        required
        defaultValue=""
        className="rounded border border-surface-200 px-1 py-0.5 text-xs dark:border-surface-700 dark:bg-surface-900"
      >
        <option value="">{t("hr_from_which_account", lang)}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs font-medium text-green-600 hover:underline">{t("hr_mark_paid", lang)}</button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? t("hr_saving", lang) : label}</Button>;
}