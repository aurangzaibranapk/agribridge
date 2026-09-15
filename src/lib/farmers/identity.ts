import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Kisan kis darwaze se aaya.
 *
 * SELF     website ya app par khud bana
 * STAFF    daftar, counter, chiller, ya booking ke waqt hamare bande ne banaya
 * WHATSAPP pehli baar WhatsApp par paigham bhejne se khud ban gaya
 */
export type RegistrationSource = "SELF" | "STAFF" | "WHATSAPP";

export interface FarmerMatch {
  id: string;
  farmerCode: string;
  fullName: string | null;
  phoneNumber: string | null;
}

/**
 * Mobile number ki asal: aakhri das hindse.
 *
 * Yahi hisaab database bhi karta hai (fn_phone_key, migration 124). Do
 * jagah ek hi hisaab rakhna acha nahi lagta, magar yahan zaroorat hai:
 * database ka pehra sirf likhte waqt kaam aata hai, aur us se pehle
 * screen par ye batana hota hai ke "ye number to pehle se kisi ka hai" --
 * bina qatar banaye.
 *
 * Das se kam hindse ho to null. Aisa number kisi ki pehchan nahi, aur us
 * par pehra lagaya jaye to alag alag logon ko ek bana dega.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/**
 * Ye number pehle se kis ka hai?
 *
 * Saaton darwaze yahi poochte hain. Pehle har darwaze ka apna sawal tha --
 * kisi ne poora number milaya, kisi ne aakhri nau hindse, aur do ne
 * poochha hi nahi -- to jawab bhi alag alag aata tha aur ek hi banda kai
 * khaton mein bat jata tha.
 */
export async function findFarmerByPhone(client: Client, phone: string | null | undefined): Promise<FarmerMatch | null> {
  const key = phoneKey(phone);
  if (!key) return null;

  const { data } = await client.rpc("fn_find_farmer_by_phone", { p_phone: key });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    id: row.id,
    farmerCode: row.farmer_code,
    fullName: row.full_name ?? null,
    phoneNumber: row.phone_number ?? null,
  };
}

/**
 * Ek hi jumla, har darwaze par.
 *
 * Naam jaan boojh kar shamil hai: sirf number bata dene se counter par
 * khare bande ko ye maloom nahi hota ke kis ka khata khul chuka hai, aur
 * wo aksar naya bana deta hai.
 */
export function alreadyRegisteredMessage(match: FarmerMatch): string {
  const name = match.fullName ? ` — ${match.fullName}` : "";
  return `Ye mobile ${match.farmerCode}${name} ke naam se registered hai.`;
}
