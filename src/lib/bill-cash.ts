/**
 * Bills, kharche aur cash ki naql-o-harkat.
 *
 * Yahan ka bunyadi usool ek hi hai:
 *
 *   Cash bahar jane ka matlab KHARCHA nahi hota.
 *
 * Cash bohot si wajhon se bahar jata hai — supplier ko purani adaigi,
 * staff ko advance, HQ ko raqam bhejna. In mein sirf EK kharcha hai;
 * baqi sab balance ki naql-o-harkat hai. Sab ko kharcha likh dena do
 * nuqsan karta hai: nafa asal se kam nazar aata hai, aur supplier ka
 * khata kabhi kam nahi hota — wo dobara wohi paise mangta hai.
 *
 * Is farq ka faisla AI nahi kar sakta. AI ko parchi par raqam nazar aati
 * hai, niyat nahi. Is liye ye faisla hamesha manager karta hai, aur
 * database ise lazmi qarar deta hai (chk_cash_party_required).
 */

import type { Database } from "@/lib/types/database.types";

type FinanceType = Database["public"]["Enums"]["finance_transaction_type"];

export type PartyType =
  | "expense"
  | "supplier_payment"
  | "staff_advance"
  | "branch_transfer"
  | "customer_receipt"
  | "income"
  | "other";

interface PartyDefinition {
  value: PartyType;
  label: string;
  /** Manager ko yaad dilane ke liye — is ka asar kya hoga. */
  hint: string;
  financeType: FinanceType;
}

/** Cash bahar gaya — manager in mein se ek chunega. */
export const CASH_PAID_PARTIES: PartyDefinition[] = [
  {
    value: "expense",
    label: "Kharcha (chai, marammat, bijli, safai)",
    hint: "Ye asal kharcha hai — nafe mein se kat jayega.",
    financeType: "expense",
  },
  {
    value: "supplier_payment",
    label: "Supplier ko adaigi",
    hint: "Ye kharcha NAHI — maal pehle aa chuka, ab us ka khata kam hoga.",
    financeType: "transfer_out",
  },
  {
    value: "staff_advance",
    label: "Staff ko advance ya qarz",
    hint: "Ye kharcha NAHI — staff se wapas lena hai.",
    financeType: "transfer_out",
  },
  {
    value: "branch_transfer",
    label: "HQ ya doosri branch ko bheja",
    hint: "Ye kharcha NAHI — paisa company ke andar hi hai.",
    financeType: "transfer_out",
  },
  {
    value: "other",
    label: "Deegar (comment mein wajah likhein)",
    hint: "Kharcha nahi samjha jayega. Wajah comment mein zaroor likhein.",
    financeType: "transfer_out",
  },
];

/** Cash andar aaya — manager in mein se ek chunega. */
export const CASH_RECEIVED_PARTIES: PartyDefinition[] = [
  {
    value: "customer_receipt",
    label: "Customer se wasooli (khata)",
    hint: "Ye aamdani NAHI — purana udhaar wapas aaya, khata kam hoga.",
    financeType: "transfer_in",
  },
  {
    value: "branch_transfer",
    label: "HQ ya doosri branch se aaya",
    hint: "Ye aamdani NAHI — paisa company ke andar hi tha.",
    financeType: "transfer_in",
  },
  {
    value: "income",
    label: "Aamdani (kiraya, scrap, deegar)",
    hint: "Ye asal aamdani hai — nafe mein shamil hogi.",
    financeType: "income",
  },
  {
    value: "other",
    label: "Deegar (comment mein wajah likhein)",
    hint: "Aamdani nahi samjhi jayegi. Wajah comment mein zaroor likhein.",
    financeType: "transfer_in",
  },
];

export function partiesForKind(kind: string): PartyDefinition[] {
  if (kind === "cash_paid") return CASH_PAID_PARTIES;
  if (kind === "cash_received") return CASH_RECEIVED_PARTIES;
  return [];
}

export function partyDefinition(kind: string, value: string): PartyDefinition | null {
  return partiesForKind(kind).find((p) => p.value === value) ?? null;
}

/**
 * Bill ki qismein — ye wohi hain jo pehle se
 * /admin/company-expenses par chal rahi hain. Jaan boojh kar wahi rakhi
 * gayi hain taake WhatsApp se aaya bill aur haath se dala hua bill ek hi
 * report mein aayen, do alag jagah nahi.
 */
export const BILL_CATEGORIES = [
  { value: "utility_bill", label: "Bijli / Gas ka bill" },
  { value: "rent", label: "Dukan ka kiraya" },
  { value: "maintenance", label: "Marammat" },
  { value: "salary", label: "Tankhwah" },
  { value: "inventory_purchase", label: "Maal ki khareed" },
  { value: "supplier_payment", label: "Supplier ko adaigi" },
  { value: "other", label: "Deegar" },
] as const;

export function isBillCategory(value: string): boolean {
  return BILL_CATEGORIES.some((c) => c.value === value);
}
