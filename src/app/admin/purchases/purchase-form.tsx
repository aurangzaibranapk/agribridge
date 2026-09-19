"use client";
import { useMemo, useState } from "react";
import { aajKaKhana } from "@/lib/utils/format";
import { useFormState, useFormStatus } from "react-dom";
import { createPurchase, type ActionState } from "@/actions/purchases";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Plus, Trash2, Search, FileUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { PaymentTermsFields } from "@/components/purchases/payment-terms-fields";
const initialState: ActionState = {};
interface Supplier {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  purchase_price: number;
  selling_price: number | null;
  mrp_price: number | null;
  wholesale_price: number | null;
  units_per_pack: number | null;
}
interface Line {
  product_id: string;
  /** Pet (peti) mein kitni botal -- bill ka "1X6" (438). Khali/1 = pet nahi. */
  units_in_pack: string;
  quantity: string;
  unit_cost: string;
  wholesale_rate: string;
  mrp_rate: string;
  sale_rate: string;
  batch_number: string;
  manufacture_date: string;
  expiry_date: string;
}
const emptyLine: Line = {
  product_id: "",
  units_in_pack: "",
  quantity: "",
  unit_cost: "",
  wholesale_rate: "",
  mrp_rate: "",
  sale_rate: "",
  batch_number: "",
  manufacture_date: "",
  expiry_date: "",
};
/** Pet mode: units > 1 -- quantity/rate pet ke, database mein botal ke jate hain. */
function lineUnits(line: Line): number {
  const u = parseFloat(line.units_in_pack);
  return Number.isFinite(u) && u > 0 ? u : 0;
}
const rupee2 = (v: number) => (Math.round(v * 100) / 100).toLocaleString();
/** Adaigi ki slip: raqam + tareekh + tasveer (436). */
interface Slip {
  amount: string;
  paid_on: string;
  url: string;
  fileName: string;
  uploading: boolean;
  error: string | null;
}
const emptySlip: Slip = { amount: "", paid_on: "", url: "", fileName: "", uploading: false, error: null };

export function PurchaseForm({
  suppliers,
  products,
  isAdminLevel,
  branches,
  staffBranchName,
  uiMode = "advanced",
}: {
  suppliers: Supplier[];
  products: Product[];
  isAdminLevel: boolean;
  branches: { id: string; name: string }[];
  staffBranchName: string | null;
  /** Simple = sirf product, tadad, rate, adaigi; batch/expiry/notes chhupe (E). */
  uiMode?: "simple" | "advanced";
}) {
  const simple = uiMode === "simple";
  const lang = useLang();
  const [state, formAction] = useFormState(createPurchase, initialState);
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(aajKaKhana());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [terms, setTerms] = useState<"paid" | "partial" | "credit">("credit");
  const [slips, setSlips] = useState<Slip[]>([]);
  function updateSlip(idx: number, patch: Partial<Slip>) {
    setSlips((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  async function uploadSlipFile(idx: number, file: File | undefined) {
    if (!file) return;
    updateSlip(idx, { uploading: true, error: null });
    try {
      const supabase = createClient();
      const path = `purchase-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("payment-slips").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("payment-slips").getPublicUrl(path);
      updateSlip(idx, { url: data.publicUrl, fileName: file.name, uploading: false });
    } catch (err: any) {
      updateSlip(idx, { uploading: false, error: err?.message ?? "Upload nahi ho saki. Dobara koshish karein." });
    }
  }
  const slipsJson = useMemo(() => {
    return JSON.stringify(
      slips
        .filter((s) => s.url && s.paid_on && parseFloat(s.amount) > 0)
        .map((s) => ({ amount: parseFloat(s.amount), paid_on: s.paid_on, image_url: s.url }))
    );
  }, [slips]);
  const slipIncomplete = slips.some(
    (s) => (s.url || s.paid_on || s.amount) && !(s.url && s.paid_on && parseFloat(s.amount) > 0)
  );
  // Malik (19 September): "jaise slip upload ho neeche outstanding aa
  // jaye... kitna hua, dena hai nahi dena" -- slips ka jama aur baqi
  // dena wahin ke wahin dikhta rehta hai.
  const slipsTotal = useMemo(
    () => slips.reduce((sum, s) => sum + (s.url && s.paid_on ? parseFloat(s.amount) || 0 : 0), 0),
    [slips]
  );
  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, field: keyof Line, value: string) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const updated = { ...line, [field]: value };
        if (field === "product_id") {
          const product = products.find((p) => p.id === value);
          // Pet mein kitni botal -- pichli dafa jo likha tha wahi khud
          // aa jata hai (438).
          if (product && !updated.units_in_pack && product.units_per_pack != null && product.units_per_pack > 1) {
            updated.units_in_pack = String(product.units_per_pack);
          }
          const u = parseFloat(updated.units_in_pack);
          const units = Number.isFinite(u) && u > 1 ? u : 1;
          // Database mein rate hamesha FI BOTAL hai; form par pet mode
          // mein PET ka rate dikhana hai -- is liye × units.
          if (product && !updated.unit_cost) {
            updated.unit_cost = String(Math.round(product.purchase_price * units * 100) / 100);
          }
          // Maujooda rate dikha dete hain -- khali chhoR dein to wahi
          // rahega, badalna ho to yahin badal jayega (19 September).
          // Wholesale pet ka hota hai (Boss), MRP/Sale single botal ke.
          if (product && !updated.wholesale_rate && product.wholesale_price != null) {
            updated.wholesale_rate = String(Math.round(product.wholesale_price * units * 100) / 100);
          }
          if (product && !updated.mrp_rate && product.mrp_price != null) {
            updated.mrp_rate = String(product.mrp_price);
          }
          if (product && !updated.sale_rate && product.selling_price != null) {
            updated.sale_rate = String(product.selling_price);
          }
        }
        return updated;
      })
    );
  }
  const total = useMemo(
    () =>
      lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0), 0),
    [lines]
  );
  const itemsJson = useMemo(() => {
    return JSON.stringify(
      lines
        .filter((l) => l.product_id && l.quantity && l.unit_cost)
        .map((l) => {
          // Pet mode (438): form par pet ke adad, database mein botal
          // ke -- stock botal mein chalta hai aur POS botal bechta hai.
          // 12 pet × Rs 753.41 = 72 botal × Rs 125.5683... -- kul wahi.
          const units = lineUnits(l);
          const pet = units > 1;
          const qty = parseFloat(l.quantity);
          const cost = parseFloat(l.unit_cost);
          const wholesale = l.wholesale_rate ? parseFloat(l.wholesale_rate) : undefined;
          return {
            product_id: l.product_id,
            quantity: pet ? qty * units : qty,
            unit_cost: pet ? cost / units : cost,
            wholesale_rate: wholesale != null ? (pet ? wholesale / units : wholesale) : undefined,
            mrp_rate: l.mrp_rate ? parseFloat(l.mrp_rate) : undefined,
            sale_rate: l.sale_rate ? parseFloat(l.sale_rate) : undefined,
            units_per_pack: units > 0 ? units : undefined,
            batch_number: l.batch_number || undefined,
            manufacture_date: l.manufacture_date || undefined,
            expiry_date: l.expiry_date || undefined,
          };
        })
    );
  }, [lines]);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">{t("pu_new_order", lang)}</h2>

      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {t("pu_created", lang)}
        </p>
      )}
      {state.warning && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {state.warning}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="supplier_id" value={supplierId} />
        <input type="hidden" name="purchase_date" value={purchaseDate} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="items_json" value={itemsJson} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("pu_supplier_req", lang)}</Label>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">{t("pu_select", lang)}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("pu_purchase_date", lang)}</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
        </div>

        {isAdminLevel ? (
          <div>
            <Label>{t("pu_branch_req", lang)}</Label>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              <option value="">{t("pu_select", lang)}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
            <input type="hidden" name="branch_id" value={branchId} />
          </div>
        ) : (
          staffBranchName && (
            <p className="text-xs text-surface-500">{t("pu_branch", lang)}: {staffBranchName}</p>
          )
        )}

        {!simple && (
          <div>
            <Label>{t("pu_notes", lang)}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        )}

        <input type="hidden" name="slips_json" value={slipsJson} />

        {/* Adaigi ki shartein (255): poora / kuch / udhaar, aur kab tak. */}
        <PaymentTermsFields
          onTermsChange={(v) => {
            setTerms(v);
            // Paid/partial chunte hi ek khali slip ki qatar khul jati
            // hai -- malik ka kehna tha "payment ke end par pooche" (436).
            if (v !== "credit") setSlips((prev) => (prev.length === 0 ? [{ ...emptySlip }] : prev));
          }}
        />

        {/* Adaigi ki slips (436): har slip par raqam + tareekh + tasveer. */}
        {terms !== "credit" && (
          <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-800">
            <div className="mb-1 flex items-center justify-between">
              <Label>{t("pu_slips_title", lang)}</Label>
              <button
                type="button"
                onClick={() => setSlips((prev) => [...prev, { ...emptySlip }])}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> {t("pu_add_slip", lang)}
              </button>
            </div>
            <p className="mb-2 text-xs text-surface-500">{t("pu_slips_hint", lang)}</p>
            <div className="space-y-2">
              {slips.map((slip, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg bg-surface-50 p-2 dark:bg-surface-800/50 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t("pu_slip_amount", lang)}
                    value={slip.amount}
                    onChange={(e) => updateSlip(idx, { amount: e.target.value })}
                  />
                  <Input
                    type="date"
                    placeholder={t("pu_slip_date", lang)}
                    value={slip.paid_on}
                    onChange={(e) => updateSlip(idx, { paid_on: e.target.value })}
                  />
                  {slip.url ? (
                    <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-2 dark:border-surface-700 dark:bg-surface-900">
                      <a href={slip.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-brand-700 hover:underline">
                        {slip.fileName || t("pu_slip_photo", lang)}
                      </a>
                      <button
                        type="button"
                        onClick={() => updateSlip(idx, { url: "", fileName: "" })}
                        className="ml-auto shrink-0 text-surface-400 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-surface-300 px-2 py-2 text-xs text-surface-400 hover:bg-surface-100 dark:border-surface-700 dark:hover:bg-surface-800">
                      <FileUp className="h-4 w-4" />
                      <span>{slip.uploading ? t("pu_slip_uploading", lang) : t("pu_slip_photo", lang)}</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={slip.uploading}
                        onChange={(e) => uploadSlipFile(idx, e.target.files?.[0])}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => setSlips((prev) => prev.filter((_, i) => i !== idx))}
                    className="justify-self-end self-center text-surface-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {slip.error && <p className="col-span-full text-xs text-red-600 dark:text-red-400">{slip.error}</p>}
                </div>
              ))}
            </div>
            {slipIncomplete && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t("pu_slip_incomplete", lang)}</p>
            )}
            {/* Neeche wahin hisaab: kitna diya, kitna dena baqi (malik, 19 September). */}
            {slipsTotal > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-surface-200 bg-white p-2.5 text-sm dark:border-surface-700 dark:bg-surface-900">
                <div className="flex items-center justify-between">
                  <span className="text-surface-600 dark:text-surface-400">{t("pu_slips_paid_total", lang)}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Rs {slipsTotal.toLocaleString()}</span>
                </div>
                {total - slipsTotal > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-surface-600 dark:text-surface-400">{t("pu_slips_outstanding", lang)}</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">Rs {(total - slipsTotal).toLocaleString()}</span>
                  </div>
                ) : total - slipsTotal === 0 && total > 0 ? (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t("pu_slips_fully_paid", lang)}</p>
                ) : total > 0 ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t("pu_slips_overpaid", lang)}</p>
                ) : null}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>{t("pu_products", lang)}</Label>
            <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> {t("pu_add_product", lang)}
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="rounded-lg border border-surface-200 p-3 dark:border-surface-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-surface-500">{t("pu_line", lang)} {idx + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(idx)} className="text-surface-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {(() => {
                  const units = lineUnits(line);
                  const pet = units > 1;
                  const qty = parseFloat(line.quantity) || 0;
                  const cost = parseFloat(line.unit_cost) || 0;
                  const wholesale = parseFloat(line.wholesale_rate) || 0;
                  return (
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <ProductPicker
                      products={products}
                      value={line.product_id}
                      onChange={(id) => updateLine(idx, "product_id", id)}
                      placeholder={t("pu_select_product", lang)}
                    />
                  </div>
                  {line.product_id && (
                    <div className="col-span-2">
                      <Label className="mb-1 text-xs">{t("pu_units_in_pack", lang)}</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.units_in_pack}
                        onChange={(e) => updateLine(idx, "units_in_pack", e.target.value)}
                        placeholder="jaise 1X6 = 6"
                      />
                    </div>
                  )}
                  <Input
                    type="number"
                    placeholder={t(pet ? "pu_qty_pets" : "pu_quantity", lang)}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t(pet ? "pu_pet_cost" : "pu_unit_cost", lang)}
                    value={line.unit_cost}
                    onChange={(e) => updateLine(idx, "unit_cost", e.target.value)}
                  />
                  {/* Pet ka hisaab wahin ke wahin: kitni botal banti hain
                      aur 1 botal kis rate par paRti hai (438). */}
                  {pet && qty > 0 && cost > 0 && (
                    <p className="col-span-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
                      {t("pu_pet_math", lang)
                        .replace("{pets}", String(qty))
                        .replace("{units}", String(units))
                        .replace("{total}", String(qty * units))}
                      {" · "}
                      {t("pu_per_bottle", lang)}: Rs {rupee2(cost / units)}
                    </p>
                  )}
                  {line.product_id && line.quantity && line.unit_cost && (
                    <div className="col-span-2 grid grid-cols-3 gap-2 rounded-lg bg-surface-50 p-2 dark:bg-surface-800/50">
                      <div className="col-span-3 text-xs text-surface-500">
                        {t(pet ? "pu_pet_hint" : "pu_rate_hint", lang)}
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={t(pet ? "pu_wholesale_pet" : "pu_wholesale_rate", lang)}
                          value={line.wholesale_rate}
                          onChange={(e) => updateLine(idx, "wholesale_rate", e.target.value)}
                        />
                        {pet && wholesale > 0 && (
                          <p className="mt-0.5 text-[11px] text-surface-500">
                            {t("pu_per_bottle", lang)}: Rs {rupee2(wholesale / units)}
                          </p>
                        )}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={t(pet ? "pu_mrp_bottle" : "pu_mrp_rate", lang)}
                        value={line.mrp_rate}
                        onChange={(e) => updateLine(idx, "mrp_rate", e.target.value)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={t(pet ? "pu_sale_bottle" : "pu_sale_rate", lang)}
                        value={line.sale_rate}
                        onChange={(e) => updateLine(idx, "sale_rate", e.target.value)}
                      />
                    </div>
                  )}
                  {!simple && (
                    <>
                      <Input
                        placeholder={t("pu_batch_optional", lang)}
                        value={line.batch_number}
                        onChange={(e) => updateLine(idx, "batch_number", e.target.value)}
                      />
                      <Input
                        type="date"
                        placeholder={t("pu_expiry", lang)}
                        value={line.expiry_date}
                        onChange={(e) => updateLine(idx, "expiry_date", e.target.value)}
                      />
                    </>
                  )}
                </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-100 pt-3 dark:border-surface-800">
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{t("pu_total", lang)}</span>
          <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">
            Rs {total.toLocaleString()}
          </span>
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}

/**
 * Malik (19 September): "products search ka option nahi, wo lagayein
 * jis se search kar sakein jo bhi products ka purchase order banana
 * hai." Plain `<select>` mein saari products alphabetical fehrist mein
 * thi -- lambi list mein dhoondna mushkil. Ab naam type karte hi
 * filter hoti hai (PersonPicker jaisa hi tareeqa).
 */
function ProductPicker({
  products,
  value,
  onChange,
  placeholder,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = products.find((p) => p.id === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 25);
  }, [products, query]);

  if (chosen && !open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setQuery(""); }}
        className="flex w-full items-center justify-between rounded-lg border border-surface-200 bg-white px-3 py-2 text-left text-sm dark:border-surface-700 dark:bg-surface-900"
      >
        <span className="truncate font-medium text-surface-900 dark:text-surface-100">
          {chosen.name}{chosen.pack_size ? ` (${chosen.pack_size})` : ""}
        </span>
        <span className="shrink-0 text-xs text-brand-600 underline">badlein</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 dark:border-surface-700">
        <Search className="h-4 w-4 shrink-0 text-surface-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-surface-400"
        />
      </div>
      {open && query.trim().length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg dark:border-surface-700 dark:bg-surface-900">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-surface-500">Koi nahi mila.</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { onChange(p.id); setQuery(""); setOpen(false); }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-50 dark:hover:bg-surface-800"
                >
                  <span>{p.name}{p.pack_size ? ` (${p.pack_size})` : ""}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function SubmitButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t("pu_creating", lang) : t("pu_create", lang)}
    </Button>
  );
}