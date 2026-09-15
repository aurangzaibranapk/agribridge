"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateLivestockDetails, type FarmerProfileState } from "@/actions/farmer-profile";
import { Button, Input, Label } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: FarmerProfileState = {};

interface Farmer {
  has_livestock: boolean;
  cow_count: number | null;
  buffalo_count: number | null;
  calves_count: number | null;
  milking_animal_count: number | null;
  meat_animal_count: number | null;
  milk_liters_per_day: number | null;
  milk_buyer_name: string | null;
  milk_sale_rate: number | null;
  milk_advance_loan_amount: number | null;
}

export function LivestockDetailsForm({ farmer }: { farmer: Farmer }) {
  const lang = useLang();
  const [state, formAction] = useFormState(updateLivestockDetails, initialState);
  const [hasLivestock, setHasLivestock] = useState(farmer.has_livestock);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card mb-6">
      <h2 className="font-display text-sm font-semibold text-surface-900">{t("pm_livestock_details", lang)}</h2>
      {state.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("c_saved", lang)}</p>}
      <form action={formAction} className="mt-3 space-y-3">
        <div>
          <Label>{t("pm_have_livestock", lang)}</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm text-surface-600">
              <input type="radio" name="has_livestock" value="yes" checked={hasLivestock} onChange={() => setHasLivestock(true)} className="h-4 w-4" />{t("yes_label", lang)}</label>
            <label className="flex items-center gap-1.5 text-sm text-surface-600">
              <input type="radio" name="has_livestock" value="no" checked={!hasLivestock} onChange={() => setHasLivestock(false)} className="h-4 w-4" />{t("no_label", lang)}</label>
          </div>
        </div>

        {hasLivestock && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="cow_count">{t("pm_cows", lang)}</Label>
                <Input id="cow_count" name="cow_count" type="number" min="0" defaultValue={farmer.cow_count ?? 0} />
              </div>
              <div>
                <Label htmlFor="buffalo_count">{t("pm_buffaloes", lang)}</Label>
                <Input id="buffalo_count" name="buffalo_count" type="number" min="0" defaultValue={farmer.buffalo_count ?? 0} />
              </div>
              <div>
                <Label htmlFor="calves_count">{t("pm_calves", lang)}</Label>
                <Input id="calves_count" name="calves_count" type="number" min="0" defaultValue={farmer.calves_count ?? 0} />
              </div>
              <div>
                <Label htmlFor="milking_animal_count">{t("pm_milking_animals", lang)}</Label>
                <Input id="milking_animal_count" name="milking_animal_count" type="number" min="0" defaultValue={farmer.milking_animal_count ?? 0} />
              </div>
              <div>
                <Label htmlFor="meat_animal_count">{t("pm_meat_animals", lang)}</Label>
                <Input id="meat_animal_count" name="meat_animal_count" type="number" min="0" defaultValue={farmer.meat_animal_count ?? 0} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-surface-100 pt-3">
              <div>
                <Label htmlFor="milk_liters_per_day">{t("pm_milk_per_day", lang)}</Label>
                <Input id="milk_liters_per_day" name="milk_liters_per_day" type="number" step="0.1" min="0" defaultValue={farmer.milk_liters_per_day ?? ""} />
              </div>
              <div>
                <Label htmlFor="milk_sale_rate">{t("pm_milk_rate", lang)}</Label>
                <Input id="milk_sale_rate" name="milk_sale_rate" type="number" step="0.01" min="0" defaultValue={farmer.milk_sale_rate ?? ""} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="milk_buyer_name">{t("pm_milk_buyer", lang)}</Label>
                <Input id="milk_buyer_name" name="milk_buyer_name" defaultValue={farmer.milk_buyer_name ?? ""} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="milk_advance_loan_amount">{t("pm_milk_advance", lang)}</Label>
                <Input id="milk_advance_loan_amount" name="milk_advance_loan_amount" type="number" step="0.01" min="0" defaultValue={farmer.milk_advance_loan_amount ?? ""} />
              </div>
            </div>
          </>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Save Livestock Details"}</Button>;
}