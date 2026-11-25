"use client";
import { NotebookPen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Callout, Card, EmptyState, ErrorState, Field, LimitsNote, LoadingBlock, PageHeader, SectionTitle, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

interface Entry {
  date: string;
  sleepHours: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  activityMin: number | null;
  symptoms: string[];
  notes: string;
}
interface Data {
  entries: Entry[];
  hidden: number;
  windowDays: number;
  averages14: Record<string, number | null>;
}

const QUICK = ["Headache", "Fatigue", "Palpitations", "Dizziness", "Nausea", "Tingling", "Bloating", "Joint pain", "Poor sleep"];
const today = () => new Date().toISOString().slice(0, 10);
const blank = (date: string): Entry => ({ date, sleepHours: null, mood: null, energy: null, stress: null, activityMin: null, symptoms: [], notes: "" });

function Scale({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number | null) => void; low: string; high: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-navy-700">{label}</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={value === n} onClick={() => onChange(value === n ? null : n)} className={`h-10 flex-1 rounded-xl text-sm font-semibold transition ${value === n ? "bg-sano-600 text-white shadow-glow" : "bg-navy-50 text-navy-600 hover:bg-sano-50"}`}>
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-[11px] text-navy-400"><span>{low}</span><span>{high}</span></p>
    </div>
  );
}

function Spark({ label, values, unit, max }: { label: string; values: (number | null)[]; unit?: string; max: number }) {
  const pts = values.map((v, i) => (v == null ? null : { x: values.length === 1 ? 50 : (i / (values.length - 1)) * 100, y: 100 - (v / max) * 100, v })).filter((p): p is { x: number; y: number; v: number } => !!p);
  const last = pts[pts.length - 1];
  const avg = pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : null;
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-navy-700">{label}</p>
        <p className="text-[12px] text-navy-400">{avg == null ? "no data" : `avg ${avg.toFixed(1)}${unit ?? ""}`}</p>
      </div>
      {pts.length > 1 ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-2 h-16 w-full" role="img" aria-label={`${label} trend`}>
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#14afb1" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {last && <circle cx={last.x} cy={last.y} r="3" fill="#0e8f96" vectorEffect="non-scaling-stroke" />}
        </svg>
      ) : (
        <p className="mt-3 text-[12px] text-navy-400">Add a few days to see a trend.</p>
      )}
    </div>
  );
}

export default function DiaryPage() {
  const { data, error, loading, reload } = useApi<Data>("/api/diary");
  const [form, setForm] = useState<Entry>(blank(today()));
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const e = data?.entries.find((x) => x.date === form.date);
    setForm(e ?? blank(form.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, form.date]);

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/api/diary", { method: "PUT", json: form });
      toast("Saved to your diary.");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  const entries = data?.entries ?? [];
  const last30 = entries.slice(-30);
  const insight = useMemo(() => {
    const withBoth = entries.filter((e) => e.sleepHours != null && e.energy != null);
    const good = withBoth.filter((e) => (e.sleepHours as number) >= 7);
    const short = withBoth.filter((e) => (e.sleepHours as number) < 7);
    if (good.length < 3 || short.length < 3) return null;
    const m = (a: Entry[]) => a.reduce((s, e) => s + (e.energy as number), 0) / a.length;
    return { good: m(good).toFixed(1), short: m(short).toFixed(1), g: good.length, s: short.length };
  }, [entries]);

  if (loading && !data) return <LoadingBlock rows={3} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Health Diary" title="Small daily notes, a clearer picture" description="Log sleep, mood, energy, stress and symptoms in under a minute. Trends help you notice patterns — and give your clinician real data instead of memory." />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="card-pad space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><NotebookPen className="h-5 w-5 text-sano-600" /><h2 className="text-[15px] font-semibold text-navy-900">Log a day</h2></div>
            <input type="date" aria-label="Date" max={today()} className="field !w-auto !py-1.5" value={form.date} onChange={(e) => setForm(blank(e.target.value))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sleep (hours)" htmlFor="sl"><input id="sl" type="number" min={0} max={24} step={0.5} className="field" value={form.sleepHours ?? ""} onChange={(e) => setForm((f) => ({ ...f, sleepHours: e.target.value === "" ? null : Number(e.target.value) }))} /></Field>
            <Field label="Activity (minutes)" htmlFor="ac"><input id="ac" type="number" min={0} max={1440} step={5} className="field" value={form.activityMin ?? ""} onChange={(e) => setForm((f) => ({ ...f, activityMin: e.target.value === "" ? null : Number(e.target.value) }))} /></Field>
          </div>
          <Scale label="Mood" low="low" high="great" value={form.mood} onChange={(v) => setForm((f) => ({ ...f, mood: v }))} />
          <Scale label="Energy" low="drained" high="energised" value={form.energy} onChange={(v) => setForm((f) => ({ ...f, energy: v }))} />
          <Scale label="Stress" low="calm" high="very stressed" value={form.stress} onChange={(v) => setForm((f) => ({ ...f, stress: v }))} />
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-navy-700">Symptoms today</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((s) => {
                const on = form.symptoms.includes(s);
                return (
                  <button key={s} aria-pressed={on} onClick={() => setForm((f) => ({ ...f, symptoms: on ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s] }))} className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${on ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300" : "bg-navy-50 text-navy-600 hover:bg-navy-100"}`}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Notes (optional)" htmlFor="nt"><textarea id="nt" className="field min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
          <Button className="w-full" loading={busy} onClick={save}>Save entry</Button>
        </Card>

        <div className="space-y-5">
          {entries.length === 0 ? (
            <EmptyState icon={<NotebookPen className="h-6 w-6" />} title="Your diary is empty" body="Log today to start building a picture of your sleep, mood and energy." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Spark label="Sleep" values={last30.map((e) => e.sleepHours)} unit=" h" max={12} />
                <Spark label="Mood" values={last30.map((e) => e.mood)} max={5} />
                <Spark label="Energy" values={last30.map((e) => e.energy)} max={5} />
                <Spark label="Stress" values={last30.map((e) => e.stress)} max={5} />
                <Spark label="Activity" values={last30.map((e) => e.activityMin)} unit=" min" max={120} />
              </div>
              {insight && (
                <Callout tone="teal" title="A pattern in your own entries">
                  Energy averaged <strong>{insight.good}/5</strong> on days after 7+ hours of sleep ({insight.g} days) versus <strong>{insight.short}/5</strong> on shorter nights ({insight.s} days). This describes your diary only — it does not show that sleep causes the difference.
                </Callout>
              )}
              <div>
                <SectionTitle title="Recent entries" hint="Click a row to edit" />
                <ul className="space-y-2">
                  {[...entries].reverse().slice(0, 14).map((e) => (
                    <li key={e.date}>
                      <div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white p-3.5">
                        <button className="min-w-0 flex-1 text-left" onClick={() => setForm(e)}>
                          <p className="text-[13.5px] font-semibold text-navy-800">{new Date(e.date + "T00:00").toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}</p>
                          <p className="mt-0.5 text-[12.5px] text-navy-500">
                            {[e.sleepHours != null && `${e.sleepHours} h sleep`, e.mood != null && `mood ${e.mood}`, e.energy != null && `energy ${e.energy}`, e.stress != null && `stress ${e.stress}`, e.activityMin != null && `${e.activityMin} min active`].filter(Boolean).join(" · ") || "No measures"}
                          </p>
                          {e.symptoms.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{e.symptoms.map((s) => <Badge key={s} tone="amber">{s}</Badge>)}</p>}
                        </button>
                        <button aria-label={`Delete entry ${e.date}`} onClick={async () => { await apiFetch("/api/diary", { method: "DELETE", json: { date: e.date } }); reload(); }} className="rounded-lg p-2 text-navy-300 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {data && data.hidden > 0 && (
            <Callout tone="info" title={`${data.hidden} older entries are hidden`}>Your plan shows the last {data.windowDays} days. They are not deleted — <Link href="/pricing" className="font-medium underline">upgrade</Link> to see your full history.</Callout>
          )}
        </div>
      </div>
      <LimitsNote>The diary is for your own tracking. Patterns shown are descriptive, not diagnostic. If a symptom worries you, speak to a clinician.</LimitsNote>
    </div>
  );
}
