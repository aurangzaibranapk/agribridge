"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createProduct, updateProduct, extractProductFromImageAction, type FormState } from "@/actions/products";
import { type ExtractedProductInfo } from "@/lib/ai/product-extraction-client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { PRODUCT_UNITS } from "@/lib/data/units";
import { ProductImageUpload } from "@/app/admin/products/new/product-image-upload";
import { VoiceDictationButton } from "@/components/admin/voice-dictation-button";
import { Sparkles, Barcode, Clock } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: FormState = {};

interface ExistingProduct {
  id: string;
  name: string;
  company_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  unit: string | null;
  pack_size: string | null;
  barcode: string | null;
  manufacture_date: string | null;
  expiry_date: string | null;
  show_expiry_to_customer: boolean;
  active_ingredient: string | null;
  composition: string | null;
  dose: string | null;
  usage_instructions: string | null;
  safety_information: string | null;
  purchase_price: number;
  selling_price: number;
  mrp_price: number | null;
  wholesale_price: number | null;
  min_stock_threshold: number | null;
  image_url: string | null;
}

export function ProductForm({
  companies, brands, categories, product, uiMode = "advanced",
}: {
  companies: { id: string; name: string }[]; brands: { id: string; name: string }[]; categories: { id: string; name: string; category_kind: string; default_min_stock: number | null }[];
  product?: ExistingProduct;
  /** Simple = zarai/technical khane chhupe (E). Rok wahi rehti hai. */
  uiMode?: "simple" | "advanced";
}) {
  const simple = uiMode === "simple";
  const isEditMode = !!product;
  const [state, formAction] = useFormState(isEditMode ? updateProduct : createProduct, initialState);
  const lang = useLang();
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");

  const [aiData, setAiData] = useState<ExtractedProductInfo | null>(null);
  const [aiNotConfigured, setAiNotConfigured] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const activeIngredientRef = useRef<HTMLInputElement>(null);
  // Qism chunte hi form badal jata hai: karyana par saada, zarai par
  // poore khane. Faisla qism par likha hai (247) -- yahan sirf us ka
  // natija dikhta hai.
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? "");
  const [showAgri, setShowAgri] = useState<boolean | null>(null);

  const chosenCategory = categories.find((c) => c.id === categoryId);
  // showAgri === null ka matlab: bande ne khud kuch nahi chuna, qism se
  // tay hoga. Qism bhi na ho to khane CHHUPE rehte hain -- karyana wala
  // banda paanch khali khane dekh kar rukta hai, aur wo khane us ke maal
  // se koi taalluq nahi rakhte.
  const agriVisible = showAgri ?? chosenCategory?.category_kind === "agri";

  const compositionRef = useRef<HTMLTextAreaElement>(null);
  const packSizeRef = useRef<HTMLInputElement>(null);
  const doseRef = useRef<HTMLInputElement>(null);
  const usageRef = useRef<HTMLInputElement>(null);
  const safetyInformationRef = useRef<HTMLTextAreaElement>(null);
  const manufactureDateRef = useRef<HTMLInputElement>(null);
  const expiryDateRef = useRef<HTMLInputElement>(null);

  if (aiData) {
    if (aiData.name && nameRef.current && !nameRef.current.value) nameRef.current.value = aiData.name;
    if (aiData.activeIngredient && activeIngredientRef.current && !activeIngredientRef.current.value) activeIngredientRef.current.value = aiData.activeIngredient;
    if (aiData.composition && compositionRef.current && !compositionRef.current.value) compositionRef.current.value = aiData.composition;
    if (aiData.packSize && packSizeRef.current && !packSizeRef.current.value) packSizeRef.current.value = aiData.packSize;
    if (aiData.manufactureDate && manufactureDateRef.current && !manufactureDateRef.current.value) manufactureDateRef.current.value = aiData.manufactureDate;
    if (aiData.expiryDate && expiryDateRef.current && !expiryDateRef.current.value) expiryDateRef.current.value = aiData.expiryDate;
    if (aiData.dose && doseRef.current && !doseRef.current.value) doseRef.current.value = aiData.dose;
    if (aiData.usageInstructions && usageRef.current && !usageRef.current.value) usageRef.current.value = aiData.usageInstructions;
    if (aiData.safetyInformation && safetyInformationRef.current && !safetyInformationRef.current.value) safetyInformationRef.current.value = aiData.safetyInformation;
  }

  function generateBarcode() {
    const generated = Date.now().toString().slice(-12);
    setBarcode(generated);
  }

  async function handleAutoFill() {
    if (!imageUrl) return;
    setAiPending(true);
    setAiError(null);
    try {
      const formData = new FormData();
      formData.set("image_url", imageUrl);
      const result = await extractProductFromImageAction({}, formData);
      if (result.notConfigured) setAiNotConfigured(true);
      else if (result.data) setAiData(result.data);
      else if (result.error) setAiError(result.error);
    } catch (err: any) {
      setAiError(err.message ?? "Photo se detail nikalne mein masla ho gaya.");
    } finally {
      setAiPending(false);
    }
  }

  if (state.pending) {
    return (
      <div className="rounded-card border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
        <Clock className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <h2 className="font-display text-base font-semibold text-amber-800 dark:text-amber-300">{t("pf_sent_for_approval", lang)}</h2>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {isEditMode
            ? "Aapke changes save ho gaye hain, lekin abhi live nahi honge jab tak admin verify na kare."
            : "Ye product ab admin ke pass verify hone ke liye pending hai. Verify hone ke baad hi live/catalog mein dikhega."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {isEditMode && <input type="hidden" name="id" value={product.id} />}
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}

      <div className="rounded-card border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-800/50">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-surface-400 dark:text-surface-500">3 Ways to Add This Product</p>
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <ProductImageUpload onUploaded={setImageUrl} defaultUrl={imageUrl} />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-sm font-medium text-surface-700 dark:text-surface-300">1. Manual - just type into the fields below</p>
            <p className="mb-1 text-sm font-medium text-surface-700 dark:text-surface-300">2. Voice - tap the mic next to any field and speak</p>
            <p className="mb-2 text-sm font-medium text-surface-700 dark:text-surface-300">3. AI from Photo - upload a photo above, then:</p>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={!imageUrl || aiPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:bg-surface-900 dark:text-brand-400"
            >
              <Sparkles className="h-3.5 w-3.5" /> {aiPending ? "Reading photo..." : "Auto-fill from Photo"}
            </button>
            {aiPending && (
              <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-brand-100 dark:bg-brand-900/40">
                <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-brand-500" />
              </div>
            )}
            {aiNotConfigured && (
              <p className="mt-2 max-w-md text-xs text-amber-600 dark:text-amber-400">{t("pf_ai_not_connected", lang)}</p>
            )}
            {aiError && <p className="mt-2 max-w-md text-xs text-red-600 dark:text-red-400">{aiError}</p>}
            {aiData && <p className="mt-2 text-xs text-brand-600 dark:text-brand-400">{t("pf_photo_prefilled", lang)}</p>}
          </div>
        </div>
      </div>

      <FieldWithMic label={t("pf_product_name", lang)} inputRef={nameRef} name="name" required defaultValue={product?.name} />

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="company_id">{t("c_company", lang)}</Label>
          <Select id="company_id" name="company_id" defaultValue={product?.company_id ?? ""}><option value="">- select -</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </div>
        <div>
          <Label htmlFor="brand_id">{t("c_brand", lang)}</Label>
          <Select id="brand_id" name="brand_id" defaultValue={product?.brand_id ?? ""}><option value="">- select -</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </div>
        <div>
          <Label htmlFor="category_id">{t("c_category", lang)}</Label>
          <Select
            id="category_id"
            name="category_id"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              // Qism badalne par bande ka apna faisla bhi hat jata hai --
              // warna wo purani qism ka faisla nayi qism par chipka
              // rehta.
              setShowAgri(null);
            }}
          >
            <option value="">- select -</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="unit">{t("pf_unit", lang)}</Label>
          <Select id="unit" name="unit" defaultValue={product?.unit ?? ""}>
            <option value="">- select -</option>
            {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </div>
        <FieldWithMic label={t("c_pack_size", lang)} inputRef={packSizeRef} name="pack_size" placeholder={t("pf_pack_size_eg", lang)} defaultValue={product?.pack_size ?? undefined} />
        <div>
          <Label htmlFor="barcode">{t("pf_barcode", lang)}</Label>
          <div className="flex gap-2">
            <Input id="barcode" name="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="flex-1" />
            <button
              type="button"
              onClick={generateBarcode}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:bg-surface-900 dark:text-brand-400"
            >
              <Barcode className="h-3.5 w-3.5" />{t("pf_generate", lang)}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="manufacture_date">{t("pf_manufacture_date", lang)}</Label>
          <Input ref={manufactureDateRef} id="manufacture_date" name="manufacture_date" type="date" defaultValue={product?.manufacture_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor="expiry_date">{t("c_expiry_date", lang)}</Label>
          <Input ref={expiryDateRef} id="expiry_date" name="expiry_date" type="date" defaultValue={product?.expiry_date ?? undefined} />
          <p className="mt-1 text-[11px] text-surface-400">{t("pf_expiry_from_batch", lang)}</p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
        <input type="checkbox" name="show_expiry_to_customer" defaultChecked={product?.show_expiry_to_customer} />{t("pf_show_expiry", lang)}</label>

      {/* Zarai ke khane. Khaad, zeher aur wande par ye LAZMI hain --
          bina safety aur dose ke wo maal bechna theek nahi. Karyana ke
          dabbe par in mein se ek bhi nahi hota, is liye wahan ye chhupe
          rehte hain.

          Chhupane ka matlab MITANA nahi: jo qeemat pehle se bhari hui
          hai wo form ke sath jati rahegi, kyunke ye khane hate nahi,
          sirf nazar se ojhal hain. */}
      {!agriVisible && (
        <button
          type="button"
          onClick={() => setShowAgri(true)}
          className="text-xs text-brand-700 underline"
        >
          Zarai ke khane dikhayein (dose, composition, safety)
        </button>
      )}

      <div className={agriVisible ? "space-y-4" : "hidden"}>
        {chosenCategory?.category_kind === "karyana" && (
          <button
            type="button"
            onClick={() => setShowAgri(false)}
            className="text-xs text-surface-500 underline"
          >
            ye khane chhupa dein — is qism par zaroorat nahi
          </button>
        )}

      {!simple && (
        <>
      <FieldWithMic label={t("pf_active_ingredient", lang)} inputRef={activeIngredientRef} name="active_ingredient" defaultValue={product?.active_ingredient ?? undefined} />

      <div>
        <Label htmlFor="composition">{t("pf_composition", lang)}</Label>
        <div className="flex gap-2">
          <Textarea ref={compositionRef} id="composition" name="composition" rows={2} defaultValue={product?.composition ?? undefined} className="flex-1" />
          <VoiceDictationButton onResult={(text) => { if (compositionRef.current) compositionRef.current.value = text; }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldWithMic label={t("pf_dose", lang)} inputRef={doseRef} name="dose" defaultValue={product?.dose ?? undefined} />
        <FieldWithMic label={t("pf_usage_instructions", lang)} inputRef={usageRef} name="usage_instructions" defaultValue={product?.usage_instructions ?? undefined} />
      </div>

      <div>
        <Label htmlFor="safety_information">{t("pf_safety_info", lang)}</Label>
        <div className="flex gap-2">
          <Textarea ref={safetyInformationRef} id="safety_information" name="safety_information" rows={2} defaultValue={product?.safety_information ?? undefined} className="flex-1" />
          <VoiceDictationButton onResult={(text) => { if (safetyInformationRef.current) safetyInformationRef.current.value = text; }} />
        </div>
      </div>
        </>
      )}

      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="purchase_price">{t("pf_purchase_price", lang)}</Label>
          <Input id="purchase_price" name="purchase_price" type="number" step="0.01" required defaultValue={product?.purchase_price} />
        </div>
        <div>
          <Label htmlFor="selling_price">{t("pf_selling_cash", lang)}</Label>
          <Input id="selling_price" name="selling_price" type="number" step="0.01" required defaultValue={product?.selling_price} />
        </div>
        <div>
          <Label htmlFor="mrp_price">{t("pf_mrp_rate", lang)}</Label>
          <Input id="mrp_price" name="mrp_price" type="number" step="0.01" defaultValue={product?.mrp_price ?? undefined} />
        </div>
        <div>
          <Label htmlFor="wholesale_price">{t("pf_f_wholesale", lang)}</Label>
          <Input
            id="wholesale_price"
            name="wholesale_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.wholesale_price ?? undefined}
            placeholder={t("pf_f_wholesale_ph", lang)}
          />
          {/* Khali chhoRna theek hai -- sifar ka matlab "thok par muft"
              hota, aur wo adad ek din bill par chala jata. */}
          <p className="mt-0.5 text-[11px] text-surface-500">{t("pf_f_wholesale_hint", lang)}</p>
        </div>
      </div>
      <div>
        <Label htmlFor="min_stock_threshold">{t("pf_low_stock_below", lang)}</Label>
        <Input
            id="min_stock_threshold"
            name="min_stock_threshold"
            type="number"
            step="0.001"
            min="0"
            key={`ms-${categoryId}`}
            defaultValue={
              product?.min_stock_threshold ?? chosenCategory?.default_min_stock ?? undefined
            }
          />
      </div>

      <SubmitButton isEditMode={isEditMode} />
    </form>
  );
}

function FieldWithMic({
  label, inputRef, name, required, placeholder, defaultValue,
}: { label: string; inputRef: React.RefObject<HTMLInputElement>; name: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="flex gap-2">
        <Input ref={inputRef} id={name} name={name} required={required} placeholder={placeholder} defaultValue={defaultValue} className="flex-1" />
        <VoiceDictationButton onResult={(text) => { if (inputRef.current) inputRef.current.value = text; }} />
      </div>
    </div>
  );
}

function SubmitButton({ isEditMode }: { isEditMode: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : isEditMode ? "Save Changes" : "Add Product"}</Button>;
}