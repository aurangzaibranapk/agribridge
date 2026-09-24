import { createServiceClient } from "@/lib/supabase/service";

/**
 * WhatsApp par aane wale number ki pehchan.
 *
 * Tareeqa banking jaisa hai: bank ke paas pehle se aapka number hota
 * hai, aur wo tasdeeq ke liye kuch aisa poochhta hai jo sirf aap
 * jaante hain. Yahan bhi do cheezein sath milani parti hain —
 *
 *   1. Number pehle se HR ne staff_details.phone mein darj kiya ho
 *      (yani phone us shakhs ke qabze mein hai), aur
 *   2. CNIC ke aakhri 6 hindse (yani wo jaanta hai).
 *
 * Dono mil jayein to number us staff se pakka jur jata hai aur aage se
 * dobara nahi poochha jata. HR backend se phone badle to tasdeeq khud
 * khatam ho jati hai (staff_details par trigger) aur naye number se
 * dobara karni parti hai.
 */

const MAX_ATTEMPTS = 3;
const CNIC_DIGITS = 6;

export type StaffIdentity =
  | { kind: "verified_staff"; profileId: string; fullName: string; branchId: string | null }
  | { kind: "awaiting_cnic"; profileId: string; fullName: string }
  | { kind: "not_staff" };

/** Number se saare ghair-hindse nikaal deta hai, taake 0333-111 6727 = 03331116727. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Do number ek hi hain ya nahi. Log 0333..., 92333..., +92333... sab
 * likhte hain, is liye aakhri 10 hindse milaye jate hain.
 */
function sameNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = digitsOnly(a);
  const y = digitsOnly(b);
  if (x.length < 10 || y.length < 10) return false;
  return x.slice(-10) === y.slice(-10);
}

/**
 * Pata lagata hai ke ye number kis staff ka hai — pehle se tasdeeq
 * shuda, ya tasdeeq ka muntazir, ya staff hai hi nahi.
 */
export async function identifyStaffByWhatsApp(fromPhone: string): Promise<StaffIdentity> {
  const service = createServiceClient();
  const tail = digitsOnly(fromPhone).slice(-10);
  if (tail.length < 10) return { kind: "not_staff" };

  const { data: rows } = await service
    .from("staff_details")
    .select("profile_id, phone, whatsapp_number, whatsapp_verified_at, profiles(full_name, is_active, branch_id)")
    .eq("is_active", true);

  for (const row of rows ?? []) {
    const profile: any = Array.isArray((row as any).profiles) ? (row as any).profiles[0] : (row as any).profiles;
    if (!profile?.is_active) continue;

    // Pehle se juda hua number — seedha andar.
    if (row.whatsapp_verified_at && sameNumber(row.whatsapp_number, fromPhone)) {
      return {
        kind: "verified_staff",
        profileId: row.profile_id,
        fullName: profile.full_name ?? "Staff",
        branchId: profile.branch_id ?? null,
      };
    }

    // HR ne number darj kiya hua hai magar abhi tasdeeq nahi hui.
    if (sameNumber(row.phone, fromPhone)) {
      return { kind: "awaiting_cnic", profileId: row.profile_id, fullName: profile.full_name ?? "Staff" };
    }
  }

  return { kind: "not_staff" };
}

export interface VerificationReply {
  message: string;
  verified: boolean;
}

/** Tasdeeq shuru: number ko intezar mein daal kar CNIC maangta hai. */
export async function beginVerification(fromPhone: string, profileId: string, fullName: string): Promise<VerificationReply> {
  const service = createServiceClient();
  await service.from("staff_whatsapp_pending").upsert(
    {
      whatsapp_number: digitsOnly(fromPhone),
      profile_id: profileId,
      attempts: 0,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
    { onConflict: "whatsapp_number" }
  );

  return {
    verified: false,
    message:
      `Assalam-o-Alaikum ${fullName}.\n\n` +
      `Ye number aapke naam par darj hai. Tasdeeq ke liye apne CNIC ke ` +
      `aakhri ${CNIC_DIGITS} hindse bhejein.\n\n` +
      `(Misal: agar CNIC 35202-1234567-1 hai to bhejein: 345671)`,
  };
}

/**
 * CNIC ka jawab parkhta hai. Sahi ho to number hamesha ke liye jur jata
 * hai; ghalat ho to koshish ginti hai aur teen ke baad band.
 */
export async function checkCnicAnswer(fromPhone: string, answer: string): Promise<VerificationReply | null> {
  const service = createServiceClient();
  const number = digitsOnly(fromPhone);

  const { data: pending } = await service
    .from("staff_whatsapp_pending")
    .select("profile_id, attempts, expires_at")
    .eq("whatsapp_number", number)
    .maybeSingle();
  if (!pending) return null;

  if (new Date(pending.expires_at) < new Date()) {
    await service.from("staff_whatsapp_pending").delete().eq("whatsapp_number", number);
    return { verified: false, message: "Tasdeeq ka waqt guzar gaya. Dobara koi message bhejein." };
  }

  const given = digitsOnly(answer);
  if (given.length < CNIC_DIGITS) {
    return { verified: false, message: `CNIC ke aakhri ${CNIC_DIGITS} hindse bhejein.` };
  }

  const { data: staff } = await service
    .from("staff_details")
    .select("cnic")
    .eq("profile_id", pending.profile_id)
    .maybeSingle();

  const realTail = digitsOnly(staff?.cnic).slice(-CNIC_DIGITS);
  const givenTail = given.slice(-CNIC_DIGITS);

  if (realTail.length === CNIC_DIGITS && realTail === givenTail) {
    await service
      .from("staff_details")
      .update({ whatsapp_number: number, whatsapp_verified_at: new Date().toISOString() })
      .eq("profile_id", pending.profile_id);
    await service.from("staff_whatsapp_pending").delete().eq("whatsapp_number", number);

    return {
      verified: true,
      message:
        "Tasdeeq mukammal. Ab ye number aapke naam se jur gaya hai.\n\n" +
        "Ab aap likh sakte hain:\n" +
        "• *Hazir* — hazri lagane ke liye (sath apni location bhejein)\n" +
        "• *Chhutti* — kaam khatam hone par",
    };
  }

  const attempts = (pending.attempts ?? 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await service.from("staff_whatsapp_pending").delete().eq("whatsapp_number", number);
    return {
      verified: false,
      message: "CNIC teen dafa ghalat aaya. Tasdeeq band kar di gayi hai — apne admin se rabta karein.",
    };
  }

  await service.from("staff_whatsapp_pending").update({ attempts }).eq("whatsapp_number", number);
  return {
    verified: false,
    message: `CNIC ghalat hai. ${MAX_ATTEMPTS - attempts} koshish baqi hai. Apne CNIC ke aakhri ${CNIC_DIGITS} hindse dobara bhejein.`,
  };
}

/** Is number ki tasdeeq abhi chal rahi hai? */
export async function hasPendingVerification(fromPhone: string): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service
    .from("staff_whatsapp_pending")
    .select("whatsapp_number")
    .eq("whatsapp_number", digitsOnly(fromPhone))
    .maybeSingle();
  return !!data;
}
