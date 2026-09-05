"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/layout-primitives";
import { bulkUpdateInvestorStatus, bulkDeleteInvestors, type ActionState } from "@/actions/investors-bulk";
import { CheckSquare, FileText } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Deal {
  id: string;
  deal_type: string;
  amount_invested: number;
  profit_share_percentage: number;
  status: string;
}

interface Investor {
  id: string;
  investor_code: string;
  full_name: string;
  phone_number: string | null;
  total_invested: number;
  is_active: boolean;
  created_at: string;
  deals: Deal[];
}

function dealTypeLabel(type: string) {
  const map: Record<string, string> = {
    product_investment: "Product Investment",
    corporation_deal: "Corporation Deal",
    dairy_investment: "Dairy & Livestock",
    franchise: "Franchise",
  };
  return map[type] ?? type;
}

export function InvestorsListClient({ investors }: { investors: Investor[] }) {
  const lang = useLang();
  const [selected, setSelected] = useState<string[]>([]);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelected(selected.length === investors.length ? [] : investors.map((i) => i.id));
  }

  if (investors.length === 0) {
    return <EmptyState title={t("iv_none", lang)} description="Convert an investor inquiry to create your first investor." />;
  }

  return (
    <div>
      {selected.length > 0 && <BulkActionBar selectedIds={selected} onDone={() => setSelected([])} />}

      <div className="mb-2 flex items-center gap-2 px-1">
        <input type="checkbox" checked={selected.length > 0 && selected.length === investors.length} onChange={toggleSelectAll} />
        <span className="text-xs text-surface-500">Sab Select Karein ({selected.length} selected)</span>
      </div>

      <div className="space-y-3">
        {investors.map((inv) => (
          <div key={inv.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={selected.includes(inv.id)} onChange={() => toggleSelect(inv.id)} className="mt-1" />
                <div>
                  <p className="font-medium text-surface-900 dark:text-white">
                    {inv.full_name} <span className="ml-1 font-mono text-xs text-surface-400">({inv.investor_code})</span>
                    {!inv.is_active && <span className="ml-2 rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-500">{t("c_inactive", lang)}</span>}
                  </p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">
                    {inv.phone_number ?? "-"} - Joined {formatDateTime(inv.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                  Total Invested: Rs {inv.total_invested.toLocaleString()}
                </p>
                <Link href={`/admin/investors/${inv.id}/statement`} className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                  <FileText className="h-3.5 w-3.5" />{t("c_statement", lang)}</Link>
              </div>
            </div>
            {inv.deals.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-surface-100 pt-3 dark:border-surface-800">
                {inv.deals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                      {dealTypeLabel(d.deal_type)}
                      <Badge tone={d.status === "active" ? "green" : "gray"}>{d.status}</Badge>
                    </span>
                    <span className="text-surface-700 dark:text-surface-300">
                      Rs {d.amount_invested.toLocaleString()} @ {d.profit_share_percentage}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BulkActionBar({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const lang = useLang();
  const [statusState, statusAction] = useFormState(bulkUpdateInvestorStatus, initialState);
  const [deleteState, deleteAction] = useFormState(bulkDeleteInvestors, initialState);

  if (statusState.success || deleteState.success) setTimeout(onDone, 500);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
      <span className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <CheckSquare className="h-4 w-4" /> {selectedIds.length} selected
      </span>
      <form action={statusAction} className="flex gap-1">
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="is_active" value="true" />
        <button type="submit" className="rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200">{t("c_activate", lang)}</button>
      </form>
      <form action={statusAction} className="flex gap-1">
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="is_active" value="false" />
        <button type="submit" className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200">{t("c_deactivate", lang)}</button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`Kya aap ${selectedIds.length} investors delete karna chahte hain?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <button type="submit" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">{t("c_delete", lang)}</button>
      </form>
    </div>
  );
}