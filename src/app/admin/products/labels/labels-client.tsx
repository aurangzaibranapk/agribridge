"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Barcode, Printer, Search, Sparkles } from "lucide-react";
import { assignInternalBarcodes, type SetupState } from "@/actions/product-setup";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import { ean13Modules, isEan13 } from "@/lib/ean13";

const initial: SetupState = {};

interface Row {
  id: string;
  name: string;
  packSize: string | null;
  barcode: string | null;
  internalBarcode: string | null;
  source: string | null;
  price: number | null;
}

/** EAN-13 ko SVG mein. EAN na ho (UPC/EAN-8/koi aur) to sirf adad likhte hain. */
function BarcodeSvg({ code, height = 44 }: { code: string; height?: number }) {
  if (!isEan13(code)) {
    return <p className="font-mono text-[11px]">{code}</p>;
  }
  const mods = ean13Modules(code);
  const w = 1.4;
  const rects: React.ReactNode[] = [];
  let x = 0;
  for (let i = 0; i < mods.length; i++) {
    if (mods[i] === "1") {
      // Kinare aur beech ki lakeerein thori lambi -- scanner ke liye.
      const guard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      rects.push(<rect key={i} x={x} y={0} width={w} height={guard ? height + 5 : height} fill="#000" />);
    }
    x += w;
  }
  return (
    <svg viewBox={`0 0 ${mods.length * w} ${height + 14}`} width="100%" style={{ maxWidth: 150 }} shapeRendering="crispEdges" aria-label={code}>
      {rects}
      <text x={(mods.length * w) / 2} y={height + 12} textAnchor="middle" fontFamily="monospace" fontSize="9">
        {code}
      </text>
    </svg>
  );
}

function BulkButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-4 w-4" /> {pending ? "…" : label}
      </span>
    </Button>
  );
}

export function LabelsClient({
  lang,
  q,
  filter,
  missingCount,
  rows,
}: {
  lang: Lang;
  q: string;
  filter: string;
  missingCount: number;
  rows: Row[];
}) {
  const [state, action] = useFormState(assignInternalBarcodes, initial);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [printing, setPrinting] = useState(false);

  const labels = useMemo(() => {
    const out: { row: Row; code: string }[] = [];
    for (const r of rows) {
      const n = picked[r.id] ?? 0;
      const code = r.internalBarcode ?? r.barcode;
      if (n > 0 && code) for (let i = 0; i < n; i++) out.push({ row: r, code });
    }
    return out;
  }, [rows, picked]);

  function toggle(r: Row, on: boolean) {
    setPicked((p) => ({ ...p, [r.id]: on ? Math.max(1, p[r.id] ?? 1) : 0 }));
  }

  function print() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  }

  return (
    <div className="space-y-3">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #label-sheet, #label-sheet * { visibility: visible !important; }
          #label-sheet { position: absolute; left: 0; top: 0; width: 100%; padding: 4mm; }
          .label-cell { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Apna barcode banana */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
            {t("pf_lb_missing_n", lang).replace("{n}", String(missingCount))}
          </p>
          <p className="text-xs text-surface-500">{t("pf_lb_internal_hint", lang)}</p>
          {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
          {state.success && (
            <p className="mt-1 text-xs text-emerald-700">{t("pf_lb_made_n", lang).replace("{n}", String(state.saved ?? 0))}</p>
          )}
        </div>
        {missingCount > 0 && (
          <form action={action}>
            <input type="hidden" name="all_missing" value="1" />
            <BulkButton label={t("pf_lb_make_all", lang)} />
          </form>
        )}
      </Card>

      {/* Chhantna */}
      <Card>
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="f" value={filter} />
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-surface-400" />
            <Input name="q" defaultValue={q} placeholder={t("pd_search", lang)} className="pl-8" />
          </div>
          <div className="flex gap-1 text-xs">
            {(["all", "missing", "internal"] as const).map((k) => (
              <Link
                key={k}
                href={`/admin/products/labels?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`rounded-full px-3 py-1.5 ${filter === k ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300"}`}
              >
                {t(k === "all" ? "pf_lb_f_all" : k === "missing" ? "pf_lb_f_missing" : "pf_lb_f_internal", lang)}
              </Link>
            ))}
          </div>
          <Button type="button" onClick={print} disabled={labels.length === 0}>
            <span className="inline-flex items-center gap-1.5">
              <Printer className="h-4 w-4" /> {t("pf_lb_print", lang)} ({labels.length})
            </span>
          </Button>
        </form>
      </Card>

      {/* Fehrist */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                <th className="w-8 py-2"></th>
                <th className="py-2">{t("pf_th_name", lang)}</th>
                <th className="py-2">{t("pf_th_pack", lang)}</th>
                <th className="py-2">Barcode</th>
                <th className="w-24 py-2">{t("pf_lb_copies", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const code = r.internalBarcode ?? r.barcode;
                const n = picked[r.id] ?? 0;
                return (
                  <tr key={r.id} className="border-b border-surface-100">
                    <td className="py-2">
                      <input type="checkbox" checked={n > 0} disabled={!code} onChange={(e) => toggle(r, e.target.checked)} />
                    </td>
                    <td className="py-2 pr-2 font-medium">{r.name}</td>
                    <td className="py-2 pr-2 text-surface-600">{r.packSize ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {code ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-xs">{code}</span>
                          {r.source === "internal" || r.internalBarcode === code ? (
                            <Badge tone="blue">{t("pf_lb_b_internal", lang)}</Badge>
                          ) : (
                            <Badge tone="gray">{t("pf_lb_b_company", lang)}</Badge>
                          )}
                        </span>
                      ) : (
                        <Badge tone="amber">{t("pf_sq_b_barcode", lang)}</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      <Input
                        type="number"
                        min={0}
                        max={200}
                        value={n}
                        disabled={!code}
                        onChange={(e) => setPicked((p) => ({ ...p, [r.id]: Math.max(0, Number(e.target.value) || 0) }))}
                        className="h-8 w-20 text-right"
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-surface-400">{t("pf_lb_empty", lang)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Label sheet -- screen par jhalak, print par sirf yehi */}
      {labels.length > 0 && (
        <Card>
          <p className="mb-2 flex items-center gap-1.5 text-xs text-surface-500">
            <Barcode className="h-3.5 w-3.5" /> {t("pf_lb_preview", lang)}
          </p>
          <div id="label-sheet" className={printing ? "" : "max-h-96 overflow-y-auto"}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {labels.map((l, i) => (
                <div key={`${l.row.id}-${i}`} className="label-cell rounded border border-dashed border-surface-300 bg-white p-2 text-center text-black">
                  <p className="truncate text-[11px] font-semibold leading-tight">{l.row.name}</p>
                  <p className="text-[10px] leading-tight text-neutral-600">
                    {l.row.packSize ?? ""}
                    {l.row.price != null ? `${l.row.packSize ? " · " : ""}Rs ${l.row.price.toLocaleString()}` : ""}
                  </p>
                  <BarcodeSvg code={l.code} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
