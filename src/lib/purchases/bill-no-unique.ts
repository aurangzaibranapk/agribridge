/** "INV-001", "inv-001" aur " INV-001 " ek hi bill hain (289 ka qaida). */
export function normalizeSupplierBillNo(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** ILIKE ke liye % _ \ ko escape karo, taa-ke bill number pattern na bane. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Unique slot. Doosri purchase usi bill-upload se (388) slot nahi leti,
 * is liye 289 wala poora taala wapas nahi aaya. Pehli purchase / workspace
 * bill slot leti hai; race database ka partial index pakarta hai (629).
 */
export function billNoKey(billNo: string | null | undefined, allowRepeat: boolean): string | null {
  const key = normalizeSupplierBillNo(billNo ?? "");
  if (!key || allowRepeat) return null;
  return key;
}

/** Purane (289), bill-read (388) ya naye slot (629) ka unique error. */
export function isDuplicateBillNoError(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined): boolean {
  if (!error || error.code !== "23505") return false;
  return /ux_purchases_supplier_bill_no|ux_purchases_bill_no_key|ux_bill_reads_supplier_bill_no_applied|bill_no_key/i.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

/**
 * Dono raaste ek hi bill dekhte hain: purchases.supplier_bill_no aur
 * supplier_bill_reads.bill_number. Ek jagah dekhna doosri jagah ka
 * dohra bill chhoR deta tha.
 */
export function duplicateBillSources(args: {
  billNo: string;
  purchases: Array<{ id?: string | null; supplier_bill_no: string | null; status?: string | null; purchase_number?: string | null }>;
  billReads: Array<{ id: string; bill_number: string | null; purchase_id?: string | null }>;
  ignorePurchaseId?: string | null;
  ignoreBillId?: string | null;
}): { purchaseNumber: string | null; billReadId: string | null } | null {
  const want = normalizeSupplierBillNo(args.billNo);
  if (!want) return null;
  const purchase = args.purchases.find(
    (p) => p.status !== "cancelled" && p.id !== args.ignorePurchaseId && normalizeSupplierBillNo(p.supplier_bill_no) === want
  );
  const read = args.billReads.find(
    (b) => b.id !== args.ignoreBillId && Boolean(b.purchase_id) && normalizeSupplierBillNo(b.bill_number) === want
  );
  if (!purchase && !read) return null;
  return { purchaseNumber: purchase?.purchase_number ?? null, billReadId: read?.id ?? null };
}

export function duplicateBillError(billNo: string, hit: { purchaseNumber: string | null; billReadId: string | null }): string {
  const where = hit.purchaseNumber ? ` (${hit.purchaseNumber})` : hit.billReadId ? " (kisi aur bill-upload)" : "";
  return `Supplier bill ${billNo} pehle se save hai${where}. Duplicate bill dobara nahi banaya.`;
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
