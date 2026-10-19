/**
 * Raasta (route) ki ijazat -- ek hi qaida, middleware, menu aur safhe teeno ke liye.
 *
 * Aam qaida: /a ki ijazat /a/b bhi kholti hai.
 *
 * MAGAR "hub" raaste (abhi sirf /admin/reports) sirf apna darwaza kholte
 * hain, andar ke safhe nahi. Pehle "Reports" ki ijazat se P&L, Salary
 * Planner, Stock Value -- sab khul jate the (17 October audit). Ab har
 * report ko apni ijazat chahiye.
 *
 * Kuch report safhon ka apna feature nahi -- wo kisi qareebi feature ki
 * ijazat se khulte hain (CHILD_ROUTE_REQUIRES). Jin ka koi rishta nahi,
 * wo sirf owner/admin ke liye hain (middleware un ko waise bhi nahi rokta).
 */

export const HUB_ONLY_ROUTES: readonly string[] = ["/admin/reports"];

export const CHILD_ROUTE_REQUIRES: Readonly<Record<string, readonly string[]>> = {
  "/admin/reports/profit-loss": ["/admin/reports/pnl"],
  "/admin/reports/stock-reconcile": ["/admin/reports/stock-value"],
  "/admin/reports/shop-summary": ["/admin/shop-360"],
};

function clean(route: string): string {
  return route.split(/[?#]/, 1)[0];
}

/** Kya ek di hui ijazat (granted) is raaste ko kholti hai. */
export function routeGrants(granted: string, pathname: string): boolean {
  const r = clean(granted);
  if (!r) return false;
  if (pathname === r) return true;
  if (HUB_ONLY_ROUTES.includes(r)) return false;
  return pathname.startsWith(r + "/");
}

/** Kya ijazat ki fehrist (allowed) is raaste ko kholti hai. */
export function pathAllowed(allowed: readonly string[], pathname: string): boolean {
  if (allowed.some((r) => routeGrants(r, pathname))) return true;
  for (const [child, needs] of Object.entries(CHILD_ROUTE_REQUIRES)) {
    if (pathname === child || pathname.startsWith(child + "/")) {
      return needs.some((need) => allowed.some((r) => routeGrants(r, need)));
    }
  }
  return false;
}
