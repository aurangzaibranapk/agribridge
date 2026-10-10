/**
 * POS par khatam stock (malik, 10 October): "Jo stock POS sy khatam ho wo
 * whan sy ghaib NI Hona chiaye, nazar ana chiaye -- staff KO demand bnana
 * asan ho ga."
 *
 * Khatam cheez counter par dikhti hai (grey, "Stock khatam" ke nishaan ke
 * saath) magar cart mein tab hi ja sakti hai jab manfi (negative) stock
 * ki ijazat ho. Aaj nizam mein aisi koi setting nahi, is liye default
 * band hai.
 */
export const POS_ALLOW_NEGATIVE_STOCK = false;

/** Demand / reorder banane ka safha. */
export const POS_DEMAND_HREF = "/admin/products/reorder";

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
