import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { CreditCard, ReceiptText, Home } from "lucide-react";
import { SupplierPaymentRequests } from "./supplier-payment-requests";

export const dynamic = "force-dynamic";

const HQ_APPROVER_ROLES = ["super_admin", "admin", "owner"];

export default async function FinanceQueuePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  const role = profile?.role ?? null;
  const canRequestPayment = role === "finance" || HQ_APPROVER_ROLES.includes(role ?? "");
  const canApprovePayment = HQ_APPROVER_ROLES.includes(role ?? "");

  const { data: pendingPayments } = await supabase
    .from("agri_order_payments")
    .select("id, payment_number, paid_amount, payment_method, order_id, agri_orders(order_number, shop_dealer_name)")
    .eq("status", "pending_verification")
    .order("created_at", { ascending: false });

  const { data: pendingExpenses } = await supabase
    .from("company_expense_requests")
    .select("id, expense_number, amount, category, description")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: pendingBills } = await supabase
    .from("shop_bills")
    .select("id, bill_type, amount, bill_month, bill_year, branches(name)")
    .eq("status", "pending")
    .order("bill_year", { ascending: false })
    .order("bill_month", { ascending: false });

  const { data: rawPaymentRequests } = await supabase
    .from("supplier_payment_requests")
    .select("id, request_number, amount, payment_method, notes, slip_url, status, rejection_reason, suppliers(name)")
    .in("status", ["pending", "approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: suppliers } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");

  const payments = (pendingPayments ?? []).map((p: any) => ({
    id: p.id,
    payment_number: p.payment_number,
    paid_amount: Number(p.paid_amount),
    payment_method: p.payment_method,
    order_id: p.order_id,
    order_number: Array.isArray(p.agri_orders) ? p.agri_orders[0]?.order_number : p.agri_orders?.order_number,
    shop_name: Array.isArray(p.agri_orders) ? p.agri_orders[0]?.shop_dealer_name : p.agri_orders?.shop_dealer_name,
  }));

  const expenses = (pendingExpenses ?? []).map((e: any) => ({
    id: e.id,
    expense_number: e.expense_number,
    amount: Number(e.amount),
    category: e.category,
    description: e.description,
  }));

  const bills = (pendingBills ?? []).map((b: any) => ({
    id: b.id,
    bill_type: b.bill_type,
    amount: Number(b.amount),
    bill_month: b.bill_month,
    bill_year: b.bill_year,
    branch_name: Array.isArray(b.branches) ? b.branches[0]?.name : b.branches?.name,
  }));

  const paymentRequests = (rawPaymentRequests ?? []).map((r: any) => ({
    id: r.id,
    request_number: r.request_number,
    amount: Number(r.amount),
    payment_method: r.payment_method,
    notes: r.notes,
    slip_url: r.slip_url,
    status: r.status,
    rejection_reason: r.rejection_reason,
    supplier_name: Array.isArray(r.suppliers) ? r.suppliers[0]?.name : r.suppliers?.name,
  }));

  const totalPendingCount = payments.length + expenses.length + bills.length + paymentRequests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader title="Finance Queue" description="Jahan bhi paisa involve hai - sab ek jagah, verify/approve ke liye" />

      <div className="mb-6">
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Total Pending Action</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-800 dark:text-brand-200">{totalPendingCount}</p>
        </Card>
      </div>

      {/* AgriBridge Order Payments */}
      <div className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <CreditCard className="h-4 w-4" /> AgriBridge Order Payments ({payments.length})
        </h2>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          {payments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-surface-400">Koi payment pending nahi hai.</p>
          ) : (
            payments.map((p) => (
              <Link
                key={p.id}
                href={`/admin/agri-orders/${p.order_id}`}
                className="flex items-center justify-between border-b border-surface-100 px-4 py-3 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
              >
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{p.order_number} - {p.shop_name}</p>
                  <p className="text-xs text-surface-400">{p.payment_number} | {p.payment_method}</p>
                </div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">Rs {p.paid_amount.toLocaleString()}</p>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Company Expenses */}
      <div className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <ReceiptText className="h-4 w-4" /> Company Expense Approvals ({expenses.length})
        </h2>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          {expenses.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-surface-400">Koi expense pending nahi hai.</p>
          ) : (
            expenses.map((e) => (
              <Link
                key={e.id}
                href="/admin/company-expenses"
                className="flex items-center justify-between border-b border-surface-100 px-4 py-3 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
              >
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{e.expense_number} - {e.category}</p>
                  <p className="text-xs text-surface-400">{e.description}</p>
                </div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">Rs {e.amount.toLocaleString()}</p>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Shop Bills */}
      <div className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <Home className="h-4 w-4" /> Shop Bills Pending ({bills.length})
        </h2>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          {bills.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-surface-400">Koi bill pending nahi hai.</p>
          ) : (
            bills.map((b) => (
              <Link
                key={b.id}
                href="/admin/shop-rent"
                className="flex items-center justify-between border-b border-surface-100 px-4 py-3 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
              >
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{b.branch_name} - {b.bill_type}</p>
                  <p className="text-xs text-surface-400">{b.bill_month}/{b.bill_year}</p>
                </div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">Rs {b.amount.toLocaleString()}</p>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Supplier Payment Requests - Finance requests, Admin/Owner approve */}
      <SupplierPaymentRequests requests={paymentRequests} suppliers={suppliers ?? []} canRequest={canRequestPayment} canApprove={canApprovePayment} />
    </div>
  );
}