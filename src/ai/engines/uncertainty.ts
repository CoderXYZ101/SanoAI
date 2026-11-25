import { z } from "zod";
import { BIOMARKER_BY_KEY } from "../knowledge/biomarkers";
import { retrieve, type Retrieved } from "../knowledge/retrieve";
import { SOURCE_BY_ID, sourcesFor } from "../knowledge/sources";
import type { HealthEvent, UStatement, UncertaintyAssessment } from "../types";
import { LlmUncertaintySchema } from "../types";
import type { HealthProfile } from "@/lib/repo";
import { formatDate } from "./dates";
import { computeSignals, latestByKey } from "./signals";
import { demoMeta, runStructured } from "../structured";

/**
 * Medical Uncertainty Engine.
 * Every analysis is decomposed into: supported / possible / missing / alternative explanations /
 * needs-professional. Each statement carries its BASIS (your records, a cited reference, or
 * uncited AI general knowledge). No statistical confidence figures are ever produced.
 */

const stm = (text: string, basis: UStatement["basis"], sourceIds: string[] = [], eventIds: string[] = []): UStatement => ({ text, basis, sourceIds, eventIds });
const uniq = <T,>(a: T[]) => [...new Set(a)];

export function assessUncertaintyRules(question: string, events: HealthEvent[], profile?: HealthProfile, hits?: Retrieved[]): Omit<UncertaintyAssessment, "meta"> {
  const found = hits ?? retrieve(question, 3);
  const sig = computeSignals(events, profile);
  const latest = latestByKey(events);
  const supported: UStatement[] = [];
  const possibilities: UStatement[] = [];
  const missing: UStatement[] = [];
  const alternatives: UStatement[] = [];
  const professional: UStatement[] = [];
  const why: string[] = [];

  if (!found.length) {
    why.push("SanoAI's reference library has no passage that matches this topic closely enough to ground an answer, so nothing can be stated with a documented basis.");
    professional.push(stm("A qualified clinician is the right person to discuss this question.", "ai-general"));
    why.push("SanoAI cannot examine you, take a history or order tests.");
    return { topic: question, question, supported, possibilities, missing, alternatives, professional, whyNotDefinitive: why, sources: [], generatedAt: new Date().toISOString() };
  }

  const primary = found[0].entry;
  const entries = found.slice(0, 2).map((f) => f.entry);

  // supported — from the user's own records
  for (const en of entries) {
    for (const n of en.needed) {
      if (!n.signal || !sig.has(n.signal)) continue;
      const refs = sig.refs(n.signal).slice(0, 2);
      supported.push(stm(`Your records include: ${n.label.toLowerCase()}.`, "records", [], refs.map((r) => r.eventId!).filter(Boolean)));
      if (n.signal.startsWith("lab:")) {
        const key = n.signal.slice(4);
        const p = latest.get(key);
        const name = BIOMARKER_BY_KEY.get(key)?.name ?? key;
        if (p && (p.value.flag === "low" || p.value.flag === "high")) {
          supported.push(
            stm(
              `Your most recent ${name} result (${p.value.valueText}${p.value.unit ? " " + p.value.unit : ""}, ${formatDate(p.date)}) is ${p.value.flag === "low" ? "below" : "above"} the range printed on the lab report${p.value.refText ? ` (${p.value.refText})` : ""}.`,
              "records",
              [],
              [p.event.id],
            ),
          );
        }
      }
    }
  }
  // supported — established reference facts
  for (const en of entries) en.facts.filter((f) => f.status === "established").slice(0, en === primary ? 3 : 1).forEach((f) => supported.push(stm(f.text, "reference", en.sourceIds)));

  // possibilities
  for (const en of entries) {
    en.causes.slice(0, 5).forEach((c) => possibilities.push(stm(`${c} — can be associated with this kind of finding; whether it applies to you cannot be determined from documents alone.`, "reference", en.sourceIds)));
    en.facts.filter((f) => f.status === "emerging").forEach((f) => possibilities.push(stm(`Still being studied / mixed evidence: ${f.text}`, "reference", en.sourceIds)));
  }

  // missing
  for (const en of entries) {
    for (const n of en.needed) {
      const present = n.signal ? sig.has(n.signal) : false;
      if (!present) missing.push(stm(n.signal ? `Not found in your records: ${n.label.toLowerCase()}.` : `Not recorded in your documents: ${n.label.toLowerCase()}.`, "records"));
    }
  }

  // alternatives
  for (const en of entries) en.alternatives.forEach((a) => alternatives.push(stm(a, "reference", en.sourceIds)));

  // professional
  for (const en of entries) {
    en.redFlags.forEach((r) => professional.push(stm(`Seek prompt medical attention: ${r}.`, "reference", en.sourceIds)));
    if (en === primary) professional.push(stm(en.whenToSeek, "reference", en.sourceIds));
  }
  professional.push(stm("Interpreting results, ruling causes in or out, and deciding on tests or treatment requires a clinician who can examine you and see your whole history.", "ai-general"));

  // why not definitive
  const missCount = uniq(missing.map((m) => m.text)).length;
  if (missCount) why.push(`${missCount} piece${missCount === 1 ? "" : "s"} of information that clinicians usually consider for this topic ${missCount === 1 ? "is" : "are"} not in your records.`);
  if (primary.causes.length > 1) why.push(`Several different explanations are associated with this topic (${primary.causes.slice(0, 3).join("; ").toLowerCase()}), and documents alone cannot tell them apart.`);
  if (entries.some((e) => e.facts.some((f) => f.status === "emerging"))) why.push("Part of the evidence in this area is still emerging or mixed.");
  if ([...latest.values()].some((p) => p.value.flag === "low" || p.value.flag === "high")) why.push("A laboratory value is a snapshot; trends, repeat tests and symptoms change its meaning.");
  why.push("SanoAI cannot examine you, take a full history, or order tests — so it cannot give a definitive answer.");

  const srcIds = uniq(entries.flatMap((e) => e.sourceIds));
  return {
    topic: primary.title,
    question,
    supported: dedupe(supported),
    possibilities: dedupe(possibilities),
    missing: dedupe(missing),
    alternatives: dedupe(alternatives),
    professional: dedupe(professional),
    whyNotDefinitive: why.slice(0, 5),
    sources: sourcesFor(srcIds),
    generatedAt: new Date().toISOString(),
  };
}

const dedupe = (a: UStatement[]) => a.filter((s, i) => a.findIndex((x) => x.text === s.text) === i);

/** Enforces the "defensible basis" rule on model output: unverifiable claims are downgraded, never trusted. */
function sanitise(list: UStatement[], validEventIds: Set<string>, validSourceIds: Set<string>): UStatement[] {
  return list.map((s) => {
    const eventIds = s.eventIds.filter((id) => validEventIds.has(id));
    const sourceIds = s.sourceIds.filter((id) => validSourceIds.has(id));
    let basis = s.basis;
    if (basis === "records" && !eventIds.length) basis = "ai-general";
    if (basis === "reference" && !sourceIds.length) basis = "ai-general";
    return { text: s.text, basis, eventIds, sourceIds };
  });
}

export async function assessUncertainty(userId: string, question: string, events: HealthEvent[], profile: HealthProfile | undefined, language: string): Promise<UncertaintyAssessment> {
  const hits = retrieve(question, 3);
  const base = assessUncertaintyRules(question, events, profile, hits);

  const validSourceIds = new Set(hits.flatMap((h) => h.entry.sourceIds));
  const validEventIds = new Set(events.map((e) => e.id));
  const recordFacts = events.slice(0, 120).map((e) => ({
    id: e.id,
    date: e.date,
    title: e.title,
    values: e.values.map((v) => `${v.name} ${v.valueText}${v.unit ? " " + v.unit : ""} (lab range ${v.refText ?? "not stated"}; ${v.flag})`),
  }));
  const passages = hits.map((h) => ({ topic: h.entry.title, sourceIds: h.entry.sourceIds, facts: h.entry.facts.map((f) => `[${f.status}] ${f.text}`), causes: h.entry.causes, redFlags: h.entry.redFlags }));

  const r = await runStructured({
    userId,
    module: "uncertainty-engine",
    schemaName: "uncertainty_assessment",
    schema: LlmUncertaintySchema as z.ZodType<z.infer<typeof LlmUncertaintySchema>>,
    system: [
      "You are the Medical Uncertainty engine of SanoAI. You do NOT answer medical questions confidently. You explain what is known, what is only possible, what is missing, what alternatives exist and what needs a professional.",
      "Sections: supported (backed by the user's records or the provided reference passages), possibilities (might apply; not established for this person), missing (information absent that a clinician would want), alternatives (other explanations), professional (what requires clinician evaluation incl. warning signs).",
      "Each statement needs a basis: 'records' (cite eventIds from provided records only), 'reference' (cite sourceIds from provided passages only) or 'ai-general' (no citation available). If you cannot cite, use 'ai-general'. NEVER invent percentages, probabilities or confidence scores.",
      "NEVER diagnose, never say a clinician erred, never advise starting/stopping/changing treatment. whyNotDefinitive: 2–4 plain reasons the AI cannot give a definitive answer.",
      `Write in ${language}, in plain language.`,
    ].join("\n"),
    user: JSON.stringify({ question, records: recordFacts, referencePassages: passages }),
  });
  if (!r.ok) return { ...base, meta: r.meta };

  const d = r.data;
  const toU = (arr: typeof d.supported) => sanitise(arr, validEventIds, validSourceIds);
  const professional = toU(d.professional);
  if (!professional.some((p) => /clinician|doctor|professional/i.test(p.text))) professional.push(stm("A clinician who can examine you must evaluate this.", "ai-general"));
  const srcIds = uniq([...toU(d.supported), ...toU(d.possibilities), ...toU(d.alternatives), ...professional].flatMap((s) => s.sourceIds));
  return {
    topic: base.topic,
    question,
    supported: toU(d.supported),
    possibilities: toU(d.possibilities),
    missing: toU(d.missing),
    alternatives: toU(d.alternatives),
    professional,
    whyNotDefinitive: d.whyNotDefinitive.length ? d.whyNotDefinitive : base.whyNotDefinitive,
    sources: srcIds.map((id) => SOURCE_BY_ID.get(id)!).filter(Boolean),
    generatedAt: new Date().toISOString(),
    meta: r.meta,
  };
}

export { demoMeta };
