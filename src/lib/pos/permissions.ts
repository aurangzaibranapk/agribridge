import { loadUserAccess, can } from "@/lib/access/permissions";

/**
 * Counter par kaun kya dekh sakta hai, aur kya badal sakta hai.
 *
 * Malik ka usool (4 September): "normal Sales Staff ko Trade Price /
 * Purchase Rate zaroori nahi dikhni chahiye. Admin/authorized person
 * dekh sakta hai."
 *
 * DO ALAG SAWAL, aur inhen mila dena aam ghalti hai:
 *
 *   dekhna  -- lagat (trade rate / kharid ka rate). Ye munafe ka raaz
 *              hai. Counter par khaRa banda gahak ke saamne screen
 *              ghumata hai; wahan lagat likhi ho to wo gahak tak pahunch
 *              jati hai, aur agli dafa mol bhao usi adad par shuru hota
 *              hai.
 *   badalna -- bikri ka rate. Ye paise ka faisla hai: rate girane se
 *              maal us qeemat par chala jata hai jis ka koi record nahi
 *              hota.
 *
 * ===== AHEM =====
 * Safhe se khana chhupa dena ijazat NAHI hai. Browser se seedha checkout
 * bulaya ja sakta hai aur us mein koi bhi rate bheja ja sakta hai. Is
 * liye YEHI fehrist checkout ke andar bhi parhi jati hai (src/actions/
 * pos.ts) -- aur wahan bina ijazat wale ka bheja hua rate manzoor nahi
 * hota. Ek hi jagah likhne se dono taraf ka jawab hamesha ek rehta hai.
 */

export interface PosPermissions {
  /** Lagat (trade / kharid ka rate) nazar aayegi? */
  canSeeCost: boolean;
  /** Counter par bikri ka rate badal sakta hai? */
  canEditRate: boolean;
}

export const POS_PERMS_NONE: PosPermissions = { canSeeCost: false, canEditRate: false };

export async function loadPosPermissions(userId: string | null | undefined): Promise<PosPermissions> {
  if (!userId) return POS_PERMS_NONE;

  const access = await loadUserAccess(userId);
  if (!access) return POS_PERMS_NONE;

  // Owner / Admin par rok nahi. Baqiyon ke liye: lagat wohi dekh sakta
  // hai jo pehle se lagat wale safhe (bill se trade rate, rate master)
  // khol sakta hai -- warna ek hi baat do jagah do tarah tay hoti.
  const canSeeCost =
    access.unrestricted || can(access, "products.bill_rates", "view") || can(access, "rate-master", "view");

  // Rate badalna POS ki apni "badalna" ki ijazat se. Malik ye ijazat
  // kisi ek bande ko /admin/access se de sakte hain -- role badle
  // baghair.
  const canEditRate = access.unrestricted || can(access, "pos", "edit");

  return { canSeeCost, canEditRate };
}
