"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { saveChillerTotal, type ChillerTotalState } from "@/actions/milk-chiller-total";
import { formatPhone3, phoneLab } from "@/lib/milk-phone-lab";

export interface GridChiller {
  name: string;
  gross: string;
  fat: string;
  lr: string;
}

const initial: ChillerTotalState = {};

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {pending ? "..." : "Save"}
    </button>
  );
}

/** Ek chiller ki qatar: gross, FAT, LR likhein. SNF, TS, adjusted khud. Naam locked. */
function ChillerRow({ branchId, date, shift, row, snfConstant, referenceTs }: {
  branchId: string;
  date: string;
  shift: string;
  row: GridChiller;
  snfConstant: number;
  referenceTs: number;
}) {
  const [state, action] = useFormState(saveChillerTotal, initial);
  const [gross, setGross] = useState(row.gross);
  const [fat, setFat] = useState(row.fat);
  const [lr, setLr] = useState(row.lr);
  const lab = phoneLab(Number(gross), Number(fat), Number(lr), referenceTs, snfConstant);
  return (
    <form action={action} className="grid grid-cols-2 items-center gap-2 border-t border-surface-100 py-2 md:grid-cols-8" data-testid="chiller-row">
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="shift" value={shift} />
      <input type="hidden" name="chiller_no" value={row.name} />
      <div className="col-span-2 font-semibold text-surface-900 md:col-span-1">{row.name}</div>
      <input name="gross_liters" inputMode="decimal" placeholder="Gross L" value={gross} onChange={(e) => setGross(e.target.value)} className="rounded border px-2 py-1 text-sm" />
      <input name="fat_percentage" inputMode="decimal" placeholder="FAT" value={fat} onChange={(e) => setFat(e.target.value)} className="rounded border px-2 py-1 text-sm" />
      <input name="lr" inputMode="decimal" placeholder="LR" value={lr} onChange={(e) => setLr(e.target.value)} className="rounded border px-2 py-1 text-sm" />
      <div className="text-xs text-surface-600">SNF {lab ? formatPhone3(lab.snf) : "—"}</div>
      <div className="text-xs text-surface-600">TS {lab ? formatPhone3(lab.ts) : "—"}</div>
      <div className="text-xs text-surface-600">Adj {lab ? formatPhone3(lab.adjusted) : "—"}</div>
      <div className="flex items-center gap-2">
        <Save />
        {state.error && <span className="text-xs text-red-700">{state.error}</span>}
        {state.message && <span className="text-xs text-brand-700">{state.message}</span>}
      </div>
    </form>
  );
}

/** Shift ka grid: har chiller ki qatar, aur neeche shift ka kul. */
export function ChillerGrid({ branchId, date, shift, rows, snfConstant, referenceTs }: {
  branchId: string;
  date: string;
  shift: string;
  rows: GridChiller[];
  snfConstant: number;
  referenceTs: number;
}) {
  const saved = rows.filter((r) => r.gross.trim() && Number(r.gross) > 0 && r.fat.trim() && r.lr.trim());
  const gross = saved.reduce((s, r) => s + Number(r.gross), 0);
  const fatAvg = gross > 0 ? saved.reduce((s, r) => s + Number(r.gross) * Number(r.fat), 0) / gross : null;
  const lrAvg = gross > 0 ? saved.reduce((s, r) => s + Number(r.gross) * Number(r.lr), 0) / gross : null;
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-8 gap-2 text-xs text-surface-500 md:grid">
        <div>Chiller</div><div>Gross L</div><div>FAT</div><div>LR</div><div>SNF</div><div>TS</div><div>Adjusted</div><div></div>
      </div>
      {rows.length === 0 && <p className="text-sm text-surface-500">Is branch ke chiller master list mein nahi. Admin chiller ki list mein jorein.</p>}
      {rows.map((row) => (
        <ChillerRow key={row.name} branchId={branchId} date={date} shift={shift} row={row} snfConstant={snfConstant} referenceTs={referenceTs} />
      ))}
      <div className="rounded-lg bg-brand-50 p-3 text-sm">
        <b>Shift ka kul:</b> gross {gross ? gross.toFixed(3) : "—"} L · FAT {fatAvg == null ? "—" : fatAvg.toFixed(2)} · LR {lrAvg == null ? "—" : lrAvg.toFixed(2)} · {saved.length} chiller darj
      </div>
    </div>
  );
}
