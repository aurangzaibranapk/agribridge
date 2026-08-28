import { createServiceClient } from "@/lib/supabase/service";
import { loadRegistry, featureForPath, type Registry } from "@/lib/access/registry";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { homePageForRole } from "@/lib/departments";
import { ADMIN_NAV_GROUPS } from "@/components/layout/nav-items";

/**
 * Menu database se banta hai -- ab code se nahi.
 *
 * Group ab "Dashboard" hain (Milk, Finance, Fleet...), aur un ke andar
 * wahi feature jo is banday ko khulte hain. Ek hi feature kai group mein
 * nazar aa sakta hai, magar hai wo ek hi cheez.
 *
 * SAHARA (fallback): agar database se kuch na aaye -- table khali ho,
 * connection na bane, ya kisi ne galti se sab hata diya ho -- to purana
 * code wala menu chal parta hai. Ye ehtiyat jaan boojh kar hai: menu ka
 * ghayab ho jana matlab poora daftar ruk jana, aur us waqt wajah dhoondna
 * bohot mushkil hota hai. Ghalat menu se khali menu kahin bura hai.
 */

export interface NavEntry {
  href: string;
  label: string;
  /** Icon ka naam -- component client ki taraf banta hai. */
  icon: string | null;
}

export interface NavGroupData {
  key: string;
  label: string;
  items: NavEntry[];
}

export interface NavResult {
  groups: NavGroupData[];
  /** Jin raaston par ye banda ja sakta hai. */
  allowedRoutes: string[];
  unrestricted: boolean;
  /** Database se nahi bana -- purane menu par chala. */
  usedFallback: boolean;
}

/** Ye hamesha khulte hain, chahe ijazat mein likhe hon ya na hon. */
const ALWAYS = ["/admin/permissions-denied", "/admin/my-attendance"];

function fallbackGroups(allowed: Set<string> | null): NavGroupData[] {
  return ADMIN_NAV_GROUPS.map((g) => ({
    key: g.label,
    label: g.label,
    items: g.items
      .filter((i) => allowed == null || allowed.has(i.href))
      .map((i) => ({ href: i.href, label: i.label, icon: i.icon.displayName ?? null })),
  })).filter((g) => g.items.length > 0);
}

function groupsFromRegistry(registry: Registry, visible: Set<string> | null): NavGroupData[] {
  return registry.dashboards
    .map((d) => ({
      key: d.key,
      label: d.label,
      items: (registry.byDashboard.get(d.key) ?? [])
        .filter((key) => visible == null || visible.has(key))
        .map((key) => registry.features.get(key))
        .filter((f): f is NonNullable<typeof f> => !!f)
        .map((f) => ({ href: f.route, label: f.label, icon: f.icon })),
    }))
    .filter((g) => g.items.length > 0);
}

export async function loadNav(profileId: string, role: string): Promise<NavResult> {
  const unrestricted = UNRESTRICTED_ROLES.includes(role);
  const service = createServiceClient();

  let registry: Registry;
  try {
    registry = await loadRegistry();
  } catch {
    return { groups: fallbackGroups(null), allowedRoutes: [], unrestricted, usedFallback: true };
  }

  if (registry.features.size === 0) {
    return { groups: fallbackGroups(null), allowedRoutes: [], unrestricted, usedFallback: true };
  }

  if (unrestricted) {
    return {
      groups: groupsFromRegistry(registry, null),
      allowedRoutes: [],
      unrestricted: true,
      usedFallback: false,
    };
  }

  const { data: rows } = await service
    .from("v_user_feature_access")
    .select("feature_key, route, actions")
    .eq("profile_id", profileId);

  const visible = new Set<string>();
  // Apna department dashboard bhi khulta hai -- wo feature nahi, kaam ka
  // ghar hai.
  const routes = new Set<string>([...ALWAYS, homePageForRole(role)]);
  for (const row of rows ?? []) {
    if (!row.feature_key || !row.route) continue;
    const actions = (row.actions as string[] | null) ?? [];
    if (!actions.includes("view")) continue;
    visible.add(row.feature_key);
    routes.add(row.route);
  }

  // Nayi ijazat kahin se bhi na mile to purane raaste par chalte hain --
  // warna wo banda apne hi system se bahar ho jata hai.
  if (visible.size === 0) {
    const { data: profile } = await service
      .from("profiles")
      .select("allowed_pages")
      .eq("id", profileId)
      .maybeSingle();
    const own = (profile?.allowed_pages as string[] | null) ?? [];

    let pages = own;
    if (pages.length === 0) {
      const { data: rolePerm } = await service
        .from("role_page_permissions")
        .select("allowed_pages")
        .eq("role", role)
        .maybeSingle();
      pages = (rolePerm?.allowed_pages as string[] | null) ?? [];
    }

    const allowed = new Set([...ALWAYS, ...pages]);
    return {
      groups: fallbackGroups(allowed),
      allowedRoutes: [...allowed],
      unrestricted: false,
      usedFallback: true,
    };
  }

  return {
    groups: groupsFromRegistry(registry, visible),
    allowedRoutes: [...routes],
    unrestricted: false,
    usedFallback: false,
  };
}

/**
 * Rok: ye raasta khulta hai ya nahi.
 *
 * Sab se lamba milta hua raasta jeetta hai. /admin/milk-collection/chiller
 * ko /admin/milk-collection samajh lena us shakhs ko chiller khol deta
 * jise sirf collection ki ijazat thi.
 */
export function routeAllowed(allowedRoutes: string[], pathname: string): boolean {
  return allowedRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export { featureForPath };
