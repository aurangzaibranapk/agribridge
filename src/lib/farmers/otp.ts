import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-client";
import { sendMilkSms } from "@/lib/sms";
import { phoneKey } from "@/lib/farmers/identity";

/**
 * Kisan ke login ka OTP -- banana aur bhejna.
 *
 * DO RAASTE, IS TARTEEB SE. Pehle WhatsApp, kyunke wo pehle se chal raha
 * hai aur us ka koi alag kharcha nahi -- kisan ko bill wahin milta hai.
 * Wo na jaye to SMS, kyunke har phone par WhatsApp nahi hota.
 *
 * WhatsApp par OTP SAADE MATN se nahi jata. Meta saada matn sirf us
 * soorat mein pahunchata hai jab bande ne pichhle chaubees ghante mein
 * khud hamein likha ho -- aur OTP to usay bhejna hai jis ne kuch nahi
 * likha. Is liye yahan manzoor shuda template chahiye. Wo Meta ke
 * daftar se manzoor hota hai, code se nahi; is liye us ka naam bahar
 * (env) se aata hai aur na ho to ye raasta chup chaap chhoR diya jata
 * hai.
 *
 * CODE KAHIN LIKHA NAHI JATA. Qatar mein sirf us ka hash jata hai
 * (197). Ye function usay bhejne ke baad bhool jata hai -- na log mein,
 * na jawab mein.
 */

/** OTP dobara maangne se pehle itni der. */
const COOLDOWN_SECONDS = 60;
/** Ek ghante mein itni dafa se ziyada nahi. */
const PER_HOUR_LIMIT = 5;
/** OTP itni der ka mehmaan hai. */
const VALID_MINUTES = 5;

export type OtpRequest =
  | { ok: true; sentVia: "whatsapp" | "sms"; phoneKey: string }
  | { ok: false; error: string; retryAfterSeconds?: number };

function sixDigits(): string {
  // Math.random() yahan kaafi nahi. Ye chaabi hai, aur chaabi ka andaza
  // lagaya ja sakna us ki sab se buri khaami hoti hai.
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

/**
 * Naya OTP bana kar bhejo.
 *
 * Jawab mein code kabhi nahi jata -- sirf ye ke gaya ya nahi, aur kis
 * raaste se.
 *
 * `prefer` banda khud chunta hai. Default WhatsApp hai (upar wali wajah),
 * magar jis ke phone par WhatsApp hai hi nahi -- ya jise wahan code aata
 * hi nahi -- us ke liye SMS pehle chalaya ja sakta hai. Chunav sirf
 * TARTEEB badalta hai, doosra raasta band nahi karta: agar chuna hua
 * raasta nakaam ho to doosra phir bhi aazmaya jata hai, warna banda
 * apne hi chunav ki wajah se bahar reh jata.
 */
export async function sendFarmerOtp(
  rawPhone: string,
  prefer: "whatsapp" | "sms" = "whatsapp"
): Promise<OtpRequest> {
  const key = phoneKey(rawPhone);
  if (!key) return { ok: false, error: "Mobile number poora likhein — gyarah hindse." };

  const service = createServiceClient();

  // Kitni jaldi jaldi maanga ja raha hai. Ye rok is liye hai ke ek
  // number par baar baar OTP bhejna hamara paisa bhi kharch karta hai
  // aur us bande ka phone bhi bharta hai jis ne kuch maanga hi nahi.
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await service
    .from("farmer_login_otps")
    .select("created_at")
    .eq("phone_key", key)
    .gte("created_at", sinceHour)
    .order("created_at", { ascending: false });

  const rows = recent ?? [];
  if (rows.length >= PER_HOUR_LIMIT) {
    return { ok: false, error: "Bohot dafa koshish ho chuki. Ek ghante baad dobara try karein." };
  }
  if (rows.length > 0) {
    const gap = (Date.now() - new Date(rows[0].created_at as string).getTime()) / 1000;
    if (gap < COOLDOWN_SECONDS) {
      return {
        ok: false,
        error: `Thora intezar karein — ${Math.ceil(COOLDOWN_SECONDS - gap)} second baad dobara bhej sakte hain.`,
        retryAfterSeconds: Math.ceil(COOLDOWN_SECONDS - gap),
      };
    }
  }

  const code = sixDigits();

  // Qatar PEHLE banti hai, bhejne se pehle.
  //
  // Ulta karte -- pehle bhejte, phir likhte -- to us lamhe mein jab
  // paighaam chala jaye aur likhna nakaam ho, kisan ke haath mein ek
  // code hota jise hamara nizam jaanta hi nahi. Wo shikayat kabhi hal
  // nahi hoti.
  // Hash database ke andar banta hai. Code is server ki yaad se bahar
  // kisi qatar mein khula nahi girta -- ek hi qadam mein qatar bhi banti
  // hai aur hash bhi (197).
  const { data: otpId, error: makeError } = await service.rpc("fn_create_farmer_otp", {
    p_phone_key: key,
    p_code: code,
    p_minutes: VALID_MINUTES,
  });

  if (makeError || !otpId) {
    return { ok: false, error: "OTP nahi bana. Dobara koshish karein." };
  }

  const text = `${code} — Al Rana Traders ke portal mein daakhil hone ka code. ${VALID_MINUTES} minute tak chalega. Kisi ko na batayein.`;
  let sentVia: "whatsapp" | "sms" | null = null;
  const problems: string[] = [];

  const tryWhatsapp = async () => {
    const template = process.env.WHATSAPP_OTP_TEMPLATE;
    if (!template) {
      problems.push("whatsapp: OTP ka template set nahi hai (WHATSAPP_OTP_TEMPLATE)");
      return;
    }
    try {
      await sendWhatsAppTemplate(rawPhone, template, process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? "en", [code], code);
      sentVia = "whatsapp";
    } catch (e) {
      problems.push(`whatsapp: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const trySms = async () => {
    const sms = await sendMilkSms(rawPhone, text);
    if (sms.sent) sentVia = "sms";
    else problems.push(`sms: ${sms.reason ?? "nahi gaya"}`);
  };

  // Chuna hua raasta pehle, doosra sahare ke tor par.
  const order = prefer === "sms" ? [trySms, tryWhatsapp] : [tryWhatsapp, trySms];
  for (const attempt of order) {
    if (sentVia) break;
    await attempt();
  }

  await service
    .from("farmer_login_otps")
    .update({ sent_via: sentVia, send_error: problems.length > 0 ? problems.join(" | ") : null })
    .eq("id", otpId as string);

  if (!sentVia) {
    // Jhoot nahi bola jata. Purana nizam har paighaam ko "bheja gaya"
    // likh deta tha aur kisan ke paas kuch nahi pahunchta -- wo shikayat
    // kabhi hal nahi hoti thi kyunke record khud ghalat tha.
    return {
      ok: false,
      error:
        "OTP nahi bheja ja saka — na WhatsApp se, na SMS se. Daftar se raabta karein.",
    };
  }

  return { ok: true, sentVia, phoneKey: key };
}
