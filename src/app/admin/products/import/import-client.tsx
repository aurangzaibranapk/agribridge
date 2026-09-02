"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileUp, RotateCcw, Trash2, Upload } from "lucide-react";
import { importProductsCsv, previewProductsCsv, type ImportRow, type ImportState } from "@/actions/products-import";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: ImportState = {};

const SAMPLE = `name,pack_size,unit,barcode,sale_rate,wholesale,trade_rate,mrp,expiry,category,brand
Tapal Danedar Chai,250g,Packet,,650,610,,700,12/2027,Chai,Tapal
Sufi Cooking Oil,1 Litre,Bottle,,540,505,485,560,06/2027,Ghee aur Tel,Sufi
Lifebuoy Sabun,100g,Piece,,120,,,130,,Sabun,Lifebuoy`;

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

const TONE: Record<ImportRow["status"], "green" | "amber" | "red" | "gray"> = {
  new: "green",
  duplicate: "amber",
  error: "red",
  skipped: "gray",
};

const LABEL_KEY: Record<ImportRow["status"], "pf_row_new" | "pf_row_dup" | "pf_row_error" | "pf_row_skipped"> = {
  new: "pf_row_new",
  duplicate: "pf_row_dup",
  error: "pf_row_error",
  skipped: "pf_row_skipped",
};

/**
 * Preview par likhi hui durusti.
 *
 * Ye qatar ke number (CSV ki lakeer) par rakhi jati hai, us ke naam par
 * nahi -- naam khud badla ja sakta hai, aur us par rakhne se durusti
 * pehli hi tabdeeli par apni qatar kho deti.
 */
type RowEdit = Partial<
  Record<"name" | "packSize" | "purchasePrice" | "sellingPrice" | "wholesalePrice" | "expiryDate", string>
>;

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
  const lang: Lang = useLang();
  const [csv, setCsv] = useState("");
  const [edits, setEdits] = useState<Record<number, RowEdit>>({});
  const [skips, setSkips] = useState<number[]>([]);
  const [touched, setTouched] = useState(false);

  const setCell = (line: number, key: keyof RowEdit, value: string) => {
    setTouched(true);
    setEdits((prev) => ({ ...prev, [line]: { ...prev[line], [key]: value } }));
  };

  const toggleSkip = (line: number) => {
    setTouched(true);
    setSkips((prev) => (prev.includes(line) ? prev.filter((x) => x !== line) : [...prev, line]));
  };

  // Nayi file ya naya matn aate hi purani durusti bekaar ho jati hai --
  // wo qatar ke number par lagi hoti hai, aur naye matn mein us number
  // par doosri cheez ho sakti hai.
  const replaceCsv = (text: string) => {
    setCsv(text);
    setEdits({});
    setSkips([]);
    setTouched(false);
  };

  const editFields = JSON.stringify(edits);
  const skipFields = JSON.stringify(skips);
  const [previewState, previewAction] = useFormState(previewProductsCsv, initial);
  const [importState, importAction] = useFormState(importProductsCsv, initial);
  const fileRef = useRef<HTMLInputElement>(null);

  // File yahin parhi jati hai, server par bheji nahi jati. Us ka matn
  // wohi hai jo neeche dikh raha hai -- yani jo charhega wo aap ne dekh
  // liya hoga.
  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    replaceCsv(await f.text());
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
              <strong>{tradeRatePending}</strong> {t("pf_pending_rate_warn", lang)}
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
              <FileUp className="h-4 w-4" /> {t("pf_pick_csv", lang)}
            </span>
          </Button>
          {/* Excel se seedha copy-paste kaam karta hai: wahan khane TAB
              se alag hote hain, aur parser dono nishan samajhta hai. */}
          <span className="text-xs text-surface-500">
            {t("pf_or_paste", lang)}
          </span>
        </div>

        <form action={previewAction} className="mt-3 space-y-2">
          <input type="hidden" name="edits" value={editFields} />
          <input type="hidden" name="skip" value={skipFields} />
          <Label htmlFor="csv">CSV</Label>
          <Textarea
            id="csv"
            name="csv"
            rows={8}
            value={csv}
            onChange={(e) => replaceCsv(e.target.value)}
            placeholder={SAMPLE}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Submit label={t("pf_preview_first", lang)} />
            <button
              type="button"
              onClick={() => replaceCsv(SAMPLE)}
              className="text-xs text-brand-700 underline"
            >
              {t("pf_fill_sample", lang)}
            </button>
          </div>
          {previewState.error && <p className="text-sm text-red-700">{previewState.error}</p>}
        </form>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-surface-600">{t("pf_column_names", lang)}</summary>
          <div className="mt-2 space-y-2 text-xs text-surface-600">
            <p>
              <strong>{t("pf_required", lang)}</strong> <code>name</code> (ya <code>naam</code>) aur <code>sale_rate</code> (ya{" "}
              <code>price</code>, <code>qeemat</code>).
            </p>
            <p>
              <strong>{t("pf_optional", lang)}</strong> <code>pack_size</code>, <code>unit</code>, <code>barcode</code>,{" "}
              <code>trade_rate</code>, <code>wholesale</code> (ya <code>thok</code>), <code>mrp</code>,{" "}
              <code>mfg</code>, <code>expiry</code>, <code>min_stock</code>, <code>category</code>,{" "}
              <code>brand</code>, <code>company</code>.
            </p>
            <p>
              {t("pf_date_rule", lang)
                .replace("{sample}", "05/09/2026")
                .replace("{day}", t("pf_day_5_sep", lang))
                .replace("{month}", "09/2027")}
            </p>
            <p>{t("pf_exact_names", lang)}</p>
            {categories.length > 0 && (
              <p>
                <strong>{t("pf_existing_cats", lang)}</strong> {categories.join(" · ")}
              </p>
            )}
            {brands.length > 0 && (
              <p>
                <strong>{t("pf_existing_brands", lang)}</strong> {brands.slice(0, 40).join(" · ")}
                {brands.length > 40 ? " …" : ""}
              </p>
            )}
            {companies.length > 0 && (
              <p>
                <strong>{t("pf_existing_companies", lang)}</strong> {companies.slice(0, 40).join(" · ")}
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
            <Badge tone="green">{t("pf_will_create", lang).replace("{n}", String(s.ready))}</Badge>
            {s.duplicates > 0 && <Badge tone="amber">{t("pf_already_there", lang).replace("{n}", String(s.duplicates))}</Badge>}
            {s.errors > 0 && <Badge tone="red">{t("pf_has_errors", lang).replace("{n}", String(s.errors))}</Badge>}
            {s.noTradeRate > 0 && <Badge tone="amber">{t("pf_no_trade_n", lang).replace("{n}", String(s.noTradeRate))}</Badge>}
            {s.noWholesale > 0 && <Badge tone="gray">{t("pf_no_wholesale_n", lang).replace("{n}", String(s.noWholesale))}</Badge>}
            {s.skipped > 0 && <Badge tone="gray">{t("pf_skipped_n", lang).replace("{n}", String(s.skipped))}</Badge>}
          </div>

          <p className="mb-3 text-xs text-surface-500">{t("pf_edit_hint", lang)}</p>

          {previewState.notice && <p className="mb-3 text-sm text-surface-700">{previewState.notice}</p>}

          {/* Durusti likh dene se qatar khud nahi badalti -- jaanch
              server par chalti hai. Is liye yaad dilaya jata hai,
              warna banda samajhta hai ke ho gaya. */}
          {touched && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              {t("pf_edit_rerun", lang)}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-xs">
              <thead>
                <tr className="border-b border-surface-200 text-left uppercase text-surface-500">
                  <th className="py-1.5">#</th>
                  <th className="py-1.5">{t("pf_th_name", lang)}</th>
                  <th className="py-1.5">{t("pf_th_pack", lang)}</th>
                  <th className="py-1.5 text-right">{t("pf_th_trade", lang)}</th>
                  <th className="py-1.5 text-right">{t("pf_th_sale", lang)}</th>
                  <th className="py-1.5 text-right">{t("pf_th_wholesale", lang)}</th>
                  <th className="py-1.5">{t("pf_th_expiry", lang)}</th>
                  <th className="py-1.5">{t("pf_th_state", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const off = r.status === "skipped";
                  // Har khana yahin theek ho sakta hai. Jo likha jata
                  // hai wo CSV ki us lakeer par chipak jata hai, aur
                  // dobara "Pehle dekhein" par server usi jaanch se
                  // guzarta hai jis se baqi qatarein.
                  const cell = (key: keyof RowEdit, value: string, extra?: string) => (
                    <Input
                      defaultValue={value}
                      disabled={off}
                      onChange={(e) => setCell(r.line, key, e.target.value)}
                      className={`h-7 px-1.5 py-0 text-xs ${extra ?? ""}`}
                    />
                  );

                  return (
                    <tr key={r.line} className={`border-b border-surface-100 align-top ${off ? "opacity-45" : ""}`}>
                      <td className="py-1.5 pr-1 text-surface-400">{r.line}</td>
                      <td className="min-w-[9rem] py-1.5 pr-1 font-medium">
                        {cell("name", r.name, "font-medium")}
                      </td>
                      <td className="w-20 py-1.5 pr-1">{cell("packSize", r.packSize ?? "")}</td>
                      {/* Trade rate na ho to "0" nahi likha jata --
                          khana khali rehta hai aur us par nishan lagta
                          hai. */}
                      <td className="w-20 py-1.5 pr-1">
                        {cell("purchasePrice", r.purchasePrice === null ? "" : String(r.purchasePrice), "text-right")}
                        {r.purchasePrice === null && !off && (
                          <span className="block text-[10px] text-amber-700">{t("pf_pending_word", lang)}</span>
                        )}
                      </td>
                      <td className="w-20 py-1.5 pr-1">
                        {cell("sellingPrice", r.sellingPrice === null ? "" : String(r.sellingPrice), "text-right")}
                      </td>
                      {/* Thok ka rate khali chhoRna theek hai. Sifar ka
                          matlab "thok par muft" hota. */}
                      <td className="w-20 py-1.5 pr-1">
                        {cell("wholesalePrice", r.wholesalePrice === null ? "" : String(r.wholesalePrice), "text-right")}
                      </td>
                      <td className="w-28 py-1.5 pr-1">{cell("expiryDate", r.expiryDate ?? "")}</td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={TONE[r.status]}>{t(LABEL_KEY[r.status], lang)}</Badge>
                          <button
                            type="button"
                            onClick={() => toggleSkip(r.line)}
                            className="inline-flex items-center gap-1 text-[11px] text-surface-500 underline hover:text-surface-800"
                          >
                            {off ? (
                              <>
                                <RotateCcw className="h-3 w-3" /> {t("pf_row_unskip", lang)}
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-3 w-3" /> {t("pf_row_skip", lang)}
                              </>
                            )}
                          </button>
                        </div>
                        {r.problem && <p className="mt-0.5 text-[11px] text-surface-600">{r.problem}</p>}
                        {r.status === "duplicate" && (
                          <p className="mt-0.5 text-[11px] text-amber-700">{t("pf_dup_hint", lang)}</p>
                        )}
                        {r.notes.map((n, i) => (
                          <p key={i} className="mt-0.5 text-[11px] text-amber-700">
                            {n}
                          </p>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {s.ready > 0 && (
            <form action={importAction} className="mt-4 border-t border-surface-200 pt-3">
              {/* Wohi matn dobara jata hai jo dekha gaya. Server usay
                  khud dobara parhta hai -- browser ka bheja hua natija
                  nahi maanta. */}
              <input type="hidden" name="csv" value={csv} />
              {/* Wohi durusti jo preview par dikhi. Dono jagah ek hi
                  hisaab chalta hai -- warna jo nazar aaya aur jo charha,
                  wo do alag cheezein ban jatin. */}
              <input type="hidden" name="edits" value={editFields} />
              <input type="hidden" name="skip" value={skipFields} />
              <Submit label={t("pf_upload_n", lang).replace("{n}", String(s.ready))} icon={<Upload className="h-4 w-4" />} />
              {s.duplicates + s.errors + s.skipped > 0 && (
                <p className="mt-1.5 text-xs text-surface-500">
                  {t("pf_skipped_note", lang)
                    .replace("{skipped}", String(s.duplicates + s.errors + s.skipped))
                    .replace("{ready}", String(s.ready))}
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
                  {t("pf_see_products", lang)}
                </Link>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
