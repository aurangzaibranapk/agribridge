"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileUp, Upload } from "lucide-react";
import { importProductsCsv, previewProductsCsv, type ImportRow, type ImportState } from "@/actions/products-import";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Label, Textarea } from "@/components/ui/form";

const initial: ImportState = {};

const SAMPLE = `name,pack_size,unit,barcode,sale_rate,trade_rate,mrp,expiry,category,brand
Tapal Danedar Chai,250g,Packet,,650,,700,12/2027,Chai,Tapal
Sufi Cooking Oil,1 Litre,Bottle,,540,485,560,06/2027,Ghee aur Tel,Sufi
Lifebuoy Sabun,100g,Piece,,120,,130,,Sabun,Lifebuoy`;

function Submit({ label, icon }: { label: string; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">
        {icon} {pending ? "…" : label}
      </span>
    </Button>
  );
}

const TONE: Record<ImportRow["status"], "green" | "amber" | "red"> = {
  new: "green",
  duplicate: "amber",
  error: "red",
};

const LABEL: Record<ImportRow["status"], string> = {
  new: "banega",
  duplicate: "pehle se hai",
  error: "ghalti",
};

export function ImportClient({
  categories,
  brands,
  companies,
  tradeRatePending,
}: {
  categories: string[];
  brands: string[];
  companies: string[];
  tradeRatePending: number | null;
}) {
  const [csv, setCsv] = useState("");
  const [previewState, previewAction] = useFormState(previewProductsCsv, initial);
  const [importState, importAction] = useFormState(importProductsCsv, initial);
  const fileRef = useRef<HTMLInputElement>(null);

  // File yahin parhi jati hai, server par bheji nahi jati. Us ka matn
  // wohi hai jo neeche dikh raha hai -- yani jo charhega wo aap ne dekh
  // liya hoga.
  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCsv(await f.text());
  }

  const s = previewState.summary;
  const rows = previewState.rows ?? [];

  return (
    <div className="space-y-4">
      {tradeRatePending !== null && tradeRatePending > 0 && (
        <Card>
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{tradeRatePending}</strong> products aise hain jin ka <strong>trade rate abhi nahi bhara</strong>.
              Un par munafa ka hisaab abhi nahi banta. Supplier ka bill aane par bhar dein.
            </span>
          </p>
        </Card>
      )}

      {/* ---- File ya matn ---- */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={pickFile}
            className="hidden"
          />
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            <span className="inline-flex items-center gap-1.5">
              <FileUp className="h-4 w-4" /> CSV file chunein
            </span>
          </Button>
          <span className="text-xs text-surface-500">— ya neeche seedha paste kar dein</span>
        </div>

        <form action={previewAction} className="mt-3 space-y-2">
          <Label htmlFor="csv">CSV</Label>
          <Textarea
            id="csv"
            name="csv"
            rows={8}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={SAMPLE}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Submit label="Pehle dekhein" />
            <button
              type="button"
              onClick={() => setCsv(SAMPLE)}
              className="text-xs text-brand-700 underline"
            >
              namoona bhar dein
            </button>
          </div>
          {previewState.error && <p className="text-sm text-red-700">{previewState.error}</p>}
        </form>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-surface-600">Khanon ke naam</summary>
          <div className="mt-2 space-y-2 text-xs text-surface-600">
            <p>
              <strong>Lazmi:</strong> <code>name</code> (ya <code>naam</code>) aur <code>sale_rate</code> (ya{" "}
              <code>price</code>, <code>qeemat</code>).
            </p>
            <p>
              <strong>Ikhtiyari:</strong> <code>pack_size</code>, <code>unit</code>, <code>barcode</code>,{" "}
              <code>trade_rate</code>, <code>mrp</code>, <code>mfg</code>, <code>expiry</code>,{" "}
              <code>min_stock</code>, <code>category</code>, <code>brand</code>, <code>company</code>.
            </p>
            <p>
              Tareekh <code>05/09/2026</code> ka matlab <strong>5 September</strong> liya jayega (din pehle). Sirf
              mahina likhein (<code>09/2027</code>) to us mahine ka aakhri din.
            </p>
            <p>
              Qism, brand aur company ka naam <strong>hu ba hu</strong> wohi hona chahiye jo pehle se darj hai —
              warna khali reh jayega. Naya khud se nahi banta (ek harf ki ghalti do alag brand bana deti hai).
            </p>
            {categories.length > 0 && (
              <p>
                <strong>Maujood qismein:</strong> {categories.join(" · ")}
              </p>
            )}
            {brands.length > 0 && (
              <p>
                <strong>Maujood brands:</strong> {brands.slice(0, 40).join(" · ")}
                {brands.length > 40 ? " …" : ""}
              </p>
            )}
            {companies.length > 0 && (
              <p>
                <strong>Maujood companies:</strong> {companies.slice(0, 40).join(" · ")}
                {companies.length > 40 ? " …" : ""}
              </p>
            )}
          </div>
        </details>
      </Card>

      {/* ---- Preview ---- */}
      {s && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="green">{s.ready} banenge</Badge>
            {s.duplicates > 0 && <Badge tone="amber">{s.duplicates} pehle se hain</Badge>}
            {s.errors > 0 && <Badge tone="red">{s.errors} mein ghalti</Badge>}
            {s.noTradeRate > 0 && <Badge tone="amber">{s.noTradeRate} ka trade rate nahi</Badge>}
          </div>

          {previewState.notice && <p className="mb-3 text-sm text-surface-700">{previewState.notice}</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-xs">
              <thead>
                <tr className="border-b border-surface-200 text-left uppercase text-surface-500">
                  <th className="py-1.5">#</th>
                  <th className="py-1.5">Naam</th>
                  <th className="py-1.5">Pack</th>
                  <th className="py-1.5 text-right">Trade</th>
                  <th className="py-1.5 text-right">Sale</th>
                  <th className="py-1.5">Expiry</th>
                  <th className="py-1.5">Haalat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-b border-surface-100 align-top">
                    <td className="py-1.5 text-surface-400">{r.line}</td>
                    <td className="py-1.5 font-medium">{r.name || <span className="text-red-600">—</span>}</td>
                    <td className="py-1.5 text-surface-600">{r.packSize ?? "—"}</td>
                    {/* Trade rate na ho to "0" nahi likha jata. */}
                    <td className="py-1.5 text-right tabular-nums">
                      {r.purchasePrice === null ? (
                        <span className="text-amber-700">baqi</span>
                      ) : (
                        r.purchasePrice.toLocaleString()
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {r.sellingPrice === null ? "—" : r.sellingPrice.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-surface-600">{r.expiryDate ?? "—"}</td>
                    <td className="py-1.5">
                      <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                      {r.problem && <p className="mt-0.5 text-[11px] text-surface-600">{r.problem}</p>}
                      {r.notes.map((n, i) => (
                        <p key={i} className="mt-0.5 text-[11px] text-amber-700">
                          {n}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {s.ready > 0 && (
            <form action={importAction} className="mt-4 border-t border-surface-200 pt-3">
              {/* Wohi matn dobara jata hai jo dekha gaya. Server usay
                  khud dobara parhta hai -- browser ka bheja hua natija
                  nahi maanta. */}
              <input type="hidden" name="csv" value={csv} />
              <Submit label={`${s.ready} products charhayein`} icon={<Upload className="h-4 w-4" />} />
              {s.duplicates + s.errors > 0 && (
                <p className="mt-1.5 text-xs text-surface-500">
                  {s.duplicates + s.errors} qatarein chhoR di jayengi — sirf {s.ready} banenge.
                </p>
              )}
            </form>
          )}
        </Card>
      )}

      {/* ---- Natija ---- */}
      {(importState.error || importState.notice) && (
        <Card>
          {importState.error && <p className="text-sm text-red-700">{importState.error}</p>}
          {importState.success && (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm text-emerald-800">{importState.notice}</p>
                <Link href="/admin/products" className="mt-1 inline-block text-xs text-brand-700 underline">
                  Products dekhein
                </Link>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
