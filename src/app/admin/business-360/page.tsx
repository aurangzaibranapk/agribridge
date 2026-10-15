import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Package,
  Search,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

export const dynamic = "force-dynamic";

const OWNER_ROLES = ["owner", "super_admin", "admin", "finance", "manager"];

type Sale = {
  id: string;
  total_amount: number | null;
  total_cogs: number | null;
  profit: number | null;
  created_at: string;
  customer_id: string | null;
  crm_customer_id: string | null;
  created_by: string | null;
  shop_id: string | null;
  branch_id: string | null;
  khata_amount: number | null;
  cash_paid: number | null;
  payment_mode: string | null;
  status: string | null;
};

type Purchase = {
  id: string;
  purchase_number: string | null;
  supplier_id: string | null;
  purchase_date: string;
  total_amount: number | null;
  invoice_total: number | null;
  shop_id: string | null;
  branch_id: string | null;
  payment_terms: string | null;
  status: string | null;
};

type Customer = {
  id: string;
  name: string | null;
  customer_type: string | null;
  current_balance: number | null;
  shop_id: string | null;
};

type Supplier = {
  id: string;
  name: string | null;
  company_name: string | null;
  current_payable: number | null;
};

type Product = { id: string; name: string | null };
type NameRow = { id: string; name: string | null };
type Staff = { id: string; full_name: string | null; role: string | null };

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number): string {
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

function label(value: string | null | undefined): string {
  return String(value ?? "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()) || "—";
}

function partyType(value: string | null | undefined): string {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("farmer")) return "Farmer";
  if (v.includes("dealer")) return "Dealer";
  if (v.includes("wholesale") || v.includes("shop")) return "Customer / Shop";
  return value ? label(value) : "Customer";
}

export default async function Business360Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; shop_id?: string; party?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <div className="p-8 text-center text-surface-500">Login required.</div>;

  const { data: me } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.role || !OWNER_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-500">Business 360 sirf authorized management ke liye hai.</div>;
  }

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);
  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;

  let salesQuery = supabase
    .from("pos_sales")
    .select("id,total_amount,total_cogs,profit,created_at,customer_id,crm_customer_id,created_by,shop_id,branch_id,khata_amount,cash_paid,payment_mode,status")
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)
    .not("status", "in", "(voided,cancelled,void)");
  if (params.shop_id) salesQuery = salesQuery.eq("shop_id", params.shop_id);

  let purchasesQuery = supabase
    .from("purchases")
    .select("id,purchase_number,supplier_id,purchase_date,total_amount,invoice_total,shop_id,branch_id,payment_terms,status")
    .gte("purchase_date", from)
    .lte("purchase_date", to);
  if (params.shop_id) purchasesQuery = purchasesQuery.eq("shop_id", params.shop_id);

  const [salesRes, purchaseRes, shopsRes, branchesRes, customersRes, suppliersRes, staffRes] = await Promise.all([
    salesQuery,
    purchasesQuery,
    supabase.from("shops").select("id,name").eq("is_active", true).order("name"),
    supabase.from("branches").select("id,name").eq("is_active", true).order("name"),
    supabase.from("customers").select("id,name,customer_type,current_balance,shop_id").eq("is_deleted", false).order("name").limit(2000),
    supabase.from("suppliers").select("id,name,company_name,current_payable").order("name").limit(2000),
    supabase.from("profiles").select("id,full_name,role").eq("is_active", true).order("full_name").limit(1000),
  ]);

  const sales = (salesRes.data ?? []) as Sale[];
  const purchases = (purchaseRes.data ?? []) as Purchase[];
  const customers = (customersRes.data ?? []) as Customer[];
  const suppliers = (suppliersRes.data ?? []) as Supplier[];
  const shops = (shopsRes.data ?? []) as NameRow[];
  const branches = (branchesRes.data ?? []) as NameRow[];
  const staff = (staffRes.data ?? []) as Staff[];

  const saleIds = sales.map((s) => s.id);
  const itemRes = saleIds.length
    ? await supabase
        .from("pos_sale_items")
        .select("sale_id,product_id,quantity,subtotal,line_cogs,products(name)")
        .in("sale_id", saleIds)
    : { data: [] };
  const items = (itemRes.data ?? []) as any[];

  const customerById = new Map(customers.map((x) => [x.id, x]));
  const supplierById = new Map(suppliers.map((x) => [x.id, x]));
  const shopById = new Map(shops.map((x) => [x.id, x.name ?? "—"]));
  const branchById = new Map(branches.map((x) => [x.id, x.name ?? "—"]));
  const staffById = new Map(staff.map((x) => [x.id, x.full_name ?? "—"]));

  const revenue = sales.reduce((s, x) => s + num(x.total_amount), 0);
  const purchasesTotal = purchases.reduce((s, x) => s + num(x.invoice_total ?? x.total_amount), 0);
  const grossProfit = sales.reduce((s, x) => s + num(x.profit ?? (num(x.total_amount) - num(x.total_cogs))), 0);
  const grossLoss = Math.abs(Math.min(0, grossProfit));
  const receivable = customers.reduce((s, x) => s + Math.max(0, num(x.current_balance)), 0);
  const payable = suppliers.reduce((s, x) => s + Math.max(0, num(x.current_payable)), 0);

  const customerTotals = new Map<string, { sales: number; count: number; khata: number }>();
  for (const sale of sales) {
    const id = sale.crm_customer_id ?? sale.customer_id;
    if (!id) continue;
    const old = customerTotals.get(id) ?? { sales: 0, count: 0, khata: 0 };
    old.sales += num(sale.total_amount);
    old.count += 1;
    old.khata += num(sale.khata_amount);
    customerTotals.set(id, old);
  }

  const supplierTotals = new Map<string, { purchases: number; count: number }>();
  for (const purchase of purchases) {
    if (!purchase.supplier_id) continue;
    const old = supplierTotals.get(purchase.supplier_id) ?? { purchases: 0, count: 0 };
    old.purchases += num(purchase.invoice_total ?? purchase.total_amount);
    old.count += 1;
    supplierTotals.set(purchase.supplier_id, old);
  }

  const staffTotals = new Map<string, number>();
  for (const sale of sales) {
    if (sale.created_by) staffTotals.set(sale.created_by, (staffTotals.get(sale.created_by) ?? 0) + num(sale.total_amount));
  }

  const productTotals = new Map<string, { name: string; qty: number; revenue: number; cogs: number }>();
  for (const item of items) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const id = String(item.product_id ?? product?.name ?? "unknown");
    const old = productTotals.get(id) ?? { name: product?.name ?? "Unknown product", qty: 0, revenue: 0, cogs: 0 };
    old.qty += num(item.quantity);
    old.revenue += num(item.subtotal);
    old.cogs += num(item.line_cogs);
    productTotals.set(id, old);
  }

  const partyRows = [
    ...customers
      .filter((x) => {
        const t = customerTotals.get(x.id);
        return t && (!params.party || x.name?.toLowerCase().includes(params.party.toLowerCase()));
      })
      .map((x) => ({ id: x.id, name: x.name ?? "Unnamed", type: partyType(x.customer_type), bought: customerTotals.get(x.id)?.sales ?? 0, sold: 0, balance: num(x.current_balance), detail: `${customerTotals.get(x.id)?.count ?? 0} sales · ${shopById.get(x.shop_id ?? "") ?? "—"}` })),
    ...suppliers
      .filter((x) => {
        const t = supplierTotals.get(x.id);
        return t && (!params.party || (x.name ?? x.company_name ?? "").toLowerCase().includes(params.party.toLowerCase()));
      })
      .map((x) => ({ id: x.id, name: x.name ?? x.company_name ?? "Unnamed", type: "Supplier", bought: 0, sold: supplierTotals.get(x.id)?.purchases ?? 0, balance: num(x.current_payable), detail: `${supplierTotals.get(x.id)?.count ?? 0} purchases` })),
  ].sort((a, b) => (b.bought + b.sold) - (a.bought + a.sold)).slice(0, 30);

  const productRows = Array.from(productTotals.values()).sort((a, b) => (b.revenue - b.cogs) - (a.revenue - a.cogs)).slice(0, 12);
  const lossProducts = productRows.filter((x) => x.revenue - x.cogs < 0).length;
  const shopOptions = shops.slice(0, 80);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Business 360"
        description="Customer, farmer, dealer, supplier aur staff ka poora lena-dena — shop, khata aur product profit ke sath"
      />

      <div className="mb-5 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-emerald-50 p-4 dark:border-brand-900/40 dark:from-brand-950/30 dark:via-surface-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">Management view</p>
            <h2 className="mt-1 text-xl font-bold text-surface-900 dark:text-white">Ek screen par poora business flow</h2>
            <p className="mt-1 text-sm text-surface-500">Sales se cash/khata tak, purchase se supplier payable tak, aur product se profit/loss tak.</p>
          </div>
          <Link href="/admin/reports/pnl" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">Detailed P&L <ChevronRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <form className="mb-5 grid gap-3 rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-medium text-surface-500">From<input name="from" type="date" defaultValue={from} className="mt-1 w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-950" /></label>
        <label className="text-xs font-medium text-surface-500">To<input name="to" type="date" defaultValue={to} className="mt-1 w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-950" /></label>
        <label className="text-xs font-medium text-surface-500 lg:col-span-2">Shop<select name="shop_id" defaultValue={params.shop_id ?? ""} className="mt-1 w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-950"><option value="">All shops</option>{shopOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-xs font-medium text-surface-500">Party search<input name="party" defaultValue={params.party ?? ""} placeholder="Customer / supplier" className="mt-1 w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-950" /></label>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 sm:col-span-2 lg:col-span-5 lg:justify-self-end"><Search className="h-4 w-4" /> Apply filters</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={<CircleDollarSign />} label="Total sales" value={money(revenue)} tone="blue" />
        <Metric icon={<ShoppingCart />} label="Total purchase" value={money(purchasesTotal)} tone="amber" />
        <Metric icon={<TrendingUp />} label="Gross profit" value={money(Math.max(0, grossProfit))} tone="green" />
        <Metric icon={<TrendingDown />} label="Gross loss" value={money(grossLoss)} tone="red" />
        <Metric icon={<ArrowDownLeft />} label="Receivable" value={money(receivable)} tone="purple" />
        <Metric icon={<ArrowUpRight />} label="Payable" value={money(payable)} tone="orange" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Party 360 — lena dena" icon={<Users className="h-4 w-4 text-brand-600" />}>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="px-4 py-3">Party</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Ham ne liya</th><th className="px-4 py-3 text-right">Ham ne diya</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Source</th></tr></thead><tbody>{partyRows.map((row) => <tr key={row.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800"><td className="px-4 py-3 font-semibold text-surface-900 dark:text-white">{row.name}</td><td className="px-4 py-3"><span className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">{row.type}</span></td><td className="px-4 py-3 text-right tabular-nums">{row.bought ? money(row.bought) : "—"}</td><td className="px-4 py-3 text-right tabular-nums">{row.sold ? money(row.sold) : "—"}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${row.balance > 0 ? "text-amber-700" : "text-surface-500"}`}>{money(row.balance)}</td><td className="px-4 py-3 text-xs text-surface-500">{row.detail}</td></tr>)}{partyRows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-surface-400">Is filter/date range mein party movement nahi mili.</td></tr>}</tbody></table></div>
        </Section>

        <Section title="Business health" icon={<BarChart3 className="h-4 w-4 text-brand-600" />}>
          <div className="space-y-3 p-4">
            <Health label="Sales coverage" value={`${sales.length} bills`} note={`${customers.filter((x) => customerTotals.has(x.id)).length} active buying parties`} tone="blue" />
            <Health label="Profitability" value={money(grossProfit)} note={lossProducts ? `${lossProducts} product lines loss mein` : "No loss product line in top view"} tone={grossProfit >= 0 ? "green" : "red"} />
            <Health label="Credit exposure" value={money(receivable + payable)} note="Customer receivable + supplier payable" tone="amber" />
            <Health label="Staff contribution" value={`${staffTotals.size} staff`} note={staffTotals.size ? "Sales creator-wise tracked" : "No creator tagged"} tone="purple" />
          </div>
          <div className="border-t border-surface-100 p-4 text-xs text-surface-500 dark:border-surface-800">Period: <span className="font-semibold text-surface-700 dark:text-surface-300">{from} — {to}</span></div>
        </Section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Section title="Product performance — profit, barabar, loss" icon={<Package className="h-4 w-4 text-brand-600" />}>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Sale</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Result</th></tr></thead><tbody>{productRows.map((p) => { const result = p.revenue - p.cogs; return <tr key={p.name} className="border-b border-surface-100 last:border-0 dark:border-surface-800"><td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{p.name}</td><td className="px-4 py-3 text-right tabular-nums">{p.qty.toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums">{money(p.revenue)}</td><td className="px-4 py-3 text-right tabular-nums">{money(p.cogs)}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${result > 0 ? "text-emerald-700" : result < 0 ? "text-red-700" : "text-surface-500"}`}>{result > 0 ? "+" : ""}{money(result)}</td></tr> })}{productRows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-surface-400">Is range mein product sale nahi mili.</td></tr>}</tbody></table></div>
        </Section>

        <Section title="Staff / shop activity" icon={<BriefcaseBusiness className="h-4 w-4 text-brand-600" />}>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">{Array.from(staffTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, amount]) => <div key={id} className="flex items-center justify-between px-4 py-3"><div><p className="font-medium text-surface-900 dark:text-white">{staffById.get(id) ?? "Unknown staff"}</p><p className="text-xs text-surface-500">Sales entered by staff</p></div><p className="font-semibold tabular-nums text-brand-700 dark:text-brand-300">{money(amount)}</p></div>)}{staffTotals.size === 0 && <p className="px-4 py-10 text-center text-sm text-surface-400">Staff activity is range mein nahi mili.</p>}</div>
          <div className="border-t border-surface-100 p-4 dark:border-surface-800"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-500"><Store className="h-4 w-4" /> Shop snapshot</div><div className="grid gap-2 sm:grid-cols-2">{shops.slice(0, 8).map((shop) => { const amount = sales.filter((s) => s.shop_id === shop.id).reduce((sum, s) => sum + num(s.total_amount), 0); return <div key={shop.id} className="rounded-xl bg-surface-50 p-3 dark:bg-surface-950"><p className="truncate text-sm font-medium">{shop.name}</p><p className="mt-1 text-xs text-surface-500">{money(amount)} sales</p></div> })}</div></div>
        </Section>
      </div>

      <Section title="Purchase / supplier ledger" icon={<WalletCards className="h-4 w-4 text-brand-600" />} className="mt-5">
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="px-4 py-3">Bill</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Shop / branch</th><th className="px-4 py-3">Source / account</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{purchases.slice(0, 30).map((p) => <tr key={p.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800"><td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{p.purchase_number ?? "Purchase"}</td><td className="px-4 py-3">{supplierById.get(p.supplier_id ?? "")?.name ?? supplierById.get(p.supplier_id ?? "")?.company_name ?? "—"}</td><td className="px-4 py-3 text-xs text-surface-500">{shopById.get(p.shop_id ?? "") ?? branchById.get(p.branch_id ?? "") ?? "—"}</td><td className="px-4 py-3 text-xs text-surface-500">{label(p.payment_terms)} · {label(p.status)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{money(num(p.invoice_total ?? p.total_amount))}</td></tr>)}{purchases.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-surface-400">Is range mein purchase record nahi mila.</td></tr>}</tbody></table></div>
      </Section>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-surface-500">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {from} — {to}</span>
        <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Read-only reporting view</span>
        <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Existing AgriBridge tables</span>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "blue" | "amber" | "green" | "red" | "purple" | "orange" }) {
  const colors = { blue: "text-blue-700 dark:text-blue-300", amber: "text-amber-700 dark:text-amber-300", green: "text-emerald-700 dark:text-emerald-300", red: "text-red-700 dark:text-red-300", purple: "text-violet-700 dark:text-violet-300", orange: "text-orange-700 dark:text-orange-300" };
  return <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"><div className={`flex items-center gap-2 ${colors[tone]}`}>{icon}<span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span></div><p className="mt-2 text-xl font-bold text-surface-900 dark:text-white">{value}</p></div>;
}

function Section({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900 ${className}`}><div className="flex items-center gap-2 border-b border-surface-100 px-4 py-3 dark:border-surface-800"><h3 className="text-sm font-semibold text-surface-900 dark:text-white">{icon}{title}</h3></div>{children}</section>;
}

function Health({ label, value, note, tone }: { label: string; value: string; note: string; tone: "blue" | "green" | "red" | "amber" | "purple" }) {
  const dot = { blue: "bg-blue-500", green: "bg-emerald-500", red: "bg-red-500", amber: "bg-amber-500", purple: "bg-violet-500" };
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-50 p-3 dark:bg-surface-950"><div><p className="text-xs text-surface-500">{label}</p><p className="mt-1 font-semibold text-surface-900 dark:text-white">{value}</p></div><div className="text-right"><span className={`inline-block h-2 w-2 rounded-full ${dot[tone]}`} /><p className="mt-1 text-[11px] text-surface-500">{note}</p></div></div>;
}
