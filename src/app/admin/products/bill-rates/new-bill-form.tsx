"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { FileText, Image as ImageIcon, Sparkles, Table2, Upload, X } from "lucide-react";
import { createBillFromFiles, createBillFromSheet, type BillRateState } from "@/actions/supplier-bill-rates";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: BillRateState = {};

const SAMPLE = `name\ttrade rate\tpack
Tapal Danedar\t610\t250g
Sufi Cooking Oil\t2450\t5 Litre
Lifebuoy Sabun\t95\t100g`;

interface PickedFile {
  url: string;
  mime: string;
  name: string;
}

function Submit({ label, busyLabel, icon, disabled }: { label: string; busyLabel: string; icon: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <span className="inline-flex items-center gap-1.5">
        {icon} {pending ? busyLabel : label}
      </span>
    </Button>
  );
}

/**
 * Bill andar lene ke do darwaze.
 *
 * Bill hamesha ek saaf tasveer ki shakl mein nahi aata: aksar PDF hota
 * hai, aksar do teen safhon ka, aur kabhi bill hota hi nahi -- supplier
 * rate ki sheet bhejta hai. Teenon soorton mein sawal wohi hai, is liye
 * aage ka safha bhi wohi rehta hai; sirf andar aane ka raasta alag hai.
 */
export function NewBillForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const lang = useLang();
  const router = useRouter();

  const [tab, setTab] = useState<"files" | "sheet">("files");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState("");

  const [fileState, fileAction] = useFormState(createBillFromFiles, initial);
  const [sheetState, sheetAction] = useFormState(createBillFromSheet, initial);

  const state = tab === "files" ? fileState : sheetState;

  useEffect(() => {
    const id = fileState.billId ?? sheetState.billId;
    if (id) router.push(`/admin/products/bill-rates/${id}`);
  }, [fileState.billId, sheetState.billId, router]);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const added: PickedFile[] = [];
      // Ek ek kar ke charhti hain, sath sath nahi. Sath bhejne par ek
      // ke nakaam hone par pata nahi chalta kaun si reh gayi.
      for (const file of Array.from(list)) {
        const path = `bills/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const { error } = await supabase.storage.from("products").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("products").getPublicUrl(path);
        added.push({ url: data.publicUrl, mime: file.type || "", name: file.name });
      }
      setFiles((prev) => [...prev, ...added].slice(0, 20));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("pf_photo_failed", lang));
    } finally {
      setUploading(false);
    }
  }

  const supplierField = (
    <div>
      <Label htmlFor="sup">{t("pf_bill_supplier", lang)}</Label>
      <Select id="sup" name="supplier_id" defaultValue="" className="w-full">
        <option value="">{t("pf_bill_supplier_none", lang)}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-surface-500">{t("pf_bill_supplier_hint", lang)}</p>
    </div>
  );

  return (
    <Card>
      {/* ---- Do darwaze ---- */}
      <div className="mb-4 flex gap-2">
        {(
          [
            ["files", t("pf_bill_tab_files", lang), <FileText key="f" className="h-4 w-4" />],
            ["sheet", t("pf_bill_tab_sheet", lang), <Table2 key="s" className="h-4 w-4" />],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              tab === key
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-surface-300 text-surface-600 hover:bg-surface-50"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === "files" ? (
        <form action={fileAction} className="space-y-3">
          <input type="hidden" name="files" value={JSON.stringify(files.map((f) => ({ url: f.url, mime: f.mime })))} />

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <Label>{t("pf_bill_photo", lang)}</Label>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-surface-300 px-3 py-5 text-surface-500 hover:bg-surface-50">
                <Upload className="h-6 w-6" />
                <span className="text-xs">{uploading ? t("pf_photo_uploading", lang) : t("pf_bill_files_add", lang)}</span>
                {/* PDF bhi chalti hai -- supplier ka bill aksar wahi
                    hota hai, aur us ka screenshot lene mein safha kat
                    jane ya dhundla hone ka khatra rehta hai. */}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="mt-1 text-xs text-surface-500">{t("pf_bill_files_hint", lang)}</p>

              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={f.url}
                      className="flex items-center gap-2 rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm"
                    >
                      {f.mime === "application/pdf" ? (
                        <FileText className="h-4 w-4 shrink-0 text-red-600" />
                      ) : (
                        <ImageIcon className="h-4 w-4 shrink-0 text-surface-400" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-surface-400">{t("pf_bill_page_label", lang).replace("{n}", String(i + 1))}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((x) => x.url !== f.url))}
                        className="text-surface-400 hover:text-red-600"
                        aria-label={t("pf_bill_file_remove", lang)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
            </div>

            {supplierField}
          </div>

          <Submit
            label={t("pf_bill_read_it", lang)}
            busyLabel={t("pf_bill_reading", lang)}
            icon={<Sparkles className="h-4 w-4" />}
            disabled={files.length === 0}
          />
        </form>
      ) : (
        <form action={sheetAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <Label htmlFor="sheet">{t("pf_bill_sheet_label", lang)}</Label>
              {/* Ye raasta AI se guzarta hi nahi: sheet mein rate LIKHA
                  hua adad hai, parha hua nahi. */}
              <Textarea
                id="sheet"
                name="sheet"
                rows={8}
                value={sheet}
                onChange={(e) => setSheet(e.target.value)}
                placeholder={SAMPLE}
                className="font-mono text-xs"
              />
              <p className="mt-1 text-xs text-surface-500">{t("pf_bill_sheet_hint", lang)}</p>
              <button
                type="button"
                onClick={() => setSheet(SAMPLE)}
                className="mt-1 text-xs text-brand-700 underline"
              >
                {t("pf_bill_sheet_sample", lang)}
              </button>
            </div>

            <div className="space-y-3">
              {supplierField}
              <div>
                <Label htmlFor="bno">{t("pf_bill_number", lang)}</Label>
                <Input id="bno" name="bill_number" />
              </div>
              <div>
                <Label htmlFor="bdate">{t("pf_bill_date", lang)}</Label>
                <Input id="bdate" name="bill_date" type="date" />
              </div>
            </div>
          </div>

          <Submit
            label={t("pf_bill_sheet_go", lang)}
            busyLabel="…"
            icon={<Table2 className="h-4 w-4" />}
            disabled={sheet.trim().length === 0}
          />
        </form>
      )}

      {state.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state.notice && <p className="mt-2 text-sm text-emerald-700">{state.notice}</p>}
    </Card>
  );
}
