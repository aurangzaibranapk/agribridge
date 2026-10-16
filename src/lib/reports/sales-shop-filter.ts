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

/** Next 14: searchParams plain object (ya Next 15 mein Promise) -- dono se salesShop. */
export async function readSalesShopParam(searchParams: unknown): Promise<string | undefined> {
  const sp = (await (searchParams as any)) ?? {};
  const v = sp?.[SALES_SHOP_PARAM];
  return Array.isArray(v) ? v[0] : typeof v === "string" ? v : undefined;
}

/** Baqi query wesi hi, sirf salesShop badle. */
export function salesShopHref(pathname: string, search: string, shop: string): string {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  q.set(SALES_SHOP_PARAM, shop || ALL_SHOPS);
  return `${pathname}?${q.toString()}`;
}
