"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Plus, ScanLine, Sparkles, Trash2 } from "lucide-react";
import { BarcodeCameraModal } from "@/components/pos/barcode-camera-modal";
import {
  addBlankItem,
  addScannedItem,
  approveIntakeBatch,
  attachPhotoAndRead,
  saveIntakeItem,
  skipIntakeItem,
  type IntakeState,
} from "@/actions/product-intake";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";
import { isValidBarcode } from "@/lib/barcode";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: IntakeState = {};

const UNITS = ["Packet", "Bottle", "Piece", "Box", "Bag", "Tin", "Sachet", "Kg", "Litre", "Dozen"];

interface Item {
  id: string;
  imageUrl: string | null;
  barcode: string | null;
  barcodeSource: string | null;
  barcodeVerified: boolean | null;
  name: string | null;
  brandName: string | null;
  companyName: string | null;
  categoryName: string | null;
  packSize: string | null;
  unit: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  mrpPrice: number | null;
  sellingPrice: number | null;
  wholesalePrice: number | null;
  purchasePrice: number | null;
  openingQty: number;
  status: string;
  aiReadAt: string | null;
}

function Submit({ label, icon, variant }: { label: string; icon?: React.ReactNode; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant}>
      <span className="inline-flex items-center gap-1.5">
        {icon} {pending ? "…" : label}
      </span>
    </Button>
  );
}

function Msg({ state }: { state: IntakeState }) {
  if (state.error) return <p className="mt-2 text-sm text-red-700">{state.error}</p>;
  if (state.notice) return <p className="mt-2 text-sm text-emerald-700">{state.notice}</p>;
  return null;
}

export function BatchClient({
  lang,
  batchId,
  batchStatus,
  categories,
  items,
  units,
}: {
  lang: Lang;
  batchId: string;
  batchStatus: string;
  categories: string[];
  items: Item[];
  /** Units ka master (273); khali ho to built-in fehrist. */
  units?: string[];
}) {
  const unitOptions = units && units.length > 0 ? units : UNITS;
  const router = useRouter();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanState, scanAction] = useFormState(addScannedItem, initial);
  const [blankState, blankAction] = useFormState(addBlankItem, initial);
  const [approveState, approveAction] = useFormState(approveIntakeBatch, initial);

  const done = batchStatus === "approved";
  const ready = items.filter((i) => i.status === "ready").length;
  const draft = items.filter((i) => i.status === "draft").length;

  // Scanner se code aate hi qatar ban jati hai. Banda dabba haath mein
  // liye khara hota hai -- us se aur ek click maangna kaam dhima kar
  // deta hai.
  async function onDetected(code: string) {
    setScanOpen(false);
    const fd = new FormData();
    fd.set("batch_id", batchId);
    fd.set("barcode", code);
    fd.set("barcode_source", "scanner");
    await addScannedItem({}, fd);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {scanOpen && <BarcodeCameraModal lang={lang} onDetected={onDetected} onClose={() => setScanOpen(false)} />}

      {/* ---- Upar ke do button ---- */}
      {!done && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setScanOpen(true)}>
              <span className="inline-flex items-center gap-1.5">
                <ScanLine className="h-4 w-4" /> {t("pf_scan_barcode", lang)}
              </span>
            </Button>

            <form action={blankAction}>
              <input type="hidden" name="batch_id" value={batchId} />
              <Submit label={t("pf_without_barcode", lang)} icon={<Plus className="h-4 w-4" />} variant="secondary" />
            </form>

            <span className="text-xs text-surface-500">
              {items.length} {t("pf_rows", lang)} · <strong className="text-emerald-700">{ready} {t("pf_ready", lang)}</strong>
              {draft > 0 && ` · ${draft} ${t("pf_incomplete", lang)}`}
            </span>
          </div>
          <Msg state={scanState} />
          <Msg state={blankState} />
        </Card>
      )}

      {/* ---- Har product ka apna baRa khana ---- */}
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-surface-500">
            {t("pf_nothing_yet", lang)}
          </p>
        </Card>
      ) : (
        items.map((item, idx) => (
          <ItemCard key={item.id} n={idx + 1} lang={lang} item={item} categories={categories} units={unitOptions} done={done} />
        ))
      )}

      {/* ---- Sab ek sath manzoor ---- */}
      {!done && items.length > 0 && (
        <Card>
          <form action={approveAction}>
            <input type="hidden" name="batch_id" value={batchId} />
            <div className="flex flex-wrap items-center gap-3">
              <Submit label={t("pf_approve_n", lang).replace("{n}", String(ready))} icon={<CheckCircle2 className="h-4 w-4" />} />
              {draft > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t("pf_incomplete_warn", lang).replace("{n}", String(draft))}
                </span>
              )}
            </div>
            <Msg state={approveState} />
          </form>
        </Card>
      )}

      {done && (
        <Card>
          <p className="flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> {t("pf_batch_done", lang)}
          </p>
        </Card>
      )}
    </div>
  );
}

/**
 * Ek product ka khana.
 *
 * Khane jaan boojh kar BARE hain aur ek sath nazar aate hain: banda
 * tasveer dekh kar saath hi khane parhta hai. Chhote khanon mein wo
 * ek ek kar ke kholta hai, aur us tarah pachaas products ka jaanchna
 * mumkin nahi rehta.
 */
function ItemCard({
  n,
  lang,
  item,
  categories,
  units: unitOptions,
  done,
}: {
  n: number;
  lang: Lang;
  item: Item;
  categories: string[];
  units: string[];
  done: boolean;
}) {
  const router = useRouter();
  const [saveState, saveAction] = useFormState(saveIntakeItem, initial);
  const [skipState, skipAction] = useFormState(skipIntakeItem, initial);
  const [photoState, photoAction] = useFormState(attachPhotoAndRead, initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const path = `intake/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("products").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("products").getPublicUrl(path);

      const fd = new FormData();
      fd.set("item_id", item.id);
      fd.set("image_url", data.publicUrl);
      await attachPhotoAndRead({}, fd);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("pf_photo_failed", lang));
    } finally {
      setUploading(false);
    }
  }

  const barcodeOk = item.barcode ? isValidBarcode(item.barcode) : null;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-surface-400">#{n}</span>
        {item.status === "ready" ? (
          <Badge tone="green">{t("pf_ready", lang)}</Badge>
        ) : item.status === "approved" ? (
          <Badge tone="green">{t("pf_approved", lang)}</Badge>
        ) : (
          <Badge tone="amber">{t("pf_incomplete", lang)}</Badge>
        )}
        {item.aiReadAt && (
          <span className="inline-flex items-center gap-1 text-xs text-brand-700">
            <Sparkles className="h-3 w-3" /> {t("pf_ai_filled", lang)}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* ---- Tasveer ---- */}
        <div>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.name ?? "product"}
              className="h-48 w-full rounded-lg border border-surface-200 object-contain bg-surface-50"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-surface-300 bg-surface-50 text-surface-400">
              <ImagePlus className="h-8 w-8" />
            </div>
          )}

          {!done && (
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
              <Camera className="h-4 w-4" />
              {uploading ? t("pf_photo_uploading", lang) : item.imageUrl ? t("pf_photo_change", lang) : t("pf_photo_add", lang)}
              {/* capture="environment" -- phone par seedha camera khulta
                  hai, gallery nahi. Dukan mein khaRe bande ke liye wohi
                  chahiye. */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={pickPhoto}
                disabled={uploading}
              />
            </label>
          )}
          {uploadError && <p className="mt-1 text-xs text-red-700">{uploadError}</p>}
          <Msg state={photoState} />
        </div>

        {/* ---- Khane ---- */}
        <form action={saveAction} className="space-y-3">
          <input type="hidden" name="item_id" value={item.id} />

          <div>
            <Label htmlFor={`name-${item.id}`}>{t("pf_f_name", lang)}</Label>
            <Input
              id={`name-${item.id}`}
              name="name"
              defaultValue={item.name ?? ""}
              disabled={done}
              className="text-base"
              placeholder="Tapal Danedar Chai"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={`brand-${item.id}`}>{t("pf_f_brand", lang)}</Label>
              <Input id={`brand-${item.id}`} name="brand_name" defaultValue={item.brandName ?? ""} disabled={done} />
            </div>
            <div>
              <Label htmlFor={`comp-${item.id}`}>{t("pf_f_company", lang)}</Label>
              <Input id={`comp-${item.id}`} name="company_name" defaultValue={item.companyName ?? ""} disabled={done} />
            </div>
            <div>
              <Label htmlFor={`cat-${item.id}`}>{t("pf_f_category", lang)}</Label>
              <Input
                id={`cat-${item.id}`}
                name="category_name"
                defaultValue={item.categoryName ?? ""}
                disabled={done}
                list={`cats-${item.id}`}
              />
              {/* Maujood qismein tajweez ke taur par -- taake naye naam
                  se doosri qism na ban jaye. */}
              <datalist id={`cats-${item.id}`}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={`pack-${item.id}`}>{t("pf_f_pack", lang)}</Label>
              <Input id={`pack-${item.id}`} name="pack_size" defaultValue={item.packSize ?? ""} disabled={done} placeholder="250g" />
            </div>
            <div>
              <Label htmlFor={`unit-${item.id}`}>{t("pf_f_unit", lang)}</Label>
              <Select id={`unit-${item.id}`} name="unit" defaultValue={item.unit ?? ""} disabled={done} className="w-full">
                <option value="">—</option>
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`qty-${item.id}`}>{t("pf_f_qty_in", lang)}</Label>
              <Input
                id={`qty-${item.id}`}
                name="opening_qty"
                type="number"
                step="0.001"
                min="0"
                defaultValue={item.openingQty ?? 0}
                disabled={done}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={`trade-${item.id}`}>{t("pf_f_trade", lang)}</Label>
              <Input
                id={`trade-${item.id}`}
                name="purchase_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.purchasePrice ?? ""}
                disabled={done}
                placeholder={t("pf_f_trade_ph", lang)}
              />
              {/* Dabbe par trade rate likha hi nahi hota. Khali chhoRna
                  yahan theek hai -- product par nishan lag jayega. */}
              <p className="mt-0.5 text-[11px] text-surface-500">{t("pf_f_trade_hint", lang)}</p>
            </div>
            <div>
              <Label htmlFor={`sale-${item.id}`}>{t("pf_f_sale", lang)}</Label>
              <Input
                id={`sale-${item.id}`}
                name="selling_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.sellingPrice ?? ""}
                disabled={done}
                className="text-base font-semibold"
              />
            </div>
            <div>
              <Label htmlFor={`mrp-${item.id}`}>{t("pf_f_mrp", lang)}</Label>
              <Input id={`mrp-${item.id}`} name="mrp_price" type="number" step="0.01" min="0" defaultValue={item.mrpPrice ?? ""} disabled={done} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={`whole-${item.id}`}>{t("pf_f_wholesale", lang)}</Label>
              <Input
                id={`whole-${item.id}`}
                name="wholesale_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.wholesalePrice ?? ""}
                disabled={done}
                placeholder={t("pf_f_wholesale_ph", lang)}
              />
              {/* Khali chhoRna theek hai. Sifar likhne ka matlab "thok
                  par muft" hota -- aur wo adad ek din bill par chala
                  jata. */}
              <p className="mt-0.5 text-[11px] text-surface-500">{t("pf_f_wholesale_hint", lang)}</p>
            </div>
            <div>
              <Label htmlFor={`mfg-${item.id}`}>{t("pf_f_mfg", lang)}</Label>
              <Input id={`mfg-${item.id}`} name="manufacture_date" type="date" defaultValue={item.manufactureDate ?? ""} disabled={done} />
            </div>
            <div>
              <Label htmlFor={`exp-${item.id}`}>{t("pf_f_expiry", lang)}</Label>
              <Input id={`exp-${item.id}`} name="expiry_date" type="date" defaultValue={item.expiryDate ?? ""} disabled={done} />
            </div>
            <div>
              <Label htmlFor={`bc-${item.id}`}>{t("pf_f_barcode", lang)}</Label>
              <Input id={`bc-${item.id}`} name="barcode" defaultValue={item.barcode ?? ""} disabled={done} className="font-mono" />
              {/* Barcode kahan se aaya, ye adad se zyada ahem hai. */}
              {item.barcode && (
                <p className="mt-0.5 text-[11px]">
                  {item.barcodeSource === "scanner" ? (
                    <span className="text-emerald-700">{t("pf_bc_scanner", lang)}</span>
                  ) : item.barcodeSource === "ai" ? (
                    <span className="text-amber-700">{t("pf_bc_ai", lang)}</span>
                  ) : (
                    <span className="text-surface-500">{t("pf_bc_manual", lang)}</span>
                  )}
                  {barcodeOk === false && <span className="text-red-700">{t("pf_bc_bad_digit", lang)}</span>}
                </p>
              )}
            </div>
          </div>

          {!done && (
            <div className="flex flex-wrap items-center gap-2 border-t border-surface-100 pt-2">
              <Submit label={t("pf_save", lang)} />
              <button
                type="submit"
                formAction={skipAction}
                className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("pf_drop_row", lang)}
              </button>
            </div>
          )}

          <Msg state={saveState} />
          <Msg state={skipState} />
        </form>
      </div>
    </Card>
  );
}
