import { createServiceClient } from "@/lib/supabase/service";

/**
 * Dashboards aur features ki fehrist -- database se.
 *
 * Pehle ye fehrist code mein thi (nav-items.ts). Do kharabiyan is se
 * paida hoti thin: ek hi cheez kai jagah likhi jati thi ("AgriBridge
 * Ordering" chaar jagah), aur kuch bhi badalne ke liye poora build aur
 * deploy ka chakkar chalta tha.
 *
 * Ab har feature ek hi jagah hai. Ek feature kai dashboard par nazar aa
 * sakta hai, magar rehta ek hi jagah: na naql banti hai, na do jagah ka
 * data alag hota hai.
 */

export interface FeatureRow {
  key: string;
  label: string;
  route: string;
  icon: string | null;
  isSensitive: boolean;
}

export interface DashboardRow {
  key: string;
  label: string;
  icon: string | null;
  summary: string | null;
  sortOrder: number;
}

export interface Registry {
  dashboards: DashboardRow[];
  features: Map<string, FeatureRow>;
  /** dashboard key → feature keys, tarteeb ke sath. */
  byDashboard: Map<string, string[]>;
  /** feature key → un dashboards ki fehrist jin par wo laga hua hai. */
  dashboardsOf: Map<string, string[]>;
  /** route → feature key (rok lagane ke liye ulta raasta). */
  byRoute: Map<string, string>;
}

export async function loadRegistry(): Promise<Registry> {
  const service = createServiceClient();

  const [{ data: dashboards }, { data: features }, { data: links }] = await Promise.all([
    service.from("dashboards").select("key, label, icon, summary, sort_order").eq("is_active", true).order("sort_order"),
    service.from("features").select("key, label, route, icon, is_sensitive").eq("is_active", true).order("label"),
    service.from("dashboard_features").select("dashboard_key, feature_key, sort_order").order("sort_order"),
  ]);

  const featureMap = new Map<string, FeatureRow>();
  const byRoute = new Map<string, string>();
  for (const f of features ?? []) {
    featureMap.set(f.key, {
      key: f.key,
      label: f.label,
      route: f.route,
      icon: f.icon,
      isSensitive: f.is_sensitive,
    });
    byRoute.set(f.route, f.key);
  }

  const byDashboard = new Map<string, string[]>();
  const dashboardsOf = new Map<string, string[]>();
  for (const link of links ?? []) {
    // Band ya mita hua feature raasta na rok de.
    if (!featureMap.has(link.feature_key)) continue;
    byDashboard.set(link.dashboard_key, [...(byDashboard.get(link.dashboard_key) ?? []), link.feature_key]);
    dashboardsOf.set(link.feature_key, [...(dashboardsOf.get(link.feature_key) ?? []), link.dashboard_key]);
  }

  return {
    dashboards: (dashboards ?? []).map((d) => ({
      key: d.key,
      label: d.label,
      icon: d.icon,
      summary: d.summary,
      sortOrder: d.sort_order,
    })),
    features: featureMap,
    byDashboard,
    dashboardsOf,
    byRoute,
  };
}

/**
 * Raaste se feature dhoondna.
 *
 * Sab se lamba milta hua raasta jeetta hai: /admin/milk-collection/chiller
 * ko /admin/milk-collection samajh lena us shakhs ko chiller khol deta
 * jise sirf collection ki ijazat thi.
 */
export function featureForPath(registry: Registry, pathname: string): string | null {
  let best: string | null = null;
  let bestLength = -1;
  for (const [route, key] of registry.byRoute) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      if (route.length > bestLength) {
        best = key;
        bestLength = route.length;
      }
    }
  }
  return best;
}
