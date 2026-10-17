"use client";
import { useFormStatus } from "react-dom";
import { Upload, Check, X, Loader2, FileSpreadsheet } from "lucide-react";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { previewSeasonImport, commitSeasonImport, cancelSeasonImport, reviewCustomProduct, type SeasonState, type ImportState } from "@/actions/season-booking";
import type { CampaignProductRow } from "@/lib/campaigns/season-v2";

const card = "rounded-2xl border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900";
const badge = { ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", error: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" } as const;
function Msg({ s }: { s: SeasonState }) {
  if (s.error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{s.error}</p>;
  if (s.success) return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{s.message}</p>;
  return null;
}
function Btn({ children, cls }: { children: React.ReactNode; cls: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${cls}`}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>;
}

export function ImportPanel({ campaignId, batch, rows }: {
  campaignId: string;
  batch: null | { id: string; file_name: string | null; total_rows: number; ok_rows: number; warning_rows: number; error_rows: number; mine: boolean };
  rows: { row_no: number; raw: any; result: "ok" | "warning" | "error"; messages: string[] }[];
}) {
  const [ps, preview] = useFormState(previewSeasonImport, {} as ImportState);
  const [cs, commit] = useFormState(commitSeasonImport, {} as SeasonState);
  const [xs, cancel] = useFormState(cancelSeasonImport, {} as SeasonState);
  return (
    <section id="import" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-surface-900 dark:text-white"><FileSpreadsheet className="h-5 w-5 text-emerald-600" />Sheet se import</h3>
          <p className="text-xs text-surface-500">Google Sheets / Excel se CSV ya XLSX. Pehle preview, phir doosra Admin confirm kare. <a href="/admin/season-bookings/template" className="font-medium text-emerald-700 underline dark:text-emerald-400">Template (XLSX)</a> · <a href="/admin/season-bookings/template?format=csv" className="font-medium text-emerald-700 underline dark:text-emerald-400">CSV</a></p>
        </div>
        <form action={preview} className="flex items-center gap-2">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="max-w-[230px] text-sm text-surface-600 file:mr-2 file:rounded-lg file:border-0 file:bg-surface-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:text-surface-300 dark:file:bg-surface-800 dark:file:text-surface-100" />
          <Btn cls="bg-emerald-600 text-white hover:bg-emerald-700"><Upload className="h-4 w-4" />Preview</Btn>
        </form>
      </div>
      <div className="mt-3 space-y-2"><Msg s={ps} /><Msg s={cs} /><Msg s={xs} /></div>
      {batch && (
        <div className="mt-4 overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-emerald-800 to-emerald-600 px-4 py-3 text-white">
            <div className="text-sm"><b>Preview — {batch.file_name}</b> · {batch.total_rows} qataarein · <span className="text-emerald-100">{batch.ok_rows} theek</span> · <span className="text-amber-200">{batch.warning_rows} warning</span> · <span className="text-red-200">{batch.error_rows} error</span> · abhi kuch save nahi hua</div>
            <div className="flex gap-2">
              <form action={cancel}><input type="hidden" name="batch_id" value={batch.id} /><Btn cls="border border-white/40 text-white hover:bg-white/10"><X className="h-4 w-4" />Cancel</Btn></form>
              <form action={commit}><input type="hidden" name="batch_id" value={batch.id} />
                {batch.mine ? <span className="inline-block rounded-lg bg-white/15 px-3 py-2 text-xs">Doosra Admin confirm karega</span> : <Btn cls="bg-amber-400 text-surface-900 hover:bg-amber-300"><Check className="h-4 w-4" />{batch.ok_rows + batch.warning_rows} qataarein import karein</Btn>}
              </form>
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-50 text-surface-500 dark:bg-surface-950"><tr>{["#", "Phone", "Kisan", "Farm", "Acre", "Lat, Lng", "Qism", "Product", "Miqdar", "Natija"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {rows.map((r) => (
                  <tr key={r.row_no} className="text-surface-700 dark:text-surface-300">
                    <td className="px-3 py-2 text-surface-400">{r.row_no}</td><td className="px-3 py-2">{r.raw.phone ? `0${r.raw.phone}` : r.raw.raw?.Phone ?? "—"}</td>
                    <td className="px-3 py-2">{r.raw.name || "—"}</td><td className="px-3 py-2">{r.raw.farm || "—"}</td><td className="px-3 py-2">{r.raw.acres ?? "—"}</td>
                    <td className="px-3 py-2">{r.raw.lat != null ? `${r.raw.lat}, ${r.raw.lng}` : "—"}</td><td className="px-3 py-2">{r.raw.kind ?? "—"}</td>
                    <td className="px-3 py-2">{r.raw.product || "—"}</td><td className="px-3 py-2">{r.raw.quantity ?? "—"} {r.raw.unit}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge[r.result]}`}>{r.messages.length ? r.messages.join(" · ") : "Match"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export function CustomProductQueue({ items, products }: { items: { id: string; name: string; line_kind: string; quantity: number | null; unit: string | null; mine: boolean; farmers: { full_name: string; phone_number: string | null } | null }[]; products: CampaignProductRow[] }) {
  const [s, act] = useFormState(reviewCustomProduct, {} as SeasonState);
  if (!items.length) return null;
  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-surface-900 dark:text-white">Kisanon ki apni products ({items.length})</h3>
      <p className="text-xs text-surface-500">Catalog product se jorein ya rad karein. Jis ne entry banayi wo khud review nahi kar sakta.</p>
      <div className="mt-3"><Msg s={s} /></div>
      <ul className="mt-2 divide-y divide-surface-100 dark:divide-surface-800">
        {items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span><b className="text-surface-900 dark:text-white">{c.name}</b> <span className="text-xs text-surface-500">· {c.line_kind} · {c.quantity ?? "—"} {c.unit ?? ""} · {c.farmers?.full_name}</span></span>
            {c.mine ? <span className="text-xs text-surface-500">Doosra Admin review karega</span> : (
              <form action={act} className="flex gap-2">
                <input type="hidden" name="request_id" value={c.id} />
                <select name="product_id" className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100">
                  <option value="">— Rad karein —</option>
                  {products.filter((p) => p.line_kind === c.line_kind).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Btn cls="bg-surface-900 text-white dark:bg-white dark:text-surface-900">Save</Btn>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
