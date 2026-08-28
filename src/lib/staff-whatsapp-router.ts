import { identifyStaffByWhatsApp, beginVerification, checkCnicAnswer, hasPendingVerification } from "@/lib/staff-whatsapp";
import { whatsappCheckIn, whatsappCheckOut } from "@/lib/staff-attendance";
import { readVehiclePhoto } from "@/lib/ai/vehicle-photo-client";
import { recordSubmission, type SubmissionKind } from "@/lib/whatsapp-submissions";
import { vehicleForStaff, todaysLog, recordOpening, recordFuel, recordClosing } from "@/lib/vehicle-daily-log";

/**
 * Staff ke WhatsApp message ka jawab.
 *
 * Farmer AI se alag rakha gaya hai — staff ke kaam gine chune aur
 * muqarrar hain, un mein AI ke andaze ki gunjaish nahi honi chahiye.
 * "Hazir" ka matlab hamesha hazri hi hona chahiye, chahe AI kuch aur
 * samjhe. AI sirf tasveer parhne ke liye hai, faisla lene ke liye nahi.
 *
 * Wapsi mein null ka matlab: ye staff nahi — purana farmer wala raasta
 * chalao.
 */

const CHECK_IN_WORDS = ["hazir", "hazri", "haazir", "present", "حاضر", "حاضری"];
const CHECK_OUT_WORDS = ["chhutti", "chutti", "chhuti", "checkout", "check out", "off", "چھٹی"];
const OPENING_WORDS = ["subah", "subh", "opening", "start", "صبح"];
const CLOSING_WORDS = ["shaam", "sham", "closing", "end", "khatam", "شام"];
const FUEL_WORDS = ["petrol", "diesel", "fuel", "tel", "پٹرول", "ڈیزل"];

function matchesAny(text: string, words: string[]): boolean {
  const t = text.trim().toLowerCase();
  return words.some((w) => t === w || t.startsWith(w + " ") || t.includes(w));
}

export interface IncomingStaffMessage {
  fromPhone: string;
  text: string | null;
  latitude: number | null;
  longitude: number | null;
  /** WhatsApp se utari hui tasveer. */
  image: { base64: string; mimeType: string } | null;
}

const HELP =
  "Aap ye kar sakte hain:\n\n" +
  "*Hazri*\n" +
  "• *Hazir* — hazri lagane ke liye (sath location bhejein)\n" +
  "• *Chhutti* — kaam khatam hone par\n\n" +
  "*Motorcycle*\n" +
  "• Subah meter ki photo bhejein\n" +
  "• Petrol ka bill photo bhejein\n" +
  "• Shaam meter ki photo bhejein\n\n" +
  "Photo ke sath likh bhi sakte hain, jaise: *subah* ya *shaam*.";

function flagLine(flags: string[]): string {
  if (!flags.length) return "";
  return `\n\n⚠️ Manager ko ye baatein dikhengi:\n${flags.map((f) => `• ${f}`).join("\n")}`;
}

async function handlePhoto(
  msg: IncomingStaffMessage,
  staff: { profileId: string; branchId: string | null; fullName: string }
): Promise<string> {
  const image = msg.image!;
  const text = (msg.text ?? "").toLowerCase();

  const reading = await readVehiclePhoto(image.base64, image.mimeType);
  const vehicle = await vehicleForStaff(staff.profileId);

  // Staff ne khud likh diya ho to us ki baat maani jayegi, AI ki nahi.
  const saysOpening = matchesAny(text, OPENING_WORDS);
  const saysClosing = matchesAny(text, CLOSING_WORDS);
  const saysFuel = matchesAny(text, FUEL_WORDS);

  const isMeter = saysOpening || saysClosing || (!saysFuel && reading?.kind === "meter");
  const isFuel = saysFuel || reading?.kind === "fuel_receipt";

  // Gaari lagi hi na ho to meter/petrol ka hisaab nahi ban sakta — magar
  // saboot phir bhi darj hota hai, manager dekh lega.
  if ((isMeter || isFuel) && !vehicle) {
    await recordSubmission({
      staffProfileId: staff.profileId,
      branchId: staff.branchId,
      whatsappNumber: msg.fromPhone,
      kind: "other",
      rawText: msg.text,
      media: image,
      aiExtracted: reading as never,
      aiSummary: reading?.summary ?? null,
      flags: ["Is staff ke naam par koi gaari lagi hui nahi hai."],
    });
    return "Photo mil gayi aur manager ko bhej di hai.\n\n⚠️ Aap ke naam par koi gaari darj nahi hai — admin se kehein ke gaari assign karein, warna KM ka hisaab nahi ban sakta.";
  }

  if (isMeter && vehicle) {
    const km = reading?.odometerKm ?? null;

    const log = await todaysLog(vehicle.id);
    // Kaunsa meter hai — staff ne likha ho to wahi, warna aaj ki
    // soorat-e-haal se tay hota hai.
    const wantsClosing = saysClosing || (!saysOpening && log?.opening_km != null);
    const kind: SubmissionKind = wantsClosing ? "meter_closing" : "meter_opening";

    const sub = await recordSubmission({
      staffProfileId: staff.profileId,
      branchId: staff.branchId,
      whatsappNumber: msg.fromPhone,
      kind,
      rawText: msg.text,
      media: image,
      aiExtracted: reading as never,
      aiSummary: reading?.summary ?? null,
      flags: km == null ? ["Meter ka number photo se parha nahi ja saka."] : [],
    });
    if ("error" in sub) return `Photo mahfooz nahi ho saki: ${sub.error}`;

    if (km == null) {
      return `Photo mil gayi, magar meter ka number saaf nahi parha ja saka.\n\nSaaf photo dobara bhejein — ya manager khud bhar dega (${sub.submissionNumber}).`;
    }

    if (wantsClosing) {
      const result = await recordClosing(vehicle, km, sub.id);
      if ("error" in result) return result.error;

      const lines = [
        `Shaam ka meter darj: ${km.toLocaleString()} km`,
        `Aaj chale: ${Math.round(result.kmTravelled).toLocaleString()} km`,
      ];
      if (result.fuelLiters != null) lines.push(`Petrol: ${result.fuelLiters} litre — Rs ${(result.fuelAmount ?? 0).toLocaleString()}`);
      if (result.kmPerLiter != null) lines.push(`Mileage: ${result.kmPerLiter} km/litre`);
      if (result.expectedLiters != null && result.litersDifference != null) {
        const more = result.litersDifference > 0;
        lines.push(`Lagna chahiye tha: ${result.expectedLiters} litre (${more ? "+" : ""}${result.litersDifference} litre ka farq)`);
      }
      if (result.costPerKm != null) lines.push(`Fi km kharcha: Rs ${result.costPerKm}`);
      lines.push("", "Ye hisaab manager ke paas verify ke liye chala gaya hai.");
      return lines.join("\n") + flagLine(result.flags);
    }

    const result = await recordOpening(vehicle, staff.profileId, staff.branchId, km, sub.id);
    if ("error" in result) return result.error;
    return `Subah ka meter darj: ${km.toLocaleString()} km\nGaari: ${vehicle.vehicleName}\n\nShaam ko kaam khatam hone par meter ki photo dobara bhej dein.${flagLine(result.flags)}`;
  }

  if (isFuel && vehicle) {
    const sub = await recordSubmission({
      staffProfileId: staff.profileId,
      branchId: staff.branchId,
      whatsappNumber: msg.fromPhone,
      kind: "fuel",
      rawText: msg.text,
      media: image,
      aiExtracted: reading as never,
      aiSummary: reading?.summary ?? null,
      originalAmount: reading?.amount ?? null,
    });
    if ("error" in sub) return `Bill mahfooz nahi ho saka: ${sub.error}`;

    const result = await recordFuel(
      vehicle,
      staff.profileId,
      staff.branchId,
      { liters: reading?.liters ?? null, ratePerLiter: reading?.ratePerLiter ?? null, amount: reading?.amount ?? null, receiptPath: null },
      sub.id
    );
    if ("error" in result) return result.error;

    const parts: string[] = ["Petrol ka bill darj ho gaya."];
    if (reading?.liters != null) parts.push(`Litre: ${reading.liters}`);
    if (reading?.ratePerLiter != null) parts.push(`Rate: Rs ${reading.ratePerLiter}`);
    if (reading?.amount != null) parts.push(`Raqam: Rs ${reading.amount.toLocaleString()}`);
    parts.push("", "Manager verify karega tabhi kharche mein jayega.");
    return parts.join("\n") + flagLine(result.flags);
  }

  // Koi aur bill/photo — darj kar ke manager ke paas bhej dete hain.
  const sub = await recordSubmission({
    staffProfileId: staff.profileId,
    branchId: staff.branchId,
    whatsappNumber: msg.fromPhone,
    kind: "expense",
    rawText: msg.text,
    media: image,
    aiExtracted: reading as never,
    aiSummary: reading?.summary ?? null,
    originalAmount: reading?.amount ?? null,
  });
  if ("error" in sub) return `Photo mahfooz nahi ho saki: ${sub.error}`;
  return `Photo mil gayi (${sub.submissionNumber}) aur manager ke paas verify ke liye chali gayi hai.`;
}

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

  if (msg.image) {
    return handlePhoto(msg, { profileId, branchId, fullName });
  }

  // Location akela aaya — aam tor par log pehle "Hazir" likhte hain phir
  // location bhejte hain, is liye ise hazri hi samjho.
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
