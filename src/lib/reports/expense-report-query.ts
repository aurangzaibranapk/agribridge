import {
  FETCH_CAP,
  applyExpenseFilters,
  applyExpenseScope,
  expenseQueryPlan,
  mapExpenseRow,
  undatedOutsideOr,
  type ExpenseLine,
  type ExpenseReportFilters,
  type NameMaps,
  type RawExpense,
} from "./expense-report";

const SELECT =
  "id, expense_number, kind, category, amount, description, status, expense_date, created_at, party_name, shop_id, branch_id, paid_from_account_id";
const PAGE = 1000;

export interface LoadedExpenseReport {
  error: string | null;
  truncated: boolean;
  dbCount: number | null;
  undatedOutside: number | null;
  lines: ExpenseLine[];
  namesFailed: boolean;
}

interface NameLoad {
  map: Map<string, string>;
  failed: boolean;
}

async function loadNames(service: { from: (table: string) => any }, table: string, ids: string[]): Promise<NameLoad> {
  const map = new Map<string, string>();
  if (ids.length === 0) return { map, failed: false };
  for (let i = 0; i < ids.length; i += 200) {
    const res = await service.from(table).select("id, name").in("id", ids.slice(i, i + 200));
    if (res.error) return { map, failed: true };
    for (const row of res.data ?? []) {
      if (row?.id) map.set(String(row.id), String(row.name ?? ""));
    }
  }
  return { map, failed: false };
}

function uniqueIds(rows: RawExpense[], key: "shop_id" | "branch_id" | "paid_from_account_id"): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const id = row[key];
    if (id) set.add(String(id));
  }
  return [...set];
}

/**
 * Filtered qatarein, 200 ki hard cap nahi. Jor poori filtered fehrist
 * ka hai; safha baad mein kaat-ta hai. Ginti na mile to null — sifar nahi.
 */
export async function loadFilteredExpenses(service: { from: (table: string) => any }, filters: ExpenseReportFilters): Promise<LoadedExpenseReport> {
  const plan = expenseQueryPlan(filters);
  const base = () =>
    applyExpenseFilters(service.from("company_expense_requests").select(SELECT, { count: "exact" }), plan)
      .order("expense_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });

  const rows: RawExpense[] = [];
  let from = 0;
  let dbCount: number | null = null;
  while (rows.length < FETCH_CAP) {
    const res = await base().range(from, from + PAGE - 1);
    if (res.error) {
      return { error: String(res.error.message ?? res.error), truncated: false, dbCount, undatedOutside: null, lines: [], namesFailed: false };
    }
    if (typeof res.count === "number") dbCount = res.count;
    const batch = (res.data ?? []) as RawExpense[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (dbCount != null && from >= dbCount) break;
  }

  const truncated =
    (dbCount != null && dbCount > rows.length) ||
    (rows.length >= FETCH_CAP && (dbCount == null || dbCount > rows.length));

  const [shops, branches, banks] = await Promise.all([
    loadNames(service, "shops", uniqueIds(rows, "shop_id")),
    loadNames(service, "branches", uniqueIds(rows, "branch_id")),
    loadNames(service, "finance_accounts", uniqueIds(rows, "paid_from_account_id")),
  ]);
  const names: NameMaps = { shops: shops.map, branches: branches.map, banks: banks.map };
  const namesFailed = shops.failed || branches.failed || banks.failed;

  let undatedOutside: number | null = null;
  const undated = await applyExpenseScope(
    service
      .from("company_expense_requests")
      .select("id", { count: "exact", head: true })
      .is("expense_date", null)
      .or(undatedOutsideOr(filters.from, filters.to)),
    plan,
  );
  if (!undated.error && typeof undated.count === "number") undatedOutside = undated.count;

  return {
    error: null,
    truncated,
    dbCount,
    undatedOutside,
    lines: rows.map((row) => mapExpenseRow(row, names)),
    namesFailed,
  };
}
