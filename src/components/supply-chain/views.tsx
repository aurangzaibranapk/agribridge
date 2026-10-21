import type { ReactNode } from "react";
import { Donut } from "../finance-dash/charts";
import { BarLine, DotLine, VBars } from "./charts";
import { rs } from "@/lib/finance-dash/format";
import { deltaText, type ScFilters, type ScKpi, type ScResult } from "@/lib/supply-chain/compute";

/* CSS page.tsx mein import hoti hai (test mein node CSS nahi parh sakta). Sirf props se chalta hai (koi database nahi) -- test aur screenshot ke liye. Rang/dhancha finance dashboards (#197) wala. */

type Opt = { id: string; name: string };
export interface ScOptions { months: { key: string; label: string }[]; branches: Opt[]; categories: Opt[]; suppliers: Opt[] }

function Card({ label, icon, k, fmt, unit, lowerIsBetter, empty, foot }: {
  label: string; icon: string; k: ScKpi; fmt: (v: number) => string; unit: "pct" | "num" | "rs"; lowerIsBetter?: boolean; empty: string; foot: string;
}) {
  const d = deltaText(k, unit, lowerIsBetter);
  return (
    <div className="card" data-kpi={label}>
      <div className="kl">{icon} {label}</div>
      {k.value == null ? <div className="kv empty">Data nahi</div> : <div className="kv">{fmt(k.value)}</div>}
      <div className={`ks${d.good === false ? " bad" : d.good == null ? " mutd" : ""}`}>{k.value == null ? empty : d.text || foot}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="emptybox">{children}</div>;
}

const CHIP: Record<ScResult["rows"][number]["status"], [string, string]> = {
  waqt_par: ["ok", "Waqt par"],
  late: ["late", "Late"],
  intezar: ["wait", "Maal baqi"],
  tareekh_nahi: ["none", "Tareekh nahi"],
};

const lakh = (v: number) => (v >= 1e7 ? `Rs ${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `Rs ${(v / 1e5).toFixed(2)} Lakh` : rs(v));

export function SupplyChainDashboard({ d, filters, options, action = "/admin/reports/supply-chain", renderMinSetter }: {
  d: ScResult; filters: ScFilters; options: ScOptions; action?: string; renderMinSetter?: (productId: string) => ReactNode;
}) {
  const k = d.kpi;
  const anyOnTime = d.months.some((m) => m.onTime != null);
  const anyGrn = d.months.some((m) => m.grn > 0);
  const anyTurn = d.months.some((m) => m.turnover != null);
  const anyLead = d.months.some((m) => m.lead != null);
  const costTotal = d.costSplit.reduce((s, c) => s + c.value, 0);
  return (
    <div className="fdash" data-testid="sc-dashboard">
      <div className="band">
        <span>KHAREED AUR STOCK · SUPPLY CHAIN</span>
        <span style={{ fontWeight: 500, fontSize: 11 }}>{d.periodLabel} · PO → GRN → Godam → Sale</span>
      </div>

      <form method="get" action={action} className="card slicers" style={{ marginBottom: 12 }}>
        <div>
          <label htmlFor="sc-month">Mahina</label>
          <select id="sc-month" name="month" defaultValue={filters.month}>
            <option value="">Sab (12 mahine)</option>
            {options.months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sc-branch">Branch / Dukan</label>
          <select id="sc-branch" name="branch" defaultValue={filters.branch}>
            <option value="">Sab</option>
            {options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sc-cat">Category</label>
          <select id="sc-cat" name="category" defaultValue={filters.category}>
            <option value="">Sab</option>
            {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sc-sup">Supplier</label>
          <select id="sc-sup" name="supplier" defaultValue={filters.supplier}>
            <option value="">Sab</option>
            {options.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button type="submit">Dikhao</button>
      </form>

      {!d.hasExpectedDate && (
        <div className="warn" style={{ marginTop: 0, marginBottom: 12 }}>
          Database update (migration 692) abhi Live par nahi lagi, is liye &quot;maal kab tak aayega&quot; ki tareekh aur kharche ki qisam abhi mehfooz nahi ho saktin. Waqt par % aur kharche ka batwara us ke baad bharna shuru honge.
        </div>
      )}

      <div className="g6">
        <Card label="Supplier waqt par" icon="🚚" k={k.onTime} unit="pct" fmt={(v) => `${v.toFixed(1)}%`} empty="PO par 'maal kab tak' tareekh nahi" foot={`${d.counts.withExpected} GRN ki tareekh se`} />
        <Card label="Kul kharcha" icon="💰" k={k.totalCost} unit="rs" lowerIsBetter fmt={lakh} empty="Is muddat mein koi PO nahi" foot={`${d.counts.po} PO`} />
        <Card label="Stock gardish" icon="📦" k={k.turnover} unit="num" fmt={(v) => `${v.toFixed(2)}x`} empty="Sale ya stock ki qeemat nahi" foot="biki laagat ÷ aaj ka stock" />
        <Card label="Order poora (fill rate)" icon="🛒" k={k.fillRate} unit="pct" fmt={(v) => `${v.toFixed(1)}%`} empty="Abhi koi GRN nahi hua" foot={`${d.counts.received} GRN mein`} />
        <Card label="Avg lead time (din)" icon="⏱️" k={k.leadDays} unit="num" lowerIsBetter fmt={(v) => v.toFixed(1)} empty="Abhi koi GRN nahi hua" foot="PO se GRN tak" />
        <Card label="Stock khatam" icon="⚠️" k={k.stockout} unit="pct" lowerIsBetter fmt={(v) => `${v.toFixed(1)}%`} empty="Kisi product par min-stock hadd nahi" foot={`${d.counts.tracked} / ${d.counts.products} products ki hadd lagi`} />
      </div>

      <div className="grid">
        <div className="card">
          <h2>Supplier waqt par delivery — expected tareekh vs GRN</h2>
          <div className="leg2" style={{ marginBottom: 4 }}>
            <span><i style={{ background: "#15803d" }} />Waqt par %</span>
            <span><i style={{ background: "#65a30d" }} />Kul GRN</span>
          </div>
          {anyOnTime || anyGrn
            ? <BarLine labels={d.months.map((m) => m.label.split(" ")[0])} bars={d.months.map((m) => m.onTime)} line={d.months.map((m) => m.grn)} />
            : <Empty>Pichle 12 mahine mein koi GRN nahi hua.</Empty>}
          {!anyOnTime && anyGrn && <div className="mut">Waqt par % tab banega jab PO par &quot;maal kab tak aayega&quot; ki tareekh darj hogi. Abhi sirf GRN ki ginti hai.</div>}
        </div>
        <div className="card">
          <h2>Kharche ki taqseem</h2>
          {costTotal > 0
            ? <Donut items={d.costSplit.map((c) => ({ name: c.name, value: c.value }))} center={lakh(costTotal).replace("Rs ", "")} sub="Kul kharcha" />
            : <Empty>Is muddat mein koi khareed nahi.</Empty>}
          {costTotal > 0 && d.costSplit.length <= 1 && (
            <div className="mut" style={{ marginTop: 6 }}>Kiraya, godam, packing aur mazdoori abhi darj nahi. PO ke sath ye kharche darj honge to yahan alag hisse nazar aayenge.</div>
          )}
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <h2>Stock gardish (turnover) — har mahina</h2>
          {anyTurn
            ? <VBars labels={d.months.map((m) => m.label.split(" ")[0])} values={d.months.map((m) => m.turnover)} fmt={(v) => v.toFixed(2)} />
            : <Empty>Gardish ke liye sale aur stock ki qeemat dono chahiyein.</Empty>}
          <div className="mut">Mahine ki biki laagat ÷ aaj ke stock ki qeemat. Purane mahinon ka stock record nahi, is liye aaj ka stock liya gaya.</div>
        </div>
        <div className="card">
          <h2>Supplier lead time (din) — PO se GRN</h2>
          {anyLead
            ? <DotLine labels={d.months.map((m) => m.label.split(" ")[0])} values={d.months.map((m) => m.lead)} />
            : <Empty>Abhi koi GRN nahi hua, lead time nahi nikal sakta.</Empty>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Haaliya PO / GRN</h2>
        {d.rows.length === 0 ? (
          <Empty>Is filter par koi PO nahi mila.</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>Tareekh</th><th>PO #</th><th>GRN</th><th>Product</th><th className="hide-m">Category</th><th className="hide-m">Branch</th><th>Supplier</th><th className="r">Tadad</th><th className="r">Raqam</th><th>Delivery</th></tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.po}>
                    <td className="nw">{r.date}</td>
                    <td className="nw">{r.po}</td>
                    <td className="nw">{r.grn ?? "—"}</td>
                    <td className="nw">{r.product}</td>
                    <td className="hide-m">{r.category}</td>
                    <td className="hide-m">{r.branch}</td>
                    <td className="nw">{r.supplier}</td>
                    <td className="r">{r.qty.toLocaleString("en-US")}</td>
                    <td className="r">{rs(r.amount)}</td>
                    <td><span className={`chip ${CHIP[r.status][0]}`}>{CHIP[r.status][1]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {d.counts.noMin > 0 && (
        <div className="warn" data-testid="sc-min-stock">
          <b>{d.counts.noMin} products par min-stock hadd nahi lagi</b> ({d.counts.tracked} / {d.counts.products} par lagi hai). Is liye &quot;Stock khatam %&quot; sirf {d.counts.tracked} products par hai. Neeche wale products ki hadd abhi laga dein:
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Product</th><th className="hide-m">Category</th><th className="r">Aaj stock</th><th>Min hadd</th></tr></thead>
            <tbody>
              {d.noMinProducts.map((p) => (
                <tr key={p.id}>
                  <td className="nw">{p.name}</td>
                  <td className="hide-m">{p.category}</td>
                  <td className="r">{p.stock.toLocaleString("en-US")}</td>
                  <td>{renderMinSetter ? renderMinSetter(p.id) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.counts.noMin > d.noMinProducts.length && <a className="btn" href="/admin/products">Baqi products dekhein</a>}
        </div>
      )}
    </div>
  );
}
