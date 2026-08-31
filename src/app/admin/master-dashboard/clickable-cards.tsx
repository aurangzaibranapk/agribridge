"use client";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Wallet, Boxes, ArrowDownCircle, ArrowUpCircle, PiggyBank, Scale, ChevronDown, ChevronUp, ReceiptText, Milk } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface DataPoint {
  name: string;
  value: number;
}

interface SummaryProps {
  variant?: "summary";
  totalCapitalInvested: number;
  capitalBreakdown: DataPoint[];
  currentPosition: number;
  totalBankBalance: number;
  bankBreakdown: DataPoint[];
  totalInventoryValue: number;
  inventoryBreakdown: DataPoint[];
  totalReceivables: number;
  receivablesBreakdown: DataPoint[];
  totalPayables: number;
  payablesBreakdown: DataPoint[];
}

interface PLProps {
  variant: "pl";
  expenseBreakdown: DataPoint[];
  milkBreakdown: DataPoint[];
  totalExpenses: number;
  milkTotalDeductions: number;
}

export function ClickableCards(props: SummaryProps | PLProps) {
  const [openCard, setOpenCard] = useState<string | null>(null);
  const lang = useLang();

  function toggle(key: string) {
    setOpenCard(openCard === key ? null : key);
  }

  if (props.variant === "pl") {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ClickCard
          id="expenses"
          label={t("md_company_expenses", lang)}
          icon={<ReceiptText className="h-4 w-4" />}
          value={props.totalExpenses}
          valueColor="text-red-600"
          isOpen={openCard === "expenses"}
          onToggle={() => toggle("expenses")}
          data={props.expenseBreakdown}
          barColor="#ef4444"
        />
        <ClickCard
          id="milk"
          label={t("md_milk_costs", lang)}
          icon={<Milk className="h-4 w-4" />}
          value={props.milkTotalDeductions}
          valueColor="text-red-600"
          isOpen={openCard === "milk"}
          onToggle={() => toggle("milk")}
          data={props.milkBreakdown}
          barColor="#f97316"
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ClickCard
          id="capital"
          label={t("md_total_capital", lang)}
          icon={<PiggyBank className="h-4 w-4" />}
          value={props.totalCapitalInvested}
          valueColor="text-brand-700"
          isOpen={openCard === "capital"}
          onToggle={() => toggle("capital")}
          data={props.capitalBreakdown}
          barColor="#16a34a"
          big
        />
        <div className="rounded-card border border-surface-200 bg-white p-6 text-center shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
            <Scale className="h-4 w-4" /> Abhi Ka Position (Bank+Stock+Receivable-Payable)
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-surface-900 dark:text-white">Rs {props.currentPosition.toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ClickCard
          id="bank"
          label={t("md_bank_cash", lang)}
          icon={<Wallet className="h-4 w-4" />}
          value={props.totalBankBalance}
          valueColor="text-surface-900 dark:text-white"
          isOpen={openCard === "bank"}
          onToggle={() => toggle("bank")}
          data={props.bankBreakdown}
          barColor="#0ea5e9"
        />
        <ClickCard
          id="inventory"
          label={t("md_inventory_value", lang)}
          icon={<Boxes className="h-4 w-4" />}
          value={props.totalInventoryValue}
          valueColor="text-surface-900 dark:text-white"
          isOpen={openCard === "inventory"}
          onToggle={() => toggle("inventory")}
          data={props.inventoryBreakdown}
          barColor="#8b5cf6"
        />
        <ClickCard
          id="receivables"
          label={t("md_receivables", lang)}
          icon={<ArrowDownCircle className="h-4 w-4" />}
          value={props.totalReceivables}
          valueColor="text-green-700"
          isOpen={openCard === "receivables"}
          onToggle={() => toggle("receivables")}
          data={props.receivablesBreakdown}
          barColor="#22c55e"
        />
        <ClickCard
          id="payables"
          label={t("md_payables", lang)}
          icon={<ArrowUpCircle className="h-4 w-4" />}
          value={props.totalPayables}
          valueColor="text-red-700"
          isOpen={openCard === "payables"}
          onToggle={() => toggle("payables")}
          data={props.payablesBreakdown}
          barColor="#ef4444"
        />
      </div>
    </>
  );
}

function ClickCard({
  id,
  label,
  icon,
  value,
  valueColor,
  isOpen,
  onToggle,
  data,
  barColor,
  big,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  valueColor: string;
  isOpen: boolean;
  onToggle: () => void;
  data: DataPoint[];
  barColor: string;
  big?: boolean;
}) {
  const lang = useLang();
  return (
    <div className={`rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900 ${big ? "p-6 text-center" : "p-4"}`}>
      <button onClick={onToggle} className="w-full">
        <div className={`flex items-center gap-2 text-surface-500 ${big ? "justify-center" : ""}`}>
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          {data.length > 0 && (isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
        </div>
        <p className={`mt-2 font-display font-semibold ${big ? "text-3xl" : "text-xl"} ${valueColor}`}>Rs {value.toLocaleString()}</p>
      </button>

      {isOpen && data.length > 0 && (
        <div className="mt-4 border-t border-surface-100 pt-3 dark:border-surface-800">
          <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v) => `Rs ${Number(v).toLocaleString()}`} />
              <Bar dataKey="value" fill={barColor} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {isOpen && data.length === 0 && <p className="mt-3 text-center text-xs text-surface-400">{t("md_no_detail", lang)}</p>}
    </div>
  );
}