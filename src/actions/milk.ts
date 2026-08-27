"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateMilkValue, buildMilkReceiptSms } from "@/lib/utils/milk-formula";
import { sendMilkSms } from "@/lib/sms";

export interface ActionState {
  error?: string;
  success?: boolean;
  smsText?: string;
  smsSent?: boolean;
}

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

  const { data: farmer } = await supabase.from("farmers").select("full_name, phone_number, milk_collection_type").eq("id", farmerId).single();
  if (!farmer) return { error: "Farmer nahi mila." };

  const { data: settings } = await supabase.from("milk_rate_settings").select("standard_rate, self_dropoff_incentive, snf_constant, reference_ts").limit(1).single();
  const standardRate = Number(settings?.standard_rate ?? 145);
  const incentive = Number(settings?.self_dropoff_incentive ?? 10);
  const snfConstant = Number(settings?.snf_constant ?? 0.805);
  const referenceTs = Number(settings?.reference_ts ?? 13);

  const effectiveRate = farmer.milk_collection_type === "self_dropoff" ? standardRate + incentive : standardRate;

  const result = calculateMilkValue(quantity, fat, lr, effectiveRate, snfConstant, referenceTs);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("milk_entries").insert({
    farmer_id: farmerId,
    branch_id: branchId,
    entry_date: entryDate,
    shift,
    quantity_liters: quantity,
    fat_percentage: fat,
    snf_percentage: result.snf,
    lr,
    rate_per_liter: effectiveRate,
    adjusted_volume: result.adjustedVolume,
    total_amount: result.amount,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await supabase.from("farmer_credit_ledger").insert({
    farmer_id: farmerId,
    source_type: "milk_collection",
    ledger_type: "credit",
    amount: result.amount,
    notes: `Milk: ${quantity}L, Fat ${fat}%, ${entryDate} (${shift})`,
    created_by: user?.id ?? null,
  });

  const { data: milkWallet } = await supabase.from("wallets").select("id").eq("owner_type", "farmer").eq("owner_id", farmerId).single();
  if (milkWallet) {
    await supabase.from("wallet_transactions").insert({
      wallet_id: milkWallet.id,
      type: "milk_income",
      direction: "credit",
      amount: result.amount,
      balance_after: 0,
      reference_type: "milk_entry",
      notes: `Milk: ${quantity}L, Fat ${fat}%, ${entryDate} (${shift})`,
      created_by: user?.id ?? null,
    });
  }

  const smsText = buildMilkReceiptSms(farmer.full_name, new Date(), quantity, fat, lr, result);
  const phone = farmer.phone_number;
  const smsResult = phone ? await sendMilkSms(phone, smsText) : { sent: false };

  revalidatePath("/admin/milk-collection");
  revalidatePath("/admin/farmer-credit");
  return { success: true, smsText, smsSent: smsResult.sent };
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

  await supabase.from("farmer_credit_ledger").insert({
    farmer_id: farmerId,
    source_type: "milk_collection",
    ledger_type: "debit",
    amount,
    notes: `Cash payment (${paymentMethod ?? "cash"})${notes ? ` - ${notes}` : ""}`,
    created_by: user?.id ?? null,
  });

  const { data: paymentWallet } = await supabase.from("wallets").select("id").eq("owner_type", "farmer").eq("owner_id", farmerId).single();
  if (paymentWallet) {
    await supabase.from("wallet_transactions").insert({
      wallet_id: paymentWallet.id,
      type: "milk_cash_payment",
      direction: "debit",
      amount,
      balance_after: 0,
      reference_type: "milk_payment",
      notes: `Cash payment (${paymentMethod ?? "cash"})${notes ? ` - ${notes}` : ""}`,
      created_by: user?.id ?? null,
    });
  }

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