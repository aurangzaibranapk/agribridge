import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { CompanyExpensesClient } from "./company-expenses-client";
export const dynamic = "force-dynamic";
export default async function CompanyExpensesPage() {
  const supabase = createClient();
  const { data: rawExpenses } = await supabase
    .from("company_expense_requests")
    .select("*, suppliers(name), branches(name), shops(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name");
  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
  const { data: shops } = await supabase.from("shops").select("id, name, branch_id, business_type").eq("is_active", true).order("name");
  const expenses = (rawExpenses ?? []).map((e: any) => ({
    id: e.id,
    expense_number: e.expense_number,
    category: e.category,
    amount: Number(e.amount),
    description: e.description,
    document_url: e.document_url,
    status: e.status,
    rejection_reason: e.rejection_reason,
    supplier_name: Array.isArray(e.suppliers) ? e.suppliers[0]?.name : e.suppliers?.name,
    branch_name: Array.isArray(e.branches) ? e.branches[0]?.name : e.branches?.name,
    shop_name: Array.isArray(e.shops) ? e.shops[0]?.name : e.shops?.name,
    created_at: e.created_at,
  }));
  const pendingCount = expenses.filter((e) => e.status === "pending").length;
  const approvedTotal = expenses.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const pendingTotal = expenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  return (
    <div>
      <PageHeader title="Company Expenses" description="Har kharcha Request + Admin Approval ke sath - poora record" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Pending Approval</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">{pendingCount} (Rs {pendingTotal.toLocaleString()})</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">Total Approved</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {approvedTotal.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Total Requests</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{expenses.length}</p>
        </Card>
      </div>
      <CompanyExpensesClient expenses={expenses} suppliers={suppliers ?? []} branches={branches ?? []} shops={shops ?? []} />
    </div>
  );
}