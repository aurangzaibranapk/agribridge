"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateGeminiText } from "@/lib/ai/gemini-text-client";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const AI_ASSISTANT_ROLE = "ai_assistant";
const ORDER_NUMBER_PATTERN = /AGR-\d{2}-\d{5}/i;

// Pulls real, current data for an order mentioned in the message so the
// AI answers from actual system state instead of guessing.
async function buildOrderContext(orderNumber: string): Promise<string> {
  const serviceClient = createServiceClient();

  const { data: order } = await serviceClient
    .from("agri_orders")
    .select("id, order_number, status, grand_total, shop_dealer_name, payment_terms, created_at")
    .ilike("order_number", orderNumber)
    .maybeSingle();

  if (!order) return `Order "${orderNumber}" system mein nahi mila.`;

  const { data: payments } = await serviceClient
    .from("agri_order_payments")
    .select("payment_number, status, paid_amount")
    .eq("order_id", order.id);

  const { data: dispatch } = await serviceClient
    .from("agri_dispatches")
    .select("dispatch_number, status, driver_name, vehicle_no")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: grn } = await serviceClient
    .from("agri_grns")
    .select("grn_number, payable_amount")
    .eq("order_id", order.id)
    .maybeSingle();

  const paymentSummary = (payments ?? []).map((p) => `${p.payment_number}: Rs ${p.paid_amount} (${p.status})`).join(", ") || "koi payment submit nahi hui";
  const dispatchSummary = dispatch ? `${dispatch.dispatch_number} - ${dispatch.status}, Driver: ${dispatch.driver_name ?? "-"}, Vehicle: ${dispatch.vehicle_no ?? "-"}` : "abhi dispatch nahi hua";
  const grnSummary = grn ? `${grn.grn_number} - Payable: Rs ${grn.payable_amount}` : "abhi GRN nahi bana";

  return `Order Data (asal system se): Order Number: ${order.order_number}, Shop: ${order.shop_dealer_name}, Status: ${order.status}, Grand Total: Rs ${order.grand_total}, Payment Terms: ${order.payment_terms}. Payments: ${paymentSummary}. Dispatch: ${dispatchSummary}. GRN: ${grnSummary}.`;
}

async function maybeSendAiReply(aiRecipientId: string, originalSenderId: string, senderMessage: string) {
  const serviceClient = createServiceClient();
  const { data: recipientProfile } = await serviceClient.from("profiles").select("role").eq("id", aiRecipientId).maybeSingle();
  if (recipientProfile?.role !== AI_ASSISTANT_ROLE) return;

  let context = "";
  const orderMatch = senderMessage.match(ORDER_NUMBER_PATTERN);
  if (orderMatch) {
    context = await buildOrderContext(orderMatch[0]);
  }

  const prompt = `Tum AgriBridge ka internal Assistant ho (sirf company staff ke liye, public feature nahi). Roman Urdu mein, seedha aur madadgar jawab do (max 5 sentences). Agar order data diya gaya hai, to SIRF usi asal data ke mutabiq jawab do, andaza na lagao. ${context ? "\n\n" + context : ""}\n\nStaff ka sawal: ${senderMessage}`;
  const reply = (await generateGeminiText(prompt)) ?? "Maaf kijiye, abhi jawab nahi de sakta - baad mein try karein.";

  await serviceClient.from("staff_messages").insert({
    sender_id: aiRecipientId,
    recipient_id: originalSenderId,
    message: reply,
  });
}

export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const recipientId = String(formData.get("recipient_id") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const relatedOrderId = (formData.get("related_order_id") as string) || null;

  if (!recipientId) return { error: "Recipient select karein." };

  let attachmentUrl: string | null = null;
  let attachmentType: string | null = null;
  const attachment = formData.get("attachment");
  if (attachment instanceof File && attachment.size > 0) {
    const path = `${user.id}/${Date.now()}-${attachment.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("staff-messages").upload(path, attachment);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("staff-messages").getPublicUrl(path);
      attachmentUrl = data.publicUrl;
      attachmentType = attachment.type.startsWith("image/") ? "image" : "file";
    }
  }

  if (!message && !attachmentUrl) return { error: "Message ya file chahiye." };

  const { error } = await supabase.from("staff_messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    message: message || null,
    attachment_url: attachmentUrl,
    attachment_type: attachmentType,
    related_order_id: relatedOrderId,
  });
  if (error) return { error: error.message };

  if (message) {
    await maybeSendAiReply(recipientId, user.id, message);
  }

  revalidatePath("/admin/messages");
  return { success: true };
}

export async function markConversationRead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const senderId = String(formData.get("sender_id") ?? "");
  if (!senderId) return { error: "Missing sender id." };

  const { error } = await supabase
    .from("staff_messages")
    .update({ is_read: true })
    .eq("recipient_id", user.id)
    .eq("sender_id", senderId)
    .eq("is_read", false);
  if (error) return { error: error.message };

  revalidatePath("/admin/messages");
  return { success: true };
}