import { supportChatKind } from "./roles";

export interface WhatsappLink {
  e164: string;
  href: string;
}

/**
 * Number settings se. Khali ho to link nahi — koi default number nahi.
 * Pehle env, phir support_whatsapp, phir contact_phone. Teeno caller bhejta hai.
 */
export function supportWhatsapp(input: {
  envNumber?: string | null;
  settingNumber?: string | null;
  contactPhone?: string | null;
  prefill?: string | null;
}): WhatsappLink | null {
  const raw = [input.envNumber, input.settingNumber, input.contactPhone].map((v) => String(v ?? "").trim()).find((v) => v.length > 0);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  const text = String(input.prefill ?? "AgriBridge support").slice(0, 180);
  return { e164: digits, href: `https://wa.me/${digits}?text=${encodeURIComponent(text)}` };
}

export function supportChatPath(portalRole: string | null | undefined): "/api/farmer-ai" | "/api/bridge-ai" | null {
  const kind = supportChatKind(portalRole);
  if (kind === "farmer") return "/api/farmer-ai";
  if (kind === "staff") return "/api/bridge-ai";
  return null;
}
