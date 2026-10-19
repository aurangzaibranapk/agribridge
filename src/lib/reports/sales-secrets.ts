/**
 * Sales Report par company ke raaz -- kaun dekh sakta hai.
 *
 * Malik (17 October): "kia cheez company ka secret hai jo hamare staff ko
 * pata nahi hona chahiye ... sale report page ko, kyunke ye sale staff ke
 * paas bhi hai."
 *
 * Raaz (sirf owner / super_admin / admin):
 *   1. Stock ki qeemat (kharid par)            -- hum kitne mein khareedte hain
 *   2. "Stock ki qeemat (kharid par)" table    -- dukan ki qism ke hisaab se
 *   3. Slow-stock par purchase price / value
 *   4. Kharche (Daily kharche + Kharche table)  -- poori company ke
 *   5. Load ki kamai (service charge + commission) aur Load/Bill ka hisaab
 *   6. "Har Shop ka Alag Hisaab"               -- sab dukanon ka muqabla
 *   7. Kul lena hai                            -- branch ka kul udhaar
 *
 * Ye data doosron ke liye FETCH hi nahi hota -- sirf chhupaya nahi jata.
 * Sales staff ko alag "Meri Dukan Report" milti hai (bina qeemat ke).
 */

export const SALES_SECRET_ROLES = ["owner", "super_admin", "admin"] as const;

export const MERI_DUKAN_ROUTE = "/admin/reports/sales/meri-dukan";

/** Kya ye role company ke raaz (cost, kharche, kamai, sab dukanein) dekh sakta hai. */
export function canSeeSalesSecrets(role: string | null | undefined): boolean {
  return (SALES_SECRET_ROLES as readonly string[]).includes(String(role ?? ""));
}

/** Sales staff ko poori report ki jagah "Meri Dukan Report" par bhejna hai. */
export function shouldUseMeriDukan(role: string | null | undefined): boolean {
  return String(role ?? "") === "sales_staff";
}

/**
 * Safhe ke kaun se hisse kis ko -- ek hi jagah, taake page aur test ek hi
 * baat kahein. `false` ka matlab: na query chalti hai, na card banta hai.
 */
export type SalesReportSections = {
  stockValue: boolean;
  stockValueByType: boolean;
  slowStockCost: boolean;
  expenses: boolean;
  loadEarnings: boolean;
  allShopsTable: boolean;
  totalReceivable: boolean;
  /** Yeh sab ko (apni dukan / branch tak) */
  stockCount: boolean;
  sales: boolean;
  cashHealth: boolean;
  recentSales: boolean;
};

export function salesReportSections(role: string | null | undefined): SalesReportSections {
  const raaz = canSeeSalesSecrets(role);
  return {
    stockValue: raaz,
    stockValueByType: raaz,
    slowStockCost: raaz,
    expenses: raaz,
    loadEarnings: raaz,
    allShopsTable: raaz,
    totalReceivable: raaz,
    stockCount: true,
    sales: true,
    cashHealth: true,
    recentSales: true,
  };
}

/**
 * Load/Bill ki query ka daira (owner ke liye). Pehle dukan wale bande ke
 * liye branch filter khali reh jata tha aur SAB branches ka load nazar
 * aata tha. Ab: dukan > branch > sab.
 */
export function loadScope(opts: { shopId?: string | null; branchId?: string | null }):
  | { column: "shop_id"; value: string }
  | { column: "branch_id"; value: string }
  | null {
  if (opts.shopId) return { column: "shop_id", value: opts.shopId };
  if (opts.branchId) return { column: "branch_id", value: opts.branchId };
  return null;
}

/** Cash-health: kam az kam 70% naqad, zyada se zyada 30% udhaar. */
export function cashHealth(totalSales: number, cash: number, udhaar: number) {
  const cashPct = totalSales > 0 ? (cash / totalSales) * 100 : 0;
  const udhaarPct = totalSales > 0 ? (udhaar / totalSales) * 100 : 0;
  const cashOk = cashPct >= 70;
  const udhaarOk = udhaarPct <= 30;
  return { cashPct, udhaarPct, cashOk, udhaarOk, ok: cashOk && udhaarOk };
}
