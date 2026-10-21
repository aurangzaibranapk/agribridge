import { createServiceClient } from "@/lib/supabase/service";
import { unwrapWebsiteSetting } from "@/lib/cms/website-setting";
import { supportWhatsapp, type WhatsappLink } from "@/lib/mobile/support";

/** Env, phir website_settings.support_whatsapp, phir contact_phone. Koi hardcoded number nahi. */
export async function readSupportWhatsapp(): Promise<WhatsappLink | null> {
  let settingNumber: string | null = null;
  let contactPhone: string | null = null;
  try {
    const service = createServiceClient();
    const { data } = await service.from("website_settings").select("key, value").in("key", ["support_whatsapp", "contact_phone"]);
    for (const row of data ?? []) {
      const text = unwrapWebsiteSetting((row as { value: unknown }).value);
      if ((row as { key: string }).key === "support_whatsapp") settingNumber = text;
      if ((row as { key: string }).key === "contact_phone") contactPhone = text;
    }
  } catch {
    settingNumber = null;
  }
  return supportWhatsapp({
    envNumber: process.env.SUPPORT_WHATSAPP_E164,
    settingNumber,
    contactPhone,
  });
}
