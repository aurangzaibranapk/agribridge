"use client";
import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestExpense, approveExpense, rejectExpense, type ActionState } from "@/actions/company-expenses";
import { Plus, X, CheckCircle2, XCircle, FileText } from "lucide-react";
const initialState: ActionState = {};
const CATEGORIES = [
  { value: "inventory_purchase", label: "Inventory Purchase" },
  { value: "rent", label: "Shop Rent" },
  { value: "salary", label: "Salary" },
  { value: "utility_bill", label: "Utility Bill (Electricity/Gas)" },
  { value: "supplier_payment", label: "Supplier Payment" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];
const BUSINESS_TYPE_LABELS: Record<string, string> = {
  karyana: "Karyana",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain",
  dairy: "Dairy",
  machinery_fleet: "Machinery",
};
interface Expense {
  id: string;
  expense_number: string;
  category: string;
  amount: number;
  description: string;
  document_url: string | null;
  status: string;
  rejection_reason: string | null;
  supplier_name: string | null;
  branch_name: string | null;
  shop_name: string | null;
  created_at: string;
}
interface Supplier {
  id: string;
  name: string;
}
interface Branch {
  id: string;
  name: string;
}
interface Shop {
  id: string;
  name: string;
  branch_id: string;
  business_type: string;
}
function statusColor(status: string) {
  if (status === "approved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}
export function CompanyExpensesClient({ expenses, suppliers, branches, shops }: { expenses: Expense[]; suppliers: Supplier[]; branches: Branch[]; shops: Shop[] }) {
  const [showRequest, setShowRequest] = useState(false);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowRequest(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Expense Request Karein
        </button>
      </div>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">No.</th>
              <th className="px-3 py-2 font-medium text-surface-500">Category</th>
              <th className="px-3 py-2 font-medium text-surface-500">Description</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Amount</th>
              <th className="px-3 py-2 font-medium text-surface-500">Status</th>
              <th className="px-3 py-2 font-medium text-surface-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-mono text-xs text-surface-500">{e.expense_number}</td>
                <td className="px-3 py-2 text-surface-700 dark:text-surface-300">
                  {CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                  {e.supplier_name && <span className="block text-xs text-surface-400">{e.supplier_name}</span>}
                  {e.branch_name && <span className="block text-xs text-surface-400">{e.branch_name}{e.shop_name ? ` - ${e.shop_name}` : ""}</span>}
                </td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                  {e.description}
                  {e.document_url && (
                    <a href={e.document_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-xs text-brand-600 hover:underline">
                      <FileText className="h-3 w-3" /> Doc
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {e.amount.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(e.status)}`}>{e.status}</span>
                  {e.rejection_reason && <p className="mt-0.5 text-xs text-red-600">{e.rejection_reason}</p>}
                </td>
                <td className="px-3 py-2">
                  {e.status === "pending" && <ApprovalActions expenseId={e.id} />}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-surface-400">Koi expense request nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showRequest && <RequestExpenseModal suppliers={suppliers} branches={branches} shops={shops} onClose={() => setShowRequest(false)} />}
    </div>
  );
}
function ApprovalActions({ expenseId }: { expenseId: string }) {
  const [approveState, approveAction] = useFormState(approveExpense, initialState);
  const [showReject, setShowReject] = useState(false);
  return (
    <div className="flex gap-1.5">
      <form action={approveAction}>
        <input type="hidden" name="expense_id" value={expenseId} />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" /> Approve
        </button>
      </form>
      <button onClick={() => setShowReject(true)} className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
        <XCircle className="h-3 w-3" /> Reject
      </button>
      {showReject && <RejectModal expenseId={expenseId} onClose={() => setShowReject(false)} />}
    </div>
  );
}
function RejectModal({ expenseId, onClose }: { expenseId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(rejectExpense, initialState);
  if (state.success) setTimeout(onClose, 800);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Reject Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="expense_id" value={expenseId} />
          <textarea name="rejection_reason" required rows={3} placeholder="Wajah likhein" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">Confirm Reject</button>
        </form>
      </div>
    </div>
  );
}
function RequestExpenseModal({ suppliers, branches, shops, onClose }: { suppliers: Supplier[]; branches: Branch[]; shops: Shop[]; onClose: () => void }) {
  const [state, formAction] = useFormState(requestExpense, initialState);
  const [category, setCategory] = useState("other");
  const [branchId, setBranchId] = useState("");
  if (state.success) setTimeout(onClose, 800);

  const shopsForBranch = useMemo(() => shops.filter((s) => s.branch_id === branchId), [shops, branchId]);
  const showLocationFields = ["rent", "salary", "utility_bill", "maintenance", "other"].includes(category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Expense Request Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {category === "supplier_payment" && (
            <select name="supplier_id" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- Supplier Select Karein -</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {showLocationFields && (
            <>
              <select name="branch_id" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">- Branch Select Karein -</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {branchId && shopsForBranch.length > 0 && (
                <select name="shop_id" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
                  <option value="">- Shop Select Karein (agar specific ho) -</option>
                  {shopsForBranch.map((s) => (
                    <option key={s.id} value={s.id}>{BUSINESS_TYPE_LABELS[s.business_type] ?? s.business_type} ({s.name})</option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-surface-400">Shop select karein taake ye kharcha us Shop ki P&L mein sahi jaye. Agar poore Branch ka mushtarka kharcha hai to Shop khaali chhod dein.</p>
            </>
          )}
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="description" required rows={2} placeholder="Description" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">Document/Receipt Upload (optional)</label>
            <input type="file" name="document" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Request Submit Karein"}</button>;
}