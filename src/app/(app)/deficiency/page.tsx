"use client";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { BiomarkerResult, BiomarkerRow } from "@/ai/types";
import { formatDate } from "@/ai/engines/dates";
import { NoRecords } from "@/components/common";
import { RangeBar, SeriesChart } from "@/components/charts";
import { AiModeChip, Badge, Callout, Card, ErrorState, flagLabel, flagTone, LimitsNote, LoadingBlock, MetaNotice, PageHeader, SourceList } from "@/components/ui";
import { useApi } from "@/lib/client";

type Data = { result: BiomarkerResult; hasRecords: boolean };
const ORDER = ["vitamin_b12", "vitamin_d", "iron", "ferritin", "hemoglobin", "calcium", "folate"];

function BiomarkerCard({ rows, sources }: { rows: BiomarkerRow[]; sources: BiomarkerResult["sources"] }) {
  const [open, setOpen] = useState(false);
  const latest = rows[rows.length - 1];
  const prev = rows.slice(0, -1);
  const refs = sources.filter((s) => latest.sourceIds.includes(s.id));
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full p-5 text-left sm:p-6">
        <div className="grid items-center gap-4 sm:grid-cols-[1.1fr_1.2fr_auto]">
          <div>
            <p className="text-[16px] font-semibold text-navy-900">{latest.name}</p>
            <p className="mt-0.5 text-[12.5px] text-navy-400">
              {formatDate(latest.date)} · {latest.docTitle}
            </p>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold text-navy-900">{latest.valueText}</span>
              <span className="text-sm text-navy-500">{latest.unit}</span>
              <Badge tone={flagTone(latest.flag)}>{flagLabel(latest.flag)}</Badge>
            </div>
            <div className="mt-2.5">
              <RangeBar value={latest.value} refLow={latest.refLow} refHigh={latest.refHigh} flag={latest.flag} />
            </div>
            <p className="mt-1.5 text-[12px] text-navy-400">Lab reference range: {latest.refText ?? "not printed on the report"}</p>
          </div>
          <ChevronDown className={`hidden h-5 w-5 text-navy-300 transition sm:block ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="space-y-5 border-t border-navy-100 bg-navy-50/40 p-5 sm:p-6">
          {rows.length > 1 && (
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-navy-400">Across your reports</p>
              <SeriesChart points={rows.map((r) => ({ date: r.date, value: r.value ?? 0, valueText: r.valueText, flag: r.flag, refLow: r.refLow, refHigh: r.refHigh }))} unit={latest.unit} height={170} />
              {prev.some((p) => p.dateCertainty === "ambiguous") && <p className="text-[12px] text-amber-700">One or more report dates are ambiguous.</p>}
            </div>
          )}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">What this measures</p>
            <p className="mt-1 text-[14px] leading-relaxed text-navy-700">{latest.explanation}</p>
          </div>
          {latest.possibleReasons.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">Possible reasons (general — not a diagnosis)</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[13.5px] text-navy-700">
                {latest.possibleReasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">Limitations</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-navy-600">
                {latest.limitations.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">Information that would help interpret it</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-navy-600">
                {latest.missingInfo.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-navy-100">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-sano-700">Questions for your doctor</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13.5px] text-navy-700">
              {latest.doctorQuestions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <SourceList sources={refs} />
        </div>
      )}
    </Card>
  );
}

export default function DeficiencyPage() {
  const { data, error, loading, reload } = useApi<Data>("/api/deficiency");
  const grouped = useMemo(() => {
    const m = new Map<string, BiomarkerRow[]>();
    data?.result.rows.forEach((r) => m.set(r.key, [...(m.get(r.key) ?? []), r]));
    return m;
  }, [data]);

  if (loading && !data) return <LoadingBlock rows={4} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const r = data.result;
  const panel = ORDER.filter((k) => grouped.has(k));
  const others = [...grouped.keys()].filter((k) => !ORDER.includes(k));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="AI Deficiency Finder" title="Your nutritional markers, explained" description="Values are read from your lab reports and compared only with the reference range printed on each report. SanoAI explains what each marker does — it does not diagnose a deficiency or recommend supplements." />
      {!data.hasRecords ? (
        <NoRecords what="The Deficiency Finder" onLoaded={reload} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AiModeChip meta={r.meta} />
            <span className="text-[12.5px] text-navy-400">Explanations come from a curated, cited library.</span>
          </div>
          <MetaNotice meta={r.meta} />
          <Callout tone="info" title="How to read this">
            “Below lab range” means below the range printed on <em>that</em> report — which can differ between labs. It is a prompt for a conversation, not a diagnosis, and symptoms alone are never used to infer a deficiency.
          </Callout>

          {panel.length === 0 ? (
            <Callout tone="warn" title="None of the tracked nutrient markers were found in your documents">Upload a blood test that includes B12, vitamin D, iron, ferritin, haemoglobin, calcium or folate.</Callout>
          ) : (
            <div className="space-y-3">
              {panel.map((k) => (
                <BiomarkerCard key={k} rows={grouped.get(k)!} sources={r.sources} />
              ))}
            </div>
          )}

          {r.notFound.length > 0 && (
            <Card className="card-pad">
              <h2 className="text-[15px] font-semibold text-navy-900">Not found in your reports</h2>
              <p className="mt-1 text-[13px] text-navy-500">Missing here does not mean normal — it means these weren&apos;t in the documents provided.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.notFound.map((n) => (
                  <Badge key={n.key} tone="slate">{n.name}</Badge>
                ))}
              </div>
            </Card>
          )}

          {others.length > 0 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-navy-900">Related markers (context)</h2>
              <div className="space-y-3">
                {others.map((k) => (
                  <BiomarkerCard key={k} rows={grouped.get(k)!} sources={r.sources} />
                ))}
              </div>
            </section>
          )}
          <Card className="card-pad"><SourceList sources={r.sources} /></Card>
        </>
      )}
      <LimitsNote>SanoAI does not diagnose nutritional deficiencies, does not recommend supplements or doses, and cannot replace a clinical assessment. Reference ranges vary between laboratories.</LimitsNote>
    </div>
  );
}
