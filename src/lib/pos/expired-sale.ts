/**
 * POS par expire batch ki bikri.
 *
 * Stock mein nazar aa sakti hai, lekin physically side-line hai.
 * Code ke baghair checkout nahi hota. Code wahi staff_auth_codes hai
 * jo POS wapsi par lagta hai — alag, khula code nahi.
 */

export const EXPIRED_SALE_WRONG_CODE =
  "Admin ka code ghalat hai. Expire batch ki bikri nahi hui — aur ye koshish darj kar di gayi hai.";

/** Server aur safha dono yahi jumla dikhate hain. */
export function expiredBatchSaleBlockMessage(batchLabel: string): string {
  const label = batchLabel.trim() || "expire";
  return `Ye batch (${label}) stock mein show ho rahi hai, lekin physically side-line kar di gayi hai. Is se nuqsan ho sakta hai. Sale ke liye admin ka code lagayein.`;
}

export function isExpiredBatchSaleBlock(message: string | null | undefined): boolean {
  if (!message) return false;
  if (message.includes(EXPIRED_SALE_WRONG_CODE)) return true;
  if (/Expire batch ki bikri band hai/i.test(message)) return true;
  return /side-line/i.test(message) && /admin ka code/i.test(message);
}

/** Pakistan ki tareekh, YYYY-MM-DD. Batch ki miyaad isi se milti hai. */
export function pktDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function expiryIsPast(expiry: string | null | undefined, todayPkt: string): boolean {
  if (!expiry) return false;
  const day = expiry.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day < todayPkt;
}

export function cartHasExpiredBatch(
  lines: { product_id: string }[],
  items: { product_id: string; expiry_date?: string | null; batch_number?: string | null }[],
  todayPkt: string
): { blocked: boolean; batchNumbers: string[] } {
  const batchNumbers: string[] = [];
  let blocked = false;
  for (const line of lines) {
    const item = items.find((row) => row.product_id === line.product_id);
    if (!item || !expiryIsPast(item.expiry_date, todayPkt)) continue;
    blocked = true;
    if (item.batch_number) batchNumbers.push(item.batch_number);
  }
  return { blocked, batchNumbers: Array.from(new Set(batchNumbers)) };
}
