import { redirect } from "next/navigation";

/**
 * "Ek Banday ki Ijazat" ab `/admin/staff-access` hai.
 *
 * =====================================================================
 * IJAZAT KE DO NIZAM EK SATH CHAL RAHE THE
 * =====================================================================
 *
 * Malik (6 September): *"Haan dono karo, migration bhi banao."*
 *
 * | Safha | Kahan likhta tha | Kya deta tha |
 * |---|---|---|
 * | Ye (purana) | `profiles.allowed_pages` | sirf "safha khulta hai" |
 * | `/admin/staff-access` | `user_feature_permissions` | safha AUR us par kaam |
 *
 * Dono ek hi sawal ka jawab dete the — "is bande ko kya khulta hai" —
 * magar do alag khaanon mein likhte the. Middleware dono parhta tha:
 * pehle naya, aur naya bilkul khali ho to purana.
 *
 * Migration 354 ne purani ijazat nayi fehrist mein naqal kar di, aur us
 * ke baad ye safha sirf ek doosra naam reh gaya.
 *
 * Safha mitaya nahi gaya, MOR diya gaya: access-requests aur AI ke
 * mashware is raaste par bhejte hain, aur mita dene se wo har jagah
 * "safha nahi mila" dikhate.
 *
 * `actions/permissions.ts` abhi apni jagah hai — us mein kuch aur kaam
 * bhi hain (conflicts, purani ijazat saaf karna) jo doosre safhe
 * bulate hain.
 */
export default function PermissionsRedirect() {
  redirect("/admin/staff-access");
}
