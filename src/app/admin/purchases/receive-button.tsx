"use client";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Camera, PackageCheck, X } from "lucide-react";
import { receivePurchase, type ActionState } from "@/actions/purchases";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export interface ReceiveItem {
  id: string;
  name: string;
  pack_size: string | null;
  quantity: number;
  unit_cost: number;
}

/**
 * Maal ginna (256). Pehle ye ek button tha: dabao, sab invoice jitna
 * andar. Ab har line par "theek aaya" aur "toota" likha jata hai; "kam"
 * khud nikalta hai. Jo asal mein aaya wohi stock mein jata hai, aur
 * supplier ka dena bhi utne ka banta hai.
 */
export function ReceiveButton({ purchaseId, purchaseNumber, items }: { purchaseId: string; purchaseNumber: string; items: ReceiveItem[] }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(receivePurchase, initialState);
  const [counts, setCounts] = useState<Record<string, { recv: string; dmg: string; note: string }>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { recv: String(i.quantity), dmg: "0", note: "" }]))
  );
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (state.success) {
      const id = setTimeout(() => setOpen(false), 1500);
      return () => clearTimeout(id);
    }
  }, [state.success]);

  const summary = useMemo(() => {
    let received = 0;
    let damaged = 0;
    let short = 0;
    let bad: string | null = null;
    let accepted = 0;
    for (const i of items) {
      const c = counts[i.id];
      const r = Math.max(0, Number(c?.recv || 0));
      const d = Math.max(0, Number(c?.dmg || 0));
      const s = i.quantity - r - d;
      if (s < 0 && !bad) {
        bad = t("grn_adds_up_err", lang).replace("{name}", i.name).replace("{qty}", String(i.quantity));
      }
      received += r;
      damaged += d;
      short += Math.max(0, s);
      accepted += r * i.unit_cost;
    }
    return { received, damaged, short, bad, accepted };
  }, [items, counts, lang]);

  const hasDiscrepancy = summary.damaged + summary.short > 0;

  function setAllOk() {
    setCounts(Object.fromEntries(items.map((i) => [i.id, { recv: String(i.quantity), dmg: "0", note: "" }])));
  }

  async function handlePhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const path = `grn/${purchaseId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("products").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
      >
        <PackageCheck className="h-3.5 w-3.5" /> {t("pu_mark_received", lang)}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">
                {t("grn_title", lang)} — {purchaseNumber}
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-surface-500">{t("grn_hint", lang)}</p>

            {state.success ? (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                {t("grn_done", lang)
                  .replace("{ok}", String(state.grn?.received ?? summary.received))
                  .replace("{dmg}", String(state.grn?.damaged ?? summary.damaged))
                  .replace("{short}", String(state.grn?.short ?? summary.short))}
              </p>
            ) : (
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="purchase_id" value={purchaseId} />
                <input type="hidden" name="grn_photo_url" value={photoUrl} />

                <div className="flex justify-end">
                  <button type="button" onClick={setAllOk} className="text-xs font-medium text-brand-600 hover:underline">
                    {t("grn_all_ok", lang)}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-800">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                        <th className="px-3 py-2 font-medium">{t("pu_products", lang)}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("grn_invoice_qty", lang)}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("grn_received", lang)}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("grn_damaged", lang)}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("grn_short", lang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {items.map((i) => {
                        const c = counts[i.id] ?? { recv: "", dmg: "0", note: "" };
                        const short = i.quantity - Math.max(0, Number(c.recv || 0)) - Math.max(0, Number(c.dmg || 0));
                        const off = short !== 0 || Number(c.dmg || 0) > 0;
                        return (
                          <tr key={i.id} className={short < 0 ? "bg-red-50 dark:bg-red-950/20" : off ? "bg-amber-50/60 dark:bg-amber-950/10" : ""}>
                            <td className="px-3 py-2">
                              <span className="font-medium text-surface-800 dark:text-surface-200">{i.name}</span>
                              {i.pack_size && <span className="block text-xs text-surface-400">{i.pack_size}</span>}
                              {off && (
                                <Input
                                  name={`note_${i.id}`}
                                  value={c.note}
                                  onChange={(e) => setCounts((p) => ({ ...p, [i.id]: { ...c, note: e.target.value } }))}
                                  placeholder={t("grn_note", lang)}
                                  className="mt-1 h-8 text-xs"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">{i.quantity}</td>
                            <td className="px-3 py-2 text-right">
                              <Input
                                type="number"
                                name={`recv_${i.id}`}
                                min={0}
                                step="any"
                                value={c.recv}
                                onChange={(e) => setCounts((p) => ({ ...p, [i.id]: { ...c, recv: e.target.value } }))}
                                className="h-8 w-20 text-right tabular-nums"
                                required
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Input
                                type="number"
                                name={`dmg_${i.id}`}
                                min={0}
                                step="any"
                                value={c.dmg}
                                onChange={(e) => setCounts((p) => ({ ...p, [i.id]: { ...c, dmg: e.target.value } }))}
                                className="h-8 w-20 text-right tabular-nums"
                              />
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums font-medium ${short < 0 ? "text-red-600" : short > 0 ? "text-amber-700 dark:text-amber-400" : "text-surface-400"}`}>
                              {short}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {summary.bad && <p className="text-xs text-red-600 dark:text-red-400">{summary.bad}</p>}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("grn_photo", lang)}</Label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-300 px-3 py-2 text-xs text-surface-600 hover:border-brand-400 dark:border-surface-700 dark:text-surface-300">
                      <Camera className="h-4 w-4" />
                      <span>{uploading ? t("pf_photo_uploading", lang) : photoUrl ? "✓ " + t("grn_photo", lang) : t("grn_photo", lang)}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-surface-400">{t("grn_photo_hint", lang)}</p>
                    {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
                  </div>
                  <div>
                    <Label>{t("grn_note", lang)}</Label>
                    <Textarea name="grn_note" rows={3} required={hasDiscrepancy} placeholder={hasDiscrepancy ? t("grn_note_req", lang) : ""} />
                  </div>
                </div>

                <div className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                    <span>{t("grn_received", lang)}: <strong>{summary.received}</strong></span>
                    <span>{t("grn_damaged", lang)}: <strong>{summary.damaged}</strong></span>
                    <span>{t("grn_short", lang)}: <strong>{summary.short}</strong></span>
                    <span>{t("pu_total", lang)}: <strong>Rs {summary.accepted.toLocaleString()}</strong></span>
                  </div>
                  {hasDiscrepancy && <p className="mt-1 text-[11px] text-surface-500">{t("grn_payable_note", lang)}</p>}
                </div>

                {state.error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>
                )}

                <SubmitButton disabled={!!summary.bad || uploading} />
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      <PackageCheck className="mr-1.5 h-4 w-4" /> {pending ? t("pu_receiving", lang) : t("grn_confirm", lang)}
    </Button>
  );
}
