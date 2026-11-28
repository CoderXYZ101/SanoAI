"use client";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FlaskConical, Minus, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SimResult } from "@/ai/engines/counterfactual";
import { DEFAULT_INPUTS, DOMAINS, type Band, type SimInputs } from "@/ai/knowledge/factors";
import { AiModeChip, Badge, Button, Callout, Card, ErrorState, LimitsNote, LoadingBlock, MetaNotice, PageHeader, Segmented, SourceList, Toggle, type Tone } from "@/components/ui";
import { apiFetch } from "@/lib/client";

const CONTROLS: { id: keyof SimInputs; label: string; unit: string; min: number; max: number; step: number }[] = [
  { id: "sleepHours", label: "Sleep", unit: "hours / night", min: 3, max: 11, step: 0.5 },
  { id: "activityMin", label: "Physical activity", unit: "min / week (moderate)", min: 0, max: 420, step: 15 },
  { id: "fruitVeg", label: "Fruit & vegetables", unit: "portions / day", min: 0, max: 10, step: 0.5 },
  { id: "sweetDrinks", label: "Sugar-sweetened drinks", unit: "per week", min: 0, max: 30, step: 1 },
  { id: "alcoholUnits", label: "Alcohol", unit: "standard drinks / week", min: 0, max: 40, step: 1 },
  { id: "stress", label: "Perceived stress", unit: "1 low – 5 high", min: 1, max: 5, step: 1 },
  { id: "sittingHours", label: "Sitting time", unit: "hours / day", min: 1, max: 16, step: 0.5 },
];
const PRESETS: { name: string; patch: Partial<SimInputs> }[] = [
  { name: "Sleep 7.5 h", patch: { sleepHours: 7.5 } },
  { name: "Move 150 min/week", patch: { activityMin: 150 } },
  { name: "Cut sugary drinks", patch: { sweetDrinks: 1 } },
  { name: "Balanced reset", patch: { sleepHours: 7.5, activityMin: 150, fruitVeg: 5, sweetDrinks: 1, stress: 2, sittingHours: 6 } },
];
const BAND: Record<Band, { label: string; tone: Tone; bar: string }> = {
  within: { label: "Within guidance", tone: "teal", bar: "bg-sano-500" },
  approaching: { label: "Approaching", tone: "amber", bar: "bg-amber-400" },
  outside: { label: "Outside guidance", tone: "rose", bar: "bg-rose-400" },
};

function Sliders({ value, onChange, base }: { value: SimInputs; onChange: (v: SimInputs) => void; base?: SimInputs }) {
  return (
    <div className="space-y-4">
      {CONTROLS.map((c) => {
        const changed = base && base[c.id] !== value[c.id];
        return (
          <div key={c.id}>
            <div className="flex items-baseline justify-between">
              <label htmlFor={`s-${c.id}`} className="text-[13px] font-medium text-navy-700">{c.label}</label>
              <span className={`text-[13px] font-semibold ${changed ? "text-sano-700" : "text-navy-900"}`}>{value[c.id]} <span className="text-[11.5px] font-normal text-navy-400">{c.unit}</span></span>
            </div>
            <input id={`s-${c.id}`} type="range" min={c.min} max={c.max} step={c.step} value={value[c.id] as number} onChange={(e) => onChange({ ...value, [c.id]: Number(e.target.value) })} className="mt-1 h-2 w-full cursor-pointer accent-sano-600" />
          </div>
        );
      })}
      <div>
        <label htmlFor="s-smoke" className="text-[13px] font-medium text-navy-700">Tobacco use (smoked or chewed)</label>
        <select id="s-smoke" className="field mt-1" value={value.smoking} onChange={(e) => onChange({ ...value, smoking: e.target.value as SimInputs["smoking"] })}>
          <option value="never">Never used tobacco</option>
          <option value="former">Former user</option>
          <option value="current">Current user</option>
        </select>
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  const [baseline, setBaseline] = useState<SimInputs>(DEFAULT_INPUTS);
  const [scenarios, setScenarios] = useState<{ id: string; name: string; inputs: SimInputs }[]>([
    { id: "a", name: "Scenario A", inputs: { ...DEFAULT_INPUTS, sleepHours: 7.5, activityMin: 150, sweetDrinks: 1 } },
    { id: "b", name: "Scenario B", inputs: { ...DEFAULT_INPUTS, fruitVeg: 5, stress: 2, sittingHours: 6 } },
  ]);
  const [useRecords, setUseRecords] = useState(true);
  const [active, setActive] = useState("a");
  const [res, setRes] = useState<{ result: SimResult; usedRecords: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setRes(await apiFetch("/api/simulator", { method: "POST", json: { baseline, scenarios, useRecords } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sc = scenarios.find((s) => s.id === active)!;
  const result = res?.result;
  const sr = result?.scenarios.find((s) => s.id === active);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="What if…?" title="See how your habits add up" description="Try changes to sleep, activity and food and compare them with public health advice. This is learning, not a prediction." />
      <Callout tone="warn" title="Educational simulation — not a clinically validated prediction">It compares habits with published guidance and describes associations from population evidence. It does not calculate your risk, use your genetics or conditions, or foretell outcomes.</Callout>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="card-pad">
            <div className="flex items-start justify-between gap-2"><h2 className="text-[15px] font-semibold text-navy-900">Your current habits (baseline)</h2><button className="text-[12.5px] font-medium text-sano-700 hover:underline" onClick={async () => { try { const d = await apiFetch<{ averages14: Record<string, number | null> }>("/api/diary"); const a = d.averages14; setBaseline((b) => ({ ...b, sleepHours: a.sleepHours ?? b.sleepHours, activityMin: a.activityMin != null ? Math.round(a.activityMin * 7) : b.activityMin, stress: a.stress != null ? Math.min(5, Math.max(1, Math.round(a.stress))) : b.stress })); } catch {} }}>Use my diary</button></div>
            <p className="mb-4 mt-0.5 text-[13px] text-navy-500">Estimate a typical week.</p>
            <Sliders value={baseline} onChange={setBaseline} />
          </Card>
          <Card className="card-pad">
            <Segmented value={active} onChange={setActive} label="Scenario" options={scenarios.map((s) => ({ value: s.id, label: s.name }))} />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => setScenarios((all) => all.map((s) => (s.id === active ? { ...s, inputs: { ...baseline, ...p.patch } } : s)))} className="rounded-full bg-navy-50 px-3 py-1 text-[12px] font-medium text-navy-600 hover:bg-sano-50 hover:text-sano-800">
                  {p.name}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Sliders value={sc.inputs} base={baseline} onChange={(v) => setScenarios((all) => all.map((s) => (s.id === active ? { ...s, inputs: v } : s)))} />
            </div>
          </Card>
          <Card className="card-pad">
            <Toggle checked={useRecords} onChange={setUseRecords} label="Add context from my records" description="Adds notes (for example about blood pressure or blood sugar) — it never changes the guideline comparison." />
            <Button className="mt-4 w-full" size="lg" onClick={run} loading={busy} icon={<Play className="h-4 w-4" />}>
              Simulate
            </Button>
          </Card>
        </div>

        <div className="space-y-5">
          {busy && !result && <LoadingBlock rows={4} label="Simulating" />}
          {error && <ErrorState message={error} onRetry={run} />}
          {result && sr && (
            <motion.div key={active + (res ? "r" : "")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <AiModeChip meta={result.meta} />
                <Badge tone="amber">Educational simulation</Badge>
              </div>
              <MetaNotice meta={result.meta} />
              <Card className="card-pad">
                <h2 className="text-[15px] font-semibold text-navy-900">Baseline vs {sr.name}</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-navy-600">{sr.explanation}</p>
                <p className="mt-2 text-[12.5px] text-navy-400">{result.overview}</p>
                <ul className="mt-5 space-y-5">
                  {sr.domains.map((d) => {
                    const meta = DOMAINS.find((x) => x.id === d.id)!;
                    return (
                      <li key={d.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[14px] font-semibold text-navy-900">{d.label}</p>
                            <p className="text-[12px] text-navy-400">{meta.blurb}</p>
                          </div>
                          <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                            {d.direction === "toward" ? <><ArrowUpRight className="h-4 w-4 text-sano-600" /><span className="text-sano-700">Moves toward guidance</span></> : d.direction === "away" ? <><ArrowDownRight className="h-4 w-4 text-rose-600" /><span className="text-rose-700">Moves away from guidance</span></> : <><Minus className="h-4 w-4 text-navy-400" /><span className="text-navy-500">No clear change</span></>}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5" aria-label={`${d.label}: baseline ${BAND[d.baselineBand].label}, scenario ${BAND[d.band].label}`}>
                          {[{ k: "Baseline", a: d.baselineAlign, b: d.baselineBand }, { k: sr.name, a: d.align, b: d.band }].map((row, i) => (
                            <div key={row.k} className="grid grid-cols-[84px_1fr_120px] items-center gap-3 text-[12px]">
                              <span className="truncate text-navy-500">{row.k}</span>
                              <div className="h-2.5 overflow-hidden rounded-full bg-navy-100">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(6, row.a * 100)}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} className={`h-full rounded-full ${BAND[row.b].bar} ${i === 0 ? "opacity-50" : ""}`} />
                              </div>
                              <span className="text-navy-600">{BAND[row.b].label}</span>
                            </div>
                          ))}
                        </div>
                        {d.drivers.length > 0 && <p className="mt-1.5 text-[12px] text-navy-400">Main contributors: {d.drivers.slice(0, 3).map((x) => `${x.label} ${x.effect === "toward" ? "↑" : "↓"}`).join(", ")}</p>}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-5 flex items-center gap-1.5 text-[12px] text-navy-400"><ArrowRight className="h-3.5 w-3.5" /> Bars show closeness to guidance ranges — they are not risks, probabilities or percentages.</p>
              </Card>

              {sr.factorNotes.length > 0 && (
                <Card className="card-pad">
                  <h2 className="text-[15px] font-semibold text-navy-900">What the evidence says about what you changed</h2>
                  <ul className="mt-3 space-y-4">
                    {sr.factorNotes.map((f) => (
                      <li key={f.factorId}>
                        <p className="text-[14px] font-semibold text-navy-800">{f.label}</p>
                        <p className="text-[12.5px] text-navy-400">{f.guidance}</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {f.evidence.map((e) => (
                            <li key={e.text} className="flex gap-2 text-[13.5px] text-navy-700">
                              <Badge tone={e.status === "established" ? "teal" : "amber"} className="mt-0.5 shrink-0">{e.status === "established" ? "Established" : "Emerging"}</Badge>
                              <span>{e.text}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {sr.changes.length === 0 && <Callout tone="info">This scenario is the same as your baseline. Adjust a slider to see a difference.</Callout>}

              {res!.usedRecords && result.recordNotes.length > 0 && (
                <Card className="card-pad border-sano-200">
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold text-navy-900"><FlaskConical className="h-4 w-4 text-sano-600" /> Context from your records</h2>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13.5px] text-navy-700">
                    {result.recordNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <Card className="card-pad">
                  <h2 className="text-[15px] font-semibold text-navy-900">Questions for your doctor</h2>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13.5px] text-navy-700">
                    {result.doctorQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </Card>
                <Card className="card-pad">
                  <h2 className="text-[15px] font-semibold text-navy-900">Limitations</h2>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-navy-600">
                    {result.limitations.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </Card>
              </div>
              <Card className="card-pad"><SourceList sources={result.sources} /></Card>
            </motion.div>
          )}
        </div>
      </div>
      <LimitsNote>Distinguishing education from prediction: a clinically validated risk tool would use validated models, your measurements and a clinician. This page does none of those.</LimitsNote>
    </div>
  );
}
