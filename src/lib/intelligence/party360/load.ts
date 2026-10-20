import { createServiceClient } from "@/lib/supabase/service";
import {
  agingFifo, grainSaleRow, lastMonths, monthlySeries, num, phoneKey, r2,
  type Party360Data, type Section, type TimelineItem,
} from "./core";
import { loadActivity, resolveLinks, q as aq, type LinkIds } from "./activity";
import { loadLinkedParties, supplierGlLines } from "@/lib/party-links/load";
import { glToStatementRows, type GlLine } from "@/lib/party-links/core";

/** Sirf PARHNA. Koi write nahi. Har query ki ghalti notes mein jaati hai, page nahi girta. */
const LIMIT = 5000;
const VOID = ["cancelled", "void", "voided", "returned", "refunded"];
const pk = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+05:00` : iso);
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }).replace(/\//g, "-");
};
const rs = (n: number) => Math.round(n).toLocaleString("en-PK");

type Db = any;
const q = (_db: Db, notes: string[], label: string, p: PromiseLike<{ data: any; error: any }>) => aq(notes, label, p);
async function withActivity(db: Db, notes: string[], d: Party360Data, seed: Partial<LinkIds>, now: Date, dealer = false): Promise<Party360Data> {
  const ids = await resolveLinks(db, notes, seed);
  const act = await loadActivity(db, notes, ids, { now, dealer, selfHref: `type=${d.type}&id=${d.id}` });
  return { ...d, activity: act, notes };
}

async function shopMap(db: Db, notes: string[]) {
  const rows = await q(db, notes, "shops", db.from("shops").select("id,name,business_type"));
  return new Map<string, { name: string; bt: string | null }>(rows.map((s: any) => [s.id, { name: s.name, bt: s.business_type }]));
}

async function posFor(db: Db, notes: string[], customerIds: string[]) {
  if (!customerIds.length) return [];
  const list = customerIds.join(",");
  const rows = await q(db, notes, "pos_sales", db.from("pos_sales").select("id,created_at,total_amount,khata_amount,cash_paid,status,shop_id")
    .or(`customer_id.in.(${list}),crm_customer_id.in.(${list})`).order("created_at", { ascending: false }).limit(LIMIT));
  return rows.filter((s: any) => !VOID.includes(String(s.status ?? "completed")));
}

async function basket(db: Db, notes: string[], saleIds: string[]) {
  if (!saleIds.length) return [];
  const items = await q(db, notes, "pos_sale_items", db.from("pos_sale_items").select("subtotal,products(name,categories(name))").in("sale_id", saleIds.slice(0, 1000)).limit(LIMIT));
  const m = new Map<string, number>();
  for (const it of items) { const c = it.products?.categories?.name ?? "Uncategorized"; m.set(c, (m.get(c) ?? 0) + num(it.subtotal)); }
  const tot = Array.from(m.values()).reduce((a, b) => a + b, 0);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, rs(v), tot ? `${Math.round((v / tot) * 100)}%` : "—"]);
}

async function promisesFor(db: Db, notes: string[], parties: { type: string; id: string }[]) {
  const out: any[] = [];
  for (const p of parties) out.push(...(await q(db, notes, "payment_promises", db.from("payment_promises").select("promise_date,promised_amount,promised_days,status,fulfilled_amount,created_at").eq("party_type", p.type).eq("party_id", p.id).order("created_at", { ascending: false }).limit(50))));
  return out;
}
const promiseSection = (rows: any[]): Section => ({
  title: "Waade (Promise to pay)", columns: ["Tareekh", "Raqam", "Din", "Status", "Wasool"],
  rows: rows.map((p) => [pk(p.promise_date), rs(num(p.promised_amount)), p.promised_days ?? "—", p.status ?? "—", rs(num(p.fulfilled_amount))]),
  empty: "Koi waada darj nahi.",
});

const sortTimeline = (t: TimelineItem[]) => t.filter((x) => x.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 25);

// ───────────────────────── FARMER ─────────────────────────
export async function loadFarmer360(id: string, now = new Date()): Promise<Party360Data> {
  const db = createServiceClient() as Db; const notes: string[] = [];
  const [f] = await q(db, notes, "farmers", db.from("farmers").select("*").eq("id", id).maybeSingle());
  if (!f) throw new Error("Kisan nahi mila.");
  const ids = await resolveLinks(db, notes, { farmerIds: [id] });
  const act = await loadActivity(db, notes, ids, { now, selfHref: `type=farmer&id=${id}` });
  // phone hint (sirf dikhana, merge nahi)
  const pkey = phoneKey(f.phone_number);
  const hints = pkey ? (await q(db, notes, "customers(phone)", db.from("customers").select("id,name,farmer_id").ilike("phone_number", `%${pkey}`).limit(10))).filter((c: any) => !c.farmer_id) : [];
  const n = act.net;
  const badges: Party360Data["badges"] = [
    f.is_verified ? { label: "Verified", tone: "good" } : { label: "Unverified", tone: "warn" },
    ...(f.signup_approval_status && f.signup_approval_status !== "approved" ? [{ label: `Signup: ${f.signup_approval_status}`, tone: "warn" as const }] : []),
    ...(!f.land_size_acres || !(f.crop_types ?? []).length ? [{ label: "Profile adhoora (acres/faslein)", tone: "warn" as const }] : []),
    { label: `Credit: ${f.credit_status ?? "none"}`, tone: f.credit_status === "blocked" ? "bad" : "neutral" },
  ];
  return {
    type: "farmer", id, name: f.full_name ?? "—", code: f.farmer_code,
    sub: [f.farmer_code, f.phone_number, [f.village, f.tehsil, f.district].filter(Boolean).join(", ") || "Gaon/tehsil darj nahi"].filter(Boolean),
    badges,
    actions: [
      { label: "Statement", href: `/admin/farmers/${id}/statement`, primary: true },
      ...(act.primaryCustomerId ? [{ label: "Wasooli / waada", href: `/admin/crm/${act.primaryCustomerId}/credit` }] : []),
      { label: "Profile", href: `/admin/farmers/${id}` },
      { label: "Naya bill (POS)", href: "/admin/pos" },
      ...(f.phone_number ? [{ label: "WhatsApp draft", href: `https://wa.me/${String(f.phone_number).replace(/\D/g, "")}` }] : []),
    ],
    kpis: [
      { label: "Dukanon se khareeda", value: ids.customerIds.length ? act.totals.pos : null, fmt: "rs", hint: ids.customerIds.length ? `${act.totals.posBills} bill` : "linked customer nahi" },
      { label: "Doodh diya", value: act.roles.includes("milk") ? act.totals.milkLiters : null, fmt: "num", hint: act.roles.includes("milk") ? `L · Rs ${rs(act.totals.milkAmt)}` : "milk entries nahi" },
      { label: "Fasal becha", value: act.totals.grainAmt || null, fmt: "rs" },
      { label: "Hum ne dena", value: n.weOwe, fmt: "rs", tone: n.weOwe ? "bad" : "neutral" },
      { label: "Unhon ne dena", value: n.theyOwe, fmt: "rs", tone: n.theyOwe ? "warn" : "neutral" },
      { label: "Net", value: Math.abs(n.net), fmt: "rs", tone: n.net > 0 ? "warn" : n.net < 0 ? "bad" : "good", hint: n.net > 0 ? "kisan ne dena" : n.net < 0 ? "hum ne dena" : "barabar" },
    ],
    monthly: { title: "Mahana: dukanon se khareed vs doodh/fasal humein", ...act.monthly },
    aging: act.khataAging, agingNote: "Khata baqaya FIFO (purane bill pehle chukte hain)",
    creditCustomerId: act.primaryCustomerId,
    activity: act,
    links: hints.map((c: any) => ({ label: `Mumkin match (same phone, link NAHI): ${c.name}`, href: `/admin/intelligence/party?type=customer&id=${c.id}` })),
    sections: [
      { title: "Farm profile", columns: ["", ""], rows: [
        ["Zameen", f.land_size_acres ? `${f.land_size_acres} acre` : "—"], ["Faslein", (f.crop_types ?? []).join(", ") || "—"],
        ["Janwar", `Gaye ${num(f.cow_count)} · Bhains ${num(f.buffalo_count)} · Bachray ${num(f.calves_count)}`],
        ["Doodh/din", f.milk_liters_per_day ? `${f.milk_liters_per_day} L` : "—"], ["Milk collection", f.milk_collection_type ?? "—"],
        ["Credit limit", f.credit_limit ? `Rs ${rs(num(f.credit_limit))}` : "—"],
        ["Bank/Wallet", [f.bank_name, f.mobile_wallet_provider].filter(Boolean).join(" · ") || "—"],
      ] },
    ],
    timeline: act.timeline.sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 25),
    notes: ["Links sirf explicit: customers.farmer_id, buyers.customer_id. Phone match sirf hint, merge nahi.", ...notes],
  };
}

// ───────────────────────── CUSTOMER ─────────────────────────
export async function loadCustomer360(id: string, now = new Date()): Promise<Party360Data> {
  const db = createServiceClient() as Db; const notes: string[] = [];
  const [c] = await q(db, notes, "customers", db.from("customers").select("*").eq("id", id).maybeSingle());
  if (!c) throw new Error("Customer nahi mila.");
  const plinks = await loadLinkedParties({ customerId: id, db }).catch(() => [] as Awaited<ReturnType<typeof loadLinkedParties>>);
  const { keys, labels } = lastMonths(now);
  const shops = await shopMap(db, notes);
  const [pos, gsales, buyers, farmer, agri] = await Promise.all([
    posFor(db, notes, [id]),
    q(db, notes, "grain_sales", db.from("grain_sales").select("id,sale_number,sale_date,quantity_kg,rate_per_kg,total_amount,amount_received,grain_type").eq("customer_id", id).limit(500)),
    q(db, notes, "buyers", db.from("buyers").select("id,business_name").eq("customer_id", id).limit(5)),
    c.farmer_id ? q(db, notes, "farmers", db.from("farmers").select("id,full_name").eq("id", c.farmer_id).maybeSingle()) : Promise.resolve([]),
    q(db, notes, "agri_orders", db.from("agri_orders").select("order_number,created_at,grand_total,status").eq("customer_id", id).limit(200)),
  ]);
  const promises = await promisesFor(db, notes, [{ type: "customer", id }]);
  const overrides = await q(db, notes, "credit_block_overrides", db.from("credit_block_overrides").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(10));
  const bas = await basket(db, notes, pos.map((s: any) => s.id));
  const bal = num(c.current_balance);
  const posTotal = r2(pos.reduce((a: number, s: any) => a + num(s.total_amount), 0));
  const credit = r2(pos.reduce((a: number, s: any) => a + num(s.khata_amount), 0));
  const gs = gsales.map((g: any) => ({ ...g, ...grainSaleRow(g) }));
  const received90 = r2(pos.filter((s: any) => now.getTime() - new Date(s.created_at).getTime() < 90 * 864e5).reduce((a: number, s: any) => a + num(s.total_amount) - Math.min(num(s.total_amount), num(s.khata_amount)), 0) + gs.reduce((a: number, g: any) => a + g.received, 0));
  const last = pos[0]?.created_at ?? null;
  const openPromise = promises.find((p: any) => ["pending", "open"].includes(String(p.status)));
  const tl: TimelineItem[] = [
    ...pos.slice(0, 30).map((s: any) => ({ date: s.created_at, label: `${shops.get(s.shop_id)?.name ?? "POS"} bill${num(s.khata_amount) > 0 ? " (khata)" : ""}`, amount: num(s.total_amount), tone: "info" as const })),
    ...gs.map((g: any) => ({ date: g.sale_date, label: `Grain sale ${g.sale_number}`, amount: g.total, tone: "good" as const })),
    ...promises.map((p: any) => ({ date: p.created_at, label: `Waada ${pk(p.promise_date)} tak (${p.status})`, amount: num(p.promised_amount), tone: "warn" as const })),
    ...overrides.map((o: any) => ({ date: o.created_at, label: `Udhaar override${o.reason ? `: ${o.reason}` : ""}`, amount: num(o.amount ?? o.sale_amount ?? 0) || null, tone: "bad" as const })),
  ];
  return withActivity(db, notes, {
    type: "customer", id, name: c.name ?? "—",
    sub: [c.customer_type, c.phone_number, c.cnic, shops.get(c.shop_id)?.name].filter(Boolean),
    badges: [
      { label: bal > 0 ? "Khata baqaya" : "Khata saaf", tone: bal > 0 ? "warn" : "good" },
      ...(c.overdue_block_exempt ? [{ label: "Hadd se mustasna", tone: "info" as const }] : []),
      ...(c.overdue_block_days ? [{ label: `Apni hadd ${c.overdue_block_days} din`, tone: "info" as const }] : []),
      { label: openPromise ? "Waada khula" : "Koi khula waada nahi", tone: openPromise ? "good" : "neutral" },
      ...(farmer[0] ? [{ label: "Kisan se linked", tone: "info" as const }] : []),
      ...(buyers.length ? [{ label: `Grain buyer se linked (${buyers.length})`, tone: "info" as const }] : []),
      ...(plinks.length ? [{ label: "Customer + Supplier", tone: "info" as const }] : []),
    ],
    actions: [
      { label: "Statement", href: `/admin/crm/${id}/statement`, primary: true },
      { label: "Wasooli / waada", href: `/admin/crm/${id}/credit` },
      { label: "Khata Recovery", href: "/admin/receivable-reminders" },
      { label: "Naya bill (POS)", href: "/admin/pos" },
      ...(c.phone_number ? [{ label: "WhatsApp draft", href: `https://wa.me/${String(c.phone_number).replace(/\D/g, "")}` }] : []),
    ],
    kpis: [
      { label: "Kul baqaya", value: bal, fmt: "rs", tone: bal > 0 ? "bad" : "good", hint: "purana khata + POS udhaar − wasooli" },
      { label: "POS khareed", value: posTotal, fmt: "rs", hint: `${pos.length} bill` },
      { label: "POS bills ka udhaar", value: credit, fmt: "rs", hint: "sirf POS bills par" },
      { label: "Purana khata baqaya", value: r2(Math.max(0, bal - credit)), fmt: "rs", tone: bal - credit > 0 ? "warn" : "neutral", hint: "opening / journal / grain (POS ke ilawa)" },
      { label: "Wasooli (90 din)", value: received90, fmt: "rs", tone: "good", hint: "POS naqad + grain receipt" },
      { label: "Akhri bill", value: last ? pk(last) : null, fmt: "text", hint: pos[0] ? `Rs ${rs(num(pos[0].total_amount))}` : "" },
    ],
    monthly: { title: "Mahana khareed vs udhaar", months: labels, series: [
      { name: "Khareed", values: monthlySeries([...pos.map((s: any) => ({ date: s.created_at, amount: num(s.total_amount) })), ...gs.map((g: any) => ({ date: g.sale_date, amount: g.total }))], keys), color: "bg-blue-500" },
      { name: "Udhaar", values: monthlySeries(pos.map((s: any) => ({ date: s.created_at, amount: num(s.khata_amount) })), keys), color: "bg-red-400" },
    ] },
    aging: bal > 0 ? agingFifo([...pos.map((s: any) => ({ date: s.created_at, amount: num(s.khata_amount) })), ...gs.map((g: any) => ({ date: g.sale_date, amount: g.due }))], bal, now) : null,
    agingNote: "FIFO; jo baqaya kisi bill se na mile (opening/journal) wo 90+ mein",
    creditCustomerId: id,
    links: [
      ...(farmer[0] ? [{ label: `Kisan: ${farmer[0].full_name}`, href: `/admin/intelligence/party?type=farmer&id=${farmer[0].id}` }] : []),
      ...buyers.map((b: any) => ({ label: `Grain buyer: ${b.business_name}`, href: `/admin/intelligence/party?type=buyer&id=${b.id}` })),
      ...plinks.map((l) => ({ label: `Supplier: ${l.supplierName}`, href: `/admin/intelligence/party?type=supplier&id=${l.supplierId}` })),
    ],
    sections: [
      ...linkedSections(plinks, c.name ?? "—"),
      promiseSection(promises),
      { title: "Basket (kya khareedta hai)", columns: ["Category", "Raqam", "Hissa"], rows: bas, empty: "Koi item nahi." },
      { title: "Recent bills", columns: ["Tareekh", "Dukan", "Raqam", "Khata"], rows: pos.slice(0, 12).map((s: any) => [pk(s.created_at), shops.get(s.shop_id)?.name ?? "—", rs(num(s.total_amount)), rs(num(s.khata_amount))]), empty: "Koi bill nahi." },
      { title: "Grain sales (is customer ke naam)", columns: ["Sale #", "Tareekh", "Kg", "Rate/mand", "Raqam", "Mila", "Baqi"], rows: gs.map((g: any) => [g.sale_number, pk(g.sale_date), rs(g.kg), rs(g.ratePerMand), rs(g.total), rs(g.received), rs(g.due)]), empty: "Koi grain sale nahi." },
      { title: "Agri orders", columns: ["#", "Tareekh", "Raqam", "Status"], rows: agri.map((o: any) => [o.order_number, pk(o.created_at), rs(num(o.grand_total)), o.status]), empty: "Koi agri order nahi." },
    ],
    timeline: sortTimeline(tl), notes,
  }, { customerIds: [id] }, now);
}

// ───────────────────────── SUPPLIER ─────────────────────────
export async function loadSupplier360(id: string, now = new Date()): Promise<Party360Data> {
  const db = createServiceClient() as Db; const notes: string[] = [];
  const [s] = await q(db, notes, "suppliers", db.from("suppliers").select("*").eq("id", id).maybeSingle());
  if (!s) throw new Error("Supplier nahi mila.");
  const { keys, labels } = lastMonths(now);
  const [plinks, glAll] = await Promise.all([
    loadLinkedParties({ supplierId: id, db }).catch(() => [] as Awaited<ReturnType<typeof loadLinkedParties>>),
    supplierGlLines(db, id).catch(() => [] as GlLine[]),
  ]);
  const glRows = glToStatementRows(glAll);
  const glBills = r2(glRows.reduce((a, r) => a + r.debit, 0));
  const glPaid = r2(glRows.reduce((a, r) => a + r.credit, 0));
  const [bills, pays] = await Promise.all([
    q(db, notes, "purchases", db.from("purchases").select("id,purchase_number,supplier_bill_no,purchase_date,due_date,status,total_amount,received_at,review_status").eq("supplier_id", id).order("purchase_date", { ascending: false }).limit(LIMIT)),
    q(db, notes, "supplier_payments", db.from("supplier_payments").select("payment_date,amount,payment_method,purchase_id").eq("supplier_id", id).limit(LIMIT)),
  ]);
  const live = bills.filter((b: any) => !VOID.includes(String(b.status ?? "")));
  const items = live.length ? await q(db, notes, "purchase_items", db.from("purchase_items").select("purchase_id,quantity,unit_cost,products(name)").in("purchase_id", live.map((b: any) => b.id).slice(0, 500)).limit(LIMIT)) : [];
  const bought = r2(live.reduce((a: number, b: any) => a + num(b.total_amount), 0));
  const paid = r2(pays.reduce((a: number, p: any) => a + num(p.amount), 0));
  // 621: Recovery / Kharche / settlement ki 2000/1120 qatarein bhi (purchase/supplier_payment dobara nahi).
  const payable = r2(bought - paid + glBills - glPaid);
  const paidBy = new Map<string, number>(); for (const p of pays) if (p.purchase_id) paidBy.set(p.purchase_id, (paidBy.get(p.purchase_id) ?? 0) + num(p.amount));
  const pending = live.filter((b: any) => !b.received_at).length;
  // rate history: har product ka pichla vs naya unit cost
  const dateOf = new Map<string, string>(live.map((b: any) => [b.id, b.purchase_date]));
  const byProd = new Map<string, { d: string; c: number }[]>();
  for (const it of items) { const n = it.products?.name ?? "—"; const a = byProd.get(n) ?? []; a.push({ d: dateOf.get(it.purchase_id) ?? "", c: num(it.unit_cost) }); byProd.set(n, a); }
  const rates = Array.from(byProd.entries()).map(([n, a]) => { a.sort((x, y) => (x.d < y.d ? -1 : 1)); const prev = a.length > 1 ? a[a.length - 2].c : null, cur = a[a.length - 1].c; return [n, prev == null ? "—" : rs(prev), rs(cur), prev ? `${(((cur - prev) / prev) * 100).toFixed(1)}%` : "—", pk(a[a.length - 1].d)]; }).slice(0, 15);
  return withActivity(db, notes, {
    type: "supplier", id, name: s.name ?? "—",
    sub: [s.company_name, s.phone_number, s.ntn_number ? `NTN ${s.ntn_number}` : null].filter(Boolean),
    badges: [...(plinks.length ? [{ label: "Customer + Supplier", tone: "info" as const }] : []), { label: payable > 0 ? "Payable" : "Saaf", tone: payable > 0 ? "bad" : "good" }, { label: s.is_active === false ? "Inactive" : "Active", tone: s.is_active === false ? "warn" : "good" }, ...(pending ? [{ label: `${pending} GRN baqi`, tone: "warn" as const }] : [])],
    actions: [
      { label: "Statement", href: `/admin/suppliers/${id}/statement`, primary: true },
      { label: "Payment karein", href: "/admin/suppliers" },
      { label: "Naya purchase/GRN", href: "/admin/purchases/new" },
      ...(s.phone_number ? [{ label: "WhatsApp draft", href: `https://wa.me/${String(s.phone_number).replace(/\D/g, "")}` }] : []),
    ],
    kpis: [
      { label: "Kul khareed", value: bought, fmt: "rs", hint: `${live.length} bill` },
      { label: "Payments", value: r2(paid + glPaid), fmt: "rs", hint: `${pays.length} payment${glPaid ? ` + ledger Rs ${rs(glPaid)}` : ""}` },
      { label: "Payable", value: payable, fmt: "rs", tone: payable > 0 ? "bad" : "good", hint: s.current_payable != null ? `suppliers.current_payable Rs ${rs(num(s.current_payable))}` : "bills – payments" },
      { label: "Akhri bill", value: live[0] ? pk(live[0].purchase_date) : null, fmt: "text", hint: live[0] ? `Rs ${rs(num(live[0].total_amount))}` : "" },
      { label: "Bara bill", value: live.length ? Math.max(...live.map((b: any) => num(b.total_amount))) : null, fmt: "rs" },
      { label: "GRN baqi", value: pending, fmt: "num", tone: pending ? "warn" : "neutral" },
    ],
    monthly: { title: "Mahana khareed vs payment", months: labels, series: [
      { name: "Khareed", values: monthlySeries(live.map((b: any) => ({ date: b.purchase_date, amount: num(b.total_amount) })), keys), color: "bg-orange-500" },
      { name: "Payment", values: monthlySeries(pays.map((p: any) => ({ date: p.payment_date, amount: num(p.amount) })), keys), color: "bg-emerald-500" },
    ] },
    aging: payable > 0 ? agingFifo(live.map((b: any) => ({ date: b.purchase_date, amount: num(b.total_amount) })), payable, now) : null,
    agingNote: "Payables FIFO (bill date se)",
    links: plinks.map((l) => ({ label: `Customer: ${l.customerName}`, href: `/admin/intelligence/party?type=customer&id=${l.customerId}` })),
    sections: [
      ...linkedSections(plinks, s.name ?? "—"),
      { title: "Ledger entries (2000/1120) — Recovery, Kharche bill, settlement", note: "Purchases aur supplier payments upar/neeche apni table se; yahan sirf baqi ledger qatarein.",
        columns: ["Tareekh", "Tafseel", "Bill (dena barha)", "Payment (dena ghata)"],
        rows: glRows.slice().reverse().slice(0, 30).map((r) => [pk(r.date), r.description, r.debit ? rs(r.debit) : "—", r.credit ? rs(r.credit) : "—"]), empty: "Koi ledger qatar nahi." },
      { title: "Purchase bills / GRN", columns: ["Bill #", "Supplier bill", "Tareekh", "Due", "Raqam", "Paid (bill par)", "GRN"],
        rows: live.slice(0, 30).map((b: any) => [b.purchase_number, b.supplier_bill_no ?? "—", pk(b.purchase_date), pk(b.due_date), rs(num(b.total_amount)), rs(paidBy.get(b.id) ?? 0), b.received_at ? pk(b.received_at) : "baqi"]), empty: "Koi bill nahi." },
      { title: "Rate history", columns: ["Item", "Pichla", "Naya", "Farq", "Tareekh"], rows: rates, empty: "Items nahi mile." },
      { title: "Payments", columns: ["Tareekh", "Raqam", "Tareeqa"], rows: pays.sort((a: any, b: any) => (a.payment_date < b.payment_date ? 1 : -1)).slice(0, 20).map((p: any) => [pk(p.payment_date), rs(num(p.amount)), p.payment_method ?? "—"]), empty: "Koi payment nahi." },
    ],
    timeline: sortTimeline([
      ...live.map((b: any) => ({ date: b.purchase_date, label: `Bill ${b.purchase_number}`, amount: num(b.total_amount), tone: "warn" as const })),
      ...pays.map((p: any) => ({ date: p.payment_date, label: "Payment di", amount: num(p.amount), tone: "good" as const })),
      ...glRows.map((r) => ({ date: r.date, label: r.description, amount: r.debit || r.credit, tone: (r.debit ? "warn" : "good") as "warn" | "good" })),
    ]),
    notes,
  }, { supplierIds: [id] }, now);
}

// ───────────────────────── BUYER ─────────────────────────
export async function loadBuyer360(id: string, now = new Date()): Promise<Party360Data> {
  const db = createServiceClient() as Db; const notes: string[] = [];
  const [b] = await q(db, notes, "buyers", db.from("buyers").select("*").eq("id", id).maybeSingle());
  if (!b) throw new Error("Buyer nahi mila.");
  const { keys, labels } = lastMonths(now);
  const [sales, orders, bpays] = await Promise.all([
    q(db, notes, "grain_sales", db.from("grain_sales").select("id,sale_number,sale_date,grain_type,quantity_kg,rate_per_kg,total_amount,amount_received,profit,delivery_term").eq("buyer_id", id).order("sale_date", { ascending: false }).limit(LIMIT)),
    q(db, notes, "produce_orders", db.from("produce_orders").select("order_number,placed_at,subtotal,status").eq("buyer_id", id).limit(LIMIT)),
    q(db, notes, "buyer_payments", db.from("buyer_payments").select("payment_date,amount,direction").eq("buyer_id", id).limit(LIMIT)),
  ]);
  const gs = sales.map((s: any) => ({ ...s, ...grainSaleRow(s) }));
  const spays = gs.length ? await q(db, notes, "grain_sale_payments", db.from("grain_sale_payments").select("sale_id,amount,payment_date,created_at,payment_method").in("sale_id", gs.map((s: any) => s.id)).limit(LIMIT)) : [];
  const [cust] = b.customer_id ? await q(db, notes, "customers", db.from("customers").select("id,name").eq("id", b.customer_id).maybeSingle()) : [];
  const total = r2(gs.reduce((a: number, s: any) => a + s.total, 0)), kg = r2(gs.reduce((a: number, s: any) => a + s.kg, 0));
  const received = r2(gs.reduce((a: number, s: any) => a + s.received, 0)), due = r2(gs.reduce((a: number, s: any) => a + s.due, 0));
  const profit = r2(gs.reduce((a: number, s: any) => a + num(s.profit), 0));
  const poTotal = r2(orders.reduce((a: number, o: any) => a + num(o.subtotal), 0));
  const avgRate = kg ? r2((total / kg) * 40) : null;
  return withActivity(db, notes, {
    type: "buyer", id, name: b.business_name ?? "—", code: b.buyer_code,
    sub: [b.buyer_code, b.contact_person, b.phone_number].filter(Boolean),
    badges: [
      ...Array.from(new Set(gs.map((s: any) => s.grain_type).filter(Boolean))).map((g) => ({ label: `${g} buyer`, tone: "info" as const })),
      { label: due > 0 ? `Receivable Rs ${rs(due)}` : "Saaf", tone: due > 0 ? "bad" : "good" },
      { label: `${gs.length} grain sale`, tone: "neutral" },
    ],
    actions: [
      { label: "Statement", href: `/admin/buyers/${id}/statement`, primary: true },
      { label: "Grain sales", href: "/admin/grain-procurement" },
      ...(b.phone_number ? [{ label: "WhatsApp draft", href: `https://wa.me/${String(b.phone_number).replace(/\D/g, "")}` }] : []),
    ],
    kpis: [
      { label: "Kul sale", value: total, fmt: "rs", hint: `${gs.length} grain sale${poTotal ? ` + PO Rs ${rs(poTotal)}` : ""}` },
      { label: "Wazan", value: kg, fmt: "kg", hint: `${rs(kg / 40)} mand` },
      { label: "Avg rate/mand", value: avgRate, fmt: "rs" },
      { label: "Wasooli", value: received, fmt: "rs", tone: "good" },
      { label: "Baqaya", value: due, fmt: "rs", tone: due > 0 ? "bad" : "good" },
      { label: "Munafa", value: profit, fmt: "rs", tone: "good" },
    ],
    monthly: { title: "Mahana sale (Rs) vs wasooli", months: labels, series: [
      { name: "Sale", values: monthlySeries(gs.map((s: any) => ({ date: s.sale_date, amount: s.total })), keys), color: "bg-amber-500" },
      { name: "Wasooli", values: monthlySeries(spays.map((p: any) => ({ date: p.payment_date ?? p.created_at, amount: num(p.amount) })), keys), color: "bg-emerald-500" },
    ] },
    aging: due > 0 ? agingFifo(gs.map((s: any) => ({ date: s.sale_date, amount: s.due })), due, now) : null,
    agingNote: "Har sale ka baqi uski tareekh se",
    links: cust ? [{ label: `Customer khata: ${cust.name} (alag party, merge nahi)`, href: `/admin/intelligence/party?type=customer&id=${cust.id}` }] : [],
    sections: [
      { title: "Grain sales", columns: ["Sale #", "Tareekh", "Fasal", "Kg", "Mand", "Rate/mand", "Raqam", "Mila", "Baqi", "Munafa"],
        rows: gs.map((s: any) => [s.sale_number, pk(s.sale_date), s.grain_type, rs(s.kg), s.mand, rs(s.ratePerMand), rs(s.total), rs(s.received), rs(s.due), rs(num(s.profit))]), empty: "Koi grain sale nahi." },
      { title: "Wasooli (grain_sale_payments)", columns: ["Tareekh", "Raqam", "Tareeqa"], rows: spays.map((p: any) => [pk(p.payment_date ?? p.created_at), rs(num(p.amount)), p.payment_method ?? "—"]), empty: "Koi wasooli darj nahi." },
      { title: "Produce orders (marketplace)", columns: ["#", "Tareekh", "Raqam", "Status"], rows: orders.map((o: any) => [o.order_number, pk(o.placed_at), rs(num(o.subtotal)), o.status]), empty: "Koi produce order nahi." },
      { title: "Buyer payments", columns: ["Tareekh", "Raqam", "Direction"], rows: bpays.map((p: any) => [pk(p.payment_date), rs(num(p.amount)), p.direction]), empty: "Koi buyer payment nahi." },
    ],
    timeline: sortTimeline([
      ...gs.map((s: any) => ({ date: s.sale_date, label: `Grain sale ${s.sale_number} (${rs(s.kg)} kg)`, amount: s.total, tone: "info" as const })),
      ...spays.map((p: any) => ({ date: p.payment_date ?? p.created_at, label: "Wasooli", amount: num(p.amount), tone: "good" as const })),
    ]),
    notes,
  }, { buyerIds: [id] }, now);
}

// ───────────────────────── DEALER ─────────────────────────
export async function loadDealer360(id: string, now = new Date()): Promise<Party360Data> {
  const db = createServiceClient() as Db; const notes: string[] = [];
  const [d] = await q(db, notes, "dealers", db.from("dealers").select("*").eq("id", id).maybeSingle());
  if (!d) throw new Error("Dealer nahi mila.");
  const { keys, labels } = lastMonths(now);
  const [orders, pays, khata] = await Promise.all([
    q(db, notes, "bridge_orders", db.from("bridge_orders").select("order_number,placed_at,subtotal,commission_amount,dealer_payout_amount,status").eq("assigned_dealer_id", id).order("placed_at", { ascending: false }).limit(LIMIT)),
    q(db, notes, "dealer_payments", db.from("dealer_payments").select("payment_date,amount").eq("dealer_id", id).limit(LIMIT)),
    q(db, notes, "khata_accounts", db.from("khata_accounts").select("current_balance,credit_limit").eq("dealer_id", id).limit(5)),
  ]);
  const sale = r2(orders.reduce((a: number, o: any) => a + num(o.subtotal), 0));
  const comm = r2(orders.reduce((a: number, o: any) => a + num(o.commission_amount), 0));
  const paid = r2(pays.reduce((a: number, p: any) => a + num(p.amount), 0));
  const bal = r2(khata.reduce((a: number, k: any) => a + num(k.current_balance), 0));
  const limit = r2(khata.reduce((a: number, k: any) => a + num(k.credit_limit), 0));
  const empty = !orders.length && !pays.length && !khata.length;
  return withActivity(db, notes, {
    type: "dealer", id, name: d.business_name ?? "—", code: d.dealer_code,
    sub: [d.dealer_code, d.contact_person, d.phone_number, [d.tehsil, d.district].filter(Boolean).join(", ")].filter(Boolean),
    badges: [{ label: d.verification_status ?? "unverified", tone: d.verification_status === "verified" ? "good" : "warn" }, { label: d.is_active === false ? "Inactive" : "Active", tone: d.is_active === false ? "warn" : "good" }],
    actions: [{ label: "Statement", href: `/admin/dealers/${id}/statement`, primary: true }, ...(d.phone_number ? [{ label: "WhatsApp draft", href: `https://wa.me/${String(d.phone_number).replace(/\D/g, "")}` }] : [])],
    kpis: [
      { label: "Orders", value: orders.length, fmt: "num" }, { label: "Sale value", value: sale, fmt: "rs" },
      { label: "Commission", value: comm, fmt: "rs" }, { label: "Payments", value: paid, fmt: "rs" },
      { label: "Khata baqaya", value: khata.length ? bal : null, fmt: "rs", tone: bal > 0 ? "bad" : "neutral" },
      { label: "Credit bacha", value: limit ? r2(limit - bal) : null, fmt: "rs", hint: limit ? `limit Rs ${rs(limit)}` : "limit set nahi" },
    ],
    monthly: { title: "Mahana orders", months: labels, series: [{ name: "Sale", values: monthlySeries(orders.map((o: any) => ({ date: o.placed_at, amount: num(o.subtotal) })), keys), color: "bg-purple-500" }] },
    aging: null,
    sections: [
      { title: "Orders (bridge_orders)", columns: ["#", "Tareekh", "Raqam", "Commission", "Status"], rows: orders.slice(0, 30).map((o: any) => [o.order_number, pk(o.placed_at), rs(num(o.subtotal)), rs(num(o.commission_amount)), o.status]), empty: "Koi order nahi." },
      { title: "Targets", columns: ["", ""], rows: [], empty: "Dealer targets abhi system mein track nahi hote." },
    ],
    timeline: sortTimeline([...orders.map((o: any) => ({ date: o.placed_at, label: `Order ${o.order_number}`, amount: num(o.subtotal), tone: "info" as const })), ...pays.map((p: any) => ({ date: p.payment_date, label: "Payment", amount: num(p.amount), tone: "good" as const }))]),
    empty: empty ? "Is dealer ki abhi koi activity nahi (orders, payments, khata khali)." : null,
    notes,
  }, {}, now, true);
}

export const LOADERS = { farmer: loadFarmer360, customer: loadCustomer360, supplier: loadSupplier360, buyer: loadBuyer360, dealer: loadDealer360 } as const;
export type Party360Type = keyof typeof LOADERS;

/** 621: "Yasir Ali: customer + supplier" — net balance ka section. */
function linkedSections(plinks: Awaited<ReturnType<typeof loadLinkedParties>>, name: string): Section[] {
  if (!plinks.length) return [];
  return [{
    title: `${name}: customer + supplier (net)`,
    note: "Party link (621). Kuch khud nahi katta — kaatna sirf Settlements ki manzoori se (Dr 2000 / Cr 1100).",
    columns: ["Customer", "Supplier", "Unhon ne dena (1100)", "Hum ne dena (2000)", "Net"],
    rows: plinks.map((l) => [l.customerName, l.supplierName, rs(l.net.theyOwe), rs(l.net.weOwe),
      `${rs(Math.abs(l.net.net))} ${l.net.net > 0 ? "party ne dena" : l.net.net < 0 ? "hum ne dena" : "barabar"}`]),
    href: "/admin/party-links",
  }];
}
