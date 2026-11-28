import clsx from "clsx";

export interface Reading {
  name: string;
  valueText: string;
  unit: string | null;
  value: number | null;
  refLow: number | null;
  refHigh: number | null;
  flag: "low" | "high" | "normal" | "unknown";
  date: string | null;
}

/** Shows a result against the range printed on the report: green band = the lab's range, dot = the value. */
export default function RangeBar({ r }: { r: Reading }) {
  const tone = r.flag === "low" ? "amber" : r.flag === "high" ? "rose" : "teal";
  const text = r.flag === "low" ? "Below range" : r.flag === "high" ? "Above range" : "In range";
  const { value, refLow, refHigh } = r;
  let scale: { band: [number, number]; dot: number } | null = null;
  if (value !== null && (refLow !== null || refHigh !== null)) {
    const low = refLow ?? 0;
    const high = refHigh ?? Math.max(value, low) * 1.4;
    const pad = (high - low) * 0.6 || Math.abs(high) * 0.3 || 1;
    const min = Math.max(0, Math.min(value, low) - pad);
    const max = Math.max(value, high) + pad;
    const at = (n: number) => ((n - min) / (max - min)) * 100;
    scale = { band: [at(low), refHigh === null ? 100 : at(high)], dot: at(value) };
  }
  const range = refLow !== null && refHigh !== null ? `${refLow} – ${refHigh}` : refLow !== null ? `above ${refLow}` : refHigh !== null ? `below ${refHigh}` : "not printed";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-navy-900">{r.name}</p>
        <p className="shrink-0 text-[15px] font-semibold text-navy-900">
          {r.valueText} <span className="text-[12px] font-normal text-navy-400">{r.unit}</span>
        </p>
      </div>
      {scale && (
        <div className="relative my-2.5 h-3 rounded-full bg-navy-100" role="img" aria-label={`${r.name} ${r.valueText} ${r.unit ?? ""}; lab range ${range}`}>
          <span className="absolute inset-y-0 rounded-full bg-emerald-300" style={{ left: `${scale.band[0]}%`, width: `${scale.band[1] - scale.band[0]}%` }} />
          <span className={clsx("absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow", tone === "amber" ? "bg-amber-500" : tone === "rose" ? "bg-rose-500" : "bg-sano-600")} style={{ left: `${Math.min(98, Math.max(2, scale.dot))}%` }} />
        </div>
      )}
      <p className="flex flex-wrap justify-between gap-x-3 text-[12px]">
        <span className={clsx("font-semibold", tone === "amber" ? "text-amber-700" : tone === "rose" ? "text-rose-700" : "text-sano-700")}>{text}</span>
        <span className="text-navy-400">Lab range: {range}</span>
      </p>
    </div>
  );
}
