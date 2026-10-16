"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function saveControlEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const collectorId = String(formData.get("collector_id") ?? "") || null;
  const chillarId = String(formData.get("chillar_id") ?? "") || null;
  const quantity = Number(formData.get("quantity") ?? 0);
  const fat = Number(formData.get("fat") ?? 0) || null;
  const rate = Number(formData.get("rate") ?? 0);
  const entryDate = String(formData.get("entry_date") ?? aajKaKhana());

  if (!farmerId) return { error: "Farmer zaroori hai." };
  if (!quantity || quantity <= 0) return { error: "Quantity zaroori hai." };
  if (!rate || rate <= 0) return { error: "Rate zaroori hai." };

  const amount = Math.round(quantity * rate * 100) / 100;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const service = createServiceClient();
  const { error } = await service.from("milk_entries").insert({
    farmer_id: farmerId,
    entry_date: entryDate,
    quantity_liters: quantity,
    fat_percentage: fat,
    rate_per_liter: rate,
    total_amount: amount,
    collector_id: collectorId,
    chillar_id: chillarId,
    status: fat ? "verified" : "pending_fat",
    source: "website",
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection");
  revalidatePath("/admin/milk-collection/control-entry");
  revalidatePath("/admin/milk-collection/chillar-control");
  return { success: true, message: `Entry save ho gaya. Amount: Rs ${amount}` };
}
