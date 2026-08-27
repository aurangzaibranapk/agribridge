"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function respondToEscalation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  const response = String(formData.get("response") ?? "").trim();
  if (!requestId) return { error: "Missing request id." };
  if (!response) return { error: "Jawab likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: request } = await supabase
    .from("farmer_ai_requests")
    .select("farmer_id, farmers(whatsapp_number, phone_number)")
    .eq("id", requestId)
    .single();
  if (!request) return { error: "Request nahi mili." };

  await supabase
    .from("farmer_ai_requests")
    .update({
      status: "approved",
      expert_response: response,
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  const farmer = Array.isArray((request as any).farmers) ? (request as any).farmers[0] : (request as any).farmers;
  const whatsappNumber = farmer?.whatsapp_number ?? farmer?.phone_number;
  if (whatsappNumber) {
    await sendWhatsAppMessage(whatsappNumber, `Aapke sawal ka Agronomist Expert ka jawab: \n\n${response}`);
  }

  revalidatePath("/expert");
  return { success: true };
}