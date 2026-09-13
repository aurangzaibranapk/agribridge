"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Landmark, CheckCircle2, AlertTriangle, Clock, X } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { submitCollectionDeposit, type ActionState } from "@/actions/pos-collection";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import type { StaffShopOutstanding } from "@/lib/pos/collection-outstanding";
import type { MyDepositHistoryRow } from "@/actions/pos-collection";

const KHALI: ActionState = {};

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending Approval", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  approved: { label: "Approved", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", tone: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" },
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Submit ho raha hai..." : "Submit Bank Deposit"}
    </button>
  );
}

function DepositForm({
  shop,
  banks,
  onDone,
}: {
  shop: StaffShopOutstanding;
  banks: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action] = useFormState(submitCollectionDeposit, KHALI);
  const [slipUrl, setSlipUrl] = useState("");

  if (state.success) {
    return (
      <div className="px-5 py-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-sm font-medium text-surface-900 dark:text-white">{state.message}</p>
        <button
          type="button"
          onClick={onDone}
          className="mt-4 rounded-lg border border-surface-200 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
        >
          Theek hai
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 px-5 py-5">
      <input type="hidden" name="shop_id" value={shop.shopId} />

      <div className="rounded-xl bg-surface-50 px-4 py-3 text-xs dark:bg-surface-800">
        <div className="flex items-center justify-between text-surface-700 dark:text-surface-300">
          <span>Shop</span>
          <span className="font-medium">{shop.shopName}</span>
        </div>
        <div className="mt-1 flex items-center justify-between font-semibold text-surface-900 dark:text-white">
          <span>Outstanding</span>
          <span className="tabular-nums">{rs(shop.outstanding)}</span>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-400">Deposit Amount</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">Rs</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            max={shop.outstanding}
            step="0.01"
            required
            autoFocus
            className="w-full rounded-xl border border-surface-200 py-2.5 pl-9 pr-3 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-900"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-400">Company Bank Account</label>
        <select
          name="bank_account_id"
          required
          className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">— chunein —</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-400">Deposit Date</label>
        <input
          name="deposit_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
      </div>

      <PaymentSlipUpload onUploaded={setSlipUrl} />
      {!slipUrl && <p className="text-[11px] text-surface-400">Slip upload karna lazmi hai.</p>}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-400">Note (agar ho)</label>
        <input
          name="staff_note"
          className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
      </div>

      {state.error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}

export function MyCollectionClient({
  shops,
  history,
  banks,
  highlightId,
}: {
  shops: StaffShopOutstanding[];
  history: MyDepositHistoryRow[];
  banks: { id: string; name: string }[];
  highlightId?: string;
}) {
  const [openShop, setOpenShop] = useState<StaffShopOutstanding | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shops.map((s) => (
          <Card key={s.shopId} className="p-4">
            <p className="text-xs font-medium text-surface-500">{s.shopName}</p>
            <p className="mt-1 font-display text-2xl font-bold text-surface-900 dark:text-white">{rs(s.outstanding)}</p>
            <p className="text-[11px] text-surface-400">POS Collection Outstanding</p>

            <div className="mt-3 space-y-1 text-xs text-surface-600 dark:text-surface-400">
              <div className="flex items-center justify-between">
                <span>Today&apos;s Sale</span>
                <span className="tabular-nums">{rs(s.todayCollected)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Deposit Pending Approval</span>
                <span className="tabular-nums">{rs(s.pendingDeposits)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Verified/Settled</span>
                <span className="tabular-nums">{rs(s.approvedDeposits)}</span>
              </div>
            </div>

            <button
              onClick={() => setOpenShop(s)}
              disabled={s.outstanding <= 0}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Landmark className="h-3.5 w-3.5" /> Submit Bank Deposit
            </button>
          </Card>
        ))}
      </div>

      {openShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-surface-900">
            <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4 dark:border-surface-800">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">Submit Bank Deposit</p>
              <button
                onClick={() => setOpenShop(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DepositForm shop={openShop} banks={banks} onDone={() => setOpenShop(null)} />
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
          Recent Deposits
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">Abhi koi deposit submit nahi hui.</p>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {history.map((h) => (
              <li
                key={h.id}
                className={`flex items-start justify-between gap-3 px-4 py-2.5 ${h.id === highlightId ? "bg-brand-50/70 dark:bg-brand-950/20" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white">
                    {rs(h.amount)} <span className="text-xs font-normal text-surface-400">· {h.shopName}</span>
                  </p>
                  <p className="text-xs text-surface-400">
                    {h.depositNumber} · {new Date(h.submittedAt).toLocaleDateString("en-PK")}
                  </p>
                  {h.status === "rejected" && h.financeNote && (
                    <p className="mt-0.5 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {h.financeNote}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_LABEL[h.status]?.tone ?? ""}`}
                >
                  {h.status === "pending" && <Clock className="mr-1 inline h-3 w-3" />}
                  {STATUS_LABEL[h.status]?.label ?? h.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
