/**
 * POS par khatam stock (malik, 10 October): "Jo stock POS sy khatam ho wo
 * whan sy ghaib NI Hona chiaye, nazar ana chiaye -- staff KO demand bnana
 * asan ho ga."
 *
 * Khatam cheez counter par dikhti hai (grey, "Stock khatam" ke nishaan ke
 * saath) magar cart mein tab hi ja sakti hai jab manfi (negative) stock
 * ki ijazat ho. Aaj nizam mein aisi koi setting nahi, is liye default
 * band hai.
 *
 * Hadd (30 October): stock se zyada select nahi hota. Jo dukan ke godam
 * mein bechne layak hai (expire batch ke baghair), cart us se aage nahi
 * barhta. Doosre godam (warehouse strip) ka maal is hadd mein shamil nahi
 * -- wo abhi is counter ki bikri nahi.
 */
export const POS_ALLOW_NEGATIVE_STOCK = false;

/** Demand / reorder banane ka safha. */
export const POS_DEMAND_HREF = "/admin/products/reorder";

const QTY_EPS = 1e-6;

export function isOutOfStock(item: { stock_quantity: number | null | undefined }): boolean {
  return !(Number(item.stock_quantity ?? 0) > 0);
}

export function canAddToCart(
  item: { stock_quantity: number | null | undefined },
  allowNegative: boolean = POS_ALLOW_NEGATIVE_STOCK
): boolean {
  return allowNegative || !isOutOfStock(item);
}

/** Stock wali cheezein pehle, khatam wali aakhir mein -- tarteeb baqi wohi. */
export function sortInStockFirst<T extends { stock_quantity: number | null | undefined }>(items: T[]): T[] {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => Number(isOutOfStock(a.item)) - Number(isOutOfStock(b.item)) || a.idx - b.idx)
    .map((x) => x.item);
}

/** Asia/Karachi ki tareekh, YYYY-MM-DD. fn_batch_is_sellable isi din se milata hai. */
export function todayPkt(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * fn_batch_is_sellable: expiry na ho to bech sakte hain. Aaj (PKT) ya us
 * ke baad ki miyaad abhi theek hai. Kal ki khatam hai.
 */
export function isBatchSellable(expiry: string | null | undefined, today: string): boolean {
  if (expiry == null || String(expiry).trim() === "") return true;
  const day = String(expiry).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
  return day >= today;
}

export interface StockLot {
  batch_id?: string | null;
  quantity_on_hand: number | null;
}

export interface SellableStock {
  sellable: number;
  expiredQty: number;
  /** Sab se pehle khatam hone wali bechne layak miyaad. */
  sellableExpiry: string | null;
  /** Jab bechne layak kuch bacha hi na ho, expire batch ki miyaad. */
  expiredExpiry: string | null;
}

/**
 * Dukan ke inventory rows se bechne layak stock.
 * Expire batch ki miqdar shamil nahi. Batch id ho aur fehrist mein na
 * mile to miyaad maloom nahi -- chhupate nahi, bechne layak ginte hain.
 */
export function sellableFromLots(
  lots: StockLot[],
  expiryByBatch: { has(id: string): boolean; get(id: string): string | null | undefined },
  today: string
): SellableStock {
  let sellable = 0;
  let expiredQty = 0;
  let sellableExpiry: string | null = null;
  let expiredExpiry: string | null = null;
  for (const lot of lots) {
    const qty = Number(lot.quantity_on_hand ?? 0);
    if (!(qty > 0)) continue;
    const id = lot.batch_id ?? null;
    if (id && !expiryByBatch.has(id)) {
      sellable += qty;
      continue;
    }
    const expiry = id ? (expiryByBatch.get(id) ?? null) : null;
    const day = expiry ? String(expiry).slice(0, 10) : null;
    if (!isBatchSellable(expiry, today)) {
      expiredQty += qty;
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && (!expiredExpiry || day < expiredExpiry)) expiredExpiry = day;
      continue;
    }
    sellable += qty;
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && (!sellableExpiry || day < sellableExpiry)) sellableExpiry = day;
  }
  return { sellable, expiredQty, sellableExpiry, expiredExpiry };
}

/**
 * Bottle / base units jo stock se nikalte hain.
 * pos_line_stock_units (513) ka wahi hisaab: carton ho to quantity x
 * units_per_pack, warna quantity. sale_unit khali ho aur rate retail se
 * 2.5 guna se upar ho to purane client ke liye carton hi mana jata hai.
 */
export function lineStockUnits(args: {
  quantity: number;
  unitPrice: number;
  saleUnit?: string | null;
  unitsPerPack?: number | null;
  sellingPrice?: number | null;
}): number {
  const qty = Number(args.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const upp = Number(args.unitsPerPack ?? 1);
  const selling = Number(args.sellingPrice ?? 0);
  const price = Number(args.unitPrice);
  const unit = args.saleUnit == null ? "" : String(args.saleUnit);
  const carton =
    upp > 1 &&
    (unit === "carton" || (unit === "" && selling > 0 && price > 2.5 * selling));
  return qty * (carton ? upp : 1);
}

/**
 * Cart ki tadaad ki hadd. Retail: poori bottles. Wholesale PET: poori
 * carton, bachi hui bottles se adha PET nahi banta.
 */
export function maxSelectableQty(
  sellableBottles: number | null | undefined,
  opts?: { unitsPerPack?: number | null; carton?: boolean; allowNegative?: boolean }
): number {
  if (opts?.allowNegative) return Number.POSITIVE_INFINITY;
  const have = Math.max(0, Number(sellableBottles ?? 0) || 0);
  const upp = Number(opts?.unitsPerPack ?? 0);
  if (opts?.carton && upp > 1) return Math.floor((have + QTY_EPS) / upp);
  return Math.floor(have + QTY_EPS);
}

function formatPlain(n: number): string {
  const q = Math.round((Number(n) || 0) * 100) / 100;
  if (!Number.isFinite(q)) return "0";
  return Number.isInteger(q) ? String(q) : String(q);
}

/** Counter par jo jumla staff ko nazar aata hai -- Roman Urdu + English. */
export function stockLimitMessage(
  name: string,
  sellableBottles: number | null | undefined,
  opts?: { unitsPerPack?: number | null; carton?: boolean }
): string {
  const have = Math.max(0, Number(sellableBottles ?? 0) || 0);
  const bottles = formatPlain(have);
  const upp = Number(opts?.unitsPerPack ?? 0);
  const carton = !!opts?.carton && upp > 1;
  const max = maxSelectableQty(have, { carton, unitsPerPack: upp });
  if (max <= 0 && !(have > 0)) {
    return `"${name}" ka stock khatam hai (Out of stock) -- Demand bana dein.`;
  }
  if (max <= 0 && carton) {
    return `"${name}" ka stock ${bottles} bottle hai — ek PET (${formatPlain(upp)} btl) ke liye kam hai. Select nahi ho sakti. (Not enough stock)`;
  }
  if (max <= 0) {
    return `"${name}" ka stock sirf ${bottles} hai — ek poori cheez ke liye kam hai. Select nahi ho sakti. (Not enough stock)`;
  }
  if (carton) {
    return `"${name}" ka stock ${bottles} bottle hai — ${formatPlain(max)} PET se zyada select nahi ho sakta. (Only ${formatPlain(max)} in stock)`;
  }
  return `"${name}" ka stock sirf ${bottles} hai — is se zyada select nahi ho sakta. (Only ${bottles} in stock)`;
}

/** Cart ki maangi hui tadaad bechne layak stock se aage hai? */
export function exceedsSellable(args: {
  quantity: number;
  unitPrice: number;
  saleUnit?: string | null;
  unitsPerPack?: number | null;
  sellingPrice?: number | null;
  sellableBottles: number;
  allowNegative?: boolean;
}): boolean {
  if (args.allowNegative) return false;
  const need = lineStockUnits(args);
  const have = Math.max(0, Number(args.sellableBottles) || 0);
  return need > have + QTY_EPS;
}
