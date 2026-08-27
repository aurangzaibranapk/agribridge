import { cn } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/layout-primitives";

export interface Column<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  className?: string;
}

/**
 * Server-rendered data table used by every module's list page (Products,
 * Farmers, Customers, Sales...). Deliberately dumb/generic — sorting,
 * filtering, and pagination happen in the page's server-side data fetch
 * (query params), not client-side, so it works the same way with 50 rows
 * or 50,000.
 */
export function DataTable<T>({
  columns,
  rows,
  keyFor,
  emptyTitle = "Nothing here yet",
  emptyDescription,
}: {
  columns: Column<T>[];
  rows: T[];
  keyFor: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50 text-left">
            {columns.map((col) => (
              <th key={col.header} className={cn("px-4 py-3 font-medium text-surface-500", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyFor(row)} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
              {columns.map((col) => (
                <td key={col.header} className={cn("px-4 py-3 text-surface-800", col.className)}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, totalCount, basePath }: { page: number; pageSize: number; totalCount: number; basePath: string }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const buildHref = (p: number) => `${basePath}${basePath.includes("?") ? "&" : "?"}page=${p}`;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-surface-500">
      <span>
        Page {page} of {totalPages} — {totalCount} total
      </span>
      <div className="flex gap-2">
        <a
          href={page > 1 ? buildHref(page - 1) : undefined}
          className={cn("rounded-lg border border-surface-200 px-3 py-1.5", page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-surface-100")}
        >
          Previous
        </a>
        <a
          href={page < totalPages ? buildHref(page + 1) : undefined}
          className={cn("rounded-lg border border-surface-200 px-3 py-1.5", page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-surface-100")}
        >
          Next
        </a>
      </div>
    </div>
  );
}
