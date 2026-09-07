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
 * Malik ka pehla usool (5 September) ye tha: "1-10 permissions: sidebar
 * nahi, 10 se zyada: sidebar khud aa jaye." Malik ne 7 September ko ye
 * badal diya: *"sabko hamesha sidebar chahiye"* -- kam features wale
 * staff (Anwar jaisa, 10 features) ko bhi ab chhoti sidebar milti hai,
 * itemCount ka hisaab nahi lagaya jata. Purana threshold isi liye ab
 * istemal nahi hota -- yahan sirf yaadgaar chhoड़ा gaya hai.
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

    // Malik (7 September): "sabko hamesha sidebar chahiye" -- kam
    // features wala staff bhi ab chhoti "work" sidebar leta hai, ginti
    // ka hisaab nahi lagaya jata. itemCount parameter ab sirf caller ke
    // liye rakha hua hai (aane wale kal kisi wajah se dobara chahiye ho).
    void itemCount;
    return { kind: "work", showSidebar: false, isMaster: false };
  } catch {
    // Setting na mile to purani sidebar chalti hai -- navigation ka
    // ghayab ho jana poore daftar ko rok deta hai.
    return { kind: "full", showSidebar: true, isMaster: isMasterByDefault };
  }
}
