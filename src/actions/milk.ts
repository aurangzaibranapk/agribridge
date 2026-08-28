"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recordCollection, applyFat } from "@/lib/milk-collection";
import { postFarmerLedger, postFarmerWallet } from "@/lib/farmer-ledger";

export interface ActionState {
  error?: string;
  success?: boolean;
  smsText?: string;
  smsSent?: boolean;
}

/**
 * Website ka purana form.
 *
 * Ab ye khud hisaab nahi karta -- wahi engine bulata hai jo WhatsApp,
 * offline aur aage chal kar app istemal karengi. Pehle yahan ledger aur
 * wallet ka apna code tha jo balance_after bhejna bhool gaya tha; wo
 * entry hamesha nakaam hoti thi, aur pakri is liye nahi gayi ke ab tak
 * ek bhi milk entry bani hi nahi thi.
 *
 * Is form mein FAT abhi bhi maanga jata hai, is liye entry banate hi
 * rate lag jata hai. Naya collection screen (jahan FAT chiller par
 * lagega) alag banega.
 */
export async function createMilkEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const branchId = (formData.get("branch_id") as string) || null;
  const entryDate = String(formData.get("entry_date") ?? new Date().toISOString().slice(0, 10));
  const shift = String(formData.get("shift") ?? "morning");
  const quantity = Number(formData.get("quantity_liters") ?? 0);
  const fat = Number(formData.get("fat_percentage") ?? 0);
  const lr = Number(formData.get("lr") ?? 0);
  const lateReason = (formData.get("late_reason") as string) || null;
  const notesRaw = (formData.get("notes") as string) || "";
  const notes = lateReason ? `[Late Entry: ${lateReason}] ${notesRaw}`.trim() : notesRaw || null;

  if (!farmerId) return { error: "Farmer is required." };
  if (!quantity || quantity <= 0) return { error: "Quantity must be greater than zero." };
  if (!fat || fat <= 0) return { error: "Fat % zaroori hai." };
  if (!lr || lr <= 0) return { error: "LR zaroori hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const saved = await recordCollection({
    farmerId,
    liters: quantity,
    lr,
    shift,
    entryDate,
    source: "website",
    mcaProfileId: user.id,
    branchId,
    notes,
  });
  if ("error" in saved) return { error: saved.error };

  const priced = await applyFat(saved.id, fat, user.id);
  if ("error" in priced) return { error: priced.error };

  revalidatePath("/admin/milk-collection");
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}

export async function recordMilkPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  if (!farmerId) return { error: "Farmer is required." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("milk_payments").insert({
    farmer_id: farmerId,
    amount,
    payment_method: paymentMethod,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  const label = `Cash payment (${paymentMethod ?? "cash"})${notes ? ` - ${notes}` : ""}`;

  // Doodh ki adaigi kisan ka bojh BARHATI hai (debit) -- jo raqam us ka
  // haq thi wo ab us ke haath mein hai.
  await postFarmerLedger({
    farmerId,
    sourceType: "milk",
    ledgerType: "debit",
    amount,
    notes: label,
    createdBy: user?.id ?? null,
  });

  await postFarmerWallet({
    farmerId,
    type: "milk_payment",
    direction: "debit",
    amount,
    notes: label,
    referenceType: "milk_payment",
    createdBy: user?.id ?? null,
  });

  revalidatePath("/admin/milk-collection");
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}

export async function setMilkCollectionType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const newType = String(formData.get("milk_collection_type") ?? "");
  if (!farmerId || !["self_dropoff", "field_collection"].includes(newType)) return { error: "Invalid data." };

  const { data: farmer } = await supabase.from("farmers").select("milk_collection_type").eq("id", farmerId).single();
  const oldType = farmer?.milk_collection_type ?? null;

  const { error } = await supabase.from("farmers").update({ milk_collection_type: newType }).eq("id", farmerId);
  if (error) return { error: error.message };

  if (oldType !== newType) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("milk_type_migrations").insert({
      farmer_id: farmerId,
      old_type: oldType,
      new_type: newType,
      changed_by: user?.id ?? null,
    });
  }

  revalidatePath("/admin/milk-collection");
  return { success: true };
}

export async function saveMilkRateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const standardRate = Number(formData.get("standard_rate") ?? 0);
  const incentive = Number(formData.get("self_dropoff_incentive") ?? 0);
  const snfConstant = Number(formData.get("snf_constant") ?? 0.805);
  const referenceTs = Number(formData.get("reference_ts") ?? 13);
  if (!standardRate || standardRate <= 0) return { error: "Standard rate zaroori hai." };

  const { data: existing } = await supabase.from("milk_rate_settings").select("id").limit(1).single();
  if (existing) {
    const { error } = await supabase
      .from("milk_rate_settings")
      .update({
        standard_rate: standardRate,
        self_dropoff_incentive: incentive,
        snf_constant: snfConstant,
        reference_ts: referenceTs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("milk_rate_settings").insert({
      standard_rate: standardRate,
      self_dropoff_incentive: incentive,
      snf_constant: snfConstant,
      reference_ts: referenceTs,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/milk-collection");
  return { success: true };
}