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
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Plus, X, CheckSquare, UserPlus } from "lucide-react";

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
}: {
  staff: Staff[];
  attendance: Attendance[];
  salaries: Salary[];
  branches: Branch[];
}) {
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
          <TabButton active={tab === "staff"} onClick={() => setTab("staff")}>Staff</TabButton>
          <TabButton active={tab === "attendance"} onClick={() => setTab("attendance")}>Attendance</TabButton>
          <TabButton active={tab === "salary"} onClick={() => setTab("salary")}>Salary</TabButton>
        </div>
        {tab === "staff" && (
          <button onClick={() => setShowInvite(true)} className="mb-2 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <UserPlus className="h-3.5 w-3.5" /> Naya Staff Invite Karein
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
                  <th className="px-3 py-2 font-medium text-surface-500">Naam</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Role</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Designation</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Phone</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Basic Salary</th>
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
                      <button onClick={() => setEditingStaff(s)} className="text-xs font-medium text-brand-600 hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">Koi Staff nahi hai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div>
          <button onClick={() => setShowMarkAttendance(true)} className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Attendance Mark Karein
          </button>
          <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Staff</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Date</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{a.staff_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{a.attendance_date}</td>
                    <td className="px-3 py-2">
                      <Badge tone={a.status === "present" ? "green" : a.status === "absent" ? "red" : "amber"}>{a.status}</Badge>
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-surface-400">Koi record nahi hai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "salary" && (
        <div>
          <button onClick={() => setShowSalaryForm(true)} className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Salary Record Karein
          </button>
          <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Staff</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Month/Year</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Net Salary</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Status</th>
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
                      <Badge tone={s.status === "paid" ? "green" : "amber"}>{s.status === "paid" ? "Paid" : "Pending"}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {s.status !== "paid" && <MarkPaidButton paymentId={s.id} />}
                    </td>
                  </tr>
                ))}
                {salaries.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-surface-400">Koi record nahi hai.</td></tr>
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
  const [state, formAction] = useFormState(bulkDeactivateStaff, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
      <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
        <CheckSquare className="h-4 w-4" /> {selectedIds.length} selected
      </span>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Kya aap ${selectedIds.length} Staff ko Inactive karna chahte hain?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <button type="submit" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">Inactive Karein</button>
      </form>
      <button onClick={onDone} className="ml-auto text-xs text-surface-500 hover:text-surface-700">Cancel</button>
    </div>
  );
}

function InviteStaffModal({ branches, onClose }: { branches: Branch[]; onClose: () => void }) {
  const [state, formAction] = useFormState(inviteStaffMember, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Naya Staff Invite Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Invite bhej di gayi, login details email mein hain.</p>}
        <form action={formAction} className="space-y-2">
          <Input name="full_name" required placeholder="Naam *" />
          <Input type="email" name="email" required placeholder="Email *" />
          <Select name="role" required>
            <option value="sales_staff">Sales Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
          <Select name="branch_id">
            <option value="">- Branch (optional) -</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Input name="designation" placeholder="Designation (optional)" />
          <Input type="number" step="0.01" name="basic_salary" placeholder="Basic Salary (optional)" />
          <SubmitButton label="Invite Karein" />
        </form>
      </div>
    </div>
  );
}

function EditStaffModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const [state, formAction] = useFormState(saveStaffDetails, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{staff.full_name} - Details</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="profile_id" value={staff.id} />
          <Input name="designation" defaultValue={staff.details?.designation ?? ""} placeholder="Designation" />
          <Input name="cnic" defaultValue={staff.details?.cnic ?? ""} placeholder="CNIC" />
          <Input name="phone" defaultValue={staff.details?.phone ?? ""} placeholder="Phone" />
          <Textarea name="address" defaultValue={staff.details?.address ?? ""} rows={2} placeholder="Address" />
          <div>
            <Label>Hire Date</Label>
            <Input type="date" name="hire_date" defaultValue={staff.details?.hire_date ?? ""} />
          </div>
          <Input type="number" step="0.01" name="basic_salary" defaultValue={staff.details?.basic_salary ?? ""} placeholder="Basic Salary" />
          <Input name="bank_account" defaultValue={staff.details?.bank_account ?? ""} placeholder="Bank Account" />
          <SubmitButton label="Save Karein" />
        </form>
      </div>
    </div>
  );
}

function MarkAttendanceModal({ staff, onClose }: { staff: Staff[]; onClose: () => void }) {
  const [state, formAction] = useFormState(markAttendance, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Attendance Mark Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Select name="profile_id" required>
            <option value="">- Staff Select Karein -</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </Select>
          <Input type="date" name="attendance_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          <Select name="status" required>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
            <option value="half_day">Half Day</option>
          </Select>
          <Textarea name="notes" rows={2} placeholder="Notes (optional)" />
          <SubmitButton label="Mark Karein" />
        </form>
      </div>
    </div>
  );
}

function SalaryFormModal({ staff, onClose }: { staff: Staff[]; onClose: () => void }) {
  const [state, formAction] = useFormState(recordSalaryPayment, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Salary Record Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <Select name="profile_id" required>
            <option value="">- Staff Select Karein -</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input type="number" name="pay_month" min="1" max="12" defaultValue={now.getMonth() + 1} required placeholder="Month" />
            <Input type="number" name="pay_year" defaultValue={now.getFullYear()} required placeholder="Year" />
          </div>
          <Input type="number" step="0.01" name="basic_salary" required placeholder="Basic Salary *" />
          <Input type="number" step="0.01" name="bonus" placeholder="Bonus (optional)" />
          <Input type="number" step="0.01" name="deductions" placeholder="Deductions (optional)" />
          <Input type="number" step="0.01" name="advance_deduction" placeholder="Advance Deduction (optional)" />
          <Textarea name="notes" rows={2} placeholder="Notes (optional)" />
          <SubmitButton label="Record Karein" />
        </form>
      </div>
    </div>
  );
}

function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const [state, formAction] = useFormState(markSalaryPaid, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 600);

  return (
    <form action={formAction}>
      <input type="hidden" name="payment_id" value={paymentId} />
      <button type="submit" className="text-xs font-medium text-green-600 hover:underline">Paid Mark Karein</button>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : label}</Button>;
}