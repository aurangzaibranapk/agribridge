import { canSeeFinanceDash, loadCashFlow, loadInventory, loadPnl } from "@/lib/finance-dash/load";
import { CashFlowDashboard, InventoryDashboard, PnlDashboard, type FlowBy } from "./views";

/* Server sections: role check, data load, phir view. Kuch bhi ghalat ho to mojooda page chalta rahe. */

function Fail({ msg }: { msg: string }) {
  return <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">Dashboard load nahi hua: {msg}</div>;
}

export async function CashFlowSection({ from, to, by }: { from?: string; to?: string; by?: string }) {
  if (!(await canSeeFinanceDash())) return null;
  const flowBy: FlowBy = by === "roz" || by === "mahina" ? by : "hafta";
  const qs = (b: FlowBy) => `/admin/finance/reports?view=cashflow${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}&cf_by=${b}`;
  try { return <CashFlowDashboard d={await loadCashFlow({ from, to })} by={flowBy} hrefFor={qs} />; } catch (e) { return <Fail msg={(e as Error).message} />; }
}
export async function PnlSection({ from, to }: { from?: string; to?: string }) {
  if (!(await canSeeFinanceDash())) return null;
  try { return <PnlDashboard d={await loadPnl({ from, to })} />; } catch (e) { return <Fail msg={(e as Error).message} />; }
}
export async function InventorySection() {
  if (!(await canSeeFinanceDash())) return null;
  try { return <InventoryDashboard d={await loadInventory()} />; } catch (e) { return <Fail msg={(e as Error).message} />; }
}
