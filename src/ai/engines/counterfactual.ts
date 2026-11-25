import { z } from "zod";
import { bandOf, DOMAINS, FACTORS, SIM_LIMITATIONS, type Band, type DomainId, type SimInputs } from "../knowledge/factors";
import type { KbFact } from "../knowledge/kb";
import { sourcesFor } from "../knowledge/sources";
import type { AiMeta, HealthEvent, SourceRef } from "../types";
import { LlmSimulatorSchema } from "../types";
import type { HealthProfile } from "@/lib/repo";
import { computeSignals } from "./signals";
import { demoMeta, runStructured } from "../structured";

/**
 * Counterfactual Health Simulator engine.
 * EDUCATIONAL ONLY: it compares hypothetical habits with public-health guidance and reports the
 * direction of movement per health domain. It does not compute risk or predict outcomes.
 */

export interface Scenario {
  id: string;
  name: string;
  inputs: SimInputs;
}
export interface DomainState {
  id: DomainId;
  label: string;
  align: number; // 0..1 — used only to draw a bar, never shown as a number/percentage
  band: Band;
}
export interface DomainDelta extends DomainState {
  baselineAlign: number;
  baselineBand: Band;
  direction: "toward" | "away" | "steady";
  drivers: { label: string; effect: "toward" | "away" }[];
}
export interface ScenarioResult {
  id: string;
  name: string;
  changes: { factorId: string; label: string; from: string; to: string; unit: string }[];
  domains: DomainDelta[];
  explanation: string;
  factorNotes: { factorId: string; label: string; guidance: string; evidence: KbFact[]; sourceIds: string[] }[];
}
export interface SimResult {
  baseline: { domains: DomainState[]; factors: { id: string; label: string; value: string; unit: string; band: Band; guidance: string }[] };
  scenarios: ScenarioResult[];
  recordNotes: string[];
  doctorQuestions: string[];
  limitations: string[];
  sources: SourceRef[];
  overview: string;
  meta: AiMeta;
  kind: "educational-simulation";
  disclaimer: string;
}

export const SIM_DISCLAIMER = "Educational simulation — not a clinically validated prediction. It does not estimate your risk or tell you what will happen to your health.";

const show = (v: number | string) => String(v);

function domainAlign(inputs: SimInputs): Record<DomainId, number> {
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAINS) {
    let num = 0;
    let den = 0;
    for (const f of FACTORS) {
      const w = f.weights[d.id];
      if (!w) continue;
      num += w * f.align(inputs[f.id]);
      den += w;
    }
    out[d.id] = den ? num / den : 1;
  }
  return out;
}

export function simulate(baseline: SimInputs, scenarios: Scenario[], events: HealthEvent[] = [], profile?: HealthProfile, useRecords = false): Omit<SimResult, "meta"> {
  const base = domainAlign(baseline);
  const baseDomains: DomainState[] = DOMAINS.map((d) => ({ id: d.id, label: d.label, align: base[d.id], band: bandOf(base[d.id]) }));
  const baseFactors = FACTORS.map((f) => ({ id: f.id, label: f.label, value: show(baseline[f.id]), unit: f.unit, band: bandOf(f.align(baseline[f.id])), guidance: f.guidance }));

  const results: ScenarioResult[] = scenarios.map((sc) => {
    const al = domainAlign(sc.inputs);
    const changed = FACTORS.filter((f) => baseline[f.id] !== sc.inputs[f.id]);
    const domains: DomainDelta[] = DOMAINS.map((d) => {
      const delta = al[d.id] - base[d.id];
      const drivers = changed
        .map((f) => {
          const w = f.weights[d.id] ?? 0;
          const c = w * (f.align(sc.inputs[f.id]) - f.align(baseline[f.id]));
          return { label: f.label, c };
        })
        .filter((x) => Math.abs(x.c) > 0.01)
        .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
        .map((x) => ({ label: x.label, effect: (x.c > 0 ? "toward" : "away") as "toward" | "away" }));
      return { id: d.id, label: d.label, align: al[d.id], band: bandOf(al[d.id]), baselineAlign: base[d.id], baselineBand: bandOf(base[d.id]), direction: delta > 0.03 ? "toward" : delta < -0.03 ? "away" : "steady", drivers };
    });
    const moved = domains.filter((d) => d.direction !== "steady");
    const explanation = changed.length
      ? `In "${sc.name}", ${changed.length} habit${changed.length === 1 ? " differs" : "s differ"} from your baseline (${changed.map((f) => `${f.label.toLowerCase()}: ${show(baseline[f.id])} → ${show(sc.inputs[f.id])} ${f.unit}`).join("; ")}). ${
          moved.length
            ? `Relative to public-health guidance, this moves ${moved.filter((d) => d.direction === "toward").map((d) => d.label.toLowerCase()).join(", ") || "no domain"} toward the guidance range${moved.some((d) => d.direction === "away") ? ` and ${moved.filter((d) => d.direction === "away").map((d) => d.label.toLowerCase()).join(", ")} away from it` : ""}.`
            : "These differences are too small to change how any domain lines up with guidance."
        } Population evidence describes associations; how much any change would matter for you is uncertain.`
      : `"${sc.name}" is identical to your baseline, so nothing changes.`;
    return {
      id: sc.id,
      name: sc.name,
      changes: changed.map((f) => ({ factorId: f.id, label: f.label, from: show(baseline[f.id]), to: show(sc.inputs[f.id]), unit: f.unit })),
      domains,
      explanation,
      factorNotes: changed.map((f) => ({ factorId: f.id, label: f.label, guidance: f.guidance, evidence: f.evidence, sourceIds: f.sourceIds })),
    };
  });

  const recordNotes: string[] = [];
  if (useRecords && (events.length || profile)) {
    const sig = computeSignals(events, profile);
    if (sig.hasAny(["lab:high_hba1c", "lab:high_fasting_glucose", "dx:diabetes"])) recordNotes.push("Your records include raised blood-sugar results or diabetes. Changes in diet and activity can affect blood sugar; discuss any larger change with your clinician, especially if you take glucose-lowering medicines.");
    if (sig.hasAny(["dx:hypertension", "vital:high_bp", "med:antihypertensive"])) recordNotes.push("Your records include raised blood pressure or blood-pressure medicine. Ask your clinician what activity level and salt intake are appropriate for you.");
    if (sig.hasAny(["lab:low_hemoglobin", "lab:low_ferritin"])) recordNotes.push("Your records include low haemoglobin or low iron stores, which can contribute to tiredness or breathlessness on exertion. Ask your clinician whether that affects what level of exercise is right for you.");
    if (sig.hasAny(["sx:palpitations", "sx:chestpain", "sx:dyspnea"])) recordNotes.push("Your records mention palpitations, chest discomfort or breathlessness. Before increasing exercise intensity, make sure these have been assessed by a clinician.");
    if (sig.has("lab:high_tsh")) recordNotes.push("Your records include a raised TSH. Thyroid function can affect energy, weight and sleep, so lifestyle changes may not have the same effect for you as in the general population.");
    if (!recordNotes.length) recordNotes.push("No record-based considerations were identified. Records are optional context and do not change the guideline comparison.");
  }

  const changedFactors = new Set(results.flatMap((r) => r.changes.map((c) => c.factorId)));
  const doctorQuestions = [
    ...FACTORS.filter((f) => changedFactors.has(f.id)).map((f) => f.doctorQuestion),
    "Given my medical history and medicines, which of these changes would be most worthwhile or need extra care?",
    "Are there tests I should have before or after making these changes?",
  ].slice(0, 7);

  const best = results
    .map((r) => ({ r, score: r.domains.filter((d) => d.direction === "toward").length - r.domains.filter((d) => d.direction === "away").length }))
    .sort((a, b) => b.score - a.score)[0];
  const overview = results.length
    ? `${results.length === 1 ? "This scenario" : "Of the scenarios compared"}${best && best.score > 0 ? `, “${best.r.name}” lines up with guidance in the most areas` : " shows little movement relative to guidance"}. This describes alignment with public-health guidance, not what would happen to you.`
    : "Add at least one scenario to compare against your baseline.";

  return {
    kind: "educational-simulation",
    disclaimer: SIM_DISCLAIMER,
    baseline: { domains: baseDomains, factors: baseFactors },
    scenarios: results,
    recordNotes,
    doctorQuestions,
    limitations: SIM_LIMITATIONS,
    sources: sourcesFor(FACTORS.filter((f) => changedFactors.has(f.id) || !changedFactors.size).flatMap((f) => f.sourceIds)),
    overview,
  };
}

export async function runSimulation(userId: string, baseline: SimInputs, scenarios: Scenario[], events: HealthEvent[], profile: HealthProfile | undefined, useRecords: boolean, language: string): Promise<SimResult> {
  const base = simulate(baseline, scenarios, events, profile, useRecords);
  if (!scenarios.length || scenarios.every((s) => !base.scenarios.find((r) => r.id === s.id)?.changes.length)) return { ...base, meta: (await demoMeta(userId)) };
  const ids = new Set(scenarios.map((s) => s.id));
  const r = await runStructured({
    userId,
    module: "counterfactual-simulator",
    schemaName: "simulation_explanation",
    schema: LlmSimulatorSchema as z.ZodType<z.infer<typeof LlmSimulatorSchema>>,
    system: [
      "You are the explanation layer of SanoAI's EDUCATIONAL Counterfactual Health Simulator.",
      "You receive a structured, rule-computed comparison between a baseline and hypothetical scenarios, with cited evidence statements. Explain it in plain language.",
      "STRICT RULES: This is NOT a prediction. NEVER state or imply what will happen to this person's health, never give percentages or risk numbers, never diagnose, never recommend medicines or doses. Use words like 'is associated with' and 'may'. Only use the evidence statements provided; do not add new medical claims. Mention uncertainty and that individual response varies. Suggest questions for a doctor.",
      `Write in ${language}. Keep each explanation under 130 words.`,
    ].join("\n"),
    user: JSON.stringify({
      baseline: base.baseline,
      scenarios: base.scenarios.map((s) => ({ scenarioId: s.id, name: s.name, changes: s.changes, domainMovement: s.domains.map((d) => ({ domain: d.label, from: d.baselineBand, to: d.band, direction: d.direction })), evidence: s.factorNotes })),
      recordNotes: base.recordNotes,
    }),
    validate: (d) => (d.perScenario.some((p) => !ids.has(p.scenarioId)) ? "unknown scenarioId" : null),
  });
  if (!r.ok) return { ...base, meta: r.meta };
  const map = new Map(r.data.perScenario.map((p) => [p.scenarioId, p.explanation]));
  return {
    ...base,
    overview: r.data.overview || base.overview,
    scenarios: base.scenarios.map((s) => ({ ...s, explanation: map.get(s.id) ?? s.explanation })),
    doctorQuestions: r.data.doctorQuestions.length ? r.data.doctorQuestions : base.doctorQuestions,
    meta: r.meta,
  };
}
