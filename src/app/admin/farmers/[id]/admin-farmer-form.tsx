"use client";
import { useFormState, useFormStatus } from "react-dom";
import { adminUpdateFarmerDetails, type FarmerProfileState } from "@/actions/farmer-profile";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: FarmerProfileState = {};

export function AdminFarmerForm({ farmer }: { farmer: any }) {
  const [state, formAction] = useFormState(adminUpdateFarmerDetails, initialState);
  const lang = useLang();

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <input type="hidden" name="farmer_id" value={farmer.id} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t("c_saved", lang)}</p>}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">{t("af_basic_info", lang)}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("af_full_name", lang)}</Label>
            <Input name="full_name" defaultValue={farmer.full_name ?? ""} />
          </div>
          <div>
            <Label>{t("c_phone_number", lang)}</Label>
            <Input name="phone_number" defaultValue={farmer.phone_number ?? ""} />
          </div>
          <div>
            <Label>{t("c_email", lang)}</Label>
            <Input name="email" type="email" defaultValue={farmer.email ?? ""} />
          </div>
          <div>
            <Label>{t("c_cnic", lang)}</Label>
            <Input name="cnic" defaultValue={farmer.cnic ?? ""} />
          </div>
          <div>
            <Label>{t("c_village", lang)}</Label>
            <Input name="village" defaultValue={farmer.village ?? ""} />
          </div>
          <div>
            <Label>{t("c_district", lang)}</Label>
            <Input name="district" defaultValue={farmer.district ?? ""} />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">{t("af_farming_details", lang)}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("af_total_land", lang)}</Label>
            <Input name="land_size_acres" type="number" step="0.1" defaultValue={farmer.land_size_acres ?? ""} />
          </div>
          <div>
            <Label>{t("af_total_farms", lang)}</Label>
            <Input name="total_farms_count" type="number" defaultValue={farmer.total_farms_count ?? ""} />
          </div>
          <div className="col-span-2">
            <Label>{t("af_crop_types", lang)}</Label>
            <Input name="crop_types" defaultValue={(farmer.crop_types ?? []).join(", ")} placeholder={t("af_crop_example", lang)} />
          </div>
        </div>

        <div className="mt-4 border-t border-surface-100 pt-4 dark:border-surface-800">
          <Label>{t("af_has_livestock", lang)}</Label>
          <Select name="has_livestock" defaultValue={farmer.has_livestock ? "yes" : "no"}>
            <option value="yes">{t("af_yes", lang)}</option>
            <option value="no">{t("af_no", lang)}</option>
          </Select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label>{t("af_cows", lang)}</Label>
            <Input name="cow_count" type="number" defaultValue={farmer.cow_count ?? 0} />
          </div>
          <div>
            <Label>{t("af_buffaloes", lang)}</Label>
            <Input name="buffalo_count" type="number" defaultValue={farmer.buffalo_count ?? 0} />
          </div>
          <div>
            <Label>{t("af_calves", lang)}</Label>
            <Input name="calves_count" type="number" defaultValue={farmer.calves_count ?? 0} />
          </div>
          <div>
            <Label>{t("af_milking_animals", lang)}</Label>
            <Input name="milking_animal_count" type="number" defaultValue={farmer.milking_animal_count ?? 0} />
          </div>
          <div>
            <Label>{t("af_meat_animals", lang)}</Label>
            <Input name="meat_animal_count" type="number" defaultValue={farmer.meat_animal_count ?? 0} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-surface-100 pt-4 dark:border-surface-800">
          <div>
            <Label>{t("af_milk_per_day", lang)}</Label>
            <Input name="milk_liters_per_day" type="number" step="0.1" defaultValue={farmer.milk_liters_per_day ?? ""} />
          </div>
          <div>
            <Label>{t("af_milk_rate", lang)}</Label>
            <Input name="milk_sale_rate" type="number" step="0.01" defaultValue={farmer.milk_sale_rate ?? ""} />
          </div>
          <div className="col-span-2">
            <Label>{t("af_milk_buyer", lang)}</Label>
            <Input name="milk_buyer_name" defaultValue={farmer.milk_buyer_name ?? ""} />
          </div>
          <div className="col-span-2">
            <Label>{t("af_milk_advance", lang)}</Label>
            <Input name="milk_advance_loan_amount" type="number" step="0.01" defaultValue={farmer.milk_advance_loan_amount ?? ""} />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">{t("c_documents", lang)}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("af_cnic_front", lang)}</Label>
            {farmer.cnic_image_url ? (
              <img src={farmer.cnic_image_url} alt="CNIC Front" className="mt-1 h-24 w-40 rounded-lg border border-surface-200 object-cover" />
            ) : (
              <p className="text-sm text-surface-400">{t("af_not_uploaded", lang)}</p>
            )}
          </div>
          <div>
            <Label>{t("af_cnic_back", lang)}</Label>
            {farmer.cnic_back_image_url ? (
              <img src={farmer.cnic_back_image_url} alt="CNIC Back" className="mt-1 h-24 w-40 rounded-lg border border-surface-200 object-cover" />
            ) : (
              <p className="text-sm text-surface-400">{t("af_not_uploaded", lang)}</p>
            )}
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Save Changes"}</Button>;
}