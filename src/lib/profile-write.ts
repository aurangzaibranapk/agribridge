import { createServiceClient } from "@/lib/supabase/service";

/**
 * Kisi bande ke profile ka khana badalna — aur ye TASDEEQ karna ke
 * waqai badla.
 *
 * =====================================================================
 * WO KHAMOSH KHARABI JIS KE LIYE YE FILE BANI
 * =====================================================================
 *
 * Malik (6 September): *"Anwar ko maine karyana par lagaya hai to kahin
 * save ka button nahi, jahan hum save kar dein."*
 *
 * Button maujood tha -- dropdown badalte hi form khud jama ho jata tha.
 * Magar Live par dekha to `shop_id` phir bhi KHALI tha, aur safhe par
 * koi ghalti bhi nazar nahi aayi.
 *
 * Wajah `profiles` table ki ijazat mein thi. Us par RLS chalu hai aur
 * SIRF EK qanoon likha hua hai:
 *
 *   own_profile — SELECT — (auth.uid() = id OR fn_is_any_staff())
 *
 * Yani PARHNE ka qanoon hai, BADALNE ka koi nahi. Aur Postgres mein RLS
 * ke peeche update NAKAAM nahi hota -- wo bas kisi qatar par lagta hi
 * nahi. Nateeja: `error` khali, `success: true`, aur database mein kuch
 * nahi badla.
 *
 * Ye ek jagah ki baat nahi thi. Isi tarah chup chaap nakaam ho rahe the:
 *
 *   * bande ki dukan (`assignUserShop`)
 *   * bande ki shaakh (`assignUserBranch`)
 *   * bande ka department/role (`updateUserRole`)
 *   * doosre department (`updateUserExtraRoles`)
 *   * account chaalu/band (`toggleUserActive`)
 *
 * Yani Users ka poora safha dekhne mein chalta tha aur amal mein kuch
 * nahi karta tha.
 *
 * =====================================================================
 * DO CHEEZEIN, AUR DONO ZAROORI
 * =====================================================================
 *
 * 1. **Service client se likhna.** Ye kaam pehle hi code mein Owner /
 *    Admin tak mehdood hain (har bulane wala apna gate laga kar aata
 *    hai). RLS ka qanoon likhne se masla hal hota, magar tab bhi doosri
 *    baat baqi rehti:
 *
 * 2. **Ginti ki tasdeeq.** `.select("id")` se ye poochha jata hai ke
 *    waqai kitni qatarein badlin. Sifar ka matlab "ho gaya" nahi hota --
 *    aur yehi wo farq hai jis ne malik ka aadha ghanta khaya. Ab sifar
 *    par saaf ghalti wapas jati hai.
 */
export async function profileKaKhanaBadlein(
  userId: string,
  patch: Record<string, unknown>
): Promise<{ error?: string }> {
  if (!userId) return { error: "Banda maloom nahi." };

  const service = createServiceClient();
  const { data, error } = await service.from("profiles").update(patch).eq("id", userId).select("id");

  if (error) return { error: error.message };

  // Khali jawab = kuch nahi badla. Isay khamoshi se qubool karna wohi
  // ghalti hai jo is file ki wajah bani.
  if (!data || data.length === 0) {
    return {
      error:
        "Kuch mehfooz nahi hua — ye banda mila hi nahi (ya us ki qatar par ijazat nahi lagi). Safha taza karein; masla rahe to batayein.",
    };
  }

  return {};
}
