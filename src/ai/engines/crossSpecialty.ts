import { z } from "zod";
import { BIOMARKER_BY_KEY } from "../knowledge/biomarkers";
import { RELATIONS } from "../knowledge/relations";
import { sourcesFor } from "../knowledge/sources";
import type { Connection, CrossSpecialtyResult, HealthEvent, Specialty } from "../types";
import { LlmSummarySchema, SPECIALTIES } from "../types";
import type { HealthProfile } from "@/lib/repo";
import { computeSignals, latestByKey } from "./signals";
import { demoMeta, runStructured } from "../structured";

/**
 * Cross-Specialty Analysis Engine.
 * Connects signals from different specialties using a curated relation catalogue and describes
 * them as ASSOCIATIONS to raise with clinicians — never as causes or diagnoses.
 */

const MED_SPECIALTY: Record<string, Specialty> = {
  metformin: "Endocrinology",
  insulin: "Endocrinology",
  levothyroxine: "Endocrinology",
  amlodipine: "Cardiology",
  losartan: "Cardiology",
  atorvastatin: "Cardiology",
  rosuvastatin: "Cardiology",
  omeprazole: "Gastroenterology",
  pantoprazole: "Gastroenterology",
  "ferrous sulfate": "Haematology",
  cholecalciferol: "Nutrition",
  cyanocobalamin: "Nutrition",
};

export function analyseCrossSpecialty(events: HealthEvent[], profile?: HealthProfile): Omit<CrossSpecialtyResult, "meta"> {
  const sig = computeSignals(events, profile);
  const connections: Connection[] = [];

  for (const rel of RELATIONS) {
    const matched = rel.groups
      .filter((g) => sig.hasAny(g.anyOf))
      .map((g) => ({ label: g.label, evidence: sig.refs(g.anyOf).slice(0, 3) }));
    const notFound = rel.groups.filter((g) => !sig.hasAny(g.anyOf)).map((g) => g.label);
    const partialAt = Math.max(1, rel.documentedAt - 1);
    if (matched.length < partialAt) continue;
    connections.push({
      id: rel.id,
      title: rel.title,
      specialties: rel.specialties,
      strength: matched.length >= rel.documentedAt ? "documented" : "partial",
      matched,
      notFound,
      why: rel.why,
      caution: rel.caution,
      questions: rel.questions,
      sourceIds: rel.sourceIds,
    });
  }
  connections.sort((a, b) => (a.strength === b.strength ? b.matched.length - a.matched.length : a.strength === "documented" ? -1 : 1));

  // what each specialty contributes
  const bySpecialty = new Map<Specialty, Set<string>>();
  const put = (sp: Specialty, item: string) => {
    if (sp === "Other") return;
    (bySpecialty.get(sp) ?? bySpecialty.set(sp, new Set()).get(sp)!).add(item);
  };
  for (const [key, p] of latestByKey(events)) {
    if (p.value.flag === "low" || p.value.flag === "high") {
      const def = BIOMARKER_BY_KEY.get(key);
      put(def?.specialty ?? "General Medicine", `${p.value.flag === "low" ? "Low" : "Raised"} ${p.value.name}`);
    }
  }
  for (const e of events) {
    if (e.category === "medication" && e.medication && e.medication.status !== "stopped") put(MED_SPECIALTY[e.medication.generic ?? ""] ?? e.specialty, `Medicine: ${e.medication.generic}`);
    else if (e.category === "symptom") put(e.specialty, e.title);
    else if (e.category === "diagnosis" && !/\(as recorded\)$/i.test(e.title)) put(e.specialty, e.title);
    else if (e.category === "visit") put(e.specialty, `Visit: ${e.title}`);
    else if ((e.category === "procedure" || e.category === "imaging") && !/^Advised/.test(e.title)) put(e.specialty, e.title);
  }
  const specialtiesInvolved = SPECIALTIES.filter((s) => bySpecialty.has(s)).map((specialty) => ({ specialty, items: [...bySpecialty.get(specialty)!].slice(0, 7) }));

  // edges between specialties
  const edgeMap = new Map<string, { a: Specialty; b: Specialty; count: number }>();
  for (const c of connections) {
    for (let i = 0; i < c.specialties.length; i++)
      for (let j = i + 1; j < c.specialties.length; j++) {
        const [a, b] = [c.specialties[i], c.specialties[j]].sort() as [Specialty, Specialty];
        const k = `${a}|${b}`;
        const cur = edgeMap.get(k) ?? { a, b, count: 0 };
        cur.count += 1;
        edgeMap.set(k, cur);
      }
  }

  const documented = connections.filter((c) => c.strength === "documented");
  const spNames = specialtiesInvolved.map((s) => s.specialty);
  const integratedSummary = connections.length
    ? `Your records touch ${spNames.length} area${spNames.length === 1 ? "" : "s"} of medicine (${spNames.join(", ")}). SanoAI found ${connections.length} possible connection${connections.length === 1 ? "" : "s"} between them; ${documented.length} ${documented.length === 1 ? "is" : "are"} supported by items from at least two areas of your own records. ${documented
        .slice(0, 3)
        .map((c) => `${c.title}: ${c.matched.map((m) => m.label.toLowerCase()).join(" + ")}.`)
        .join(" ")} These describe associations that are worth raising with your clinicians — they do not show that one finding causes another, and they are not diagnoses.`
    : "No cross-specialty connections were identified from the information provided. Add more records, or load the demonstration records, to see how SanoAI links information across specialties.";

  const questions = [...new Set(connections.flatMap((c) => c.questions))];
  if (spNames.length >= 2) questions.push("Which clinician is coordinating my overall care, and do they have all of my results?");

  const consultPrep = specialtiesInvolved.map(({ specialty, items }) => {
    const rel = connections.filter((c) => c.specialties.includes(specialty));
    return {
      specialty,
      bring: [
        ...items.slice(0, 4),
        ...rel.flatMap((c) => c.matched.filter((m) => m.evidence.length).map((m) => `Results from other areas: ${m.label.toLowerCase()}`)).slice(0, 3),
      ].filter((v, i, a) => a.indexOf(v) === i),
      ask: [...new Set(rel.flatMap((c) => c.questions))].slice(0, 3),
    };
  });

  return {
    specialtiesInvolved,
    connections,
    edges: [...edgeMap.values()],
    integratedSummary,
    coordinationQuestions: questions.slice(0, 10),
    consultPrep,
    sources: sourcesFor(connections.flatMap((c) => c.sourceIds)),
    generatedAt: new Date().toISOString(),
  };
}

export async function runCrossSpecialty(userId: string, events: HealthEvent[], profile: HealthProfile | undefined, language: string): Promise<CrossSpecialtyResult> {
  const base = analyseCrossSpecialty(events, profile);
  if (!base.connections.length) return { ...base, meta: (await demoMeta(userId)) };
  const r = await runStructured({
    userId,
    module: "cross-specialty",
    schemaName: "integrated_summary",
    schema: LlmSummarySchema as z.ZodType<z.infer<typeof LlmSummarySchema>>,
    system: [
      "You are the Cross-Specialty engine of SanoAI. Write a short integrated summary for a patient preparing for consultations.",
      "Use ONLY the connections and specialty items provided. Describe associations, never causation. Do NOT diagnose or recommend treatment changes. Mention that clinicians should confirm. Under 180 words. Plain language.",
      `Write in ${language}.`,
    ].join("\n"),
    user: JSON.stringify({ specialties: base.specialtiesInvolved, connections: base.connections.map((c) => ({ title: c.title, specialties: c.specialties, strength: c.strength, matched: c.matched.map((m) => m.label), notFound: c.notFound, why: c.why })) }),
  });
  if (!r.ok) return { ...base, meta: r.meta };
  return { ...base, integratedSummary: r.data.summary, meta: r.meta };
}
