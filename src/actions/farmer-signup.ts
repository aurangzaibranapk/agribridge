"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findFarmerByPhone, phoneKey } from "@/lib/farmers/identity";
import { sendFarmerOtp } from "@/lib/farmers/otp";
import { normalizeCnic, formatCnic, signupDecision } from "@/lib/campaigns/booking";
import { resolveRequestOrganizationId } from "@/lib/tenant/request-organization";

/**
 * Kisan ka khud signup (naam, CNIC, mobile, gaon) + WhatsApp OTP, aur
 * WhatsApp OTP se password bhoolna.
 *
 * OTP ka poora intezam purana hi hai (src/lib/farmers/otp.ts, migration 197):
 * 6 hindse, 5 minute, database mein sirf bcrypt hash, 60s cooldown, 5/ghanta,
 * 3 ghalat koshish par band. Code na log hota hai na jawab mein jata hai.
 * Yahan sirf us ke upar naye darwaze hain.
 */

export interface SignupState {
  error?: string;
  otpSent?: boolean;
  sentVia?: "whatsapp" | "sms";
  /** Purana kisan mil gaya -- naya nahi banega, login/forgot password par bhejo. */
  existing?: boolean;
  success?: boolean;
  pendingApproval?: boolean;
  retryAfterSeconds?: number;
}

function loginEmailFor(key: string) {
  return `${key}@phone.agribridge.local`;
}

async function matchExisting(phone: string, cnic: string | null) {
  const service = createServiceClient();
  const byPhone = await findFarmerByPhone(service, phone);
  let byCnic: { id: string } | null = null;
  if (cnic) {
    const { data } = await (service as any).rpc("fn_find_farmer_by_cnic", { p_cnic: cnic });
    byCnic = Array.isArray(data) && data[0] ? { id: data[0].id } : null;
  }
  return signupDecision(byCnic, byPhone ? { id: byPhone.id } : null);
}

function readSignup(formData: FormData) {
  return {
    fullName: String(formData.get("full_name") ?? "").trim().slice(0, 120),
    cnic: normalizeCnic(String(formData.get("cnic") ?? "")),
    phone: String(formData.get("phone") ?? "").trim(),
    village: String(formData.get("village") ?? "").trim().slice(0, 120),
  };
}

const EXISTING_MSG =
  "Is CNIC ya mobile par aap ka khata pehle se maujood hai. Mobile/OTP se login karein, ya 'Password bhool gaye' se naya password banayein.";

/** Qadam 1: form check, duplicate check, phir WhatsApp OTP. */
export async function startFarmerSignup(_p: SignupState, formData: FormData): Promise<SignupState> {
  const f = readSignup(formData);
  if (f.fullName.length < 3) return { error: "Poora naam likhein." };
  if (!f.cnic) return { error: "CNIC ke 13 hindse likhein (misal 35202-1234567-1)." };
  if (!phoneKey(f.phone)) return { error: "Mobile number poora likhein — misal 0300 1234567." };
  if (f.village.length < 2) return { error: "Gaon ka naam likhein." };

  const d = await matchExisting(f.phone, f.cnic);
  if (d.kind === "existing") return { existing: true, error: EXISTING_MSG };
  if (d.kind === "conflict") return { error: "Ye CNIC aur mobile do alag khaton par hain. Daftar se raabta karein." };

  const sent = await sendFarmerOtp(f.phone, "whatsapp");
  if (!sent.ok) return { error: sent.error, retryAfterSeconds: sent.retryAfterSeconds };
  return { otpSent: true, sentVia: sent.sentVia };
}

/** Qadam 2: OTP theek ho to kisan 'pending' approval ke sath banta hai, login khul jata hai. */
export async function completeFarmerSignup(_p: SignupState, formData: FormData): Promise<SignupState> {
  const f = readSignup(formData);
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const key = phoneKey(f.phone);
  if (!key || !f.cnic || f.fullName.length < 3) return { error: "Form dobara bharein." };
  if (code.length !== 6) return { otpSent: true, error: "Chhe hindse wala code likhein." };

  const organizationId = await resolveRequestOrganizationId();
  if (!organizationId) return { error: "Organization configure nahi hai." };

  // Dobara check -- OTP ke dauran kisi ne isi CNIC/phone ka khata na bana diya ho.
  const d = await matchExisting(f.phone, f.cnic);
  if (d.kind !== "new") return { existing: true, error: EXISTING_MSG };

  const service = createServiceClient();
  const { data: nateeja, error: rpcError } = await service.rpc("fn_verify_farmer_otp", { p_phone_key: key, p_code: code });
  if (rpcError) return { otpSent: true, error: "Code check nahi ho saka. Dobara koshish karein." };
  if (nateeja === "ghalat") return { otpSent: true, error: "Code ghalat hai." };
  if (nateeja === "band") return { error: "Teen dafa ghalat code. Naya code mangwaen." };
  if (nateeja !== "ok") return { error: "Code ki muddat (5 minute) khatam. Naya code mangwaen." };

  const email = loginEmailFor(key);
  const { data: made, error: makeError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: f.fullName, phone_number: f.phone, role: "farmer" },
  });
  if (makeError || !made.user) return { error: "Login nahi ban saka. Daftar se raabta karein." };

  const { error: insError } = await (service as any).from("farmers").insert({
    user_id: made.user.id,
    organization_id: organizationId,
    full_name: f.fullName,
    cnic: formatCnic(f.cnic),
    phone_number: f.phone,
    village: f.village,
    registration_source: "SELF",
    phone_verified_at: new Date().toISOString(),
    signup_approval_status: "pending",
  });
  if (insError) {
    await service.auth.admin.deleteUser(made.user.id).catch(() => undefined);
    if (/phone_key_uniq|cnic_key/.test(insError.message)) return { existing: true, error: EXISTING_MSG };
    return { error: "Kisan ka khata nahi ban saka." };
  }

  // Session: wohi tareeqa jo OTP login (farmer-auth.ts) istemal karta hai.
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (tokenHash) await createClient().auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });

  return { success: true, pendingApproval: true };
}

// ---------------------------------------------------------------------
// Password bhool gaye -- WhatsApp OTP
// ---------------------------------------------------------------------

export interface ResetState {
  error?: string;
  otpSent?: boolean;
  sentVia?: "whatsapp" | "sms";
  success?: boolean;
  retryAfterSeconds?: number;
}

/**
 * Qadam 1. Jawab hamesha ek jaisa ("agar khata hai to code gaya") taake
 * koi number daal kar ye na jaan sake ke kaun registered hai. Rate limit
 * sendFarmerOtp ke andar hai (60s, 5/ghanta) -- us ki rok ka jawab
 * dikhaya jata hai kyunke wo sirf usi number par lagti hai jis par code ja chuka.
 */
export async function requestFarmerPasswordResetOtp(_p: ResetState, formData: FormData): Promise<ResetState> {
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phoneKey(phone)) return { error: "Mobile number poora likhein." };
  const service = createServiceClient();
  const match = await findFarmerByPhone(service, phone);
  if (match) {
    const { data } = await service.from("farmers").select("user_id").eq("id", match.id).maybeSingle();
    if (data?.user_id) {
      const sent = await sendFarmerOtp(phone, "whatsapp");
      if (!sent.ok && sent.retryAfterSeconds) return { error: sent.error, retryAfterSeconds: sent.retryAfterSeconds };
      if (!sent.ok) return { error: sent.error };
      return { otpSent: true, sentVia: sent.sentVia };
    }
  }
  return { otpSent: true };
}

/** Qadam 2. OTP + naya password. */
export async function resetFarmerPasswordWithOtp(_p: ResetState, formData: FormData): Promise<ResetState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");
  const key = phoneKey(phone);
  if (!key) return { error: "Mobile number poora likhein." };
  if (code.length !== 6) return { otpSent: true, error: "Chhe hindse wala code likhein." };
  if (password.length < 6) return { otpSent: true, error: "Password kam az kam chhe harf ka rakhein." };
  if (password !== confirm) return { otpSent: true, error: "Dono password ek jaise nahi hain." };

  const service = createServiceClient();
  const { data: nateeja, error } = await service.rpc("fn_verify_farmer_otp", { p_phone_key: key, p_code: code });
  if (error) return { otpSent: true, error: "Code check nahi ho saka." };
  if (nateeja === "ghalat") return { otpSent: true, error: "Code ghalat hai." };
  if (nateeja === "band") return { error: "Teen dafa ghalat code. Naya code mangwaen." };
  if (nateeja !== "ok") return { error: "Code ki muddat (5 minute) khatam. Naya code mangwaen." };

  const match = await findFarmerByPhone(service, phone);
  const { data: row } = match
    ? await service.from("farmers").select("user_id").eq("id", match.id).maybeSingle()
    : { data: null };
  const userId = (row?.user_id as string | null) ?? null;
  if (!userId) return { error: "Is number par koi login nahi mila. Pehle signup karein." };

  const { error: passError } = await service.auth.admin.updateUserById(userId, { password });
  if (passError) return { error: "Password set nahi hua. Dobara koshish karein." };
  return { success: true };
}
