/** "INV-001", "inv-001" aur " INV-001 " ek hi bill hain (289 ka qaida). */
export function normalizeSupplierBillNo(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** ILIKE ke liye % _ \ ko escape karo, taa-ke bill number pattern na bane. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Purane (289) ya naye (388 / 522) kisi bhi bill-number unique index ka error. */
export function isDuplicateBillNoError(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined): boolean {
  if (!error || error.code !== "23505") return false;
  return /ux_purchases_supplier_bill_no|ux_bill_reads_supplier_bill_no_applied/i.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

/** Pehle se mojood (radd na hui) purchases mein wohi bill number hai? */
export function findDuplicateBillNo(
  existing: Array<{ supplier_bill_no: string | null; status?: string | null; purchase_number?: string | null }>,
  billNo: string
): string | null {
  const want = normalizeSupplierBillNo(billNo);
  if (!want) return null;
  const hit = existing.find((p) => p.status !== "cancelled" && normalizeSupplierBillNo(p.supplier_bill_no) === want);
  return hit ? hit.purchase_number ?? "" : null;
}
