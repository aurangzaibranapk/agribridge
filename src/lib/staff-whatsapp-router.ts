import { identifyStaffByWhatsApp, beginVerification, checkCnicAnswer, hasPendingVerification } from "@/lib/staff-whatsapp";
import { whatsappCheckIn, whatsappCheckOut } from "@/lib/staff-attendance";

/**
 * Staff ke WhatsApp message ka jawab.
 *
 * Farmer AI se alag rakha gaya hai — staff ke kaam (hazri, kharcha,
 * doodh) gine chune aur muqarrar hain, un mein AI ke andaze ki gunjaish
 * nahi honi chahiye. "Hazir" ka matlab hamesha hazri hi hona chahiye,
 * chahe AI kuch aur samjhe.
 *
 * Wapsi mein null ka matlab: ye staff nahi — purana farmer wala raasta
 * chalao.
 */

const CHECK_IN_WORDS = ["hazir", "hazri", "haazir", "present", "حاضر", "حاضری"];
const CHECK_OUT_WORDS = ["chhutti", "chutti", "chhuti", "checkout", "check out", "off", "چھٹی"];

function matchesAny(text: string, words: string[]): boolean {
  const t = text.trim().toLowerCase();
  return words.some((w) => t === w || t.startsWith(w + " ") || t.includes(w));
}

export interface IncomingStaffMessage {
  fromPhone: string;
  text: string | null;
  /** WhatsApp ka location message — sath aaye to hazri ki tasdeeq ho jati hai. */
  latitude: number | null;
  longitude: number | null;
}

const HELP =
  "Aap ye likh sakte hain:\n\n" +
  "• *Hazir* — hazri lagane ke liye\n" +
  "• *Chhutti* — kaam khatam hone par\n\n" +
  "Hazri ke sath apni location bhi bhejein: 📎 → *Location* → *Send your current location*";

export async function handleStaffMessage(msg: IncomingStaffMessage): Promise<string | null> {
  const identity = await identifyStaffByWhatsApp(msg.fromPhone);

  // Tasdeeq ke darmiyan mein hai — jo bhi aaya use CNIC ka jawab samjho.
  if (identity.kind === "awaiting_cnic" || (await hasPendingVerification(msg.fromPhone))) {
    if (msg.text) {
      const answer = await checkCnicAnswer(msg.fromPhone, msg.text);
      if (answer) return answer.message;
    }
    if (identity.kind === "awaiting_cnic") {
      const started = await beginVerification(msg.fromPhone, identity.profileId, identity.fullName);
      return started.message;
    }
  }

  if (identity.kind !== "verified_staff") return null;

  const { profileId, branchId, fullName } = identity;

  // Location akela aaya (bina likhe) — aam tor par log pehle "Hazir"
  // likhte hain phir location bhejte hain, is liye ise hazri hi samjho.
  if (!msg.text && msg.latitude != null && msg.longitude != null) {
    const result = await whatsappCheckIn(profileId, branchId, msg.latitude, msg.longitude);
    return result.message;
  }

  const text = msg.text ?? "";

  if (matchesAny(text, CHECK_IN_WORDS)) {
    const result = await whatsappCheckIn(profileId, branchId, msg.latitude, msg.longitude);
    return result.message;
  }

  if (matchesAny(text, CHECK_OUT_WORDS)) {
    const result = await whatsappCheckOut(profileId, branchId, msg.latitude, msg.longitude);
    return result.message;
  }

  return `Assalam-o-Alaikum ${fullName}.\n\n${HELP}`;
}
