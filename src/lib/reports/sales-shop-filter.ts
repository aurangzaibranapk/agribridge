/**
 * "Dukan chunein" filter -- Pichli sale ka khulasa (Command Center widget +
 * sales report summary). URL param `salesShop`, cookie mein yaad rehta hai.
 * Staff (meriDukan) hamesha apni dukan par locked -- param/cookie ignore.
 * Test: npm run test:sales-shop-filter
 */
import type { SalesScope } from "./sales-fetch";

export const SALES_SHOP_PARAM = "salesShop";
export const SALES_SHOP_COOKIE = "ab_sales_shop";
export const ALL_SHOPS = "all";

/**
 * Chuni hui dukan: URL param pehle, phir cookie. "all" = Sab dukanein.
 * Sirf maloom (valid) shop id qabool; warna "" (sab).
 */
export function resolveSalesShop(param: string | undefined | null, cookie: string | undefined | null, validIds: Iterable<string>): string {
  const ids = new Set(validIds);
  const pick = param != null && param !== "" ? param : cookie ?? "";
  if (!pick || pick === ALL_SHOPS) return "";
  return ids.has(pick) ? pick : "";
}

/** Summary ka scope: staff locked; admin ki chuni dukan baqi filters par ghalib. */
export function summaryScope(base: SalesScope, salesShop: string): SalesScope {
  if (base.meriDukan) return base;
  if (!salesShop) return base;
  return { meriDukan: null, shopId: salesShop, branchId: "" };
}
