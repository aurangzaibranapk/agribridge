"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils/format";

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

type LedgerRow = {
  entry_date: string;
  entry_number: string;
  tafseel: string;
  module: string;
  source_id: string | null;
  debit: number;
  credit: number;
  balance: number;
};

type SaleItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type SaleSummary = { total_amount: number; cash_paid: number };

export function StatementTable({
  rows,
  itemsMap,
  salesMap = {},
}: {
  rows: LedgerRow[];
  itemsMap: Record<string, SaleItem[]>;
  salesMap?: Record<string, SaleSummary>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
          <tr>
            <th className="w-6 px-2 py-2" />
            <th className="px-4 py-2">Tareekh</th>
            <th className="px-4 py-2">Entry</th>
            <th className="px-4 py-2">Tafseel</th>
            <th className="px-4 py-2 text-right">Liya</th>
            <th className="px-4 py-2 text-right">Diya</th>
            <th className="px-4 py-2 text-right">Baqi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const key = `${r.entry_number}-${i}`;
            const isPOS = r.module === "pos" && r.source_id;
            const items = isPOS ? (itemsMap[r.source_id!] ?? []) : [];
            const isOpen = expanded.has(key);
            // Split payment: poori sale aur cash dono dikhao
            const sale = isPOS && r.source_id ? salesMap[r.source_id] : undefined;
            const displayDebit = sale ? sale.total_amount : Number(r.debit);
            const displayCredit = sale ? sale.cash_paid + Number(r.credit) : Number(r.credit);

            return (
              <>
                <tr
                  key={key}
                  className={`border-t border-surface-100 dark:border-surface-800 ${
                    isPOS
                      ? "cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/40"
                      : ""
                  }`}
                  onClick={isPOS ? () => toggle(key) : undefined}
                >
                  <td className="px-2 py-2 text-surface-400">
                    {isPOS ? (
                      isOpen ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )
                    ) : null}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-surface-500">
                    {formatDate(r.entry_date)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.entry_number}</td>
                  <td className="px-4 py-2">{r.tafseel}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {displayDebit ? rs(displayDebit) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {displayCredit ? rs(displayCredit) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {rs(r.balance)}
                  </td>
                </tr>

                {isPOS && isOpen && (
                  <tr
                    key={`${key}-detail`}
                    className="border-t border-surface-100 bg-surface-50/60 dark:border-surface-800 dark:bg-surface-800/20"
                  >
                    <td />
                    <td colSpan={6} className="px-4 py-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-surface-400">
                          Is sale ke items nahi mile.
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-surface-400">
                              <th className="pb-1 text-left font-medium">Product</th>
                              <th className="pb-1 text-right font-medium">Qty</th>
                              <th className="pb-1 text-right font-medium">Rate</th>
                              <th className="pb-1 text-right font-medium">Jama</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-t border-surface-100 dark:border-surface-700"
                              >
                                <td className="py-1 pr-4">{item.product_name}</td>
                                <td className="py-1 text-right tabular-nums">
                                  {item.quantity}
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                  {rs(item.unit_price)}
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                  {rs(item.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
