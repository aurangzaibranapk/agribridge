import "./finance-dash.css";
import { Band, Bars, AreaFlow, Donut, HBarTable, Kpi, NewTag, PAL } from "./charts";
import { rs, kfmt, pct } from "@/lib/finance-dash/format";
import { dayLabel, topWithRest, type CashFlowResult, type PnlResult, type InventoryResult } from "@/lib/finance-dash/compute";

/* Ye teeno views sirf props se chalte hain (koi database nahi), taa ke inhein test aur screenshot kiya ja sake. */

export type FlowBy = "roz" | "hafta" | "mahina";
const FLOW_TITLE: Record<FlowBy, string> = { roz: "har din", hafta: "har hafta", mahina: "har mahina" };

export function CashFlowDashboard({ d, by = "hafta", hrefFor }: { d: CashFlowResult; by?: FlowBy; hrefFor?: (b: FlowBy) => string }) {
  const series = by === "roz" ? d.daily : by === "mahina" ? d.monthly.map((m) => ({ ...m, net: m.in - m.out })) : d.weekly;
  const maxAcct = Math.max(1, ...d.accounts.map((a) => Math.max(a.in, a.out)));
  return (
    <div className="fdash" data-testid="fdash-cashflow">
      <Band title="CASH FLOW SUMMARY" />
      <div className="g4">
        <Kpi label="Cash In (muddat)" value={rs(d.cashIn)} sub="sab bank + cash + wallet" />
        <Kpi label="Cash Out (muddat)" value={rs(d.cashOut)} sub="adaigiyan + kharche" />
        <Kpi label="Net Cash Flow" value={rs(d.net)} sub={d.net >= 0 ? "▲ in > out" : "▼ out > in"} neg={d.net < 0} />
        <Kpi label="Cash Flow Margin" value={`${d.margin.toFixed(1)}%`} sub="net ÷ cash in" neg={d.margin < 0} />
      </div>
      <div className="grid">
        <div className="card">
          <NewTag />
          <h2>Net Cash Flow — {FLOW_TITLE[by]}</h2>
          <div className="top" style={{ margin: "-4px 0 6px" }}>
            <div className="leg2"><span><i style={{ background: "#22c55e" }} />Net flow</span></div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["roz", "hafta", "mahina"] as FlowBy[]).map((b) => (
                <a key={b} href={hrefFor ? hrefFor(b) : undefined} className={`btn${b === by ? " on" : ""}`}>{b[0].toUpperCase() + b.slice(1)}</a>
              ))}
            </div>
          </div>
          <AreaFlow labels={series.map((w) => w.label)} values={series.map((w) => w.net)} />
          <div className="mut">Mahina: {d.monthly.map((m) => `${m.label} in ${rs(m.in)} / out ${rs(m.out)}`).join(" · ")}</div>
        </div>
        <div className="card">
          <NewTag />
          <h2>Account ka balance (aaj)</h2>
          <table>
            <thead><tr><th>Account</th><th className="r">Balance</th></tr></thead>
            <tbody>
              {d.balances.map((b) => (
                <tr key={b.name}><td>{b.name}</td><td className={`r${b.balance < 0 ? " neg" : ""}`}>{rs(b.balance)}</td></tr>
              ))}
            </tbody>
          </table>
          {d.balances.some((b) => b.balance < 0) && <div className="mut" style={{ marginTop: 6 }}>Minus wale account: entry ya statement check karni hai.</div>}
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <NewTag />
        <h2>Har account ka In / Out (muddat, andar ki transfers samait)</h2>
        <div className="leg2"><span><i style={{ background: "#15803d" }} />In</span><span><i style={{ background: "#a3e635" }} />Out</span></div>
        <table>
          <thead><tr><th>Account</th><th className="hide-m" style={{ width: "30%" }}>In</th><th className="r">In</th><th className="hide-m" style={{ width: "30%" }}>Out</th><th className="r">Out</th></tr></thead>
          <tbody>
            {d.accounts.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td>
                <td className="hide-m"><div className="bar"><i style={{ width: `${Math.round((a.in / maxAcct) * 100)}%`, background: "#15803d" }} /></div></td>
                <td className="r">{rs(a.in)}</td>
                <td className="hide-m"><div className="bar"><i style={{ width: `${Math.round((a.out / maxAcct) * 100)}%`, background: "#a3e635" }} /></div></td>
                <td className="r">{rs(a.out)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="g2">
        <div className="card"><NewTag /><h2>Sab se bari aamad (Top inflows)</h2><HBarTable rows={d.inflows} /></div>
        <div className="card"><NewTag /><h2>Sab se bari adaigiyan (Top outflows)</h2><HBarTable rows={d.outflows} color="#65a30d" /></div>
      </div>
      <div className="info">
        Muddat: {dayLabel(d.from)} – {dayLabel(d.to)} {d.to.slice(0, 4)}. Sirf asal len-den gina gaya hai. Correction, reversal, opening balance, manual aur reconciliation ki entries trend se bahar hain (warna in {kfmt(d.rawIn)} / out {kfmt(d.rawOut)} aata). Neeche mojooda Cash Flow Statement waise hi hai.
      </div>
    </div>
  );
}

export function PnlDashboard({ d }: { d: PnlResult }) {
  const et = d.expenseCats.reduce((s, c) => s + c.value, 0);
  const pos = d.expenseCats.filter((c) => c.value > 0);
  const neg = d.expenseCats.filter((c) => c.value < 0);
  const incTop = d.incomeCats.filter((c) => c.value > 0);
  const faded = d.months.map((m, i) => (m.faded ? i : -1)).filter((i) => i >= 0);
  return (
    <div className="fdash" data-testid="fdash-pnl">
      <Band title="FINANCIAL OVERVIEW · EXPENSES BREAKDOWN" />
      <div className="g4">
        <Kpi label="Total Revenue" value={rs(d.revenue)} sub={incTop.slice(0, 2).map((c) => `${c.name.replace(/^Bikri — /, "")} ${kfmt(c.value)}`).join(" + ")} />
        <Kpi label="Total Expenses" value={rs(d.expenses)} sub="lagat + kharche" />
        <Kpi label="Net Profit" value={rs(d.net)} sub={d.net >= 0 ? "▲ munafa" : "▼ nuqsan"} neg={d.net < 0} />
        <Kpi label="Profit Margin" value={`${d.margin.toFixed(1)}%`} sub="net ÷ revenue" neg={d.margin < 0} />
      </div>
      {d.salariesMissing && (
        <div className="warn">
          ⚠ <b>Tankhwah darj nahi:</b> is muddat mein sirf {rs(d.salaries)} tankhwah ke khate mein hai. Asal tankhwahein post hone tak munafa zyada dikhega. HR / salary module chalne par ye khud bharega.
        </div>
      )}
      <div className="grid">
        <div className="card">
          <NewTag />
          <h2>Revenue vs Expenses — har mahina</h2>
          <div className="leg2" style={{ marginBottom: 4 }}>
            <span><i style={{ background: "#15803d" }} />Revenue</span><span><i style={{ background: "#a3e635" }} />Expenses</span>
            {faded.length > 0 && <span className="mut">Halka mahina = KPI muddat se pehle</span>}
          </div>
          <Bars labels={d.months.map((m) => m.label)} series={[d.months.map((m) => m.revenue), d.months.map((m) => m.expenses)]} colors={["#15803d", "#a3e635"]} h={220} faded={faded} />
          <div className="mut">*Jari mahina. {d.months.filter((m) => !m.faded).map((m) => `${m.label.replace("*", "")}: ${rs(m.revenue)} / ${rs(m.expenses)}`).join(" · ")}</div>
        </div>
        <div className="card">
          <NewTag />
          <h2>Kharchon ka hissa (Expense breakdown)</h2>
          <Donut items={topWithRest(pos.map((c) => ({ name: c.name.split(" (")[0], value: c.value })))} center={kfmt(pos.reduce((s, c) => s + c.value, 0))} sub="Total expenses" />
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <NewTag />
          <h2>Kharche category ke hisaab se</h2>
          <table>
            <thead><tr><th>Category</th><th className="r">Raqam</th><th className="r">% of total</th></tr></thead>
            <tbody>
              {pos.map((c, i) => (
                <tr key={c.code}>
                  <td><span className="sw" style={{ background: PAL[Math.min(i, 7)] }} />{c.name}{c.code === "6000" && d.salariesMissing && <> <span className="pill">KAM DARJ</span></>}</td>
                  <td className="r">{rs(c.value)}</td><td className="r">{pct(c.value, et)}</td>
                </tr>
              ))}
              {neg.map((c) => (
                <tr key={c.code}><td>{c.name} (correction ke baad)</td><td className="r">{rs(c.value)}</td><td className="r">{pct(c.value, et)}</td></tr>
              ))}
              <tr><td><b>Total</b></td><td className="r"><b>{rs(et)}</b></td><td className="r">100%</td></tr>
            </tbody>
          </table>
          {d.grainPurchase > 0 && <div className="mut" style={{ marginTop: 6 }}>&quot;Karobar ke kharche&quot; (bina grain ki khareed) = {rs(et - d.grainPurchase)}.</div>}
        </div>
        <div className="card"><NewTag /><h2>Aamdani ka hissa</h2><HBarTable rows={incTop.slice(0, 5).map((c) => ({ name: c.name, value: c.value }))} /></div>
      </div>
      <div className="info">
        Muddat: KPI {dayLabel(d.from)} – {dayLabel(d.to)} {d.to.slice(0, 4)}. Bahar rakhi gayi entries (opening, reversal, correction, manual, reconciliation):{" "}
        {d.excluded.length === 0 ? "koi nahi." : d.excluded.slice(0, 4).map((x) => `${x.source} (${x.type}) ${kfmt(Math.abs(x.value))}`).join(", ") + "."} Ye trend mein nahi gini gayin. Neeche mojooda P&amp;L waise hi hai.
      </div>
    </div>
  );
}

export function InventoryDashboard({ d }: { d: InventoryResult }) {
  const maxWh = Math.max(1, ...d.byWarehouse.map((w) => w.value));
  const emptyCats = d.byCategory.filter((c) => c.inStock === 0).length;
  return (
    <div className="fdash" data-testid="fdash-inventory">
      <Band title="INVENTORY DASHBOARD" />
      {d.withMin < d.total && (
        <div className="warn">
          ⚠ <b>Sirf {d.withMin} / {d.total} products mein minimum stock set hai.</b> Baqi {d.total - d.withMin} ke liye &quot;kam stock&quot; ka alert kabhi nahi aayega.
          <a className="btn" href="/admin/products">Products mein min stock lagao</a>
        </div>
      )}
      <div className="g4" style={{ marginTop: 12 }}>
        <Kpi label="Total Products" value={String(d.total)} sub={`${d.inStock} mein stock hai`} />
        <Kpi label="Low Stock" value={String(d.low)} sub="min set walon mein, stock > 0" />
        <Kpi label="Out of Stock" value={String(d.outOfStock)} sub={`${d.minSetOut} min-set wale bhi khatam`} neg={d.outOfStock > 0} />
        <Kpi label="Inventory Health" value={`${d.health.toFixed(1)}%`} sub="stock wale, kam nahi ÷ kul" />
      </div>
      <div className="grid">
        <div className="card">
          <NewTag />
          <h2>Stock value — category ke hisaab se</h2>
          <Donut items={topWithRest(d.byCategory.map((c) => ({ name: c.name, value: c.value })))} center={kfmt(d.stockValue)} sub="Kul stock value" />
          {emptyCats > 0 && <div className="mut">{emptyCats} categories mein abhi 0 stock hai.</div>}
        </div>
        <div className="card">
          <NewTag />
          <h2>Top low stock items</h2>
          <table>
            <thead><tr><th>Product</th><th>Category</th><th className="r">Bacha</th><th className="r">Min</th><th /></tr></thead>
            <tbody>
              {d.lowList.map((r, i) => (
                <tr key={i}><td className="nw" title={r.name}>{r.name}</td><td className="nw" title={r.category}>{r.category}</td><td className="r">{r.qty}</td><td className="r">{r.min}</td><td><span className={`pill${r.status === "KAM" ? " y" : ""}`}>{r.status}</span></td></tr>
              ))}
            </tbody>
          </table>
          <div className="mut" style={{ marginTop: 6 }}>Kul {d.lowTotal}: {d.low} kam, {d.minSetOut} khatam</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <NewTag />
        <h2>Stock value — dukan / godam</h2>
        <table>
          <thead><tr><th>Godam</th><th style={{ width: "40%" }} /><th className="r">Items</th><th className="r">Value</th></tr></thead>
          <tbody>
            {d.byWarehouse.map((w) => (
              <tr key={w.name}><td>{w.name}</td><td><div className="bar"><i style={{ width: `${Math.round((w.value / maxWh) * 100)}%`, background: "#16a34a" }} /></div></td><td className="r">{w.items}</td><td className="r">{rs(w.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="info">Aaj ka stock (inventory table, purchase price par value). Health = (stock wale aur min se upar) ÷ kul products = {d.healthy} / {d.total}. Neeche mojooda inventory report waise hi hai.</div>
    </div>
  );
}

