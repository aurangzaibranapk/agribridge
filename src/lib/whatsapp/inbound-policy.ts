import crypto from "crypto";

/**
 * WhatsApp inbound ke qaide (malik, go-live 5, 19 Oct 2026):
 *
 *  1. Kisan / gahak ko AI KABHI khud jawab nahi deta. Aane wala text / voice
 *     ek pending qatar (farmer_ai_requests, intent_type = "whatsapp_reply")
 *     banata hai jis mein AI ka mashwara (suggested_reply) staff ke liye
 *     mehfooz hota hai. Paighaam tab hi jata hai jab staff admin mein
 *     dekh kar "Confirm send" dabaye.
 *  2. Anjaan number se koi farmer record khud nahi banta. Number
 *     "unknown sender" qatar (whatsapp_onboarding) mein jata hai; admin
 *     dekh kar khud farmer banata hai ya hata deta hai. Koi paighaam nahi.
 *  3. Signature: WHATSAPP_APP_SECRET set ho to sakhti se check (ghalat =
 *     401). Set na ho to inbound band nahi hota -- warning log, qubool,
 *     magar KOI paighaam nahi jata (na staff ko, na kisan ko).
 */

export type SignatureState = "valid" | "invalid" | "unsigned";

export function checkSignature(rawBody: string, header: string | null, secret: string | undefined | null): SignatureState {
  if (!secret) return "unsigned";
  if (!header?.startsWith("sha256=")) return "invalid";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // Lambai alag ho to timingSafeEqual phenk deta hai, is liye pehle check.
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? "valid" : "invalid";
}

/** Staff / machinery ke tay-shuda jawab sirf tasdeeq-shuda (signed) paighaam par. */
export function canAutoReplyToStaff(sig: SignatureState): boolean {
  return sig === "valid";
}

/** Kisan / gahak ko khud-ba-khud jawab: kabhi nahi. */
export const AUTO_REPLY_TO_FARMERS = false as const;

export const WHATSAPP_REPLY_INTENT = "whatsapp_reply" as const;

/** Kaun kisan ko WhatsApp jawab confirm-send kar sakta hai. */
export const WHATSAPP_REPLY_ROLES = ["owner", "super_admin", "admin", "admin_assistant", "manager"];

export interface InboundMessageInfo {
  fromPhone: string;
  waMessageId: string | null;
  messageType: string;
  text: string | null;
  profileName: string | null;
}

export interface ReplyDraftDetails {
  channel: "whatsapp";
  from_phone: string;
  wa_message_id: string | null;
  message_type: string;
  inbound_text: string | null;
  profile_name: string | null;
  suggested_reply: string | null;
  ai_draft_id: string | null;
  ai_error: string | null;
  signature: SignatureState;
}

/** farmer_ai_requests ki qatar: staff ke liye pending, AI ka mashwara andar. */
export function buildReplyDraftRow(
  farmerId: string,
  msg: InboundMessageInfo,
  sig: SignatureState,
  ai: { answer: string | null; draftId?: string | null; error?: string | null },
) {
  const preview = msg.text ? msg.text.replace(/\s+/g, " ").trim().slice(0, 180) : msg.messageType === "text" ? "" : "Voice note";
  const details: ReplyDraftDetails = {
    channel: "whatsapp",
    from_phone: msg.fromPhone,
    wa_message_id: msg.waMessageId,
    message_type: msg.messageType,
    inbound_text: msg.text,
    profile_name: msg.profileName,
    suggested_reply: ai.answer ? ai.answer.slice(0, 4000) : null,
    ai_draft_id: ai.draftId ?? null,
    ai_error: ai.error ? ai.error.slice(0, 300) : null,
    signature: sig,
  };
  return {
    farmer_id: farmerId,
    intent_type: WHATSAPP_REPLY_INTENT,
    description: `WhatsApp: ${preview || "(khaali paighaam)"}`,
    details,
    status: "pending",
  };
}

export function readInbound(body: any): { msg: InboundMessageInfo; raw: any } | null {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message || !message.from) return null;
  const type = String(message.type ?? "unknown");
  const text = type === "text" ? (message.text?.body ?? null) : type === "image" ? (message.image?.caption ?? null) : null;
  return {
    raw: message,
    msg: {
      fromPhone: String(message.from),
      waMessageId: message.id ? String(message.id) : null,
      messageType: type,
      text,
      profileName: value?.contacts?.[0]?.profile?.name ?? null,
    },
  };
}

/** Staff ka bheja jawab: khaali nahi, WhatsApp ki had (4096) se chhota. */
export function validateStaffReply(text: string): string | null {
  const t = text.trim();
  if (!t) return "Jawab likhein.";
  if (t.length > 4000) return "Jawab bohat lamba hai (4000 haroof tak).";
  return null;
}
