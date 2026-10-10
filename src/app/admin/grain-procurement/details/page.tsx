import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { DrillTable, type DrillTableRow } from "./drill-table";
import {
  DRILL_VIEWS, DRILL_TITLES, parseDrillView, drillHref, allocatePayments, filterPurchases, filterSales, inRange, matchesSearch,
  payableByParty, receivableByBuyer, totals, toMaund, type DrillFilter, type DrillView, type PurchaseRow, type SaleRow,
} from "@/lib/grain/drilldown";
import { WASELA_AMANAT_ACCOUNT } from "@/lib/grain/ledger-summary";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const CROPS: Record<string, string> = { wheat: "Gandum / Wheat", rice: "Munji / Rice", maize: "Makai / Maize" };
const crop = (c: string) => CROPS[c] ?? c;
const one = (x: any) => (Array.isArray(x) ? x[0] : x);
const billNo = (id: string) => `GP-${id.slice(0, 8).toUpperCase()}`;
const stmtHref = (r: PurchaseRow) => r.partyId ? `/admin/grain-procurement/statement?seller_type=${r.partyType}&seller_id=${r.partyId}` : null;

type SP = { view?: string; from?: string; to?: string; q?: string; crop?: string };

export default async function GrainDetailsPage({ searchParams }: { searchParams?: SP }) {
  const view: DrillView = parseDrillView(searchParams?.view) ?? "purchases";
  const f: DrillFilter = {
    from: ISO.test(searchParams?.from ?? "") ? searchParams!.from! : null,
    to: ISO.test(searchParams?.to ?? "") ? searchParams!.to! : null,
    q: (searchParams?.q ?? "").slice(0, 100) || null,
    crop: CROPS[searchParams?.crop ?? ""] ? searchParams!.crop! : null,
  };
  const supabase = createClient() as any;

  const [entriesRes, payRes, salesRes, expRes, stockRes] = await Promise.all([
    supabase.from("grain_procurement_entries")
      .select("id, entry_date, grain_type, gross_weight_kg, cut_kg, weight_kg, rate_per_kg, total_amount, chungi_amount, farmer_id, party_id, created_at, farmers(full_name), grain_parties(party_name)")
      .is("reclassified_as_sale_id", null).order("entry_date", { ascending: false }).limit(5000),
    supabase.from("grain_procurement_payments")
      .select("id, amount, payment_date, payment_method, notes, created_at, farmer_id, party_id, farmers(full_name), grain_parties(party_name)")
      .is("reclassified_as_sale_payment_id", null).order("created_at", { ascending: false }).limit(5000),
    supabase.from("grain_sales").select("*, buyers(business_name)").order("sale_date", { ascending: false }).limit(5000),
    supabase.from("grain_expenses").select("id, expense_date, category, description, amount, entry_id, paid_by").order("expense_date", { ascending: false }).limit(5000),
    supabase.from("v_grain_warehouse_stock").select("*").order("warehouse_name").order("grain_type"),
  ]);
  const loadErr = [entriesRes, payRes, salesRes, expRes, stockRes].map(r => r.error?.message).filter(Boolean);

  // Purchases with FIFO paid/balance per party.
  const paidByParty: Record<string, number> = {};
  const payments = (payRes.data ?? []).map((p: any) => {
    const key = p.farmer_id ? `farmer:${p.farmer_id}` : `party:${p.party_id}`;
    paidByParty[key] = (paidByParty[key] ?? 0) + Number(p.amount);
    return { ...p, key, date: String(p.payment_date ?? p.created_at ?? "").slice(0, 10), name: one(p.farmers)?.full_name ?? one(p.grain_parties)?.party_name ?? "-" };
  });
  const rawBills = (entriesRes.data ?? []).map((e: any) => {
    const partyType: "farmer" | "party" = e.farmer_id ? "farmer" : "party";
    const partyId = e.farmer_id ?? e.party_id ?? null;
    return { e, partyType, partyId, partyKey: `${partyType}:${partyId}`, id: e.id, date: String(e.entry_date), amount: Number(e.total_amount) - Number(e.chungi_amount ?? 0) };
  });
  const alloc = allocatePayments(rawBills, paidByParty);
  const purchases: PurchaseRow[] = rawBills.map(({ e, partyType, partyId, amount }: any) => ({
    id: e.id, date: String(e.entry_date), billNo: billNo(e.id), partyType, partyId,
    party: one(e.farmers)?.full_name ?? one(e.grain_parties)?.party_name ?? "-", crop: e.grain_type,
    grossKg: Number(e.gross_weight_kg ?? e.weight_kg), cutKg: Number(e.cut_kg ?? 0), netKg: Number(e.weight_kg),
    rate: Number(e.rate_per_kg), amount, paid: alloc[e.id] ?? 0, balance: Math.round((amount - (alloc[e.id] ?? 0)) * 100) / 100,
  }));
  const sales: SaleRow[] = (salesRes.data ?? []).map((s: any) => {
    const amount = Number(s.total_amount), received = Number(s.amount_received ?? 0);
    return {
      id: s.id, date: String(s.sale_date ?? s.created_at ?? "").slice(0, 10), billNo: s.sale_number ?? billNo(s.id),
      buyer: one(s.buyers)?.business_name ?? "-", customerId: s.customer_id ?? null, crop: s.grain_type,
      kg: Number(s.quantity_kg), rate: Number(s.rate_per_kg), amount, received, balance: Math.round((amount - received) * 100) / 100,
      cogs: Number(s.total_cogs ?? 0), profit: Number(s.profit ?? amount - Number(s.total_cogs ?? 0)),
    };
  });

  const P = filterPurchases(purchases, f);
  const S = filterSales(sales, f);
  let headers: string[] = [];
  let rows: DrillTableRow[] = [];
  let footer: (string | number)[] | undefined;
  const saleBill = (id: string) => `/admin/grain-procurement/sale-bill/${id}`;

  if (view === "purchases") {
    headers = ["Tareekh / Date", "Bill #", "Kisan-Party / Farmer-Party", "Fasal / Crop", "Gross kg", "Cut kg", "Net kg", "Net mand", "Rate/kg", "Raqam / Amount", "Ada / Paid", "Baqi / Balance"];
    rows = P.map(r => ({ cells: [r.date, r.billNo, r.party, crop(r.crop), r.grossKg, r.cutKg, r.netKg, toMaund(r.netKg), r.rate, r.amount, r.paid, r.balance],
      links: [{ label: "Bill", href: `/admin/grain-procurement/bill/${r.id}` }, ...(stmtHref(r) ? [{ label: "Statement", href: stmtHref(r)! }] : [])] }));
    const t = totals(P, ["grossKg", "cutKg", "netKg", "amount", "paid", "balance"]);
    footer = ["Kul / Total", "", "", "", t.grossKg, t.cutKg, t.netKg, toMaund(t.netKg), "", t.amount, t.paid, t.balance];
  } else if (view === "sales") {
    headers = ["Tareekh / Date", "Bill #", "Kharidar / Buyer", "Fasal / Crop", "kg", "Mand", "Rate/kg", "Raqam / Amount", "Wusool / Received", "Baqi / Balance"];
    rows = S.map(r => ({ cells: [r.date, r.billNo, r.buyer, crop(r.crop), r.kg, toMaund(r.kg), r.rate, r.amount, r.received, r.balance],
      links: [{ label: "Bill", href: saleBill(r.id) }, ...(r.customerId ? [{ label: "Khata", href: `/admin/khata/${r.customerId}/statement` }] : [])] }));
    const t = totals(S, ["kg", "amount", "received", "balance"]);
    footer = ["Kul / Total", "", "", "", t.kg, toMaund(t.kg), "", t.amount, t.received, t.balance];
  } else if (view === "payments") {
    const list = payments.filter((p: any) => inRange(p.date, f) && matchesSearch([p.name, p.payment_method, p.notes], f.q));
    headers = ["Tareekh / Date", "Kisan-Party / Farmer-Party", "Tareeqa / Method", "Note", "Raqam / Amount"];
    rows = list.map((p: any) => {
      const [type, id] = p.key.split(":");
      return { cells: [p.date, p.name, p.payment_method ?? "", p.notes ?? "", Number(p.amount)],
        links: [{ label: "Slip", href: `/admin/grain-procurement/payment-slip/${p.id}` }, ...(id && id !== "null" ? [{ label: "Statement", href: `/admin/grain-procurement/statement?seller_type=${type}&seller_id=${id}` }] : [])] };
    });
    footer = ["Kul / Total", "", "", "", list.reduce((s: number, p: any) => s + Number(p.amount), 0)];
  } else if (view === "payable") {
    const g = payableByParty(P).filter(x => Math.abs(x.balance) > 0.005);
    headers = ["Kisan-Party / Farmer-Party", "Bills", "Kul bill / Billed", "Ada / Paid", "Dena / Payable"];
    rows = g.map(x => {
      const [type, id] = x.key.split(":");
      return { cells: [x.name, x.count, x.billed, x.settled, x.balance],
        links: id && id !== "null" ? [{ label: "Statement", href: `/admin/grain-procurement/statement?seller_type=${type}&seller_id=${id}` }] : [] };
    });
    const { data: wl } = await supabase.from("journal_lines").select("debit, credit, journal_entries!inner(entry_date)").eq("account_code", WASELA_AMANAT_ACCOUNT).limit(5000);
    const wasela = (wl ?? []).filter((l: any) => inRange(one(l.journal_entries)?.entry_date, { to: f.to })).reduce((s: number, l: any) => s + Number(l.credit) - Number(l.debit), 0);
    rows.push({ cells: [`Wasela amanat (${WASELA_AMANAT_ACCOUNT})`, "-", wasela, 0, wasela], emphasis: true,
      links: [{ label: "Ledger", href: `/admin/finance/ledger?account=${WASELA_AMANAT_ACCOUNT}${f.from ? `&from=${f.from}` : ""}${f.to ? `&to=${f.to}` : ""}` }] });
    const tb = g.reduce((s, x) => s + x.balance, 0);
    footer = ["Kul / Total", "", "", "", Math.round((tb + wasela) * 100) / 100];
  } else if (view === "receivable") {
    const g = receivableByBuyer(S).filter(x => Math.abs(x.balance) > 0.005);
    headers = ["Kharidar / Buyer", "Bills", "Kul bikri / Billed", "Wusool / Received", "Lena / Receivable"];
    rows = g.map(x => ({ cells: [x.name, x.count, x.billed, x.settled, x.balance],
      links: x.key.startsWith("cu:") ? [{ label: "Khata", href: `/admin/khata/${x.key.slice(3)}/statement` }, { label: "Bills", href: drillHref("sales", { ...f, q: x.name }) }]
        : [{ label: "Bills", href: drillHref("sales", { ...f, q: x.name }) }] }));
    footer = ["Kul / Total", "", "", "", g.reduce((s, x) => Math.round((s + x.balance) * 100) / 100, 0)];
  } else if (view === "expenses") {
    const list = (expRes.data ?? []).filter((x: any) => inRange(x.expense_date, f) && matchesSearch([x.category, x.description, x.paid_by], f.q));
    headers = ["Tareekh / Date", "Qism / Category", "Tafseel / Description", "Kis ne diya / Paid by", "Raqam / Amount"];
    rows = list.map((x: any) => ({ cells: [String(x.expense_date), x.category ?? "", x.description ?? "", x.paid_by ?? "", Number(x.amount)],
      links: x.entry_id ? [{ label: "Bill", href: `/admin/grain-procurement/bill/${x.entry_id}` }] : [{ label: "Dashboard", href: "/admin/grain-procurement/dashboard" }] }));
    footer = ["Kul / Total", "", "", "", list.reduce((s: number, x: any) => s + Number(x.amount), 0)];
  } else if (view === "profit") {
    headers = ["Tareekh / Date", "Bill #", "Kharidar / Buyer", "Fasal / Crop", "Bikri / Sale", "Laagat / Cost", "Munafa / Profit"];
    rows = S.map(r => ({ cells: [r.date, r.billNo, r.buyer, crop(r.crop), r.amount, r.cogs, r.profit], links: [{ label: "Bill", href: saleBill(r.id) }] }));
    const t = totals(S, ["amount", "cogs", "profit"]);
    footer = ["Kul / Total", "", "", "", t.amount, t.cogs, t.profit];
  } else {
    const list = (stockRes.data ?? []).filter((x: any) => (!f.crop || x.grain_type === f.crop) && matchesSearch([x.warehouse_name, x.grain_type], f.q));
    headers = ["Godam / Warehouse", "Fasal / Crop", "Aaya kg / In", "Gaya kg / Out", "Maujood kg / On hand", "Mand", "Ausat laagat/kg", "Qeemat / Value"];
    rows = list.map((x: any) => ({ cells: [x.warehouse_name, crop(x.grain_type), Number(x.aaya_kg), Number(x.gaya_kg), Number(x.maujood_kg), toMaund(Number(x.maujood_kg)), Number(x.aausat_lagat_fi_kg ?? 0), Number(x.maujood_ki_lagat ?? 0)],
      links: [{ label: "Kharidari", href: drillHref("purchases", { crop: x.grain_type }) }, { label: "Godam", href: "/admin/grain-procurement/warehouse" }] }));
    footer = ["Kul / Total", "", "", "", list.reduce((s: number, x: any) => s + Number(x.maujood_kg), 0), "", "", list.reduce((s: number, x: any) => s + Number(x.maujood_ki_lagat ?? 0), 0)];
  }

  const title = DRILL_TITLES[view];
  const tab = (v: DrillView) => `rounded px-2.5 py-1 text-xs font-medium ${v === view ? "bg-surface-900 text-white dark:bg-white dark:text-surface-900" : "border hover:bg-surface-50"}`;
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4">
      <PageHeader title={`${title.ur} / ${title.en}`} description="Grain hisaab ki tafseel. Har qatar apne bill, party statement ya ledger se juri hai." />
      <Link href="/admin/grain-procurement" className="text-sm text-brand-600 hover:underline">&larr; Wapas / Back</Link>
      <div className="flex flex-wrap gap-1.5">
        {DRILL_VIEWS.map(v => <Link key={v} href={drillHref(v, f)} className={tab(v)}>{DRILL_TITLES[v].ur}</Link>)}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <input type="hidden" name="view" value={view} />
        <label className="flex flex-col text-xs text-surface-500">Se / From<input type="date" name="from" defaultValue={f.from ?? ""} className="rounded border px-2 py-1 text-sm" /></label>
        <label className="flex flex-col text-xs text-surface-500">Tak / To<input type="date" name="to" defaultValue={f.to ?? ""} className="rounded border px-2 py-1 text-sm" /></label>
        <label className="flex flex-col text-xs text-surface-500">Fasal / Crop
          <select name="crop" defaultValue={f.crop ?? ""} className="rounded border px-2 py-1 text-sm"><option value="">Sab / All</option>{Object.entries(CROPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="flex flex-col text-xs text-surface-500">Talash / Search<input name="q" defaultValue={f.q ?? ""} placeholder="Naam, bill #" className="rounded border px-2 py-1 text-sm" /></label>
        <button type="submit" className="rounded bg-surface-900 px-3 py-1.5 text-white dark:bg-white dark:text-surface-900">Dikhao / Apply</button>
      </form>
      {loadErr.length ? <p className="text-sm text-red-600">Kuch data load nahi hua: {loadErr.join("; ")}</p> : null}
      {view === "purchases" || view === "payable" ? <p className="text-xs text-surface-500">Ada / Paid: party ki kul adaigi purane bill se pehle (FIFO) baanti gayi hai. Kul mand = kg / 40.</p> : null}
      <DrillTable headers={headers} rows={rows} footer={footer} fileName={`grain-${view}${f.crop ? `-${f.crop}` : ""}${f.from ? `-${f.from}` : ""}${f.to ? `-${f.to}` : ""}.csv`} />
    </div>
  );
}
