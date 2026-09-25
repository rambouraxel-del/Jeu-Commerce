// Graphiques SVG simples (barres et courbes), lisibles sur mobile.

import { compactEuros } from '../../utils/format';

export function BarChart(props: {
  data: { label: string; value: number; value2?: number }[];
  color?: string;
  color2?: string;
  height?: number;
  format?: (v: number) => string;
  legend?: [string, string?];
}) {
  const h = props.height ?? 140;
  const w = 320;
  const fmt = props.format ?? compactEuros;
  const vals = props.data.flatMap((d) => [d.value, d.value2 ?? 0]);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const range = max - min || 1;
  const n = Math.max(1, props.data.length);
  const bw = (w - 30) / n;
  const y = (v: number) => 8 + ((max - v) / range) * (h - 28);
  const zero = y(0);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" role="img">
        <line x1="28" x2={w} y1={zero} y2={zero} stroke="#bbb" strokeWidth="1" />
        <text x="2" y="12" fontSize="9" fill="#888">
          {fmt(max)}
        </text>
        {min < 0 && (
          <text x="2" y={h - 20} fontSize="9" fill="#888">
            {fmt(min)}
          </text>
        )}
        {props.data.map((d, i) => {
          const x = 30 + i * bw;
          const hasTwo = d.value2 !== undefined;
          const bwi = hasTwo ? bw * 0.4 : bw * 0.7;
          const v1 = d.value;
          const r1 = { y: Math.min(y(v1), zero), h: Math.abs(y(v1) - zero) };
          return (
            <g key={i}>
              <rect x={x + bw * 0.1} y={r1.y} width={bwi} height={Math.max(0.5, r1.h)} fill={v1 < 0 ? '#d62828' : props.color ?? '#3d7dd8'} rx="1.5" />
              {hasTwo && (
                <rect
                  x={x + bw * 0.1 + bwi + 1}
                  y={Math.min(y(d.value2!), zero)}
                  width={bwi}
                  height={Math.max(0.5, Math.abs(y(d.value2!) - zero))}
                  fill={d.value2! < 0 ? '#d62828' : props.color2 ?? '#2b9348'}
                  rx="1.5"
                />
              )}
              {(n <= 10 || i % Math.ceil(n / 8) === 0) && (
                <text x={x + bw / 2} y={h - 4} fontSize="9" fill="#666" textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {props.legend && (
        <div className="chart-legend">
          <span>
            <i style={{ background: props.color ?? '#3d7dd8' }} /> {props.legend[0]}
          </span>
          {props.legend[1] && (
            <span>
              <i style={{ background: props.color2 ?? '#2b9348' }} /> {props.legend[1]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function LineChart(props: { series: { name: string; color: string; values: number[] }[]; labels: string[]; height?: number; format?: (v: number) => string }) {
  const h = props.height ?? 140;
  const w = 320;
  const fmt = props.format ?? compactEuros;
  const all = props.series.flatMap((s) => s.values);
  const max = Math.max(1e-9, ...all);
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const n = Math.max(2, props.labels.length);
  const x = (i: number) => 30 + (i / (n - 1)) * (w - 36);
  const y = (v: number) => 8 + ((max - v) / range) * (h - 28);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" role="img">
        <line x1="28" x2={w} y1={y(0)} y2={y(0)} stroke="#ccc" />
        <text x="2" y="12" fontSize="9" fill="#888">
          {fmt(max)}
        </text>
        {props.series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
        {props.labels.map((l, i) =>
          n <= 10 || i % Math.ceil(n / 8) === 0 ? (
            <text key={i} x={x(i)} y={h - 4} fontSize="9" fill="#666" textAnchor="middle">
              {l}
            </text>
          ) : null,
        )}
      </svg>
      <div className="chart-legend">
        {props.series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ShareBar(props: { parts: { name: string; value: number; color: string }[] }) {
  const total = props.parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="sharebar">
      <div className="sharebar-track">
        {props.parts.map((p) => (
          <div key={p.name} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={p.name} />
        ))}
      </div>
      <div className="chart-legend wrap">
        {props.parts.map((p) => (
          <span key={p.name}>
            <i style={{ background: p.color }} /> {p.name} {((p.value / total) * 100).toFixed(1).replace('.', ',')} %
          </span>
        ))}
      </div>
    </div>
  );
}
