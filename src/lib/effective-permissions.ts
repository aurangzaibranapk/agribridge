import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES, homePageForRole } from "@/lib/departments";

/**
 * Kisi shakhs ko waqai kaun se safhe khulte hain.
 *
 * Do darje hain, is tarteeb mein:
 *   1. Shakhs ka apna set (profiles.allowed_pages) -- agar bhara hua ho
 *   2. Us ke department ka set (role_page_permissions)
 *
 * Shakhs ka apna set khali chhorna aam soorat hai: naya banda aata hai,
 * department mein daal diya jata hai, aur us ka kaam foran chal parta
 * hai. Kisi ek ko kuch zyada ya kam dena ho, tab hi us ka apna set
 * bharte hain -- aur phir wo department se bhaari rehta hai.
 *
 * Faisla karne wala hissa (accessFrom) jaan boojh kar khali function
 * hai, jo kahin se bhi bulaya ja sakta hai. Rok middleware mein lagti
 * hai aur menu sidebar mein banta hai; agar hisaab do jagah alag alag
 * likha hota to ek din dono alag baat kehne lagte -- banda menu mein
 * cheez dekhta magar khol na pata, ya us se ulta.
 */

const ALWAYS_ALLOWED = ["/admin/permissions-denied", "/admin/my-attendance"];

export interface EffectiveAccess {
  unrestricted: boolean;
  pages: string[];
}

/** Khalis hisaab -- koi database nahi. */
export function accessFrom(role: string, ownPages: string[] | null, rolePages: string[] | null): EffectiveAccess {
  if (UNRESTRICTED_ROLES.includes(role)) return { unrestricted: true, pages: [] };
  const chosen = ownPages && ownPages.length > 0 ? ownPages : (rolePages ?? []);
  // Apna department ka dashboard hamesha khulta hai. Ise ijazat ki
  // fehrist mein daalna bhool jana bohot aasan hota, aur us soorat mein
  // banda login ke foran baad hi rok par ja takrata -- pehli hi cheez
  // jo wo dekhta, wo "ijazat nahi" hoti.
  return { unrestricted: false, pages: [...ALWAYS_ALLOWED, homePageForRole(role), ...chosen] };
}

/**
 * Server component ke liye -- department ka set khud le aata hai.
 *
 * Ek bande ke ek se ziyada department ho sakte hain (193). Un sab ke
 * safhe JORE jate hain, kisi ek ko chuna nahi jata: doosra department
 * dene ka poora maqsad hi ye hai ke pehla band na ho.
 */
export async function effectiveAccess(
  role: string,
  ownPages: string[] | null,
  extraRoles: string[] = []
): Promise<EffectiveAccess> {
  if (UNRESTRICTED_ROLES.includes(role)) return { unrestricted: true, pages: [] };
  if (ownPages && ownPages.length > 0) return accessFrom(role, ownPages, null);

  const service = createServiceClient();
  const { data } = await service
    .from("role_page_permissions")
    .select("allowed_pages")
    .in("role", [role, ...extraRoles]);

  const pages = (data ?? []).flatMap((r) => (r.allowed_pages as string[] | null) ?? []);
  return accessFrom(role, null, [...new Set(pages)]);
}

/** Safha khulta hai ya nahi. Neeche ke safhe bhi khulte hain (/a → /a/b). */
export function canOpen(access: EffectiveAccess, pathname: string): boolean {
  if (access.unrestricted) return true;
  return access.pages.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
