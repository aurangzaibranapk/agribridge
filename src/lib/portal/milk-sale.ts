/**
 * "Doodh ki farokht" (Dairy Management) -- purane Livestock safhe ke wohi
 * 4 khane `farmers` table par: milk_buyer_name, milk_sale_rate,
 * milk_liters_per_day, milk_advance_loan_amount. Koi migration nahi,
 * koi naya khana nahi (malik ki manzoori, 19 Oct). Janwaron ki ginti
 * yahan se nahi badalti -- woh Dairy ke janwar records hain.
 */
export interface MilkSaleInput {
  milk_buyer_name: string | null;
  milk_sale_rate: number | null;
  milk_liters_per_day: number | null;
  milk_advance_loan_amount: number | null;
}

export const MILK_SALE_COLUMNS = ["milk_buyer_name", "milk_sale_rate", "milk_liters_per_day", "milk_advance_loan_amount"] as const;

const num = (v: FormDataEntryValue | null, max: number): number | null | "bad" => {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const x = Number(s);
  if (!Number.isFinite(x) || x < 0 || x > max) return "bad";
  return Math.round(x * 100) / 100;
};

export function parseMilkSale(fd: { get(k: string): FormDataEntryValue | null }): { ok: true; value: MilkSaleInput } | { ok: false; error: string } {
  const buyer = String(fd.get("milk_buyer_name") ?? "").trim().slice(0, 120);
  const rate = num(fd.get("milk_sale_rate"), 10_000);
  const lpd = num(fd.get("milk_liters_per_day"), 100_000);
  const adv = num(fd.get("milk_advance_loan_amount"), 100_000_000);
  if (rate === "bad") return { ok: false, error: "Rate sahi likhein (Rs fi litre)." };
  if (lpd === "bad") return { ok: false, error: "Litre fi din sahi likhein." };
  if (adv === "bad") return { ok: false, error: "Advance ki raqam sahi likhein." };
  return { ok: true, value: { milk_buyer_name: buyer || null, milk_sale_rate: rate, milk_liters_per_day: lpd, milk_advance_loan_amount: adv } };
}
