import { pkDate } from "./compute";

export function medianLeadDays(rows: { supplier_id: string | null; purchase_date: string; received_at: string | null }[]): Record<string, number> {
  const by: Record<string, number[]> = {};
  for (const r of rows) {
    const rd = pkDate(r.received_at);
    if (!r.supplier_id || !rd) continue;
    const d = Math.round((Date.parse(rd + "T00:00:00Z") - Date.parse(r.purchase_date + "T00:00:00Z")) / 86400000);
    if (d < 0 || d > 365) continue;
    (by[r.supplier_id] ??= []).push(d);
  }
  const out: Record<string, number> = {};
  for (const [k, arr] of Object.entries(by)) {
    arr.sort((a, b) => a - b);
    out[k] = arr[Math.floor((arr.length - 1) / 2)];
  }
  return out;
}

