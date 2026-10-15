/**
 * Party & Product Intelligence -- pure hisaab (test: npm run test:intelligence).
 * Sirf parhta hai. Jo cheez kisi party type ke liye track hi nahi hoti wo
 * NULL rehti hai ("data not available"), sifar nahi.
 */
export const PARTY_TYPES = ["customer", "farmer", "dealer", "supplier", "buyer", "investor", "staff"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

/** Hamari nazar se: we_sold = humne becha (party ne khareeda); we_bought = party ne humein becha. */
export type PartyEvent = {
  date: string; // ISO
  kind: "we_sold" | "we_bought" | "received" | "paid";
  amount: number;
  ref: string;
  href?: string | null;
  category?: string | null;
  /** Udhaar hissa (sirf we_sold) -- overdue ke liye. */
  credit?: number;
};

/** Kaun sa pehlu is party type ke liye maujood hai. */
export const FACETS: Record<PartyType, { boughtFromUs: boolean; soldToUs: boolean; payments: boolean; category: boolean }> = {
  customer: { boughtFromUs: true, soldToUs: false, payments: true, category: true },
  farmer: { boughtFromUs: true, soldToUs: true, payments: true, category: true },
  dealer: { boughtFromUs: false, soldToUs: true, payments: true, category: false }, // soldToUs = commission earned
  supplier: { boughtFromUs: false, soldToUs: true, payments: true, category: false },
  buyer: { boughtFromUs: true, soldToUs: false, payments: true, category: false },
  investor: { boughtFromUs: false, soldToUs: false, payments: true, category: false },
  staff: { boughtFromUs: false, soldToUs: false, payments: true, category: false },
};

export type PartySummary = {
  boughtFromUs: number | null;
  soldToUs: number | null;
  received: number;
  paid: number;
  /** + = party humein deni hai (receivable), - = hum ne deni hai (payable). */
  balance: number;
  overdue: number | null;
  lastTransaction: string | null;
  categories: { name: string; amount: number; share: number }[] | null;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

export function summarizeParty(type: PartyType, events: PartyEvent[], opts: { now: Date; overdueDays: number; balanceOverride?: number | null }): PartySummary {
  const f = FACETS[type];
  const sum = (k: PartyEvent["kind"]) => r2(events.filter((e) => e.kind === k).reduce((a, e) => a + e.amount, 0));
  const sold = sum("we_sold"), bought = sum("we_bought"), received = sum("received"), paid = sum("paid");
  const computed = r2(sold - received - (bought - paid));
  const balance = opts.balanceOverride ?? computed;
  // Overdue: FIFO -- purane udhaar pehle chukte hain; jo had se purana bacha wo overdue.
  let overdue: number | null = null;
  if (f.boughtFromUs) {
    const credits = events.filter((e) => e.kind === "we_sold" && (e.credit ?? 0) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
    const totalCredit = credits.reduce((a, e) => a + (e.credit ?? 0), 0);
    let outstanding = Math.max(0, Math.min(totalCredit, balance));
    let paidOff = totalCredit - outstanding;
    const cutoff = opts.now.getTime() - opts.overdueDays * 86_400_000;
    overdue = 0;
    for (const c of credits) {
      const left = Math.max(0, (c.credit ?? 0) - paidOff);
      paidOff = Math.max(0, paidOff - (c.credit ?? 0));
      if (left > 0 && new Date(c.date).getTime() < cutoff) overdue += left;
    }
    overdue = r2(overdue);
  }
  let categories: PartySummary["categories"] = null;
  if (f.category) {
    const m = new Map<string, number>();
    for (const e of events) if (e.kind === "we_sold" && e.category) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    const tot = Array.from(m.values()).reduce((a, b) => a + b, 0);
    categories = Array.from(m.entries()).map(([name, amount]) => ({ name, amount: r2(amount), share: tot ? r2((amount / tot) * 100) : 0 })).sort((a, b) => b.amount - a.amount);
  }
  const last = events.reduce<string | null>((a, e) => (!a || e.date > a ? e.date : a), null);
  return { boughtFromUs: f.boughtFromUs ? sold : null, soldToUs: f.soldToUs ? bought : null, received, paid, balance, overdue, lastTransaction: last, categories };
}

export type ProductIn = {
  id: string; name: string; category: string | null;
  purchasedQty: number; purchasedValue: number; soldQty: number; soldValue: number; soldCost: number | null;
  stockQty: number; stockValue: number | null; lastSaleAt: string | null; nearestExpiry: string | null;
  suppliers: { supplier: string; qty: number; value: number }[];
};
export type Movement = "fast" | "slow" | "none";

export function productMetrics(p: ProductIn, opts: { now: Date; periodDays: number; expiryWarnDays: number }) {
  const avgPurchase = p.purchasedQty > 0 ? r2(p.purchasedValue / p.purchasedQty) : null;
  const avgSale = p.soldQty > 0 ? r2(p.soldValue / p.soldQty) : null;
  const margin = p.soldCost != null && p.soldValue > 0 ? r2(p.soldValue - p.soldCost) : avgPurchase != null && avgSale != null ? r2((avgSale - avgPurchase) * p.soldQty) : null;
  const marginPct = margin != null && p.soldValue > 0 ? r2((margin / p.soldValue) * 100) : null;
  // Movement: period ki bikri ko ausat stock se -- had ek mahine ka stock.
  const dailyRate = p.soldQty / Math.max(1, opts.periodDays);
  const daysOfStock = dailyRate > 0 ? p.stockQty / dailyRate : null;
  const movement: Movement = p.soldQty <= 0 ? "none" : daysOfStock != null && daysOfStock <= 30 ? "fast" : "slow";
  let expiry: "expired" | "near" | "ok" | null = null;
  if (p.nearestExpiry) {
    const days = (new Date(p.nearestExpiry).getTime() - opts.now.getTime()) / 86_400_000;
    expiry = days < 0 ? "expired" : days <= opts.expiryWarnDays ? "near" : "ok";
  }
  const supplierRates = p.suppliers.filter((s) => s.qty > 0).map((s) => ({ ...s, rate: r2(s.value / s.qty) })).sort((a, b) => a.rate - b.rate);
  return { avgPurchase, avgSale, margin, marginPct, movement, daysOfStock: daysOfStock == null ? null : Math.round(daysOfStock), expiry, supplierRates, cheapestSupplier: supplierRates[0]?.supplier ?? null };
}
