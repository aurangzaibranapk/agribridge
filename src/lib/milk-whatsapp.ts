import { createServiceClient } from "@/lib/supabase/service";
import { recordCollection } from "@/lib/milk-collection";

/**
 * WhatsApp par aaya hua doodh ka paighaam.
 *
 * MCA aisa likhta hai:
 *
 *     Farmer 2
 *     Milk 14 Liter
 *     LR 25
 *
 * ...aur sath LR ki photo bhejta hai. Har MCA thora alag likhta hai --
 * koi "kisan" likhta hai, koi "doodh", koi sab kuch ek hi line mein. Is
 * liye alfaz par nahi, dhaanche par chalte hain: kis lafz ke baad kaunsa
 * number aata hai.
 *
 * Yahan AI bilkul istemal nahi hota, jaan boojh kar. Litre ka andaza
 * seedha paise mein badal jata hai; jahan number ka sawal ho wahan
 * andaze ki koi gunjaish nahi honi chahiye. Number saaf na mile to hum
 * MCA se dobara poochhte hain -- khud se bhar nahi lete.
 */

const FARMER_WORDS = "farmer|kisan|kissan|f";
const MILK_WORDS = "milk|doodh|dodh|dudh|dhood";

export interface ParsedMilk {
  farmerCode: string;
  liters: number;
  lr: number | null;
}

/** Paighaam doodh ka lagta hai? (Farmer aur litre, dono ka zikr.) */
export function looksLikeMilk(text: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const hasFarmer = new RegExp(`\\b(?:${FARMER_WORDS})\\b`).test(t);
  const hasMilk = new RegExp(`\\b(?:${MILK_WORDS})\\b`).test(t) || /\d\s*(?:liter|litre|ltr)\b/.test(t);
  return hasFarmer && hasMilk;
}

export function parseMilkMessage(text: string | null): ParsedMilk | { error: string } {
  if (!text) return { error: "Paighaam khali hai." };
  const t = text.toLowerCase().replace(/,/g, "");

  const farmerMatch = t.match(new RegExp(`\\b(?:${FARMER_WORDS})\\b\\s*[:#-]?\\s*([a-z0-9-]+)`));
  if (!farmerMatch) return { error: "Farmer ka number nahi mila." };

  // "Milk 14 Liter" bhi, aur "14 liter doodh" bhi.
  const litersMatch =
    t.match(new RegExp(`\\b(?:${MILK_WORDS})\\b\\s*[:#-]?\\s*(\\d+(?:\\.\\d+)?)`)) ??
    t.match(/(\d+(?:\.\d+)?)\s*(?:liter|litre|ltr)\b/);
  if (!litersMatch) return { error: "Litre nahi mile." };

  const liters = Number(litersMatch[1]);
  if (!Number.isFinite(liters) || liters <= 0) return { error: "Litre sahi nahi hain." };

  const lrMatch = t.match(/\blr\b\s*[:#-]?\s*(\d+(?:\.\d+)?)/);
  const lr = lrMatch ? Number(lrMatch[1]) : null;

  return {
    farmerCode: farmerMatch[1],
    liters,
    lr: lr != null && Number.isFinite(lr) ? lr : null,
  };
}

const MILK_ROLES = ["milk_collection", "manager", "admin", "super_admin", "owner"];

const FORMAT_HELP =
  "Doodh is tarah likhein:\n\n" +
  "*Farmer 2*\n" +
  "*Milk 14 Liter*\n" +
  "*LR 25*\n\n" +
  "Sath LR ki photo bhi bhej dein.";

export interface MilkMessage {
  fromPhone: string;
  text: string | null;
  image: { base64: string; mimeType: string } | null;
}

/**
 * Doodh ka paighaam darj karta hai. Wahi engine bulata hai jo website
 * aur offline istemal karte hain -- rate ka formula, duplicate ki rok
 * aur khate ka usool, sab ek hi jagah rehte hain.
 */
export async function handleMilkMessage(
  msg: MilkMessage,
  staff: { profileId: string; branchId: string | null }
): Promise<string> {
  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", staff.profileId)
    .maybeSingle();

  if (!profile || !MILK_ROLES.includes(profile.role)) {
    return "Aap ke account se doodh ki entry nahi ho sakti. Admin se kehein ke aap ka role *Milk Collection* kar dein.";
  }

  const parsed = parseMilkMessage(msg.text);
  if ("error" in parsed) return `${parsed.error}\n\n${FORMAT_HELP}`;

  const { data: staffRow } = await service
    .from("staff_details")
    .select("milk_route_name, milk_chiller_name")
    .eq("profile_id", staff.profileId)
    .maybeSingle();

  const saved = await recordCollection({
    farmerCode: parsed.farmerCode,
    liters: parsed.liters,
    lr: parsed.lr,
    source: "whatsapp",
    mcaProfileId: staff.profileId,
    branchId: staff.branchId,
    routeName: staffRow?.milk_route_name ?? null,
    chillerName: staffRow?.milk_chiller_name ?? null,
    lrImage: msg.image,
    notes: msg.text,
  });

  if ("error" in saved) return `${saved.error}\n\n${FORMAT_HELP}`;

  if (saved.alreadyExisted) {
    return `Ye entry pehle se mahfooz hai — ${saved.collectionNumber}.`;
  }

  const lines = [
    `Doodh darj ho gaya — ${saved.collectionNumber}`,
    `Kisan: ${saved.farmerName}`,
    `Litre: ${saved.liters}`,
  ];
  if (parsed.lr != null) lines.push(`LR: ${parsed.lr}`);
  lines.push("", "FAT chiller par lagega — raqam us waqt banegi.");

  if (saved.flags.length) {
    lines.push("", "⚠️ Manager ko ye baatein dikhengi:");
    saved.flags.forEach((f) => lines.push(`• ${f}`));
  }

  return lines.join("\n");
}
