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


/**
 * Apne hi profile ka wo khana badalna jo banda khud badal sakta hai.
 *
 * =====================================================================
 * FEHRIST BANDHI HUI KYUN HAI
 * =====================================================================
 *
 * Ye function bhi service client se likhta hai -- yani RLS is ke raaste
 * mein nahi. Aur wohi baat ise khatarnaak bana sakti thi: agar ye kisi
 * bhi khane ko qubool karta, to koi bhi apna `role` "owner" likh kar
 * poore karobar ka darwaza khol leta.
 *
 * Is liye khane ki fehrist YAHAN bandhi hui hai, bulane wale ke haath
 * mein nahi. `role`, `is_active`, `branch_id`, `shop_id`, `extra_roles`
 * -- ye sab is fehrist mein nahi hain aur na kabhi honge; wo doosre
 * bande ka faisla hain, apna nahi.
 *
 * Aur banda hamesha `auth.uid()` se aata hai -- form se nahi. Jo cheez
 * bheji hi nahi ja sakti, us se dhoka bhi nahi ho sakta.
 */
const APNE_KHANE = ["training_mode", "ui_mode", "language", "theme"] as const;
type ApnaKhana = (typeof APNE_KHANE)[number];

export async function apnaKhanaBadlein(
  userId: string,
  patch: Partial<Record<ApnaKhana, unknown>>
): Promise<{ error?: string }> {
  if (!userId) return { error: "Login zaroori hai." };

  const saaf: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if ((APNE_KHANE as readonly string[]).includes(k)) saaf[k] = v;
  }
  if (Object.keys(saaf).length === 0) {
    return { error: "Ye khana apne aap badalne walon mein nahi hai." };
  }

  return profileKaKhanaBadlein(userId, saaf);
}


/**
 * Ek se zyada bandon ka ek hi khana.
 *
 * Alag se is liye ke tasdeeq ka sawal yahan alag hai: kitne badle,
 * kitne maange gaye the. Chup chaap kam badalna wohi kharabi hai jis ne
 * Users ka safha bekaar kar rakha tha -- bas ginti mein.
 */
export async function bohatKeKhaneBadlein(
  userIds: string[],
  patch: Record<string, unknown>
): Promise<{ badle: number; error?: string }> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return { badle: 0, error: "Koi banda chuna hi nahi gaya." };

  const service = createServiceClient();
  const { data, error } = await service.from("profiles").update(patch).in("id", ids).select("id");
  if (error) return { badle: 0, error: error.message };

  const badle = data?.length ?? 0;
  if (badle === 0) {
    return { badle: 0, error: "Kuch mehfooz nahi hua — ye bande mile hi nahi. Safha taza karein." };
  }
  if (badle < ids.length) {
    // Aadha kaam ho jana bhi khabar hai. Khamoshi se "ho gaya" kehna wo
    // ghalti hai jis ka pata mahine baad chalta hai.
    return {
      badle,
      error: `${ids.length} mein se sirf ${badle} par lagi — baqi ${ids.length - badle} nahi mile. Safha taza kar ke dobara dekhein.`,
    };
  }
  return { badle };
}
