"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, ClipboardList, ShoppingBag, Users, Wallet } from "lucide-react";
import { ShopNotifications } from "@/components/desk/shop-notifications";
import type { ShopPaymentMethodRow } from "@/lib/pos/shop-payment-methods";

const money = (n: number | null) => n == null ? "Unavailable" : `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
const countText = (n: number | null) => n == null ? "—" : n.toLocaleString("en-PK");
const PAYMENT_COLORS = ["#119b61", "#287ac0", "#e0a122", "#dc5547", "#8456c9", "#11a6ae", "#62a83d", "#e1792f", "#68778a"];

type FarmerGlance = { id: string; full_name: string | null; farmer_code: string; phone_number: string | null; milk_liters_per_day: number | null };
type Approval = { label: string; count: number | null; href: string };
type TaskItem = { key: string; label: string; count: number | null; tone: "red" | "amber" | "blue" | "gray"; href: string };
export function ShopOverviewClient({ methods, trend, stock, credit, cash, digital, received, branchAvailable, customerHealth, farmers, approvals, orders, tasks, userId }: {
  methods: ShopPaymentMethodRow[];
  trend: { day: string; sales: number }[];
  stock: number | null;
  credit: number;
  cash: number;
  digital: number;
  received: number;
  branchAvailable: boolean;
  customerHealth: { total: number | null; withBalance: number | null; newThisWeek: number | null };
  farmers: FarmerGlance[] | null;
  approvals: Approval[];
  orders: { awaiting: number; processing: number; completed: number } | null;
  tasks: TaskItem[];
  userId: string;
}) {
  const [activePanel, setActivePanel] = useState<"ledger" | "tasks" | "notifications">("ledger");
  const total = received + credit;
  const totalMethods = methods.reduce((sum, method) => sum + method.sales, 0);
  const maxTrend = Math.max(...trend.map(day => day.sales), 1);
  const dayLabel = (day: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const donut = useMemo(() => {
    if (totalMethods <= 0) return "conic-gradient(#e8eee9 0deg 360deg)";
    let current = 0;
    const slices = methods.map((method, index) => {
      const start = current;
      current += Math.max(0, method.sales) / totalMethods * 360;
      return `${PAYMENT_COLORS[index % PAYMENT_COLORS.length]} ${start}deg ${current}deg`;
    });
    return `conic-gradient(${slices.join(",")})`;
  }, [methods, totalMethods]);

  return <div className="staff-desk-screen">
    <div className="staff-desk-top-grid">
      <section className="desk-card staff-desk-ledger">
        <div className="staff-desk-card-title"><span><Wallet /> Today&apos;s Ledger</span><span className="staff-desk-live">Live Ledger</span></div>
        <div className="staff-desk-ledger-total"><strong>{money(total)}</strong><span>Aaj ki total POS sale</span></div>
        <div className="staff-desk-ledger-split">
          <div><span>Cash</span><strong>{money(cash)}</strong></div>
          <div><span>Digital</span><strong>{money(digital)}</strong></div>
          <div title="FIFO purchase cost ke mutabiq current stock value"><span>Stock Value</span><strong>{money(stock)}</strong></div>
        </div>
        <div className="staff-desk-sparkline" aria-label="Pichle 7 din ki POS sale">
          {trend.map(day => <div key={day.day} title={`${dayLabel(day.day)} · ${money(day.sales)}`}><i style={{ height: `${Math.max(day.sales / maxTrend * 100, 3)}%` }} /><span>{dayLabel(day.day).split(" ")[0]}</span></div>)}
        </div>
      </section>

      <section className="desk-card staff-desk-summary">
        <h2><ShoppingBag /> Order Funnel</h2>
        {orders ? <div className="staff-desk-funnel">
          <div><strong>{orders.awaiting}</strong><span>Naye / review</span></div>
          <div><strong>{orders.processing}</strong><span>Processing</span></div>
          <div><strong>{orders.completed}</strong><span>Delivered</span></div>
        </div> : <p className="staff-desk-muted">Order data unavailable</p>}
      </section>

      <section className="desk-card staff-desk-summary">
        <h2><Users /> Customer Health</h2>
        <div className="staff-desk-health">
          <div><strong>{countText(customerHealth.total)}</strong><span>Active</span></div>
          <div><strong>{countText(customerHealth.withBalance)}</strong><span>Khata due</span></div>
          <div><strong>{countText(customerHealth.newThisWeek)}</strong><span>Naye · 7 din</span></div>
        </div>
        <p className="staff-desk-note">Shop ke active customers. Khata due ka shop-wise verified total abhi available nahi.</p>
      </section>

      <section className="desk-card staff-desk-summary staff-desk-urgent">
        <h2><AlertTriangle /> Urgent Approvals</h2>
        {approvals.length ? approvals.slice(0, 3).map(item => <Link key={item.label} href={item.href} className="staff-desk-approval"><span>{item.label}</span><strong>{countText(item.count)}</strong></Link>) : <p className="staff-desk-muted">Koi pending approval nahi.</p>}
        <p className="staff-desk-note">Sirf aapki allowed approval queues.</p>
      </section>

    </div>

    <section className="desk-card staff-desk-method-strip">
      <div className="staff-desk-tabs" role="tablist" aria-label="My Work panels">
        {(["ledger", "tasks", "notifications"] as const).map(panel => <button key={panel} type="button" role="tab" aria-selected={activePanel === panel} onClick={() => setActivePanel(panel)}>
          {panel === "ledger" ? "Ledger" : panel === "tasks" ? `Tasks (${tasks.length})` : "Notifications"}
        </button>)}
      </div>
      <div className="staff-desk-donut" aria-label="Payment method breakdown" style={{ background: donut }}><span /></div>
      <div className="staff-desk-methods">
        {methods.map((method, index) => <div key={method.method}>
          <span className="staff-desk-method-name"><i style={{ background: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} />{method.label}</span>
          <span className="staff-desk-method-track"><i style={{ width: `${totalMethods ? Math.max(0, method.sales) / totalMethods * 100 : 0}%`, background: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} /></span>
          <span className="staff-desk-method-percent">{totalMethods ? Math.round(method.sales / totalMethods * 100) : 0}%</span>
        </div>)}
      </div>
    </section>

    <div className={`staff-desk-bottom staff-desk-panel-${activePanel}`}>
      {activePanel === "ledger" ? <>
        <section className="desk-card staff-desk-lists">
          <div className="staff-desk-card-title"><span><ClipboardList /> TODAY&apos;S TASKS</span><small>live counts</small></div>
          <div className="staff-desk-task-columns">
            <div><h3>My Tasks</h3>{tasks.filter(task => task.tone === "red" || task.tone === "amber").slice(0, 3).map(task => <Link key={task.key} href={task.href}><b>{countText(task.count)}</b><span>{task.label}</span></Link>)}</div>
            <div><h3>Team Tasks</h3>{tasks.filter(task => task.tone !== "red" && task.tone !== "amber").slice(0, 3).map(task => <Link key={task.key} href={task.href}><b>{countText(task.count)}</b><span>{task.label}</span></Link>)}</div>
          </div>
          {!tasks.length && <p className="staff-desk-clear"><CheckCircle2 /> Nothing pending on your pages.</p>}
        </section>
        <ShopNotifications userId={userId} compact />
        <section className="desk-card staff-desk-farmers">
          <div className="staff-desk-card-title"><span><Users /> FARMERS AT A GLANCE</span><Link href="/admin/farmers">All farmers →</Link></div>
          {farmers === null ? <p className="staff-desk-muted">Farmer data unavailable.</p> : farmers.length ? farmers.slice(0, 4).map(farmer => <div key={farmer.id} className="staff-desk-farmer"><span className="staff-desk-avatar">{(farmer.full_name || farmer.farmer_code).slice(0, 1).toUpperCase()}</span><span className="staff-desk-farmer-name"><strong>{farmer.full_name || farmer.farmer_code}</strong><small>{farmer.farmer_code}</small></span><strong>{farmer.milk_liters_per_day == null ? "" : `${farmer.milk_liters_per_day} L`}</strong></div>) : <p className="staff-desk-muted">Is shop se linked farmer record nahi mila.</p>}
        </section>
      </> : activePanel === "tasks" ? <section className="desk-card staff-desk-focus-panel">
        <div className="staff-desk-card-title"><span><ClipboardList /> TODAY&apos;S TASKS</span><small>{tasks.length} items</small></div>
        {tasks.length ? tasks.map(task => <Link key={task.key} href={task.href} className={`staff-desk-focus-row tone-${task.tone}`}><b>{countText(task.count)}</b><span>{task.label}</span><span>Open →</span></Link>) : <p className="staff-desk-clear"><CheckCircle2 /> Nothing pending on your pages.</p>}
      </section> : <div className="staff-desk-focus-panel"><ShopNotifications userId={userId} /></div>}
    </div>

    <div className="staff-desk-reconcile"><strong>Available funds:</strong> shop opening balances aur Load/Bill attribution verify hone tak reconciliation required.</div>
    {!branchAvailable && <span className="sr-only">Branch is not assigned.</span>}
    <span className="sr-only">POS khata sales: {money(credit)}.</span>
  </div>;
}
