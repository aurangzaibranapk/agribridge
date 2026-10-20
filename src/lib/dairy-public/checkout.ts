/**
 * Dairy checkout (glassy) -- sirf hisaab aur WhatsApp text. Koi DB, koi
 * auto-send nahi. Qeematein DAIRY_PRODUCTS se (owner ki batayi hui).
 */
import { DAIRY_PRODUCTS, SUPPLY, buildBulkOrderText, type BulkOrderInput } from "./offer";

export type CheckoutCity = "Lahore" | "Islamabad";
export type PayMethod = "cod" | "advance";

export function unitPrice(id: "doodh-13-ts" | "desi-ghee" | "desi-anday", city: CheckoutCity): number {
  const p = DAIRY_PRODUCTS.find((x) => x.id === id)!;
  return (p.offers.find((o) => o.city === city) ?? p.offers[0]).price;
}

const q = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

export function checkoutTotals(input: { city: CheckoutCity; milkL: unknown; gheeKg: unknown; eggs: unknown }) {
  const milkL = q(input.milkL), gheeKg = q(input.gheeKg), eggs = q(input.eggs);
  const lines = [
    { id: "doodh-13-ts" as const, qty: milkL, price: unitPrice("doodh-13-ts", input.city) },
    { id: "desi-ghee" as const, qty: gheeKg, price: unitPrice("desi-ghee", input.city) },
    { id: "desi-anday" as const, qty: eggs, price: unitPrice("desi-anday", input.city) },
  ].map((l) => ({ ...l, total: l.qty * l.price }));
  const total = lines.reduce((s, l) => s + l.total, 0);
  const belowMin = input.city === "Lahore" && milkL > 0 && milkL < SUPPLY.lahoreMinimumLitres;
  return { lines, total, belowMin, empty: total === 0 };
}

export function buildCheckoutText(input: BulkOrderInput & { city: CheckoutCity; pay: PayMethod; total: number }): string {
  const base = buildBulkOrderText(input);
  return `${base}\nAdaigi: ${input.pay === "cod" ? "Cash on delivery" : "Advance"}\nAndaza kul: Rs ${input.total.toLocaleString("en-PK")} (staff confirm karega)`;
}
