"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { requireMoneyAdmin } from "@/lib/access/money-gate";
import { requireAction } from "@/lib/access/guard";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordCollection, applyFat } from "@/lib/milk-collection";
import { previewQist } from "@/actions/qist";
import { applyQistAtPayout } from "@/lib/qist/apply";
import { fatRangeError, lrRangeError, payableCovers, rpcError } from "@/lib/dairy/rules";

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
  const gate = await requireAction("milk-collection.collect", "create");
  if ("error" in gate) return { error: gate.error };
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const branchId = (formData.get("branch_id") as string) || null;
  const entryDate = String(formData.get("entry_date") ?? aajKaKhana());
  const shift = String(formData.get("shift") ?? "morning");
  const quantity = Number(formData.get("quantity_liters") ?? 0);
  const fat = Number(formData.get("fat_percentage") ?? 0);
  const lr = Number(formData.get("lr") ?? 0);
  const lateReason = (formData.get("late_reason") as string) || null;
  const notesRaw = (formData.get("notes") as string) || "";
  const notes = lateReason ? `[Late Entry: ${lateReason}] ${notesRaw}`.trim() : notesRaw || null;

  if (!farmerId) return { error: "Farmer is required." };
  if (!quantity || quantity <= 0) return { error: "Quantity must be greater than zero." };
  const allowOverride = formData.get("quality_override") === "yes" && ["owner", "super_admin", "admin", "manager"].includes(gate.caller.role);
  const fatError = fatRangeError(fat, allowOverride);
  if (fatError) return { error: fatError };
  const lrError = lrRangeError(lr, allowOverride);
  if (lrError) return { error: lrError };

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
    channel: "website",
    mcaProfileId: user.id,
    branchId,
    notes,
    qualityOverride: allowOverride,
  });
  if ("error" in saved) return { error: saved.error };

  const priced = await applyFat(saved.id, fat, user.id, { allowOverride });
  if ("error" in priced) return { error: priced.error };

  revalidatePath("/admin/milk-collection");
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}

export async function recordMilkPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Doodh ki adaigi post karna");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  if (!farmerId) return { error: "Farmer is required." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };
  const clientKey = String(formData.get("client_action_id") ?? "").trim();
  if (!clientKey) return { error: "Adaigi ka nishan nahi. Safha dobara kholen." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const service = createServiceClient();
  const balanceCall = await (service as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("fn_milk_payable_balance", { p_farmer: farmerId });
  if (balanceCall.error) return { error: rpcError(balanceCall.error.message) };
  const balance = Number(balanceCall.data ?? 0);
  const over = payableCovers(balance, amount);
  if (over) return { error: over };

  // 557: Qist Plan (doodh se) ki wajib qist pehle kategi; kami akhir wali jama qist mein.
  // Rokne ke liye wajah lazmi. source id form ka nishan hai taake do dafa
  // submit qist do dafa na kaate.
  const skipQist = formData.get("apply_qist") === "no";
  const skipReason = String(formData.get("qist_skip_reason") ?? "").trim();
  if (skipQist && skipReason.length < 3) return { error: "Qist is dafa na kaatne ki wajah likhein." };
  let qistCut = 0;
  if (!skipQist) {
    const q = await applyQistAtPayout({
      partyType: "farmer", partyId: farmerId, source: "milk", payout: amount,
      sourceTable: "milk_payment_qist", sourceId: clientKey, createdBy: user?.id ?? null,
    });
    if (q.error) return { error: q.error };
    qistCut = q.deducted;
  }
  const cashAmount = Math.round((amount - qistCut) * 100) / 100;
  const qistNote = qistCut > 0 ? ` | Qist kati Rs ${qistCut.toLocaleString("en-PK")}` : skipQist ? ` | Qist roki: ${skipReason}` : "";
  const posted = await (service as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: { already?: boolean } | null; error: { message: string } | null }>;
  }).rpc("fn_record_milk_payment", {
    p_farmer: farmerId,
    p_cash: cashAmount,
    p_qist: qistCut,
    p_method: paymentMethod,
    p_notes: `${notes ?? ""}${qistNote}`.trim() || null,
    p_by: user?.id ?? null,
    p_client: clientKey,
  });
  if (posted.error) {
    if (qistCut > 0) {
      await (supabase as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }).rpc("fn_qist_reverse_source", {
        p_source_table: "milk_payment_qist",
        p_source_id: clientKey,
        p_reason: `Doodh ki adaigi nakaam: ${posted.error.message}`,
      });
    }
    return { error: rpcError(posted.error.message) };
  }

  revalidatePath("/admin/milk-collection");
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}

export async function setMilkCollectionType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Doodh ka rate tier badalna");
  if (!gate.ok) return { error: gate.error };
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
  const gate = await requireMoneyAdmin("Doodh ka rate badalna");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();
  const standardRate = Number(formData.get("standard_rate") ?? 0);
  const incentiveRaw = formData.get("self_dropoff_incentive");
  const snfRaw = formData.get("snf_constant");
  const tsRaw = formData.get("reference_ts");
  const incentive = Number(incentiveRaw);
  const snfConstant = Number(snfRaw);
  const referenceTs = Number(tsRaw);
  if (!standardRate || standardRate <= 0) return { error: "Standard rate zaroori hai." };
  if (incentiveRaw == null || String(incentiveRaw).trim() === "" || incentive < 0) return { error: "Incentive likhein (sifar ho sakta hai)." };
  if (snfRaw == null || String(snfRaw).trim() === "" || !Number.isFinite(snfConstant)) return { error: "SNF constant likhein." };
  if (!referenceTs || referenceTs <= 0) return { error: "Reference TS likhein." };

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
/** Adaigi modal ke liye: is kisan ki doodh wali wajib qist (likhta kuch nahi). */
export async function milkQistPreview(farmerId: string, payout: number) {
  const gate = await requireMoneyAdmin("Doodh ki adaigi");
  if (!gate.ok) return { due: 0, deduct: 0, items: [] };
  return previewQist("farmer", farmerId, "milk", payout);
}
