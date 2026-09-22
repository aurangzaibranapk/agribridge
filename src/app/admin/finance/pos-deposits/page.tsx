import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  collectionDepositsForFinance,
  collectionDepositSummary,
  collectionDepositFilterOptions,
  type DepositFilters,
} from "@/actions/pos-collection";
import { PosDepositsClient } from "./pos-deposits-client";

export const dynamic = "force-dynamic";

const money = (v: number) => `Rs ${Math.round(v).toLocaleString()}`;

export default async function PosDepositsPage({
  searchParams,
}: {
  searchParams?: {
    status?: string;
    branch_id?: string;
    shop_id?: string;
    staff_id?: string;
    bank_account_id?: string;
    from?: string;
    to?: string;
    deposit_id?: string;
  };
}) {
  const status = (searchParams?.status as DepositFilters["status"]) || "pending";
  const filters: DepositFilters = {
    status,
    branchId: searchParams?.branch_id || undefined,
    shopId: searchParams?.shop_id || undefined,
    staffId: searchParams?.staff_id || undefined,
    bankAccountId: searchParams?.bank_account_id || undefined,
    from: searchParams?.from || undefined,
    to: searchParams?.to || undefined,
    depositId: searchParams?.deposit_id || undefined,
  };

  const [result, summary, options] = await Promise.all([
    collectionDepositsForFinance(filters),
    collectionDepositSummary(),
    collectionDepositFilterOptions(),
  ]);

  if ("error" in result) {
    return <div className="p-8 text-center text-surface-400">{result.error}</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Deposit Verification"
        description="Sales staff ne jo bank deposit slip jama ki hai, us ki tasdeeq -- manzoor karne se hi POS Collection Outstanding kam hota hai."
      />

      {!("error" in summary) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-surface-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Today&apos;s Approved
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">{money(summary.todayApprovedAmount)}</p>
            <p className="text-[11px] text-surface-400">{summary.todayApprovedCount} deposit(s)</p>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-surface-500">
              <Clock className="h-3.5 w-3.5 text-amber-600" /> Pending Verification
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">{money(summary.pendingAmount)}</p>
            <p className="text-[11px] text-surface-400">{summary.pendingCount} deposit(s)</p>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-surface-500">
              <XCircle className="h-3.5 w-3.5 text-red-600" /> Rejected / Needs Correction
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">{summary.rejectedNeedsCorrectionCount}</p>
            <p className="text-[11px] text-surface-400">Staff se dobara jama karwani hai.</p>
          </Card>
        </div>
      )}

      {!("error" in options) && (
        <Card className="p-3">
          <form method="GET" className="flex flex-wrap items-end gap-2 text-sm">
            <label className="text-xs">
              Status
              <select name="status" defaultValue={status} className="ml-1.5 rounded-lg border px-2 py-1.5">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </label>
            {options.branches.length > 1 && (
              <label className="text-xs">
                Branch
                <select name="branch_id" defaultValue={searchParams?.branch_id || ""} className="ml-1.5 rounded-lg border px-2 py-1.5">
                  <option value="">Sab</option>
                  {options.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs">
              Shop
              <select name="shop_id" defaultValue={searchParams?.shop_id || ""} className="ml-1.5 rounded-lg border px-2 py-1.5">
                <option value="">Sab</option>
                {options.shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Staff
              <select name="staff_id" defaultValue={searchParams?.staff_id || ""} className="ml-1.5 rounded-lg border px-2 py-1.5">
                <option value="">Sab</option>
                {options.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Bank
              <select name="bank_account_id" defaultValue={searchParams?.bank_account_id || ""} className="ml-1.5 rounded-lg border px-2 py-1.5">
                <option value="">Sab</option>
                {options.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <input type="date" name="from" defaultValue={searchParams?.from || ""} className="rounded-lg border px-2 py-1.5 text-xs" title="Deposit date se" />
            <input type="date" name="to" defaultValue={searchParams?.to || ""} className="rounded-lg border px-2 py-1.5 text-xs" title="Deposit date tak" />
            <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">Apply</button>
          </form>
        </Card>
      )}

      {result.highlighted && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-600">Notification se — is record par</p>
          <PosDepositsClient deposits={[result.highlighted]} highlightId={result.highlighted.id} />
        </div>
      )}

      {result.rows.length === 0 && !result.highlighted ? (
        <Card className="p-6">
          <EmptyState title="Is filter par koi deposit nahi mili" description="Filters badal kar dekhein, ya nayi slip aane par yahan dikhengi." />
        </Card>
      ) : result.rows.length > 0 ? (
        <PosDepositsClient deposits={result.rows} highlightId={searchParams?.deposit_id} />
      ) : null}
    </div>
  );
}
