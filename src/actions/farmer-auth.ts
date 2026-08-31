"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findFarmerByPhone, phoneKey } from "@/lib/farmers/identity";
import { sendFarmerOtp } from "@/lib/farmers/otp";

/**
 * Kisan ka login -- mobile aur OTP.
 *
 * TEEN CHEEZEIN YAHAN JAAN BOOJH KAR ALAG RAKHI GAYI HAIN:
 *
 *   Kisan ka RECORD (farmers) -- wo booking, doodh, anaj ya WhatsApp se
 *   pehle hi ban chuka hota hai, bina kisi login ke.
 *
 *   Kisan ki PEHCHAN -- us ka mobile. Poore nizam mein lookup isi se
 *   hota hai (aakhri das hindse, migration 124).
 *
 *   Kisan ka LOGIN -- wo pehli dafa OTP theek hone par banta hai aur usi
 *   waqt us ke record se juR jata hai.
 *
 * Pehle ye teenon ek hi cheez samjhe jate the, aur us ki qeemat ye thi
 * ke kisan se email aur password maanga jata tha -- us bande se jis ke
 * paas email hai hi nahi. Aaj tak ek bhi kisan ka email darj nahi hua.
 *
 * EK NUMBER, EK KISAN. Ye rok database mein pehle se hai
 * (farmers_phone_key_uniq). Yahan us se pehle poochh liya jata hai,
 * taake naya banane ki koshish hi na ho aur purana khata mil jaye --
 * chahe wo khata booking ke waqt bana ho, ya chiller par, ya WhatsApp
 * par.
 */

export interface FarmerAuthState {
  error?: string;
  /** OTP chala gaya -- ab code maanga jayega. */
  otpSent?: boolean;
  sentVia?: "whatsapp" | "sms";
  /** Ye number kisi ke naam nahi -- naam aur gaon poochhna hoga. */
  needsProfile?: boolean;
  /** Sab ho gaya -- portal khul sakta hai. */
  success?: boolean;
  /** Purana kisan mila to us ka naam, taake screen us se baat kar sake. */
  knownName?: string;
}

/** Kisan ke login ka banawati email -- hamesha ek hi qaide se. */
function loginEmailFor(key: string): string {
  // AAKHRI DAS HINDSE, poora number nahi.
  //
  // Purane login form mein yahan saare hindse lagte the. Us ka matlab
  // tha ke 03001234567 aur +923001234567 do alag login ban jate --
  // jabke poore nizam mein wo ek hi banda hai. Kisan agar dobara doosre
  // andaz mein likhta to us ka apna khata na khulta.
  return `${key}@phone.agribridge.local`;
}

/** Qadam 1 -- mobile lo, OTP bhejo. */
export async function requestFarmerOtp(
  _prev: FarmerAuthState,
  formData: FormData
): Promise<FarmerAuthState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const key = phoneKey(phone);
  if (!key) return { error: "Mobile number poora likhein — misal ke tor par 0300 1234567." };

  const service = createServiceClient();
  const match = await findFarmerByPhone(service, phone);

  const sent = await sendFarmerOtp(phone);
  if (!sent.ok) return { error: sent.error };

  return {
    otpSent: true,
    sentVia: sent.sentVia,
    needsProfile: !match,
    knownName: match?.fullName ?? undefined,
  };
}

/**
 * Qadam 2 -- OTP milao, phir portal khol do.
 *
 * TARTEEB AHEM HAI. Pehle ye dekha jata hai ke naam ki zaroorat hai ya
 * nahi, AUR US KE BAAD OTP milaya jata hai. Ulta karte to naye kisan ka
 * OTP naam poochhne se pehle hi kharch ho jata, aur usay doosra OTP
 * mangwana parta -- wo bhi bina kisi wajah ke.
 */
export async function verifyFarmerOtp(
  _prev: FarmerAuthState,
  formData: FormData
): Promise<FarmerAuthState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const village = String(formData.get("village") ?? "").trim();

  const key = phoneKey(phone);
  if (!key) return { error: "Mobile number poora likhein." };
  if (code.length !== 6) return { error: "Chhe hindse wala code likhein." };

  const supabase = createClient();
  const service = createServiceClient();

  const match = await findFarmerByPhone(service, phone);
  if (!match && !fullName) {
    return { otpSent: true, needsProfile: true, error: "Apna naam likhein." };
  }

  const { data: nateeja, error: rpcError } = await service.rpc("fn_verify_farmer_otp", {
    p_phone_key: key,
    p_code: code,
  });
  if (rpcError) return { error: "Code check nahi ho saka. Dobara koshish karein." };

  if (nateeja === "ghalat") {
    return { otpSent: true, needsProfile: !match, error: "Code ghalat hai. Dobara dekh kar likhein." };
  }
  if (nateeja === "band") {
    return { error: "Teen dafa ghalat code. Naya code mangwaen." };
  }
  if (nateeja !== "ok") {
    return { error: "Code ki muddat khatam ho gayi. Naya code mangwaen." };
  }

  // ---- OTP theek hai. Ab login banao ya purana dhoondo. ----
  const email = loginEmailFor(key);
  let userId = match?.id ? await farmerUserId(service, match.id) : null;

  if (!userId) {
    // Shayad login pehle se maujood ho magar kisan se juRa na ho (misal:
    // pehle banaya gaya tha aur record baad mein bana). Naya banane se
    // pehle wahi dhoondte hain -- warna ek hi bande ke do login ban
    // jate hain.
    const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }

  if (!userId) {
    const { data: made, error: makeError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: match?.fullName ?? fullName, phone_number: phone, role: "farmer" },
    });
    if (makeError || !made.user) return { error: "Login nahi ban saka. Daftar se raabta karein." };
    userId = made.user.id;
  }

  if (match) {
    // Purana kisan -- wohi Farmer ID, wohi 360 profile. Naya record
    // kabhi nahi banta.
    const { error } = await service.from("farmers").update({ user_id: userId }).eq("id", match.id);
    if (error) return { error: "Login kisan ke khate se nahi juR saka." };
  } else {
    const { error } = await service.from("farmers").insert({
      user_id: userId,
      full_name: fullName,
      phone_number: phone,
      village: village || null,
      registration_source: "SELF",
    });
    if (error) {
      // Ek hi lamhe mein do jagah se koshish ho to database rok deta hai
      // (farmers_phone_key_uniq). Wo rok yahan bhi wohi baat kehti hai:
      // is number ka kisan ban chuka hai.
      if (error.message.includes("farmers_phone_key_uniq")) {
        return { error: "Is number ka khata abhi abhi ban chuka hai. Dobara login karein." };
      }
      return { error: "Kisan ka khata nahi ban saka." };
    }
  }

  // ---- Session ----
  // Password kahin nahi hai, aur na hona chahiye. Session banane ka
  // raasta ye hai: server ek dafa ka token banata hai aur foran usay
  // khud bhuna leta hai. Wo token kisi ko bheja nahi jata -- asal
  // darwaza OTP tha, aur wo guzar chuka.
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return { error: "Session nahi ban saka. Dobara koshish karein." };

  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (sessionError) return { error: "Session nahi ban saka. Dobara koshish karein." };

  return { success: true };
}

async function farmerUserId(
  service: ReturnType<typeof createServiceClient>,
  farmerId: string
): Promise<string | null> {
  const { data } = await service.from("farmers").select("user_id").eq("id", farmerId).maybeSingle();
  return (data?.user_id as string | null) ?? null;
}

// =====================================================================
// Kisan ki apni User ID (198)
// =====================================================================
//
// OTP se login ho jata hai, magar har dafa code ka intezar us bande ke
// liye bojh hai jo roz portal kholta hai. Is liye kisan CHAHE to apni
// User ID aur password bana le. Na chahe to koi zabardasti nahi -- OTP
// apni jagah chalta rehta hai.

export interface UsernameState {
  error?: string;
  success?: boolean;
  username?: string;
}

/**
 * Ye naam mil sakta hai ya nahi.
 *
 * Ye sirf SAFHE ko batane ke liye hai, taake banda naam likhte hi dekh
 * le. Faisla yahan nahi hota -- asal faisla database mein hota hai
 * (fn_set_farmer_username), kyunke do log ek hi lamhe mein wohi naam
 * maang lein to yahan dono ko "mil sakta hai" ka jawab mil chuka hoga.
 */
export async function checkFarmerUsername(raw: string): Promise<{ ok: boolean; reason?: string }> {
  const name = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9._]{3,19}$/.test(name)) {
    return {
      ok: false,
      reason: "Chhote harf se shuru, 4 se 20 tak. Sirf harf, hindse, nuqta aur underscore.",
    };
  }

  const service = createServiceClient();
  const [{ data: reserved }, { data: taken }] = await Promise.all([
    service.from("reserved_usernames").select("name").eq("name", name).maybeSingle(),
    service.from("farmers").select("id").eq("username", name).eq("is_deleted", false).maybeSingle(),
  ]);

  if (reserved) return { ok: false, reason: "Ye naam nahi mil sakta." };
  if (taken) return { ok: false, reason: "Ye naam pehle se kisi aur ka hai." };
  return { ok: true };
}

/**
 * User ID aur password rakhna.
 *
 * Naam database ke us function se rakha jata hai jo teenon baatein ek
 * hi lamhe mein dekhta hai (shakl, mahfooz naam, duplicate). Password
 * us ke BAAD lagta hai -- naam na mile to password lagane ka koi matlab
 * nahi.
 */
export async function setFarmerUsername(
  _prev: UsernameState,
  formData: FormData
): Promise<UsernameState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (password.length < 6) return { error: "Password kam az kam chhe harf ka rakhein." };
  if (password !== confirm) return { error: "Dono password ek jaise nahi hain." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: nateeja, error } = await supabase.rpc("fn_set_farmer_username", {
    p_username: username,
  });
  if (error) return { error: "User ID nahi ban saki. Dobara koshish karein." };

  const jumla: Record<string, string> = {
    koi_kisan_nahi: "Aap ka kisan khata nahi mila.",
    pehle_se_bana: "Aap ki User ID pehle se bani hui hai. Badalni ho to daftar se raabta karein.",
    shakl_ghalat: "Chhote harf se shuru, 4 se 20 tak. Sirf harf, hindse, nuqta aur underscore.",
    mahfooz_naam: "Ye naam nahi mil sakta.",
    kisi_aur_ka: "Ye naam abhi abhi kisi aur ne le liya. Koi doosra naam rakhein.",
  };
  if (nateeja !== "ok") return { error: jumla[nateeja as string] ?? "User ID nahi ban saki." };

  // Password ab lagta hai. Naam pehle mil chuka -- warna banda password
  // bana leta aur naam kisi aur ka nikalta.
  const service = createServiceClient();
  const { error: passError } = await service.auth.admin.updateUserById(user.id, { password });
  if (passError) {
    return {
      error:
        "User ID ban gayi magar password set nahi hua. Daftar se raabta karein — abhi OTP se login karte rahein.",
    };
  }

  return { success: true, username };
}

/**
 * User ID aur password se login.
 *
 * Ye server par hota hai, browser mein nahi -- aur is ki ek pakki wajah
 * hai. Andar ka login email kisan ke MOBILE se banta hai
 * (3001234567@phone.agribridge.local). Agar browser ko ye pata chalne
 * diya jaye ke kis User ID ka kaunsa email hai, to koi bhi naam ka
 * andaza laga kar us bande ka mobile number nikal sakta hai. Wo email
 * yahan se bahar nahi jata.
 */
export async function loginWithUsername(
  _prev: FarmerAuthState,
  formData: FormData
): Promise<FarmerAuthState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "User ID aur password dono likhein." };

  const service = createServiceClient();
  const { data: farmer } = await service
    .from("farmers")
    .select("user_id")
    .eq("username", username)
    .eq("is_deleted", false)
    .maybeSingle();

  // Naam na mile to bhi wohi jumla jo ghalat password par aata hai.
  // Alag jumla dena kisi ko ye batata hai ke kaunsi User ID maujood hai
  // aur kaunsi nahi -- aur wo fehrist banane ka pehla qadam hota hai.
  const ghalat = { error: "Ghalat User ID ya password." };
  if (!farmer?.user_id) return ghalat;

  const { data: authUser } = await service.auth.admin.getUserById(farmer.user_id as string);
  const email = authUser?.user?.email;
  if (!email) return ghalat;

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return ghalat;

  return { success: true };
}
