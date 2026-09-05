import { createServiceClient } from "@/lib/supabase/service";

/**
 * Sidebar kis ko dikhti hai.
 *
 * Malik ka faisla (locked): Master Admin ko poori ERP navigation, baqi
 * sab ko "Mera Kaam" ka safha aur upar ek chhoti patti. Koi permanent
 * sidebar nahi.
 *
 * Ye faisla database mein rakha gaya hai, code mein nahi -- taake agar
 * kisi din counter par kuch ulajh jaye to sidebar wapas lane ke liye
 * poora build wapas na karna paRe:
 *
 *   update platform_settings
 *      set value = '{"enabled": false}'::jsonb
 *    where key = 'sidebar_free_dashboards';
 *
 * ---------------------------------------------------------------------
 * Setting na mile to sidebar RAHEGI
 * ---------------------------------------------------------------------
 * Table khali ho, connection na bane, ya value kharab ho -- teenon
 * soorat mein purani sidebar chalti hai. Wajah wohi hai jo loadNav ke
 * fallback ki hai: navigation ka ghayab ho jana matlab poora daftar ruk
 * jana, aur us waqt wajah dhoondna bohot mushkil hota hai. Zyada
 * navigation dikhna, koi navigation na dikhne se kahin behtar hai.
 */

const DEFAULT_MASTER_ROLES = ["owner", "super_admin", "admin"];

/**
 * Is se ZYADA safhe hon to chhoti sidebar khud aa jati hai.
 *
 * Malik ka usool (5 September): "1-10 permissions: isi clean card
 * dashboard se kaam kare, sidebar nahi. 10 se zyada permissions:
 * dashboard same rahe, lekin us staff ke authorized modules ka dynamic
 * sidebar automatically activate ho jaye."
 *
 * Wajah saaf hai: paanch cheezon ke liye sidebar sirf jagah khaati hai
 * -- cards saamne hain, do click ki zaroorat nahi. Magar bees cheezon
 * par card ka safha khud ek fehrist ban jata hai, aur us mein se apna
 * kaam dhoondna wohi mushkil hai jis se bachne ke liye cards banaye
 * gaye the.
 */
export const SIDEBAR_MIN_ITEMS = 10;

/** Kaunsi sidebar: poori ERP, staff wali chhoti, ya koi nahi. */
export type SidebarKind = "full" | "work" | "none";

export interface SidebarMode {
  kind: SidebarKind;
  /** Purane bulane walon ke liye -- poori ERP sidebar. */
  showSidebar: boolean;
  /** Ye banda Master Admin hai (poori ERP navigation ka haqdar). */
  isMaster: boolean;
}

/**
 * @param itemCount Is bande ko kitne SAFHE khulte hain (ijazat ki ginti).
 *   Master ke liye ye bemani hai -- usay hamesha poori sidebar milti hai.
 */
export async function sidebarModeFor(role: string, itemCount = 0): Promise<SidebarMode> {
  const isMasterByDefault = DEFAULT_MASTER_ROLES.includes(role);

  try {
    const service = createServiceClient();
    const { data } = await service
      .from("platform_settings")
      .select("value")
      .eq("key", "sidebar_free_dashboards")
      .maybeSingle();

    const value = (data?.value ?? null) as { enabled?: unknown; master_roles?: unknown } | null;
    if (!value || value.enabled !== true) {
      return { kind: "full", showSidebar: true, isMaster: isMasterByDefault };
    }

    const roles = Array.isArray(value.master_roles)
      ? value.master_roles.filter((r): r is string => typeof r === "string")
      : DEFAULT_MASTER_ROLES;

    const isMaster = roles.includes(role);
    if (isMaster) return { kind: "full", showSidebar: true, isMaster: true };

    // Ginti ijazat se aati hai, role se nahi. Isi liye do bande ek hi
    // role par alag alag safha dekh sakte hain -- aur yehi theek hai:
    // sidebar us ke apne kaam ke hisaab se aati hai, us ke laqab ke
    // hisaab se nahi.
    return { kind: itemCount > SIDEBAR_MIN_ITEMS ? "work" : "none", showSidebar: false, isMaster: false };
  } catch {
    // Setting na mile to purani sidebar chalti hai -- navigation ka
    // ghayab ho jana poore daftar ko rok deta hai.
    return { kind: "full", showSidebar: true, isMaster: isMasterByDefault };
  }
}
