import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Phase 6: portal ka menu EK jagah. Sidebar, mobile drawer, neeche ki tab
 * bar aur breadcrumb chaaron yahi parhte hain -- pehle drawer sirf poori
 * URL par roshan hota tha, aur /portal/dairy/alerts par koi link roshan
 * nahi hota tha.
 *
 * Pure module (React/lucide nahi) -- test seedha chalta hai.
 */
export type NavIconName =
  | "dashboard" | "khata" | "bills" | "payments" | "dairy" | "hisaab" | "breeding" | "health"
  | "farms" | "crops" | "harvest" | "demand" | "campaigns" | "fertilizer" | "machinery" | "livestock"
  | "profile" | "ai";

export interface PortalNavItem { href: string; k: TranslationKey; icon: NavIconName; badge?: "reminders" }
export interface PortalNavGroup { key: "hisaab" | "dairy" | "kheti" | "services" | "account"; k: TranslationKey; items: PortalNavItem[] }

/** Kisan ka portal: 5 group, wahi 18 raaste jo phase 5 tak the (koi hata nahi). */
export const PORTAL_NAV_GROUPS: PortalNavGroup[] = [
  { key: "hisaab", k: "ph6_grp_hisaab", items: [
    { href: "/portal/dashboard", k: "nav_dashboard", icon: "dashboard" },
    { href: "/portal/wallet", k: "nav_wallet", icon: "khata" },
    { href: "/portal/c/orders", k: "pc_nav_bills_f", icon: "bills" },
    { href: "/portal/c/payments", k: "pc_nav_pay_f", icon: "payments" },
  ] },
  { key: "dairy", k: "ph6_grp_dairy", items: [
    { href: "/portal/dairy", k: "nav_dairy", icon: "dairy" },
    { href: "/portal/dairy/hisaab", k: "nav_dairy_hisaab", icon: "hisaab" },
    { href: "/portal/dairy/breeding", k: "nav_dairy_breeding", icon: "breeding", badge: "reminders" },
    { href: "/portal/dairy/health", k: "nav_dairy_health", icon: "health" },
  ] },
  { key: "kheti", k: "ph6_grp_kheti", items: [
    { href: "/portal/farms", k: "nav_farms", icon: "farms" },
    { href: "/portal/crops", k: "nav_crops", icon: "crops" },
    { href: "/portal/harvest", k: "nav_farm_management", icon: "harvest" },
  ] },
  { key: "services", k: "ph6_grp_services", items: [
    { href: "/portal/demand", k: "nav_demand", icon: "demand" },
    { href: "/portal/campaigns", k: "nav_campaigns", icon: "campaigns" },
    { href: "/portal/services/machinery", k: "nav_machinery", icon: "machinery" },
    { href: "/portal/services/livestock", k: "nav_livestock", icon: "livestock" },
  ] },
  { key: "account", k: "ph6_grp_account", items: [
    { href: "/portal/profile", k: "nav_profile", icon: "profile" },
    { href: "/portal/ai-assistant", k: "nav_ai", icon: "ai" },
  ] },
];

/** Gahak (non-farmer) portal: wahi group tarteeb aur naam. */
export const CUSTOMER_NAV_GROUPS: PortalNavGroup[] = [
  { key: "hisaab", k: "ph6_grp_hisaab", items: [
    { href: "/portal/c", k: "pc_nav_dash", icon: "dashboard" },
    { href: "/portal/c/khata", k: "pc_nav_khata", icon: "khata" },
    { href: "/portal/c/orders", k: "pc_nav_orders", icon: "bills" },
    { href: "/portal/c/payments", k: "pc_nav_pay", icon: "payments" },
  ] },
  { key: "account", k: "ph6_grp_account", items: [
    { href: "/portal/c/profile", k: "pc_nav_profile", icon: "profile" },
  ] },
];

/** Jin safhon ka apna menu item nahi -- wo kis item ke neeche roshan hon. */
export const NAV_ALIASES: Record<string, string> = {
  "/portal/dairy/alerts": "/portal/dairy/breeding",
  "/portal/dairy/animals": "/portal/dairy",
  "/portal/dairy/milk": "/portal/dairy",
  "/portal/c/khata": "/portal/wallet",
  "/portal/c/profile": "/portal/profile",
};

export const hrefsOf = (groups: PortalNavGroup[]): string[] => groups.flatMap((g) => g.items.map((i) => i.href));
const FARMER_HREFS = hrefsOf(PORTAL_NAV_GROUPS);

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Ek hi qaida: sab se lamba milta hua raasta jeetta hai (aliases pehle).
 * Is liye har safhe par zyada se zyada EK item roshan hota hai.
 */
export function activeHref(pathname: string, hrefs: string[] = FARMER_HREFS): string | null {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  let target = path;
  let aliasLen = -1;
  for (const [from, to] of Object.entries(NAV_ALIASES)) {
    if (under(path, from) && from.length > aliasLen && hrefs.includes(to) && !hrefs.includes(from)) { target = to; aliasLen = from.length; }
  }
  let best: string | null = null;
  for (const h of hrefs) if (under(target, h) && (!best || h.length > best.length)) best = h;
  return best;
}

export function isNavActive(pathname: string, href: string, hrefs: string[] = FARMER_HREFS): boolean {
  return activeHref(pathname, hrefs) === href;
}

export function activeGroup(pathname: string, groups: PortalNavGroup[] = PORTAL_NAV_GROUPS): PortalNavGroup["key"] | null {
  const a = activeHref(pathname, hrefsOf(groups));
  return a ? groups.find((g) => g.items.some((i) => i.href === a))?.key ?? null : null;
}

export interface Crumb { href: string | null; k: TranslationKey }
/** Portal › Dairy › Breeding */
export function breadcrumb(pathname: string, groups: PortalNavGroup[] = PORTAL_NAV_GROUPS): Crumb[] {
  const home = groups[0].items[0].href;
  const out: Crumb[] = [{ href: home, k: "ph6_crumb_portal" }];
  const a = activeHref(pathname, hrefsOf(groups));
  const g = a ? groups.find((x) => x.items.some((i) => i.href === a)) : null;
  if (!g || !a || a === home) return out;
  const first = g.items[0].href;
  out.push({ href: first === a ? null : first, k: g.k }, { href: null, k: g.items.find((i) => i.href === a)!.k });
  return out;
}

export interface Tab { key: "home" | "khata" | "dairy" | "bills" | "pay" | "more"; href: string | null; k: TranslationKey; icon: NavIconName | "more" }
/** Neeche ki tab bar (sirf phone). Dairy tab sirf jab janwar hon. */
export function portalTabs(kind: "farmer" | "customer", hasDairy: boolean): Tab[] {
  if (kind === "customer") return [
    { key: "home", href: "/portal/c", k: "ph6_tab_home", icon: "dashboard" },
    { key: "khata", href: "/portal/c/khata", k: "ph6_tab_khata", icon: "khata" },
    { key: "bills", href: "/portal/c/orders", k: "ph6_tab_bills", icon: "bills" },
    { key: "pay", href: "/portal/c/payments", k: "ph6_tab_pay", icon: "payments" },
    { key: "more", href: null, k: "ph6_tab_more", icon: "more" },
  ];
  const tabs: Tab[] = [
    { key: "home", href: "/portal/dashboard", k: "ph6_tab_home", icon: "dashboard" },
    { key: "khata", href: "/portal/wallet", k: "ph6_tab_khata", icon: "khata" },
    { key: "dairy", href: "/portal/dairy", k: "ph6_tab_dairy", icon: "dairy" },
    { key: "bills", href: "/portal/c/orders", k: "ph6_tab_bills", icon: "bills" },
    { key: "more", href: null, k: "ph6_tab_more", icon: "more" },
  ];
  return hasDairy ? tabs : tabs.filter((t) => t.key !== "dairy");
}

/** Kaun si tab roshan ho: dairy ka koi bhi safha -> Dairy; menu ke baqi -> More. */
export function activeTab(pathname: string, kind: "farmer" | "customer", hasDairy: boolean): Tab["key"] {
  const groups = kind === "farmer" ? PORTAL_NAV_GROUPS : CUSTOMER_NAV_GROUPS;
  const tabs = portalTabs(kind, hasDairy);
  const a = activeHref(pathname, hrefsOf(groups));
  if (kind === "farmer" && hasDairy && activeGroup(pathname, groups) === "dairy") return "dairy";
  return tabs.find((t) => t.href && t.href === a)?.key ?? "more";
}

/** Drawer ke liye: phone par focus andar hi ghoome (Tab / Shift+Tab). */
export function nextFocusIndex(current: number, count: number, back: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return back ? count - 1 : 0;
  return back ? (current - 1 + count) % count : (current + 1) % count;
}
