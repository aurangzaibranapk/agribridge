"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function approveFarmerAiRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request id." };

  const { data: user } = await supabase.auth.getUser();
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.user?.id ?? "").single();
  if (!farmer) return { error: "Farmer profile nahi mila." };

  const { data: request } = await supabase
    .from("farmer_ai_requests")
    .select("*")
    .eq("id", requestId)
    .eq("farmer_id", farmer.id)
    .single();
  if (!request) return { error: "Request nahi mili." };
  if (request.status !== "pending") return { error: "Ye request pehle hi review ho chuki hai." };

  const details = request.details as any;

  if (request.intent_type === "log_expense") {
    let cropHistoryId = details.crop_history_id;
    if (!cropHistoryId) {
      const { data: latestCrop } = await supabase
        .from("crop_history")
        .select("id, farms!inner(farmer_id)")
        .eq("farms.farmer_id", farmer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      cropHistoryId = latestCrop?.id ?? null;
    }
    if (!cropHistoryId) return { error: "Koi Crop record nahi mila jis mein Expense add ho." };

    await supabase.from("crop_expenses").insert({
      crop_history_id: cropHistoryId,
      expense_category: details.category ?? "other",
      description: details.description ?? "AI se add hua expense",
      amount: details.amount,
      expense_date: details.date ?? new Date().toISOString().slice(0, 10),
      source: "voice_ai",
    });
  } else if (request.intent_type === "request_machinery") {
    await supabase.from("machinery_requests").insert({
      farmer_id: farmer.id,
      machine_type: details.machine_type ?? "other",
      acres: details.acres ?? null,
      crop_type: details.crop_type ?? null,
      expected_date: details.expected_date ?? null,
      status: "pending",
      notes: `Voice AI se: ${request.description}`,
    });
  } else if (request.intent_type === "request_fertilizer") {
    await supabase.from("service_requests").insert({
      farmer_id: farmer.id,
      service_type: "fertilizer",
      description: request.description,
      status: "pending",
    });
  } else if (request.intent_type === "sell_produce") {
    await supabase.from("produce_listings").insert({
      farmer_id: farmer.id,
      crop_name: details.crop_name ?? "unknown",
      quantity_available: details.quantity ?? 0,
      unit: details.unit ?? "maund",
      asking_price_per_unit: details.price ?? null,
      status: "active",
      notes: `Voice AI se: ${request.description}`,
    });
  }

  await supabase.from("farmer_ai_requests").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", requestId);

  revalidatePath("/portal/ai-assistant");
  return { success: true };
}

export async function rejectFarmerAiRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request id." };

  const { data: user } = await supabase.auth.getUser();
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.user?.id ?? "").single();
  if (!farmer) return { error: "Farmer profile nahi mila." };

  await supabase
    .from("farmer_ai_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("farmer_id", farmer.id);

  revalidatePath("/portal/ai-assistant");
  return { success: true };
}