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

export interface SidebarMode {
  /** Is bande ko poori sidebar milti hai ya nahi. */
  showSidebar: boolean;
  /** Ye banda Master Admin hai (poori ERP navigation ka haqdar). */
  isMaster: boolean;
}

export async function sidebarModeFor(role: string): Promise<SidebarMode> {
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
      return { showSidebar: true, isMaster: isMasterByDefault };
    }

    const roles = Array.isArray(value.master_roles)
      ? value.master_roles.filter((r): r is string => typeof r === "string")
      : DEFAULT_MASTER_ROLES;

    const isMaster = roles.includes(role);
    return { showSidebar: isMaster, isMaster };
  } catch {
    return { showSidebar: true, isMaster: isMasterByDefault };
  }
}
