"use client";
import { useFormState, useFormStatus } from "react-dom";
import { adminUpdateFarmerDetails, type FarmerProfileState } from "@/actions/farmer-profile";
import { Button, Input, Label, Select } from "@/components/ui/form";

const initialState: FarmerProfileState = {};

export function AdminFarmerForm({ farmer }: { farmer: any }) {
  const [state, formAction] = useFormState(adminUpdateFarmerDetails, initialState);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <input type="hidden" name="farmer_id" value={farmer.id} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p>}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">Basic Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Full Name</Label>
            <Input name="full_name" defaultValue={farmer.full_name ?? ""} />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input name="phone_number" defaultValue={farmer.phone_number ?? ""} />
          </div>
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" defaultValue={farmer.email ?? ""} />
          </div>
          <div>
            <Label>CNIC</Label>
            <Input name="cnic" defaultValue={farmer.cnic ?? ""} />
          </div>
          <div>
            <Label>Village</Label>
            <Input name="village" defaultValue={farmer.village ?? ""} />
          </div>
          <div>
            <Label>District</Label>
            <Input name="district" defaultValue={farmer.district ?? ""} />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">Farming Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Total Land (acres)</Label>
            <Input name="land_size_acres" type="number" step="0.1" defaultValue={farmer.land_size_acres ?? ""} />
          </div>
          <div>
            <Label>Total Number of Farms</Label>
            <Input name="total_farms_count" type="number" defaultValue={farmer.total_farms_count ?? ""} />
          </div>
          <div className="col-span-2">
            <Label>Type of Crops</Label>
            <Input name="crop_types" defaultValue={(farmer.crop_types ?? []).join(", ")} placeholder="Wheat, Rice" />
          </div>
        </div>

        <div className="mt-4 border-t border-surface-100 pt-4 dark:border-surface-800">
          <Label>Has Livestock?</Label>
          <Select name="has_livestock" defaultValue={farmer.has_livestock ? "yes" : "no"}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label>Cows</Label>
            <Input name="cow_count" type="number" defaultValue={farmer.cow_count ?? 0} />
          </div>
          <div>
            <Label>Buffaloes</Label>
            <Input name="buffalo_count" type="number" defaultValue={farmer.buffalo_count ?? 0} />
          </div>
          <div>
            <Label>Calves</Label>
            <Input name="calves_count" type="number" defaultValue={farmer.calves_count ?? 0} />
          </div>
          <div>
            <Label>Milking Animals</Label>
            <Input name="milking_animal_count" type="number" defaultValue={farmer.milking_animal_count ?? 0} />
          </div>
          <div>
            <Label>Meat Animals</Label>
            <Input name="meat_animal_count" type="number" defaultValue={farmer.meat_animal_count ?? 0} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-surface-100 pt-4 dark:border-surface-800">
          <div>
            <Label>Milk (Litres/Day)</Label>
            <Input name="milk_liters_per_day" type="number" step="0.1" defaultValue={farmer.milk_liters_per_day ?? ""} />
          </div>
          <div>
            <Label>Milk Rate (Rs./Litre)</Label>
            <Input name="milk_sale_rate" type="number" step="0.01" defaultValue={farmer.milk_sale_rate ?? ""} />
          </div>
          <div className="col-span-2">
            <Label>Milk Buyer</Label>
            <Input name="milk_buyer_name" defaultValue={farmer.milk_buyer_name ?? ""} />
          </div>
          <div className="col-span-2">
            <Label>Milk Advance/Loan (Rs.)</Label>
            <Input name="milk_advance_loan_amount" type="number" step="0.01" defaultValue={farmer.milk_advance_loan_amount ?? ""} />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">Documents</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>CNIC Front</Label>
            {farmer.cnic_image_url ? (
              <img src={farmer.cnic_image_url} alt="CNIC Front" className="mt-1 h-24 w-40 rounded-lg border border-surface-200 object-cover" />
            ) : (
              <p className="text-sm text-surface-400">Not uploaded</p>
            )}
          </div>
          <div>
            <Label>CNIC Back</Label>
            {farmer.cnic_back_image_url ? (
              <img src={farmer.cnic_back_image_url} alt="CNIC Back" className="mt-1 h-24 w-40 rounded-lg border border-surface-200 object-cover" />
            ) : (
              <p className="text-sm text-surface-400">Not uploaded</p>
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