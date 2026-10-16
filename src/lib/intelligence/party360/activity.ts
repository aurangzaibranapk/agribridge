import {
  agingFifo, lastMonths, monthlySeries, netPosition, num, r2, shopKey,
  type AgingBuckets, type Section, type ShopLine, type TimelineItem,
} from "./core";

/**
 * "Sab kaam humare saath" -- har party type ke 360 par. Koi bhi member (kisan,
 * customer, supplier, buyer...) doodh bhi de sakta hai, khareed bhi sakta hai.
 * Links SIRF explicit: customers.farmer_id, buyers.customer_id. Koi guess-merge nahi.
 */
export type LinkIds = { farmerIds: string[]; customerIds: string[]; supplierIds: string[]; buyerIds: string[] };
export type Role = "kisan" | "customer" | "milk" | "supplier" | "buyer" | "dealer";
export const ROLE_LABEL: Record<Role, string> = { kisan: "Kisan", customer: "Customer", milk: "Milk supplier", supplier: "Supplier", buyer: "Buyer", dealer: "Dealer" };

export type Activity = {
  roles: Role[];
  shops: ShopLine[];
  net: { theyOwe: number; weOwe: number; net: number };
  sections: Section[];
  timeline: TimelineItem[];
  monthly: { months: string[]; series: { name: string; values: number[]; color: string }[] };
  khataAging: AgingBuckets | null;
  links: { label: string; href: string }[];
  totals: { pos: number; milkLiters: number; milkAmt: number; grainAmt: number; posBills: number };
  primaryCustomerId: string | null;
};

const VOID = ["cancelled", "void", "voided", "returned", "refunded", "rejected"];
const LIMIT = 5000;
const uniq = (a: (string | null | undefined)[]) => Array.from(new Set(a.filter(Boolean) as string[]));
export const pk = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+05:00` : iso);
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }).replace(/\//g, "-");
};
export const rs = (n: number) => Math.round(n).toLocaleString("en-PK");

export async function q(notes: string[], label: string, p: PromiseLike<{ data: any; error: any }>): Promise<any[]> {
  try {
    const { data, error } = await p;
    if (error) { notes.push(`${label}: ${error.message}`); return []; }
    return Array.isArray(data) ? data : data ? [data] : [];
  } catch (e: any) { notes.push(`${label}: ${e?.message ?? e}`); return []; }
}

/** Explicit links ko phaila do: farmer -> customers; customer -> farmer, buyers; buyer -> customer -> farmer. */
export async function resolveLinks(db: any, notes: string[], seed: Partial<LinkIds>): Promise<LinkIds> {
  const ids: LinkIds = { farmerIds: uniq(seed.farmerIds ?? []), customerIds: uniq(seed.customerIds ?? []), supplierIds: uniq(seed.supplierIds ?? []), buyerIds: uniq(seed.buyerIds ?? []) };
  for (let pass = 0; pass < 2; pass++) {
    if (ids.buyerIds.length) {
      const b = await q(notes, "buyers(link)", db.from("buyers").select("customer_id").in("id", ids.buyerIds));
      ids.customerIds = uniq([...ids.customerIds, ...b.map((x: any) => x.customer_id)]);
    }
    if (ids.customerIds.length) {
      const c = await q(notes, "customers(link)", db.from("customers").select("farmer_id").in("id", ids.customerIds));
      ids.farmerIds = uniq([...ids.farmerIds, ...c.map((x: any) => x.farmer_id)]);
      const b = await q(notes, "buyers(by customer)", db.from("buyers").select("id").in("customer_id", ids.customerIds));
      ids.buyerIds = uniq([...ids.buyerIds, ...b.map((x: any) => x.id)]);
    }
    if (ids.farmerIds.length) {
      const c = await q(notes, "customers(by farmer)", db.from("customers").select("id").in("farmer_id", ids.farmerIds));
      ids.customerIds = uniq([...ids.customerIds, ...c.map((x: any) => x.id)]);
    }
  }
  return ids;
}

/** Pure: per-shop/module lines + net. Test: npm run test:party-360. */
export function buildShopLines(input: {
  pos: { total: number; credit: number; shopBt: string | null; shopName: string | null }[];
  khataBalance: number; hasKhata: boolean;
  milk: { amount: number; paid: number; due: number | null } | null;
  grain: { amount: number; paid: number } | null;
  fertCredit: { debit: number; credit: number; balance: number } | null;
  supplier: { bought: number; paid: number } | null;
  buyer: { sold: number; received: number } | null;
}): ShopLine[] {
  const lines = new Map<string, ShopLine>();
  const line = (key: string, label: string) => { let l = lines.get(key); if (!l) { l = { key, label, weSold: 0, weBought: 0, received: 0, paid: 0, balance: 0 }; lines.set(key, l); } return l; };
  for (const s of input.pos) { const k = shopKey(s.shopBt, s.shopName); const l = line(k.key, k.label); l.weSold += s.total; l.received += s.total - Math.min(s.total, Math.max(0, s.credit)); l.note = "udhaar khata mein"; }
  if (input.hasKhata) { const l = line("khata", "Khata baqaya (sab dukanein, wasooli ke baad)"); l.balance = input.khataBalance; }
  if (input.milk) { const l = line("milk", "Doodh supply (hum ne dena)"); l.weBought = input.milk.amount; l.paid = input.milk.paid; l.balance = -(input.milk.due ?? input.milk.amount - input.milk.paid); }
  if (input.grain) { const l = line("grain", "Fasal Procurement ko (hum ne dena)"); l.weBought = input.grain.amount; l.paid = input.grain.paid; l.balance = -(input.grain.amount - input.grain.paid); }
  if (input.fertCredit) { const l = line("fert_credit", "Khaad credit (farmer_credit_ledger)"); l.weSold = input.fertCredit.debit; l.received = input.fertCredit.credit; l.balance = input.fertCredit.balance; }
  if (input.supplier) { const l = line("supplier", "Supplier bills (hum ne dena)"); l.weBought = input.supplier.bought; l.paid = input.supplier.paid; l.balance = -(input.supplier.bought - input.supplier.paid); }
  if (input.buyer) { const l = line("buyer", "Grain sale buyer ko (unhon ne dena)"); l.weSold = input.buyer.sold; l.received = input.buyer.received; l.balance = input.buyer.sold - input.buyer.received; }
  return Array.from(lines.values()).map((l) => ({ ...l, weSold: r2(l.weSold), weBought: r2(l.weBought), received: r2(l.received), paid: r2(l.paid), balance: r2(l.balance) }));
}

export function rolesFrom(x: { farmers: number; customers: number; milk: boolean; suppliers: number; buyers: number; dealer?: boolean }): Role[] {
  const r: Role[] = [];
  if (x.farmers) r.push("kisan"); if (x.customers) r.push("customer"); if (x.milk) r.push("milk");
  if (x.suppliers) r.push("supplier"); if (x.buyers) r.push("buyer"); if (x.dealer) r.push("dealer");
  return r;
}

export async function loadActivity(db: any, notes: string[], ids: LinkIds, opts: { now: Date; dealer?: boolean; selfHref: string }): Promise<Activity> {
  const { now } = opts; const { keys, labels } = lastMonths(now);
  const shopsRows = await q(notes, "shops", db.from("shops").select("id,name,business_type"));
  const shops = new Map<string, any>(shopsRows.map((s: any) => [s.id, s]));
  const C = ids.customerIds, F = ids.farmerIds, S = ids.supplierIds, B = ids.buyerIds;
  const none = Promise.resolve([] as any[]);
  const [custs, farmers, pos, milk, milkPay, milkBal, grain, grainPay, fcl, bookings, agri, sBills, sPays, bSales] = await Promise.all([
    C.length ? q(notes, "customers", db.from("customers").select("id,name,current_balance").in("id", C)) : none,
    F.length ? q(notes, "farmers", db.from("farmers").select("id,full_name").in("id", F)) : none,
    C.length ? q(notes, "pos_sales", db.from("pos_sales").select("id,created_at,total_amount,khata_amount,status,shop_id").or(`customer_id.in.(${C.join(",")}),crm_customer_id.in.(${C.join(",")})`).order("created_at", { ascending: false }).limit(LIMIT)) : none,
    F.length ? q(notes, "milk_entries", db.from("milk_entries").select("entry_date,shift,quantity_liters,fat_percentage,rate_per_liter,total_amount,status").in("farmer_id", F).order("entry_date", { ascending: false }).limit(LIMIT)) : none,
    F.length ? q(notes, "milk_payments", db.from("milk_payments").select("payment_date,amount").in("farmer_id", F).limit(LIMIT)) : none,
    F.length ? q(notes, "milk_farmer_balances", db.from("milk_farmer_balances").select("balance_due").in("farmer_id", F)) : none,
    F.length ? q(notes, "grain_procurement_entries", db.from("grain_procurement_entries").select("entry_date,grain_type,weight_kg,rate_per_kg,total_amount,bag_count,reclassified_as_sale_id").in("farmer_id", F).limit(LIMIT)) : none,
    F.length ? q(notes, "grain_procurement_payments", db.from("grain_procurement_payments").select("payment_date,amount,reclassified_as_sale_payment_id").in("farmer_id", F).limit(LIMIT)) : none,
    F.length ? q(notes, "farmer_credit_ledger", db.from("farmer_credit_ledger").select("farmer_id,created_at,source_type,ledger_type,amount,balance_after").in("farmer_id", F).order("created_at", { ascending: false }).limit(LIMIT)) : none,
    F.length ? q(notes, "campaign_bookings", db.from("campaign_bookings").select("acres,status,created_at,booking_campaigns(name,crop)").in("farmer_id", F).limit(100)) : none,
    C.length ? q(notes, "agri_orders", db.from("agri_orders").select("order_number,created_at,grand_total,status").in("customer_id", C).limit(500)) : none,
    S.length ? q(notes, "purchases", db.from("purchases").select("total_amount,status").in("supplier_id", S).limit(LIMIT)) : none,
    S.length ? q(notes, "supplier_payments", db.from("supplier_payments").select("amount").in("supplier_id", S).limit(LIMIT)) : none,
    B.length ? q(notes, "grain_sales", db.from("grain_sales").select("total_amount,amount_received").in("buyer_id", B).limit(LIMIT)) : none,
  ]);
  const promises: any[] = [];
  for (const [t, list] of [["farmer", F], ["customer", C], ["supplier", S], ["buyer", B]] as const)
    if (list.length) promises.push(...(await q(notes, "payment_promises", db.from("payment_promises").select("party_type,promise_date,promised_amount,promised_days,status,fulfilled_amount,created_at").eq("party_type", t).in("party_id", list).limit(100))));

  const posL = pos.filter((s: any) => !VOID.includes(String(s.status ?? "completed")));
  const milkL = milk.filter((m: any) => !VOID.includes(String(m.status ?? "")));
  const grainL = grain.filter((g: any) => !g.reclassified_as_sale_id);
  const grainPL = grainPay.filter((g: any) => !g.reclassified_as_sale_payment_id);
  const sum = (a: any[], k: string) => r2(a.reduce((x: number, r: any) => x + num(r[k]), 0));
  const khataBal = sum(custs, "current_balance");
  const milkAmt = sum(milkL, "total_amount"), milkLiters = sum(milkL, "quantity_liters"), milkPaid = sum(milkPay, "amount");
  const grainAmt = sum(grainL, "total_amount"), grainPaid = sum(grainPL, "amount");
  const fclLatest = new Map<string, number>(); for (const x of fcl) if (!fclLatest.has(x.farmer_id)) fclLatest.set(x.farmer_id, num(x.balance_after));
  const sBillsL = sBills.filter((b: any) => !VOID.includes(String(b.status ?? "")));
  const bt = (s: any) => shops.get(s.shop_id)?.business_type ?? null;
  const kOf = (s: any) => shopKey(bt(s), shops.get(s.shop_id)?.name).key;

  const lines = buildShopLines({
    pos: posL.map((s: any) => ({ total: num(s.total_amount), credit: num(s.khata_amount), shopBt: bt(s), shopName: shops.get(s.shop_id)?.name ?? null })),
    khataBalance: khataBal, hasKhata: custs.length > 0 && (posL.length > 0 || khataBal !== 0),
    milk: milkL.length || milkPaid ? { amount: milkAmt, paid: milkPaid, due: milkBal.length ? sum(milkBal, "balance_due") : null } : null,
    grain: grainL.length || grainPaid ? { amount: grainAmt, paid: grainPaid } : null,
    fertCredit: fcl.length ? { debit: sum(fcl.filter((x: any) => x.ledger_type === "debit"), "amount"), credit: sum(fcl.filter((x: any) => x.ledger_type === "credit"), "amount"), balance: r2(Array.from(fclLatest.values()).reduce((a, b) => a + b, 0)) } : null,
    supplier: sBillsL.length || sPays.length ? { bought: sum(sBillsL, "total_amount"), paid: sum(sPays, "amount") } : null,
    buyer: bSales.length ? { sold: sum(bSales, "total_amount"), received: sum(bSales, "amount_received") } : null,
  });
  const posBy = (k: string) => posL.filter((s: any) => kOf(s) === k);
  const posRows = (k: string) => posBy(k).slice(0, 10).map((s: any) => [pk(s.created_at), rs(num(s.total_amount)), rs(num(s.khata_amount))]);
  const tot = (a: any[]) => rs(sum(a, "total_amount"));
  const sections: Section[] = [
    { title: "Doodh supply (milk_entries)", columns: ["Tareekh", "Shift", "Liter", "Fat%", "Rate", "Raqam"], rows: milkL.slice(0, 12).map((m: any) => [pk(m.entry_date), m.shift ?? "—", num(m.quantity_liters), m.fat_percentage ?? "—", m.rate_per_liter ?? "—", rs(num(m.total_amount))]),
      note: milkL.length ? `Kul ${rs(milkLiters)} L · Rs ${rs(milkAmt)} · diya Rs ${rs(milkPaid)}` : undefined, empty: F.length ? "Doodh nahi diya (koi milk entry nahi)." : "Kisan record se link nahi — doodh ka record nahi mil sakta." },
    { title: "Kisaan Vets (services/dawai)", columns: ["Tareekh", "Raqam", "Udhaar"], rows: posRows("vets"), note: `Kul Rs ${tot(posBy("vets"))}`, empty: "Vets se kuch nahi liya." },
    { title: "Kisaan Karyana", columns: ["Tareekh", "Raqam", "Udhaar"], rows: posRows("karyana"), note: `Kul Rs ${tot(posBy("karyana"))}`, empty: "Karyana se kuch nahi liya." },
    { title: "Kisaan Dukan (khaad/beej/spray/wanda) + agri orders", columns: ["Tareekh", "Ref", "Raqam", "Status"],
      rows: [...posBy("dukan").slice(0, 10).map((s: any) => [pk(s.created_at), "POS", rs(num(s.total_amount)), num(s.khata_amount) > 0 ? "udhaar" : "naqad"]), ...agri.slice(0, 10).map((o: any) => [pk(o.created_at), o.order_number ?? "order", rs(num(o.grand_total)), o.status ?? "—"])],
      note: `POS Rs ${tot(posBy("dukan"))} · agri orders Rs ${rs(sum(agri.filter((o: any) => !VOID.includes(String(o.status))), "grand_total"))}`, empty: "Dukan se khareed nahi." },
    { title: "Fasal Procurement ko", columns: ["Tareekh", "Fasal", "Kg", "Bori", "Rate/mand", "Raqam"], rows: grainL.slice(0, 12).map((g: any) => [pk(g.entry_date), g.grain_type ?? "—", rs(num(g.weight_kg)), g.bag_count ?? "—", rs(num(g.rate_per_kg) * 40), rs(num(g.total_amount))]),
      note: grainL.length ? `Kul Rs ${rs(grainAmt)} · diya Rs ${rs(grainPaid)} · baqi Rs ${rs(grainAmt - grainPaid)}` : undefined, empty: "Fasal nahi bechi." },
    { title: "Khaad credit (farmer_credit_ledger)", columns: ["Tareekh", "Source", "Qisam", "Raqam", "Baqaya"], rows: fcl.slice(0, 12).map((x: any) => [pk(x.created_at), x.source_type, x.ledger_type, rs(num(x.amount)), rs(num(x.balance_after))]), empty: "Khaad credit nahi liya." },
    { title: "Season bookings", columns: ["Campaign", "Fasal", "Acre", "Status", "Tareekh"], rows: bookings.map((b: any) => [b.booking_campaigns?.name ?? "—", b.booking_campaigns?.crop ?? "—", num(b.acres), b.status ?? "—", pk(b.created_at)]), empty: "Koi booking nahi." },
    { title: "Waade (Promise to pay)", columns: ["Party", "Tareekh", "Raqam", "Din", "Status", "Wasool"], rows: promises.map((p: any) => [p.party_type, pk(p.promise_date), rs(num(p.promised_amount)), p.promised_days ?? "—", p.status ?? "—", rs(num(p.fulfilled_amount))]), empty: "Koi waada darj nahi." },
  ];
  const timeline: TimelineItem[] = [
    ...posL.slice(0, 40).map((s: any) => ({ date: s.created_at, label: `${shops.get(s.shop_id)?.name ?? "POS"} bill${num(s.khata_amount) > 0 ? " (udhaar)" : ""}`, amount: num(s.total_amount), tone: "info" as const })),
    ...milkL.slice(0, 20).map((m: any) => ({ date: m.entry_date, label: `Doodh ${num(m.quantity_liters)} L`, amount: num(m.total_amount), tone: "good" as const })),
    ...milkPay.map((m: any) => ({ date: m.payment_date, label: "Doodh payment di", amount: num(m.amount), tone: "neutral" as const })),
    ...grainL.map((g: any) => ({ date: g.entry_date, label: `Fasal khareedi (${g.grain_type ?? ""})`, amount: num(g.total_amount), tone: "good" as const })),
    ...grainPL.map((g: any) => ({ date: g.payment_date, label: "Fasal payment di", amount: num(g.amount), tone: "neutral" as const })),
    ...fcl.slice(0, 20).map((x: any) => ({ date: x.created_at, label: `Khaad credit ${x.ledger_type}`, amount: num(x.amount), tone: x.ledger_type === "debit" ? "bad" as const : "good" as const })),
    ...bookings.map((b: any) => ({ date: b.created_at, label: `Booking: ${b.booking_campaigns?.name ?? "campaign"}`, tone: "info" as const })),
    ...promises.map((p: any) => ({ date: p.created_at, label: `Waada ${pk(p.promise_date)} tak (${p.status})`, amount: num(p.promised_amount), tone: "warn" as const })),
  ];
  const links = [
    ...farmers.map((f: any) => ({ label: `Kisan: ${f.full_name}`, href: `/admin/intelligence/party?type=farmer&id=${f.id}` })),
    ...custs.map((c: any) => ({ label: `Customer khata: ${c.name}`, href: `/admin/intelligence/party?type=customer&id=${c.id}` })),
    ...S.map((id) => ({ label: "Supplier", href: `/admin/intelligence/party?type=supplier&id=${id}` })),
    ...B.map((id) => ({ label: "Grain buyer", href: `/admin/intelligence/party?type=buyer&id=${id}` })),
  ].filter((l) => !opts.selfHref.endsWith(l.href.split("?")[1] ?? "__"));
  return {
    roles: rolesFrom({ farmers: F.length, customers: C.length, milk: milkL.length > 0, suppliers: S.length, buyers: B.length, dealer: opts.dealer }),
    shops: lines, net: netPosition(lines), sections, timeline, links,
    monthly: { months: labels, series: [
      { name: "Dukanon se khareed", values: monthlySeries(posL.map((s: any) => ({ date: s.created_at, amount: num(s.total_amount) })), keys), color: "bg-blue-500" },
      { name: "Doodh humein", values: monthlySeries(milkL.map((m: any) => ({ date: m.entry_date, amount: num(m.total_amount) })), keys), color: "bg-emerald-500" },
      { name: "Fasal humein", values: monthlySeries(grainL.map((g: any) => ({ date: g.entry_date, amount: num(g.total_amount) })), keys), color: "bg-amber-500" },
    ] },
    khataAging: khataBal > 0 ? agingFifo(posL.map((s: any) => ({ date: s.created_at, amount: num(s.khata_amount) })), khataBal, now) : null,
    totals: { pos: sum(posL, "total_amount"), milkLiters, milkAmt, grainAmt, posBills: posL.length },
    primaryCustomerId: C[0] ?? null,
  };
}
