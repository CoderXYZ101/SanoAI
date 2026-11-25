import { BIOMARKER_BY_KEY, BIOMARKERS, DEFICIENCY_PANEL } from "../knowledge/biomarkers";
import { sourcesFor } from "../knowledge/sources";
import type { BiomarkerResult, BiomarkerRow, DocumentDTO, HealthEvent } from "../types";
import { formatDate } from "./dates";
import { labPoints } from "./signals";

/**
 * Nutritional Biomarker Analysis Engine.
 * - Compares each value ONLY with the reference range printed on that lab report.
 * - Never diagnoses a deficiency and never recommends supplements or doses.
 */

export function analyseBiomarkers(events: HealthEvent[], docs: DocumentDTO[]): Omit<BiomarkerResult, "meta"> {
  const docTitle = new Map(docs.map((d) => [d.id, d.title]));
  const rows: BiomarkerRow[] = [];
  const panelKeys = new Set(DEFICIENCY_PANEL);
  const extras = new Set(["tibc", "transferrin_saturation", "mcv", "tsh", "free_t4", "hba1c", "fasting_glucose"]);

  for (const p of labPoints(events)) {
    if (!panelKeys.has(p.key) && !extras.has(p.key)) continue;
    const def = BIOMARKER_BY_KEY.get(p.key);
    if (!def) continue;
    const v = p.value;
    const limitations = [...def.limitations];
    if (v.flag === "unknown") limitations.unshift("No reference range was printed next to this result, so SanoAI does not label it high or low.");
    if (p.event.dateCertainty === "ambiguous") limitations.push("The report date is ambiguous, so the order relative to other results is uncertain.");
    if (!p.date) limitations.push("No report date was found.");
    const explanation =
      v.flag === "low"
        ? `${def.what} This result is below the reference range printed by the lab. That is a flag for discussion, not a diagnosis.`
        : v.flag === "high"
          ? `${def.what} This result is above the reference range printed by the lab. That is a flag for discussion, not a diagnosis.`
          : v.flag === "normal"
            ? `${def.what} This result is within the reference range printed by the lab. A value inside the range does not always rule out a problem.`
            : def.what;
    rows.push({
      key: p.key,
      name: def.name,
      eventId: p.event.id,
      docId: p.event.docId,
      docTitle: docTitle.get(p.event.docId) ?? "Document",
      date: p.date,
      dateCertainty: p.event.dateCertainty,
      valueText: v.valueText,
      value: v.value,
      unit: v.unit,
      refText: v.refText,
      refLow: v.refLow,
      refHigh: v.refHigh,
      flag: v.flag,
      labFlag: v.labFlag,
      explanation,
      possibleReasons: v.flag === "low" ? def.reasonsLow : v.flag === "high" ? def.reasonsHigh : [],
      limitations: [...new Set(limitations)],
      missingInfo: def.missing,
      doctorQuestions: def.questions,
      sourceIds: def.sourceIds,
    });
  }

  rows.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.name.localeCompare(b.name));
  const foundKeys = new Set(rows.map((r) => r.key));
  const notFound = DEFICIENCY_PANEL.filter((k) => !foundKeys.has(k)).map((k) => {
    const def = BIOMARKER_BY_KEY.get(k)!;
    return { key: k, name: def.name, why: "Not found in the uploaded reports. If it was tested, check the original document; it is not assumed to be normal." };
  });
  return {
    rows,
    notFound,
    sources: sourcesFor(rows.flatMap((r) => r.sourceIds)),
    generatedAt: new Date().toISOString(),
  };
}

export function runBiomarkers(userId: string, events: HealthEvent[], docs: DocumentDTO[]): BiomarkerResult {
  // Biomarker analysis is deliberately deterministic: explanations come from the curated, source-linked
  // library so no AI-generated medical claim can enter a lab-value explanation.
  const base = analyseBiomarkers(events, docs);
  void userId;
  return { ...base, meta: { mode: "rules", provider: "SanoAI biomarker engine (curated library + lab-printed ranges)", notice: "Explanations in this module come from a curated, cited library rather than free-form AI text, so they cannot invent medical facts." } };
}

export const SUPPORTED_BIOMARKERS = BIOMARKERS.filter((b) => b.panel).map((b) => b.name);
export { formatDate };
