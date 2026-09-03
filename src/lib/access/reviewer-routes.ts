/**
 * Ijazat ki darkhwastein kaun khol sakta hai -- EK jagah.
 *
 * Ye shart teen jagah honi paRti hai: safhe ke andar (page.tsx), menu
 * banate waqt (nav.ts) aur raaste ki rok par (middleware.ts). Pehle ye
 * teenon apna apna hisaab lagate the, aur nateeja ye nikla ke Manager ko
 * card to nazar aata tha magar click par wapas My Work par phenk diya
 * jata tha -- menu "haan" keh raha tha, rok "nahi".
 *
 * Database mein yehi shart `fn_can_review_access()` hai. Yahan us ki
 * naql hai, taake code ke teenon darwaze ek hi baat kahen.
 */

export const ACCESS_REVIEW_ROUTE = "/admin/access-requests";

/** Owner/super_admin/admin waise hi har jagah khule hain (unrestricted). */
export function roleCanReviewAccess(role: string): boolean {
  return ["owner", "super_admin", "admin", "manager"].includes(role);
}

export interface HeadGrantWindow {
  starts_at?: string | null;
  expires_at?: string | null;
}

/**
 * Department head ka ikhtiyar abhi chal raha hai ya nahi.
 *
 * Waqt ka lihaz jaan boojh kar: chhutti par gaye kisi ki jagah banaya
 * gaya head hamesha ke liye head nahi rehna chahiye.
 */
export function headGrantActive(grant: HeadGrantWindow | null | undefined, now = Date.now()): boolean {
  if (!grant) return false;
  if (grant.starts_at && new Date(grant.starts_at).getTime() > now) return false;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) return false;
  return true;
}
