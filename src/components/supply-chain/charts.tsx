import { kfmt } from "@/lib/finance-dash/format";

/* Sirf SVG, koi library nahi. `null` wale mahine khali chhorte hain (farzi 0 nahi). */

export function BarLine({ labels, bars, line, barColor = "#15803d", lineColor = "#65a30d", h = 200, W = 760 }: {
  labels: string[]; bars: (number | null)[]; line: number[]; barColor?: string; lineColor?: string; h?: number; W?: number;
}) {
  const n = labels.length || 1;
  const gw = (W - 90) / n;
  const lmx = Math.max(1, ...line);
  const y = (pct: number) => h - 25 - (pct / 100) * (h - 45);
  const yl = (v: number) => h - 25 - (v / lmx) * (h - 45);
  const pts = line.map((v, i) => `${Math.round(55 + i * gw + gw / 2)},${Math.round(yl(v))}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={50} x2={W - 35} y1={Math.round(y(g))} y2={Math.round(y(g))} className="gl" />
          <text x={44} y={Math.round(y(g) + 4)} textAnchor="end" className="ax">{g}%</text>
          <text x={W - 30} y={Math.round(y(g) + 4)} className="ax">{kfmt((lmx * g) / 100)}</text>
        </g>
      ))}
      {labels.map((l, i) => {
        const v = bars[i];
        const x = 55 + i * gw + gw * 0.2;
        return (
          <g key={i}>
            {v != null && <rect x={Math.round(x)} y={Math.round(y(v))} width={Math.round(gw * 0.6)} height={Math.max(0, Math.round(h - 25 - y(v)))} rx={3} fill={barColor} />}
            {v != null && <text x={Math.round(x + gw * 0.3)} y={Math.round(y(v) - 5)} textAnchor="middle" className="ax b">{Math.round(v)}%</text>}
            <text x={Math.round(55 + i * gw + gw / 2)} y={h - 8} textAnchor="middle" className="ax">{l}</text>
          </g>
        );
      })}
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={2.5} />
      {line.map((v, i) => <circle key={i} cx={Math.round(55 + i * gw + gw / 2)} cy={Math.round(yl(v))} r={3.5} fill={lineColor} />)}
    </svg>
  );
}

export function VBars({ labels, values, color = "#16a34a", h = 180, W = 520, fmt = (v: number) => v.toFixed(1) }: {
  labels: string[]; values: (number | null)[]; color?: string; h?: number; W?: number; fmt?: (v: number) => string;
}) {
  const mx = Math.max(0.0001, ...values.map((v) => v ?? 0));
  const n = labels.length || 1;
  const gw = (W - 50) / n;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%">
      {[0, 1, 2, 3, 4].map((g) => {
        const yy = h - 25 - (g * (h - 45)) / 4;
        return <line key={g} x1={40} x2={W} y1={Math.round(yy)} y2={Math.round(yy)} className="gl" />;
      })}
      {labels.map((l, i) => {
        const v = values[i];
        const bh = v != null ? (v / mx) * (h - 45) : 0;
        const x = 45 + i * gw + gw * 0.18;
        return (
          <g key={i}>
            {v != null && <rect x={Math.round(x)} y={Math.round(h - 25 - bh)} width={Math.round(gw * 0.64)} height={Math.round(bh)} rx={3} fill={color} />}
            {v != null && <text x={Math.round(x + gw * 0.32)} y={Math.round(h - 30 - bh)} textAnchor="middle" className="ax b">{fmt(v)}</text>}
            <text x={Math.round(45 + i * gw + gw / 2)} y={h - 8} textAnchor="middle" className="ax">{l}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function DotLine({ labels, values, color = "#0d9488", h = 180, W = 520 }: { labels: string[]; values: (number | null)[]; color?: string; h?: number; W?: number }) {
  const mx = Math.max(1, ...values.map((v) => v ?? 0));
  const n = labels.length || 1;
  const gw = (W - 50) / n;
  const pts = values.map((v, i) => (v == null ? null : ([45 + i * gw + gw / 2, h - 25 - (v / mx) * (h - 50)] as const)));
  // null par line toot jati hai.
  const segs: string[] = [];
  let cur: string[] = [];
  for (const p of pts) {
    if (!p) { if (cur.length) segs.push(cur.join(" ")); cur = []; continue; }
    cur.push(`${Math.round(p[0])},${Math.round(p[1])}`);
  }
  if (cur.length) segs.push(cur.join(" "));
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%">
      {[0, 1, 2, 3, 4].map((g) => {
        const yy = h - 25 - (g * (h - 50)) / 4;
        return (
          <g key={g}>
            <line x1={40} x2={W} y1={Math.round(yy)} y2={Math.round(yy)} className="gl" />
            <text x={34} y={Math.round(yy + 4)} textAnchor="end" className="ax">{Math.round((mx * g) / 4)}</text>
          </g>
        );
      })}
      {segs.map((s, i) => <polyline key={i} points={s} fill="none" stroke={color} strokeWidth={2.5} />)}
      {pts.map((p, i) => p && (
        <g key={i}>
          <circle cx={Math.round(p[0])} cy={Math.round(p[1])} r={3.5} fill={color} />
          <text x={Math.round(p[0])} y={Math.round(p[1] - 8)} textAnchor="middle" className="ax b">{values[i]}</text>
        </g>
      ))}
      {labels.map((l, i) => <text key={i} x={Math.round(45 + i * gw + gw / 2)} y={h - 8} textAnchor="middle" className="ax">{l}</text>)}
    </svg>
  );
}
