import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type Lang } from "@/lib/i18n/translations";
import { requireAction } from "@/lib/access/guard";
import { KHARCHA_QISMEIN } from "@/lib/kharche";
import { loadFilteredExpenses } from "@/lib/reports/expense-report-query";
import {
  MISSING,
  NAME_MISSING,
  PAGE_SIZE,
  amountShare,
  categoryChoices,
  expenseExportPath,
  expenseReportPath,
  groupExpenses,
  paginateLines,
  parseExpenseFilters,
  resolveReportScope,
  sumByStatus,
  summarizeExpenses,
  type ExpenseGroupRow,
  type ExpenseReportFilters,
  type GroupDim,
} from "@/lib/reports/expense-report";

export const dynamic = "force-dynamic";

const REPORT_ROLES = new Set(["owner", "super_admin", "admin", "finance", "manager"]);

function money(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function shareText(part: number, whole: number): string {
  const share = amountShare(part, whole);
  if (share == null) return "—";
  return `${(share * 100).toFixed(1)}%`;
}

function statusText(status: string, lang: Lang): string {
  if (status === "pending") return t("khr_st_pending", lang);
  if (status === "verified") return t("khr_st_verified", lang);
  if (status === "approved") return t("khr_st_approved", lang);
  if (status === "rejected") return t("khr_st_rejected", lang);
  if (!status || status === "unknown") return t("khr_status_missing", lang);
  return status;
}

function groupLabel(dim: GroupDim, row: ExpenseGroupRow, lang: Lang): string {
  if (dim === "status") return statusText(row.key, lang);
  if (row.key === "untracked") {
    if (dim === "shop") return t("khr_missing_shop", lang);
    if (dim === "bank") return t("khr_missing_bank", lang);
    return t("khr_category_missing", lang);
  }
  if (row.label === NAME_MISSING) return t("khr_name_missing", lang);
  return row.label;
}

function fieldClass() {
  return "w-full min-w-[10rem] rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900";
}

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const lang = getLanguageFromCookies("rm");
  const gate = await requireAction("kharche.report", "view");
  if ("error" in gate) {
    return <div className="p-8 text-center text-surface-500">{t("khr_denied", lang)}</div>;
  }
  const caller = gate.caller;
  if (caller.legacy && !REPORT_ROLES.has(caller.role)) {
    return <div className="p-8 text-center text-surface-500">{t("khr_denied", lang)}</div>;
  }
  const exportGate = await requireAction("kharche.report", "export");
  const canExport = !("error" in exportGate);

  const today = aajKaKhana();
  const parsed = parseExpenseFilters(searchParams, today);
  const scoped = resolveReportScope(parsed, {
    unrestricted: caller.unrestricted,
    scope: caller.scope,
    branchId: caller.branchId,
    shopId: caller.shopId,
  });

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 pb-8">
      <PageHeader
        title={t("khr_title", lang)}
        description={t("khr_desc", lang)}
        actions={
          <Link
            href="/admin/kharche"
            className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            {t("khr_back", lang)}
          </Link>
        }
      />
      {!scoped.ok ? (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {scoped.reason === "no_shop" ? t("khr_no_shop", lang) : t("khr_no_branch", lang)}
        </Card>
      ) : (
        <ReportBody lang={lang} filters={scoped.filters} lockBranch={scoped.lockBranch} lockShop={scoped.lockShop} canExport={canExport} />
      )}
    </div>
  );
}

async function ReportBody({
  lang,
  filters,
  lockBranch,
  lockShop,
  canExport,
}: {
  lang: Lang;
  filters: ExpenseReportFilters;
  lockBranch: boolean;
  lockShop: boolean;
  canExport: boolean;
}) {
  const service = createServiceClient();
  const [loaded, lists] = await Promise.all([loadFilteredExpenses(service, filters), loadLists(service)]);

  const shopOptions = lists.shops.filter((shop) => !filters.branchId || filters.branchId === MISSING || shop.branchId === filters.branchId);
  const categories = categoryChoices(lists.categories);
  const summary = summarizeExpenses(loaded.lines);
  const page = paginateLines(loaded.lines, filters.page, PAGE_SIZE);
  const showTotals = !loaded.error && !loaded.truncated;

  return (
    <>
      <Card className="space-y-3">
        <p className="text-sm text-surface-600 dark:text-surface-300">
          {filters.kind === "all" ? t("khr_filter_all", lang) : filters.kind === "asal" ? t("khr_filter_asal", lang) : t("khr_filter_one", lang)}
        </p>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/admin/reports/expenses">
          <label className="text-xs text-surface-500">
            {t("khr_from", lang)}
            <input className={fieldClass()} type="date" name="from" defaultValue={filters.from} />
          </label>
          <label className="text-xs text-surface-500">
            {t("khr_to", lang)}
            <input className={fieldClass()} type="date" name="to" defaultValue={filters.to} />
          </label>
          <label className="text-xs text-surface-500">
            {t("khr_branch", lang)}
            {lockBranch ? (
              <>
                <input type="hidden" name="branch" value={filters.branchId} />
                <span className={`${fieldClass()} block bg-surface-50 dark:bg-surface-800`}>
                  {lists.branches.find((b) => b.id === filters.branchId)?.name ?? t("khr_locked_branch", lang)}
                </span>
              </>
            ) : (
              <select className={fieldClass()} name="branch" defaultValue={filters.branchId}>
                <option value="">{t("khr_all", lang)}</option>
                <option value={MISSING}>{t("khr_missing_branch", lang)}</option>
                {lists.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </label>
          <label className="text-xs text-surface-500">
            {t("khr_shop", lang)}
            {lockShop ? (
              <>
                <input type="hidden" name="shop" value={filters.shopId} />
                <span className={`${fieldClass()} block bg-surface-50 dark:bg-surface-800`}>
                  {lists.shops.find((s) => s.id === filters.shopId)?.name ?? t("khr_locked_shop", lang)}
                </span>
              </>
            ) : (
              <select className={fieldClass()} name="shop" defaultValue={filters.shopId}>
                <option value="">{t("khr_all", lang)}</option>
                <option value={MISSING}>{t("khr_missing_shop", lang)}</option>
                {shopOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.branchName ? `${s.name} — ${s.branchName}` : s.name}</option>
                ))}
              </select>
            )}
          </label>
          <label className="text-xs text-surface-500">
            {t("khr_category", lang)}
            <select className={fieldClass()} name="category" defaultValue={filters.category}>
              <option value="">{t("khr_all", lang)}</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
              {filters.category && !categories.some((c) => c.value === filters.category) ? (
                <option value={filters.category}>{filters.category}</option>
              ) : null}
            </select>
          </label>
          <label className="text-xs text-surface-500">
            {t("khr_bank", lang)}
            <select className={fieldClass()} name="bank" defaultValue={filters.bankId}>
              <option value="">{t("khr_all", lang)}</option>
              <option value={MISSING}>{t("khr_missing_bank", lang)}</option>
              {lists.banks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-surface-500">
            {t("khr_status", lang)}
            <select className={fieldClass()} name="status" defaultValue={filters.status}>
              <option value="">{t("khr_all", lang)}</option>
              <option value="pending">{t("khr_st_pending", lang)}</option>
              <option value="verified">{t("khr_st_verified", lang)}</option>
              <option value="approved">{t("khr_st_approved", lang)}</option>
              <option value="rejected">{t("khr_st_rejected", lang)}</option>
            </select>
          </label>
          <label className="text-xs text-surface-500">
            {t("khr_kind", lang)}
            <select className={fieldClass()} name="kind" defaultValue={filters.kind}>
              <option value="asal">{t("khr_asal", lang)}</option>
              <option value="all">{t("khr_all_kinds", lang)}</option>
              {KHARCHA_QISMEIN.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              {t("khr_show", lang)}
            </button>
            {canExport && !loaded.error ? (
              <a href={expenseExportPath(filters)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800">
                {t("khr_csv", lang)}
              </a>
            ) : null}
          </div>
        </form>
        <p className="text-xs text-surface-500">{t("khr_journal_note", lang)} {canExport ? t("khr_csv_note", lang) : ""}</p>
        {lists.failed ? <p className="text-sm text-amber-700 dark:text-amber-300">{t("khr_lists_missing", lang)}</p> : null}
      </Card>

      {loaded.error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("khr_error", lang)} {loaded.error}
        </Card>
      ) : (
        <>
          {loaded.truncated ? (
            <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {t("khr_truncated", lang)} {loaded.dbCount == null ? "" : `(${loaded.dbCount})`}
            </Card>
          ) : null}
          {loaded.namesFailed ? (
            <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30">{t("khr_names_missing", lang)}</Card>
          ) : null}
          {loaded.undatedOutside != null && loaded.undatedOutside > 0 ? (
            <Card className="text-sm text-surface-600 dark:text-surface-300">
              {t("khr_undated", lang).replace("{n}", String(loaded.undatedOutside))}
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TotalCard label={t("khr_total", lang)} ready={showTotals} amount={summary.amount} extra={showTotals ? `${summary.count} ${t("khr_rows", lang)}` : "—"} gap={showTotals ? summary.gap : 0} lang={lang} />
            <TotalCard label={t("khr_pending_sum", lang)} ready={showTotals} amount={sumByStatus(loaded.lines, "pending").amount} extra={showTotals ? String(sumByStatus(loaded.lines, "pending").count) : "—"} gap={0} lang={lang} />
            <TotalCard label={t("khr_verified_sum", lang)} ready={showTotals} amount={sumByStatus(loaded.lines, "verified").amount} extra={showTotals ? String(sumByStatus(loaded.lines, "verified").count) : "—"} gap={0} lang={lang} />
            <TotalCard label={t("khr_approved_sum", lang)} ready={showTotals} amount={sumByStatus(loaded.lines, "approved").amount} extra={showTotals ? String(sumByStatus(loaded.lines, "approved").count) : "—"} gap={0} lang={lang} />
          </div>
          {showTotals && summary.gap > 0 ? <p className="text-sm text-amber-700">{t("khr_gap", lang).replace("{n}", String(summary.gap))}</p> : null}

          {summary.count === 0 ? (
            <Card><p className="text-sm text-surface-500">{t("khr_empty", lang)}</p></Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <GroupTable title={t("khr_by_shop", lang)} dim="shop" rows={groupExpenses(loaded.lines, "shop")} total={loaded.truncated ? 0 : summary.amount} partial={loaded.truncated} lang={lang} />
                <GroupTable title={t("khr_by_category", lang)} dim="category" rows={groupExpenses(loaded.lines, "category")} total={loaded.truncated ? 0 : summary.amount} partial={loaded.truncated} lang={lang} />
                <GroupTable title={t("khr_by_bank", lang)} dim="bank" rows={groupExpenses(loaded.lines, "bank")} total={loaded.truncated ? 0 : summary.amount} partial={loaded.truncated} lang={lang} />
                <GroupTable title={t("khr_by_status", lang)} dim="status" rows={groupExpenses(loaded.lines, "status")} total={loaded.truncated ? 0 : summary.amount} partial={loaded.truncated} lang={lang} />
              </div>

              <Card className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
                      <th className="pb-2 pr-3">{t("khr_col_date", lang)}</th>
                      <th className="pb-2 pr-3">{t("khr_col_exp", lang)}</th>
                      <th className="pb-2 pr-3">{t("khr_col_kind", lang)}</th>
                      <th className="pb-2 pr-3">{t("khr_col_category", lang)}</th>
                      <th className="pb-2 pr-3">{t("khr_col_shop", lang)}</th>
                      <th className="pb-2 pr-3">{t("khr_col_branch", lang)}</th>
                      <th className="pb-2 pr-3">{t("khr_col_party", lang)}</th>
                      <th className="pb-2 pr-3">{t("khr_col_bank", lang)}</th>
                      <th className="pb-2 pr-3 text-right">{t("khr_col_amount", lang)}</th>
                      <th className="pb-2">{t("khr_col_status", lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {page.slice.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2 pr-3 whitespace-nowrap">{line.expenseDate ?? t("khr_date_missing", lang)}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{line.expenseNumber}</td>
                        <td className="py-2 pr-3">{line.kindLabel}</td>
                        <td className="py-2 pr-3">{line.categoryLabel}</td>
                        <td className="py-2 pr-3">{line.shopId ? line.shopName ?? t("khr_name_missing", lang) : t("khr_missing_shop", lang)}</td>
                        <td className="py-2 pr-3">{line.branchId ? line.branchName ?? t("khr_name_missing", lang) : t("khr_missing_branch", lang)}</td>
                        <td className="py-2 pr-3">
                          <div>{line.partyName?.trim() || t("khr_banda_nahi", lang)}</div>
                          {line.description ? <div className="max-w-[16rem] truncate text-xs text-surface-400" title={line.description}>{line.description}</div> : null}
                        </td>
                        <td className="py-2 pr-3">{line.bankId ? line.bankName ?? t("khr_name_missing", lang) : t("khr_missing_bank", lang)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{line.amount == null ? "—" : money(line.amount)}</td>
                        <td className="py-2 whitespace-nowrap">{statusText(line.status, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-surface-500">
                  <span>{t("khr_page", lang).replace("{page}", String(page.page)).replace("{pages}", String(page.pages)).replace("{n}", String(summary.count))}</span>
                  <span className="flex gap-2">
                    {page.page > 1 ? (
                      <Link className="rounded-lg border border-surface-200 px-3 py-1.5 hover:bg-surface-50 dark:border-surface-700" href={expenseReportPath(filters, { page: page.page - 1 })}>
                        {t("khr_prev", lang)}
                      </Link>
                    ) : (
                      <span className="rounded-lg px-3 py-1.5 text-surface-300">{t("khr_prev", lang)}</span>
                    )}
                    {page.page < page.pages ? (
                      <Link className="rounded-lg border border-surface-200 px-3 py-1.5 hover:bg-surface-50 dark:border-surface-700" href={expenseReportPath(filters, { page: page.page + 1 })}>
                        {t("khr_next", lang)}
                      </Link>
                    ) : (
                      <span className="rounded-lg px-3 py-1.5 text-surface-300">{t("khr_next", lang)}</span>
                    )}
                  </span>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}

function TotalCard({ label, ready, amount, extra, gap, lang }: { label: string; ready: boolean; amount: number; extra: string; gap: number; lang: Lang }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-surface-500">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{ready ? money(amount) : "—"}</p>
      <p className="mt-1 text-xs text-surface-400">{extra}{gap > 0 ? ` · ${t("khr_gap", lang).replace("{n}", String(gap))}` : ""}</p>
    </Card>
  );
}

function GroupTable({ title, dim, rows, total, partial, lang }: { title: string; dim: GroupDim; rows: ExpenseGroupRow[]; total: number; partial: boolean; lang: Lang }) {
  const untracked = rows.some((row) => !row.recorded);
  return (
    <Card>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">{title}</p>
      {partial ? <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">{t("khr_group_partial", lang)}</p> : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
            <th className="pb-1.5 pr-3">{t("khr_name", lang)}</th>
            <th className="pb-1.5 pr-3 text-right">{t("khr_rows", lang)}</th>
            <th className="pb-1.5 pr-3 text-right">{t("khr_amount", lang)}</th>
            <th className="pb-1.5 text-right">{t("khr_share", lang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {rows.map((row) => (
            <tr key={row.key} className={row.recorded ? "" : "text-amber-800 dark:text-amber-300"}>
              <td className="py-1.5 pr-3">{groupLabel(dim, row, lang)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{row.count}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{money(row.amount)}{row.gap > 0 ? " *" : ""}</td>
              <td className="py-1.5 text-right tabular-nums">{shareText(row.amount, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {untracked ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{t("khr_untracked_note", lang)}</p> : null}
    </Card>
  );
}

interface Lists {
  branches: { id: string; name: string }[];
  shops: { id: string; name: string; branchId: string | null; branchName: string | null }[];
  banks: { id: string; name: string }[];
  categories: string[];
  failed: boolean;
}

async function loadLists(service: ReturnType<typeof createServiceClient>): Promise<Lists> {
  const [branches, shops, banks, cats] = await Promise.all([
    service.from("branches").select("id, name").order("name").limit(500),
    service.from("shops").select("id, name, branch_id").order("name").limit(1000),
    service.from("finance_accounts").select("id, name").order("name").limit(500),
    service.from("company_expense_requests").select("category").limit(5000),
  ]);
  const failed = Boolean(branches.error || shops.error || banks.error || cats.error);
  const branchName = new Map<string, string>();
  for (const row of branches.data ?? []) branchName.set(row.id, row.name);
  return {
    failed,
    branches: (branches.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    shops: (shops.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      branchId: row.branch_id,
      branchName: row.branch_id ? branchName.get(row.branch_id) ?? null : null,
    })),
    banks: (banks.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    categories: [...new Set((cats.data ?? []).map((row) => String(row.category ?? "").trim()).filter(Boolean))],
  };
}
