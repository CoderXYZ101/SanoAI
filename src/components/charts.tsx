"use client";
import { formatDate } from "@/ai/engines/dates";

export interface SPoint {
  date: string | null;
  value: number;
  valueText: string;
  flag: string;
  refLow: number | null;
  refHigh: number | null;
}

const COLORS: Record<string, string> = { low: "#d97706", high: "#e11d48", normal: "#14afb1", unknown: "#7b93bc" };

/** Time-series with the LAB-PRINTED reference band shaded — values are never judged against outside ranges. */
export function SeriesChart({ points, unit, height = 190 }: { points: SPoint[]; unit?: string | null; height?: number }) {
  const pts = points.filter((p) => p.date);
  if (pts.length === 0) return <p className="text-sm text-navy-500">No dated values to plot.</p>;
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 20, t: 18, b: 34 };
  const t = (d: string) => new Date(d.length === 7 ? `${d}-15` : d).getTime();
  const xs = pts.map((p) => t(p.date!));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const last = pts[pts.length - 1];
  const lows = pts.map((p) => p.refLow).filter((v): v is number => v != null);
  const highs = pts.map((p) => p.refHigh).filter((v): v is number => v != null);
  const vals = [...pts.map((p) => p.value), ...(lows.length ? [Math.min(...lows)] : []), ...(highs.length ? [Math.max(...highs)] : [])];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = hi - lo || Math.abs(hi) || 1;
  lo -= span * 0.15;
  hi += span * 0.15;
  const X = (x: number) => (maxX === minX ? (pad.l + W - pad.r) / 2 : pad.l + ((x - minX) / (maxX - minX)) * (W - pad.l - pad.r));
  const Y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const bandLo = last.refLow ?? lo;
  const bandHi = last.refHigh ?? hi;
  const hasBand = last.refLow != null || last.refHigh != null;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${X(t(p.date!)).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const ticks = [lo + span * 0.15, (lo + hi) / 2, hi - span * 0.15];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Chart of ${pts.length} values${unit ? ` in ${unit}` : ""}`}>
      {hasBand && <rect x={pad.l} width={W - pad.l - pad.r} y={Y(Math.min(bandHi, hi))} height={Math.max(2, Y(Math.max(bandLo, lo)) - Y(Math.min(bandHi, hi)))} fill="#14afb1" opacity="0.1" rx="6" />}
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="#e5ebf3" strokeDasharray="3 4" />
          <text x={pad.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#7b93bc">
            {Number(v.toFixed(v < 10 ? 1 : 0))}
          </text>
        </g>
      ))}
      {hasBand && (
        <text x={W - pad.r - 4} y={Y(Math.min(bandHi, hi)) + 13} textAnchor="end" fontSize="10.5" fill="#0e8f96">
          lab range {last.refLow ?? "…"}–{last.refHigh ?? "…"}
        </text>
      )}
      {pts.length > 1 && <path d={path} fill="none" stroke="#33507c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={X(t(p.date!))} cy={Y(p.value)} r="6" fill="#fff" stroke={COLORS[p.flag] ?? COLORS.unknown} strokeWidth="2.5" />
          <text x={X(t(p.date!))} y={Y(p.value) - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0a1428">
            {p.valueText}
          </text>
          <text x={X(t(p.date!))} y={H - 10} textAnchor="middle" fontSize="11" fill="#516e9b">
            {formatDate(p.date)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Horizontal bar showing where a value sits relative to the lab's own printed range. */
export function RangeBar({ value, refLow, refHigh, flag }: { value: number | null; refLow: number | null; refHigh: number | null; flag: string }) {
  if (value == null || (refLow == null && refHigh == null)) {
    return <div className="h-2 rounded-full bg-navy-100" aria-label="No reference range printed on the report" />;
  }
  const lo = refLow ?? value * 0.5;
  const hi = refHigh ?? value * 1.5;
  const pad = (hi - lo) * 0.6 || 1;
  const min = Math.min(lo, value) - pad * 0.4;
  const max = Math.max(hi, value) + pad * 0.4;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="relative h-2.5 rounded-full bg-navy-100" role="img" aria-label={`Value ${value} against lab range ${refLow ?? "…"} to ${refHigh ?? "…"}: ${flag}`}>
      <div className="absolute inset-y-0 rounded-full bg-sano-300/70" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
      <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow" style={{ left: `${Math.min(97, Math.max(3, pct(value)))}%`, background: COLORS[flag] ?? COLORS.unknown }} />
    </div>
  );
}
