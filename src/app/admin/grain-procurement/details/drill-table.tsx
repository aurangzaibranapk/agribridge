"use client";
import Link from "next/link";
import { toCsv } from "@/lib/grain/drilldown";

export interface DrillLink { label: string; href: string }
export interface DrillTableRow { cells: (string | number)[]; links: DrillLink[]; emphasis?: boolean }

const fmtCell = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : v);

export function DrillTable({ headers, rows, footer, fileName }: { headers: string[]; rows: DrillTableRow[]; footer?: (string | number)[]; fileName: string }) {
  function exportCsv() {
    const body = rows.map(r => r.cells);
    if (footer) body.push(footer);
    const blob = new Blob(["\uFEFF" + toCsv(headers, body)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-surface-500">{rows.length} qataarein / rows</span>
        <button type="button" onClick={exportCsv} className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-surface-50">CSV export</button>
      </div>
      <div className="overflow-x-auto rounded border border-surface-200 dark:border-surface-800">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800">
            <tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}<th className="px-3 py-2">Link</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length + 1} className="px-3 py-6 text-center text-surface-400">Koi record nahi / No records</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={`border-t border-surface-100 dark:border-surface-800 ${r.emphasis ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
                {r.cells.map((c, j) => <td key={j} className={`whitespace-nowrap px-3 py-1.5 ${typeof c === "number" ? "text-right tabular-nums" : ""}`}>{fmtCell(c)}</td>)}
                <td className="whitespace-nowrap px-3 py-1.5">
                  {r.links.map(l => <Link key={l.href + l.label} href={l.href} className="mr-2 text-xs font-medium text-brand-600 hover:underline">{l.label}</Link>)}
                </td>
              </tr>
            ))}
          </tbody>
          {footer ? (
            <tfoot className="border-t-2 border-surface-300 font-semibold">
              <tr>{footer.map((c, j) => <td key={j} className={`whitespace-nowrap px-3 py-2 ${typeof c === "number" ? "text-right tabular-nums" : ""}`}>{fmtCell(c)}</td>)}<td /></tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
