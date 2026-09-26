"use client";

import { useState } from "react";
import { Users, Wallet, TrendingDown } from "lucide-react";

export interface ShopRow {
  id: string;
  name: string;
  branchName: string | null;
  revenue: number;
  grossProfit: number;
  opex: number; // rent + utility + maintenance + other (salary excluded)
  netProfit: number;
  staffCount: number;
}

function rs(v: number) {
  return `Rs ${Math.round(v).toLocaleString("en-PK")}`;
}

function PctBar({ pct }: { pct: number }) {
  const safe = Math.min(Math.max(pct, 0), 100);
  const color = safe > 50 ? "bg-red-400" : safe > 35 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-700">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

function ShopCard({ row, salaryPct }: { row: ShopRow; salaryPct: number }) {
  const salaryBudget = Math.max(0, row.netProfit * (salaryPct / 100));
  const perPerson = row.staffCount > 0 ? salaryBudget / row.staffCount : 0;
  const pctOfRevenue = row.revenue > 0 ? (salaryBudget / row.revenue) * 100 : 0;

  return (
    <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-surface-900 dark:text-surface-100">{row.name}</p>
          {row.branchName && <p className="text-xs text-surface-500">{row.branchName}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-400">
          {row.staffCount} staff
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800">
          <p className="text-surface-500">Sale</p>
          <p className="font-semibold text-surface-800 dark:text-surface-200">{rs(row.revenue)}</p>
        </div>
        <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800">
          <p className="text-surface-500">Gross Munafa</p>
          <p className={`font-semibold ${row.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{rs(row.grossProfit)}</p>
        </div>
        <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800">
          <p className="text-surface-500">Kharche (Ijara+bijli+baqi)</p>
          <p className="font-semibold text-red-600">{rs(row.opex)}</p>
        </div>
        <div className={`rounded-lg p-2 ${row.netProfit >= 0 ? "bg-green-50 dark:bg-green-900/30" : "bg-red-50 dark:bg-red-900/30"}`}>
          <p className="text-surface-500">Net Munafa</p>
          <p className={`font-semibold ${row.netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{rs(row.netProfit)}</p>
        </div>
      </div>

      {row.netProfit > 0 ? (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                Salary Budget ({salaryPct}% munafe ka)
              </p>
              <p className="text-base font-bold text-blue-900 dark:text-blue-100">{rs(salaryBudget)}</p>
              <PctBar pct={pctOfRevenue} />
              <p className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400">Sale ka {pctOfRevenue.toFixed(1)}%</p>
            </div>
          </div>
          {row.staffCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-blue-200 pt-2 dark:border-blue-700">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {row.staffCount} log = <strong>{rs(perPerson)}</strong> fی آدمی
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/30">
          <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">
            Net munafa mein ghata — salary budget nahi banta
          </p>
        </div>
      )}
    </div>
  );
}

export function SalaryPlannerClient({ shops, month }: { shops: ShopRow[]; month: string }) {
  const [salaryPct, setSalaryPct] = useState(30);

  const totalRevenue = shops.reduce((s, r) => s + r.revenue, 0);
  const totalNetProfit = shops.reduce((s, r) => s + r.netProfit, 0);
  const totalSalaryBudget = shops.reduce((s, r) => s + Math.max(0, r.netProfit * (salaryPct / 100)), 0);
  const totalStaff = shops.reduce((s, r) => s + r.staffCount, 0);
  const avgPerPerson = totalStaff > 0 ? totalSalaryBudget / totalStaff : 0;

  const [d] = month.split("-").map(Number);
  const monthLabel = new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1, 1)
    .toLocaleDateString("ur-PK", { year: "numeric", month: "long" });

  return (
    <div>
      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Sale", value: rs(totalRevenue), color: "text-surface-800 dark:text-surface-200" },
          { label: "Net Munafa", value: rs(totalNetProfit), color: totalNetProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600" },
          { label: "Salary Budget", value: rs(totalSalaryBudget), color: "text-blue-700 dark:text-blue-400" },
          { label: "Fی آدمی (Avg)", value: totalStaff > 0 ? rs(avgPerPerson) : "—", color: "text-purple-700 dark:text-purple-400" },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-surface-200 bg-white p-3 shadow-sm dark:border-surface-700 dark:bg-surface-900">
            <p className="text-xs text-surface-500">{tile.label}</p>
            <p className={`mt-0.5 text-lg font-bold ${tile.color}`}>{tile.value}</p>
          </div>
        ))}
      </div>

      {/* Salary % slider */}
      <div className="mb-5 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-purple-900 dark:text-purple-200">
            Net Munafe ka Kitna % Salary Dein?
          </label>
          <span className="rounded-full bg-purple-600 px-3 py-0.5 text-sm font-bold text-white">
            {salaryPct}%
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={80}
          step={5}
          value={salaryPct}
          onChange={(e) => setSalaryPct(Number(e.target.value))}
          className="mt-3 w-full accent-purple-600"
        />
        <div className="mt-1 flex justify-between text-[10px] text-purple-500">
          <span>5% (Kum)</span>
          <span>30% (Munasib)</span>
          <span>80% (Zyada)</span>
        </div>
        <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">
          Slider khiskaiye — har dukan ka salary budget foran update hoga
        </p>
      </div>

      {/* No data state */}
      {shops.length === 0 && (
        <div className="rounded-xl border border-surface-200 bg-white p-8 text-center dark:border-surface-700 dark:bg-surface-900">
          <p className="text-surface-500">Is mahine ke liye koi sale ya dukan ka data nahi mila.</p>
        </div>
      )}

      {/* Shop cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shops.map((shop) => (
          <ShopCard key={shop.id} row={shop} salaryPct={salaryPct} />
        ))}
      </div>
    </div>
  );
}
