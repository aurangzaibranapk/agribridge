import { createServiceClient } from "@/lib/supabase/service";
import { loadRegistry, featureForPath, type Registry } from "@/lib/access/registry";
import type { Lang } from "@/lib/i18n/translations";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { homePageForRole } from "@/lib/departments";
import { ADMIN_NAV_GROUPS } from "@/components/layout/nav-items";
import { ACCESS_REVIEW_ROUTE, roleCanReviewAccess, headGrantActive } from "@/lib/access/reviewer-routes";

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
  /** Card ka doosra jumla (250). Khali ho sakta hai. */
  description?: string | null;
  /**
   * Group ke andar chhoti sarkhi (174). Khali ho to item sidha group ke
   * neeche aata hai -- purane group waise ke waise chalte hain.
   */
  section?: string | null;
}

export interface NavGroupData {
  key: string;
  label: string;
  /** Department card ke liye: nishan aur doosra jumla (131). */
  icon?: string | null;
  description?: string | null;
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
//
// "Mera Kaam" is fehrist mein is liye hai ke wo har staff ka ghar hai
// (131). Us par rok lagana ka matlab hota: login ke foran baad "ijazat
// nahi" ka safha -- aur wahan se aage koi raasta nahi.
//
// Us par kuch chhupane ka khatra bhi nahi: wo safha khud kuch nahi
// dikhata, sirf wo card dikhata hai jin ki ijazat pehle se hai.
const ALWAYS = [
  "/admin/academy",
  "/admin/my-access","/admin/permissions-denied", "/admin/my-attendance", "/admin/my-work"];

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
      icon: d.icon,
      description: d.description,
      // Sarkhi ki tarteeb pehle, phir usi sarkhi ke andar wohi purani
      // tarteeb. Koi safha hata nahi -- sirf saath waalon ke paas aa
      // gaya hai.
      items: (registry.byDashboard.get(d.key) ?? [])
        .filter((key) => visible == null || visible.has(key))
        .map((key, index) => {
          const f = registry.features.get(key);
          const sec = registry.sectionByLink.get(`${d.key}::${key}`);
          return f ? { f, index, section: sec?.section ?? null, sectionOrder: sec?.order ?? 0 } : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => a.sectionOrder - b.sectionOrder || a.index - b.index)
        .map((x) => ({
          href: x.f.route,
          label: x.f.label,
          icon: x.f.icon,
          description: x.f.description,
          section: x.section,
        })),
    }))
    .filter((g) => g.items.length > 0);
}

export async function loadNav(profileId: string, role: string, lang: Lang = "rm"): Promise<NavResult> {
  const unrestricted = UNRESTRICTED_ROLES.includes(role);
  const service = createServiceClient();

  let registry: Registry;
  try {
    registry = await loadRegistry(lang);
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

  // Ijazat ki darkhwastein (270/271): safha khud Manager aur Department
  // Head ko khulta hai, magar raaste ki rok sirf feature permission se
  // banti thi -- aur is feature ki permission kisi role ke paas nahi thi.
  // Shart ab reviewer-routes.ts mein ek jagah hai (menu, rok aur safha
  // teenon wahi parhte hain).
  if (roleCanReviewAccess(role)) {
    routes.add(ACCESS_REVIEW_ROUTE);
    visible.add("access-requests");
  } else {
    const { data: headGrant } = await service
      .from("department_head_grants")
      .select("starts_at, expires_at")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (headGrantActive(headGrant)) {
      routes.add(ACCESS_REVIEW_ROUTE);
      visible.add("access-requests");
    }
  }

  // Nayi ijazat kahin se bhi na mile to purane raaste par chalte hain --
  // warna wo banda apne hi system se bahar ho jata hai.
  if (visible.size === 0) {
    const { data: profile } = await service
      .from("profiles")
      .select("allowed_pages, extra_roles")
      .eq("id", profileId)
      .maybeSingle();
    const own = (profile?.allowed_pages as string[] | null) ?? [];

    let pages = own;
    if (pages.length === 0) {
      // Apna department AUR jo doosre diye gaye hon (193). Menu aur rok
      // ek hi hisaab par chalte hain -- warna banda menu mein cheez
      // dekhta aur khol nahi pata, ya us se ulta.
      const { data: rolePerm } = await service
        .from("role_page_permissions")
        .select("allowed_pages")
        .in("role", [role, ...((profile?.extra_roles as string[] | null) ?? [])]);
      pages = [...new Set((rolePerm ?? []).flatMap((r) => (r.allowed_pages as string[] | null) ?? []))];
    }

    const allowed = new Set([...ALWAYS, ...pages]);
    // Sahara wale raaste par bhi head/manager ki darkhwastein khuli rahen.
    if (routes.has(ACCESS_REVIEW_ROUTE)) allowed.add(ACCESS_REVIEW_ROUTE);
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
