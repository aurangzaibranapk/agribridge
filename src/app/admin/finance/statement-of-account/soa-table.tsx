"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Search } from "lucide-react";
import type { SoaRow } from "@/lib/ledger/statement-of-account";

type ColKey = "sr" | "postDate" | "valueDate" | "account" | "docNo" | "linkedRef" | "details" | "withdrawal" | "deposit" | "balance";

interface Col {
  key: ColKey;
  label: string;
  numeric?: boolean;
}

const PAGE_SIZES: { label: string; value: number }[] = [
  { label: "10", value: 10 },
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "Sab (All)", value: 0 },
];

function money(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cellText(r: SoaRow, k: ColKey): string {
  switch (k) {
    case "withdrawal":
    case "deposit":
    case "balance":
      return money(r[k]);
    case "sr":
      return String(r.sr);
    case "linkedRef":
      return r.linkedRef ?? "Jorr nahi";
    default:
      return String(r[k] ?? "");
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Bank statement jaisi table: entries ki tadaad, search, CSV / Excel /
 * Copy / Print, column chhupana, column par sort. Sab browser mein --
 * bahar ki koi library nahi (jspdf/xlsx waghera ki zaroorat nahi).
 */
export function SoaTable({
  title,
  subtitle,
  fileName,
  linkedLabel,
  showLinked,
  opening,
  closing,
  rows,
}: {
  title: string;
  subtitle: string;
  fileName: string;
  linkedLabel: string;
  showLinked: boolean;
  opening: number;
  closing: number;
  rows: SoaRow[];
}) {
  const allCols: Col[] = useMemo(
    () =>
      [
        { key: "sr", label: "Sr #" },
        { key: "postDate", label: "Post Date" },
        { key: "valueDate", label: "Value Date" },
        { key: "account", label: "Account No." },
        { key: "docNo", label: "Doc No." },
        ...(showLinked ? [{ key: "linkedRef", label: linkedLabel } as Col] : []),
        { key: "details", label: "Details (Tafseel)" },
        { key: "withdrawal", label: "Withdrawal (Nikasi)", numeric: true },
        { key: "deposit", label: "Deposit (Jama)", numeric: true },
        { key: "balance", label: "Balance (Baqi)", numeric: true },
      ] as Col[],
    [showLinked, linkedLabel]
  );

  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: ColKey; dir: "asc" | "desc" }>({ key: "sr", dir: "asc" });
  const [hidden, setHidden] = useState<Set<ColKey>>(new Set());
  const [colMenu, setColMenu] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const cols = allCols.filter((c) => !hidden.has(c.key));

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = rows;
    if (words.length > 0) {
      list = rows.filter((r) => {
        const hay = allCols.map((c) => cellText(r, c.key)).join(" ").toLowerCase() + " " + allCols.filter((c) => c.numeric).map((c) => String(r[c.key as "deposit"])).join(" ");
        return words.every((w) => hay.includes(w));
      });
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    const k = sort.key;
    return [...list].sort((a, b) => {
      const av = a[k as keyof SoaRow];
      const bv = b[k as keyof SoaRow];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir || (a.sr - b.sr) * dir;
    });
  }, [rows, q, sort, allCols]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const shown = printing || pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const startN = filtered.length === 0 ? 0 : printing || pageSize === 0 ? 1 : (safePage - 1) * pageSize + 1;
  const endN = printing || pageSize === 0 ? filtered.length : Math.min(safePage * pageSize, filtered.length);

  const fTotW = filtered.reduce((s, r) => s + r.withdrawal, 0);
  const fTotD = filtered.reduce((s, r) => s + r.deposit, 0);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  function exportMatrix(): string[][] {
    const head = cols.map((c) => c.label);
    const body = filtered.map((r) => cols.map((c) => cellText(r, c.key)));
    return [head, ...body];
  }

  function download(content: string, type: string, ext: string) {
    const blob = new Blob(["\ufeff" + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onCsv() {
    const m = exportMatrix();
    const csv = m.map((row) => row.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\r\n");
    download(`${title}\r\n${subtitle}\r\nOpening,${opening}\r\n\r\n${csv}\r\n\r\nClosing,${closing}`, "text/csv;charset=utf-8;", "csv");
  }

  function onExcel() {
    const m = exportMatrix();
    const numericIdx = new Set(cols.map((c, i) => (c.numeric ? i : -1)).filter((i) => i >= 0));
    const tr = (cells: string[], th = false) =>
      `<tr>${cells
        .map((v, i) => {
          const tag = th ? "th" : "td";
          const style = !th && numericIdx.has(i) ? ' style="mso-number-format:\'#,##0.00\'"' : ' style="mso-number-format:\'\\@\'"';
          const val = !th && numericIdx.has(i) ? v.replace(/,/g, "") : esc(v);
          return `<${tag}${style}>${val}</${tag}>`;
        })
        .join("")}</tr>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1"><tr><th colspan="${cols.length}">${esc(title)}</th></tr><tr><td colspan="${cols.length}">${esc(subtitle)}</td></tr>
<tr><td colspan="${cols.length - 1}">Opening</td><td>${opening}</td></tr>
${tr(m[0], true)}${m.slice(1).map((r) => tr(r)).join("")}
<tr><td colspan="${cols.length - 1}">Closing</td><td>${closing}</td></tr></table></body></html>`;
    download(html, "application/vnd.ms-excel;charset=utf-8;", "xls");
  }

  async function onCopy() {
    const text = exportMatrix().map((r) => r.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function toggleSort(k: ColKey) {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
  }

  function renderCell(r: SoaRow, k: ColKey) {
    switch (k) {
      case "docNo":
        return r.docHref ? (
          <Link href={r.docHref} className="font-mono text-xs text-brand-700 hover:underline dark:text-brand-300" title="Us din ka General Journal kholein">
            {r.docNo}
          </Link>
        ) : (
          <span className="font-mono text-xs">{r.docNo}</span>
        );
      case "linkedRef":
        return r.linked ? (
          <span className="font-mono text-xs text-surface-500">{r.linkedRef}</span>
        ) : (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Jorr nahi</span>
        );
      case "details":
        return (
          <div className="min-w-[260px] max-w-[520px]">
            <span className="text-surface-800 dark:text-surface-200">{r.details}</span>
            <span className="mt-0.5 flex flex-wrap gap-2 text-[11px] print:hidden">
              {r.sourceHref && r.sourceLabel && (
                <Link href={r.sourceHref} className="text-brand-700 hover:underline dark:text-brand-300">↗ {r.sourceLabel}</Link>
              )}
              {r.partyHref && r.partyName && (
                <Link href={r.partyHref} className="text-brand-700 hover:underline dark:text-brand-300">↗ {r.partyName} ka khata</Link>
              )}
              {r.backdated && <span className="rounded bg-sky-100 px-1 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">Purani tareekh</span>}
            </span>
          </div>
        );
      case "withdrawal":
        return r.withdrawal ? <span className="text-rose-600">{money(r.withdrawal)}</span> : "0.00";
      case "deposit":
        return r.deposit ? <span className="text-emerald-600">{money(r.deposit)}</span> : "0.00";
      case "balance":
        return <span className="font-medium">{money(r.balance)}</span>;
      default:
        return cellText(r, k);
    }
  }

  const btn = "px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800";

  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="bg-brand-700 px-4 py-2 text-white">
        <p className="font-display text-base font-semibold">{title}</p>
        <p className="text-xs opacity-90">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
            Dikhayein
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-surface-200 px-1.5 py-1 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              {PAGE_SIZES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            entries
          </label>
          <div className="flex overflow-visible rounded-lg bg-brand-700">
            <button type="button" onClick={onCsv} className={`${btn} rounded-l-lg`}>CSV</button>
            <button type="button" onClick={onExcel} className={btn}>Excel</button>
            <button type="button" onClick={onCopy} className={btn}>{copied ? "Copy ho gaya" : "Copy"}</button>
            <button type="button" onClick={() => setPrinting(true)} className={btn}>Print</button>
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setColMenu((v) => !v)} className={`${btn} inline-flex items-center gap-1 rounded-r-lg`}>
                Column visibility <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {colMenu && (
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-surface-200 bg-white p-1 shadow-lg dark:border-surface-700 dark:bg-surface-900">
                  {allCols.map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-surface-700 hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800">
                      <input
                        type="checkbox"
                        checked={!hidden.has(c.key)}
                        onChange={() =>
                          setHidden((h) => {
                            const n = new Set(h);
                            if (n.has(c.key)) n.delete(c.key);
                            else n.add(c.key);
                            return n;
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
          <Search className="h-4 w-4" /> Search:
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Naam, TXN, raqam..."
            className="w-56 rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-700 text-left text-xs text-white">
              {cols.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-medium ${c.numeric ? "text-right" : ""}`}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1">
                    {c.label}
                    {sort.key === c.key ? (
                      sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50 print:hidden" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            <tr className="bg-surface-50 font-medium dark:bg-surface-800/40">
              <td colSpan={Math.max(1, cols.length - 1)} className="px-3 py-1.5 text-surface-600 dark:text-surface-300">Shuru ka baqi (Opening Balance)</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{money(opening)}</td>
            </tr>
            {shown.map((r) => (
              <tr key={r.key} className="align-top hover:bg-surface-50 dark:hover:bg-surface-800/40">
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-1.5 ${c.numeric ? "whitespace-nowrap text-right tabular-nums" : c.key === "details" ? "" : "whitespace-nowrap"} text-surface-700 dark:text-surface-300`}>
                    {renderCell(r, c.key)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-3 py-8 text-center text-surface-400">Is muddat mein koi entry nahi.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-600">
              {cols.map((c, i) => (
                <td key={c.key} className={`px-3 py-2 ${c.numeric ? "text-right tabular-nums" : ""}`}>
                  {i === 0 ? (q ? "Kul (search ke mutabiq)" : "Kul (Total)") : c.key === "withdrawal" ? money(fTotW) : c.key === "deposit" ? money(fTotD) : c.key === "balance" ? money(closing) : ""}
                </td>
              ))}
            </tr>
            <tr className="font-semibold">
              <td colSpan={Math.max(1, cols.length - 1)} className="px-3 py-1.5">Aakhri baqi (Closing Balance)</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{money(closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-surface-500 print:hidden">
        <span>
          {startN} se {endN} — kul {filtered.length} entries
          {filtered.length !== rows.length ? ` (${rows.length} mein se filter)` : ""}
        </span>
        {pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded-lg border border-surface-200 px-3 py-1.5 disabled:opacity-40 dark:border-surface-700">Pichla</button>
            <span>Safha {safePage} / {totalPages}</span>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="rounded-lg border border-surface-200 px-3 py-1.5 disabled:opacity-40 dark:border-surface-700">Agla</button>
          </div>
        )}
      </div>
    </div>
  );
}
