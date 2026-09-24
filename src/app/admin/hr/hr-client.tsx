"use client";
import Link from "next/link";
import { fetchAttendanceMonth } from "@/actions/hr-attendance";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveStaffDetails,
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
        <SalaryTab salaries={salaries} accounts={accounts} staff={staff} lang={lang} onNew={() => setShowSalaryForm(true)} />
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

/**
 * Hazri ab yahan se nahi lagti.
 *
 * Pehle ye modal seedha upsert karta tha: purani hazri par nayi likh kar
 * guzar jata tha, bina wajah ke, bina nishan ke. Ab hazri Calendar se
 * lagti hai -- wahan wajah lazmi hai, afsar ki hadd lagti hai, band
 * mahina rukta hai, aur purani qeemat record par mehfooz rehti hai.
 *
 * Modal ko chup chaap hata dena theek nahi tha: jo banda ise roz istemal
 * karta tha, usay ye maloom hona chahiye ke ab jana kahan hai.
 */
function MarkAttendanceModal({ staff, onClose }: { staff: Staff[]; onClose: () => void }) {
  const lang = useLang();
  void staff;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("hr_mark_attendance", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-surface-600 dark:text-surface-300">
          {t("hra_subtitle", lang)}
        </p>
        <Link
          href="/admin/hr/attendance"
          className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t("hra_title", lang)}
        </Link>
      </div>
    </div>
  );
}

function SalaryFormModal({ staff, onClose }: { staff: Staff[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordSalaryPayment, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  const now = new Date();
  const [who, setWho] = useState("");
  const [mm, setMm] = useState(now.getMonth() + 1);
  const [yy, setYy] = useState(now.getFullYear());
  const [att, setAtt] = useState<Awaited<ReturnType<typeof fetchAttendanceMonth>> | undefined>(undefined);

  // Live salary fields for net preview
  const [basic, setBasic] = useState("");
  const [bonus, setBonus] = useState("");
  const [deductions, setDeductions] = useState("");
  const [advance, setAdvance] = useState("");
  const [overtime, setOvertime] = useState("");

  // Auto-fill basic salary when employee selected
  function handleWho(id: string) {
    setWho(id);
    const s = staff.find((x) => x.id === id);
    if (s?.details?.basic_salary) setBasic(String(s.details.basic_salary));
  }

  const netSalary =
    (Number(basic) || 0) +
    (Number(bonus) || 0) +
    (Number(overtime) || 0) -
    (Number(deductions) || 0) -
    (Number(advance) || 0);

  useEffect(() => {
    if (!who) { setAtt(undefined); return; }
    let alive = true;
    setAtt(undefined);
    fetchAttendanceMonth(who, yy, mm).then((r) => { if (alive) setAtt(r); });
    return () => { alive = false; };
  }, [who, mm, yy]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-xl dark:bg-surface-900 overflow-y-auto max-h-[90vh]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("hr_record_salary", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Select name="profile_id" required value={who} onChange={(e) => handleWho(e.target.value)}>
            <option value="">{t("hr_pick_staff", lang)}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}{s.details?.basic_salary ? ` — Rs ${s.details.basic_salary.toLocaleString()}` : ""}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input type="number" name="pay_month" min="1" max="12" value={mm} onChange={(e) => setMm(Number(e.target.value))} required placeholder={t("hr_month", lang)} />
            <Input type="number" name="pay_year" value={yy} onChange={(e) => setYy(Number(e.target.value))} required placeholder={t("hr_year", lang)} />
          </div>

          {who && (
            <div className="rounded-lg border border-surface-200 p-2 text-xs dark:border-surface-700">
              {att === undefined ? (
                <p className="text-surface-400">…</p>
              ) : att === null ? (
                <p className="text-surface-500">Is mahine ki hazri parhi nahi ja saki.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Fig label={t("hra_working_days", lang)} v={att.workingDays} />
                    <Fig label={t("hra_present_days", lang)} v={att.presentDays} />
                    <Fig label={t("hra_leave_days", lang)} v={att.paidLeave + att.unpaidLeave} />
                    <Fig label={t("hra_absent_days", lang)} v={att.absentDays} />
                    <Fig label={t("hra_missing_days", lang)} v={att.missingDays} />
                    <Fig label={t("hra_late_days", lang)} v={att.lateCount} />
                  </div>
                  {(!att.isFinalized || att.openItems > 0) && (
                    <p className="mt-1.5 text-amber-700">
                      {t("hra_payroll_warning", lang)}
                      {att.openItems > 0 ? ` (${att.openItems})` : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">{t("hr_basic_salary_req", lang)}</label>
              <Input type="number" step="0.01" name="basic_salary" required value={basic} onChange={(e) => setBasic(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">{t("hr_bonus", lang)}</label>
              <Input type="number" step="0.01" name="bonus" value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">Overtime (Rs)</label>
              <Input type="number" step="0.01" name="overtime" value={overtime} onChange={(e) => setOvertime(e.target.value)} placeholder="0" />
              <p className="mt-0.5 text-[10px] text-surface-400">Extra kaam ke ghante × Rs 100</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">{t("hr_deductions", lang)}</label>
              <Input type="number" step="0.01" name="deductions" value={deductions} onChange={(e) => setDeductions(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">{t("hr_advance_deduction", lang)}</label>
              <Input type="number" step="0.01" name="advance_deduction" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" />
            </div>
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-2 dark:border-brand-800 dark:bg-brand-950/20">
              <p className="text-[10px] uppercase text-surface-400">Net tankhwah</p>
              <p className={`text-lg font-bold tabular-nums ${netSalary < 0 ? "text-red-600" : "text-brand-700 dark:text-brand-300"}`}>
                Rs {netSalary.toLocaleString()}
              </p>
            </div>
          </div>

          <Textarea name="notes" rows={2} placeholder={t("at_notes_opt", lang)} />
          <label className="flex items-start gap-2 text-xs text-surface-600 dark:text-surface-300">
            <input type="checkbox" name="ack_unfinalized" value="yes" className="mt-0.5" />
            <span>Hazri adhoori hai, phir bhi tankhwah banayein</span>
          </label>
          <SubmitButton label={t("hr_record", lang)} />
        </form>
      </div>
    </div>
  );
}

function SalaryTab({
  salaries,
  accounts,
  staff,
  lang,
  onNew,
}: {
  salaries: Salary[];
  accounts: { id: string; name: string }[];
  staff: Staff[];
  lang: import("@/lib/i18n/translations").Lang;
  onNew: () => void;
}) {
  const now = new Date();
  const [filterMm, setFilterMm] = useState(now.getMonth() + 1);
  const [filterYy, setFilterYy] = useState(now.getFullYear());

  const filtered = salaries.filter((s) => s.pay_month === filterMm && s.pay_year === filterYy);
  const totalNet = filtered.reduce((sum, s) => sum + s.net_salary, 0);
  const totalPaid = filtered.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.net_salary, 0);

  void staff; // staff passed for future use (e.g. bulk salary)

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={onNew} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Tankhwah banayein
        </button>
        <div className="flex items-center gap-1.5">
          <select
            value={filterMm}
            onChange={(e) => setFilterMm(Number(e.target.value))}
            className="rounded border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
          >
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input
            type="number"
            value={filterYy}
            onChange={(e) => setFilterYy(Number(e.target.value))}
            className="w-20 rounded border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
          />
        </div>
        {filtered.length > 0 && (
          <div className="ms-auto flex gap-4 text-sm">
            <span className="text-surface-500">Kul: <strong className="text-surface-900 dark:text-white">Rs {totalNet.toLocaleString()}</strong></span>
            <span className="text-surface-500">Di gayi: <strong className="text-emerald-700 dark:text-emerald-400">Rs {totalPaid.toLocaleString()}</strong></span>
            <span className="text-surface-500">Baqi: <strong className="text-amber-700 dark:text-amber-400">Rs {(totalNet - totalPaid).toLocaleString()}</strong></span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Staff</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Basic</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Bonus/OT</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Katauti</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Net</th>
              <th className="px-3 py-2 font-medium text-surface-500">Halat</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{s.staff_name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-surface-700 dark:text-surface-300">Rs {s.basic_salary.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{s.bonus > 0 ? `+${s.bonus.toLocaleString()}` : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{(s.deductions + s.advance_deduction) > 0 ? `-${(s.deductions + s.advance_deduction).toLocaleString()}` : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-surface-900 dark:text-white">Rs {s.net_salary.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Badge tone={s.status === "paid" ? "green" : "amber"}>{s.status === "paid" ? "Di gayi" : "Baqi"}</Badge>
                </td>
                <td className="px-3 py-2">
                  {s.status !== "paid" && <MarkPaidButton paymentId={s.id} accounts={accounts} />}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">
                Is mahine ({MONTHS[filterMm-1]} {filterYy}) koi tankhwah nahi — upar button se banayein.
              </td></tr>
            )}
          </tbody>
        </table>
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

/**
 * Ek chhota adad. Alag function is liye ke tankhwah ke form par ye
 * chhe dafa aata hai, aur chhe jagah alag alag likha jana wohi cheez
 * hai jis se adad ek doosre se mel khana chhoR dete hain.
 */
function Fig({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-surface-400">{label}</p>
      <p className="font-bold tabular-nums text-surface-800 dark:text-surface-100">{v}</p>
    </div>
  );
}
