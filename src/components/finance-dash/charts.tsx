import { kfmt, rs } from "@/lib/finance-dash/format";

/** Hare rang ki palette, mockup wali. */
export const PAL = ["#14532d", "#15803d", "#22c55e", "#65a30d", "#84cc16", "#a3e635", "#0d9488", "#94a3b8"];

export function NewTag() {
  return <span className="new">NAYA</span>;
}
export function OldTag() {
  return <span className="old">MOJOODA</span>;
}

export function Kpi({ label, value, sub, neg }: { label: string; value: string; sub: string; neg?: boolean }) {
  return (
    <div className="card">
      <NewTag />
      <div className="kl">{label}</div>
      <div className={`kv${neg ? " neg" : ""}`}>{value}</div>
      <div className={`ks${neg ? " neg" : ""}`}>{sub}</div>
    </div>
  );
}

export function Band({ title }: { title: string }) {
  return (
    <div className="band">
      <span>{title}</span>
      <span style={{ fontWeight: 500, fontSize: 11 }}>NAYA = naya hissa · MOJOODA = pehle se bana hissa (waise hi rahega)</span>
    </div>
  );
}

export function Donut({ items, center, sub }: { items: { name: string; value: number }[]; center: string; sub: string }) {
  const tot = items.reduce((s, i) => s + i.value, 0) || 1;
  let a = -Math.PI / 2;
  const paths = items.map((it, i) => {
    const b = a + (2 * Math.PI * it.value) / tot;
    const lg = b - a > Math.PI ? 1 : 0;
    const x1 = 80 + 60 * Math.cos(a), y1 = 80 + 60 * Math.sin(a);
    const x2 = 80 + 60 * Math.cos(b - 0.002), y2 = 80 + 60 * Math.sin(b - 0.002);
    a = b;
    return <path key={i} d={`M${x1.toFixed(1)},${y1.toFixed(1)} A60,60 0 ${lg} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`} stroke={PAL[i % 8]} strokeWidth={28} fill="none" />;
  });
  return (
    <div className="dn">
      <svg viewBox="0 0 160 160" width={160}>
        {paths}
        <text x={80} y={78} textAnchor="middle" className="dc">{center}</text>
        <text x={80} y={95} textAnchor="middle" className="ds">{sub}</text>
      </svg>
      <div>
        {items.map((it, i) => (
          <div className="lg" key={i}>
            <i style={{ background: PAL[i % 8] }} />
            {it.name}
            <b>{((it.value / tot) * 100).toFixed(1)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mahine/hafte ke hisaab se khari bars (grouped). `faded` index halke rang mein. */
export function Bars({ labels, series, colors, h = 190, W = 820, faded = [] }: { labels: string[]; series: number[][]; colors: string[]; h?: number; W?: number; faded?: number[] }) {
  const mx = Math.max(1, ...series.flat());
  const n = labels.length || 1;
  const gw = (W - 60) / n;
  const bw = gw / (series.length + 1);
  const grid = [0, 1, 2, 3, 4].map((g) => {
    const y = h - 25 - (g * (h - 40)) / 4;
    return (
      <g key={g}>
        <line x1={50} x2={W} y1={Math.round(y)} y2={Math.round(y)} className="gl" />
        <text x={44} y={Math.round(y + 4)} textAnchor="end" className="ax">{kfmt((mx * g) / 4)}</text>
      </g>
    );
  });
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%">
      {grid}
      {labels.map((l, i) => (
        <g key={i}>
          {series.map((s, j) => {
            const bh = (Math.max(0, s[i]) / mx) * (h - 40);
            const x = 55 + i * gw + bw * (j + 0.5);
            return <rect key={j} x={Math.round(x)} y={Math.round(h - 25 - bh)} width={Math.round(bw * 0.9)} height={Math.round(bh)} rx={3} fill={colors[j]} opacity={faded.includes(i) ? 0.35 : undefined} />;
          })}
          <text x={Math.round(55 + i * gw + gw / 2 - bw / 2)} y={h - 8} textAnchor="middle" className="ax">{l}</text>
        </g>
      ))}
    </svg>
  );
}

/** Net flow ki line/area: zero ke upar hara, neeche laal nuqta. */
export function AreaFlow({ labels, values, h = 190, W = 760 }: { labels: string[]; values: number[]; h?: number; W?: number }) {
  const mx = Math.max(1, ...values.map((v) => Math.abs(v)));
  const n = values.length;
  const z = h / 2 - 5;
  const every = Math.max(1, Math.ceil(n / 8));
  const showVals = n <= 12;
  const pts = values.map((v, i) => [55 + (n > 1 ? (i * (W - 70)) / (n - 1) : (W - 70) / 2), z - (v / mx) * (h / 2 - 30)] as const);
  const p = pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%">
      <line x1={50} x2={W} y1={z} y2={z} className="gl" style={{ strokeDasharray: 0 }} />
      <text x={44} y={z + 4} textAnchor="end" className="ax">0</text>
      <text x={44} y={30} textAnchor="end" className="ax">+{kfmt(mx)}</text>
      <text x={44} y={h - 25} textAnchor="end" className="ax">-{kfmt(mx)}</text>
      {n > 0 && <polygon points={`${Math.round(pts[0][0])},${z} ${p} ${Math.round(pts[n - 1][0])},${z}`} fill="#22c55e" opacity={0.35} />}
      <polyline points={p} fill="none" stroke="#15803d" strokeWidth={2.5} />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={Math.round(x)} cy={Math.round(y)} r={showVals ? 4 : 3} fill={values[i] >= 0 ? "#15803d" : "#dc2626"} />
          {i % every === 0 && <text x={Math.round(x)} y={h - 5} textAnchor="middle" className="ax">{labels[i]}</text>}
          {showVals && <text x={Math.round(x)} y={Math.round(values[i] >= 0 ? y - 8 : y + 16)} textAnchor="middle" className="ax b">{kfmt(values[i])}</text>}
        </g>
      ))}
    </svg>
  );
}

/** Ufqi bar wali list (top inflows / outflows). */
export function HBarTable({ rows, color = "#16a34a" }: { rows: { name: string; value: number }[]; color?: string }) {
  const mx = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <table>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.name}</td>
            <td style={{ width: "40%" }}>
              <div className="bar"><i style={{ width: `${Math.round((Math.abs(r.value) / mx) * 100)}%`, background: color }} /></div>
            </td>
            <td className="r">{rs(Math.abs(r.value))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
