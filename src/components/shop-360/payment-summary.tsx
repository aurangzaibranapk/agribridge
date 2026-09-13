"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Landmark, ReceiptText, WalletCards } from "lucide-react";

export interface PaymentSummaryRow {
  method: string;
  label: string;
  sales: number;
  expenseNet: number;
  net: number;
}

const money = (v: number | null | undefined) => v == null ? "—" : `Rs ${Number(v).toLocaleString()}`;

const CREDIT_METHODS = new Set(["khata", "credit", "customer_credit", "udhaar"]);

function methodKind(method: string) {
  if (CREDIT_METHODS.has(method)) return "Credit / Khata";
  if (method === "cash") return "Cash Collected";
  return "Non-Cash Collected";
}

export function Shop360PaymentSummary({
  rows,
  totalSales,
  verifiedDeposit,
  pendingDeposit,
  outstanding,
}: {
  rows: PaymentSummaryRow[];
  totalSales: number;
  verifiedDeposit: number;
  pendingDeposit: number;
  outstanding: number;
}) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const creditSale = rows
    .filter((r) => CREDIT_METHODS.has(r.method))
    .reduce((sum, r) => sum + Number(r.sales || 0), 0);
  const collectedSale = totalSales - creditSale;
  const usedCount = rows.filter((r) => Number(r.sales || 0) !== 0).length;
  const selected = selectedMethod ? rows.find((r) => r.method === selectedMethod) ?? null : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <WalletCards className="h-4 w-4" /> Sale & Payment Summary
          </h3>
          <p className="mt-1 text-xs text-surface-500">
            Har payment method ka total box mein jama hota rahega. Box par click karein to us method ki detail neeche khul jayegi.
          </p>
        </div>
        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600">
          {rows.length} methods · {usedCount} used
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Total Sale Value</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(totalSales)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Tamam payment methods + Khata.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Payment Received</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(collectedSale)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Khata/credit is amount mein shamil nahi.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Khata / Credit Sale</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(creditSale)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Sale hui, payment customer se leni hai.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Finance Verified Deposit</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(verifiedDeposit)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Company bank mein Finance-approved jama.</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs text-surface-500">Collection Outstanding</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(outstanding)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Abhi staff/shop custody ya settlement mein baki.</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Payment Methods</h4>
            <p className="text-[11px] text-surface-400">Box mein selected period ka jama balance. Neeche 3 totals hamesha clear rahenge.</p>
          </div>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
            <p className="text-xs font-medium text-surface-500">Total Sale</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{money(totalSales)}</p>
            <p className="mt-1 text-[11px] text-surface-400">Paid + Udhaar dono.</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-xs font-medium text-amber-700">Total Udhaar / Khata</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{money(creditSale)}</p>
            <p className="mt-1 text-[11px] text-amber-700/70">Customer se abhi lena hai.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-xs font-medium text-emerald-700">Payment Methods Total</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{money(collectedSale)}</p>
            <p className="mt-1 text-[11px] text-emerald-700/70">Cash + Bank + Kisan Card + Digital; Khata exclude.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {rows.map((r) => {
            const active = selectedMethod === r.method;
            return (
              <button
                key={r.method}
                type="button"
                onClick={() => setSelectedMethod(active ? null : r.method)}
                className={`rounded-xl border p-3 text-left transition hover:border-brand-300 hover:shadow-sm ${
                  active ? "border-brand-400 bg-brand-50/60" : "border-surface-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-surface-600">{r.label}</p>
                  {active ? <ChevronUp className="h-4 w-4 text-brand-600" /> : <ChevronDown className="h-4 w-4 text-surface-400" />}
                </div>
                <p className="mt-2 text-lg font-bold tabular-nums text-surface-900">{money(r.sales)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 pb-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-surface-500">Selected Payment Method</p>
              <h4 className="text-base font-semibold">{selected.label}</h4>
            </div>
            <p className="text-lg font-bold tabular-nums">{money(selected.sales)}</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-surface-500">Type</p>
              <p className="mt-1 font-semibold">{methodKind(selected.method)}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-surface-500">Expense / Adjustment</p>
              <p className="mt-1 font-semibold tabular-nums">{money(selected.expenseNet)}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-surface-500">Net Position</p>
              <p className="mt-1 font-semibold tabular-nums">{money(selected.net)}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-surface-500">
            Agla step transaction drill-down hai: isi method ki sale-wise entries, bill/reference aur staff detail yahin neeche dikhayi ja sakti hai jab source rows attach hon.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div className="rounded-lg bg-surface-50 p-3"><Landmark className="mr-1 inline h-4 w-4" />Pending Finance Deposit: <b>{money(pendingDeposit)}</b></div>
        <div className="rounded-lg bg-surface-50 p-3"><ReceiptText className="mr-1 inline h-4 w-4" />Verified Deposit: <b>{money(verifiedDeposit)}</b></div>
        <div className="rounded-lg bg-surface-50 p-3"><WalletCards className="mr-1 inline h-4 w-4" />Remaining Outstanding: <b>{money(outstanding)}</b></div>
      </div>

      <p className="text-[11px] text-surface-400">
        Note: Verified deposit, pending deposit aur outstanding ek hi collection lifecycle ke states hain; inhen total sale ke sath dobara jor kar fake grand total nahi banaya jata.
      </p>
    </section>
  );
}
