import { z } from "zod";
import type { AiMeta, DateCertainty, DocumentDTO, HealthEvent } from "../types";
import { LlmSummarySchema } from "../types";
import { formatDate, sortKey } from "./dates";
import { labPoints } from "./signals";
import { runStructured, demoMeta } from "../structured";

/** Timeline Reconstruction Engine — pure, deterministic assembly of structured events (no invented data). */

export interface SeriesPoint {
  date: string | null;
  dateCertainty: DateCertainty;
  value: number;
  valueText: string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: "low" | "high" | "normal" | "unknown";
  eventId: string;
  docId: string;
}
export interface Change {
  id: string;
  kind: "lab" | "medication";
  title: string;
  detail: string;
  fromDate: string | null;
  toDate: string | null;
  eventIds: string[];
}
export interface Gap {
  id: string;
  kind: "missing-date" | "uncertain-date" | "no-range" | "low-confidence" | "no-events" | "needs-text";
  title: string;
  detail: string;
  eventId?: string;
  docId?: string;
}
export interface MedHistory {
  generic: string;
  name: string;
  entries: { date: string | null; dose: string | null; frequency: string | null; status: string; eventId: string; docId: string }[];
}
export interface TimelineResult {
  events: HealthEvent[];
  series: Record<string, { name: string; points: SeriesPoint[] }>;
  changes: Change[];
  gaps: Gap[];
  medications: MedHistory[];
  summary: string;
  stats: { documents: number; events: number; labValues: number; outOfRange: number; medications: number; symptoms: number; undated: number; first: string | null; last: string | null };
}

export function sortEvents(events: HealthEvent[]): HealthEvent[] {
  return [...events].sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)) || a.category.localeCompare(b.category));
}

const dir = (a: number, b: number) => (b > a ? "up" : b < a ? "down" : "unchanged");
const flagWord = (f: string) => (f === "low" ? "below" : f === "high" ? "above" : f === "normal" ? "within" : "without a stated range for");

export function buildTimeline(events: HealthEvent[], docs: DocumentDTO[]): TimelineResult {
  const sorted = sortEvents(events);
  const series: TimelineResult["series"] = {};
  for (const p of labPoints(sorted)) {
    if (p.value.value == null) continue;
    const s = (series[p.key] ??= { name: p.value.name, points: [] });
    s.points.push({
      date: p.date,
      dateCertainty: p.event.dateCertainty,
      value: p.value.value,
      valueText: p.value.valueText,
      unit: p.value.unit,
      refLow: p.value.refLow,
      refHigh: p.value.refHigh,
      refText: p.value.refText,
      flag: p.value.flag,
      eventId: p.event.id,
      docId: p.event.docId,
    });
  }

  const changes: Change[] = [];
  for (const [key, s] of Object.entries(series)) {
    const dated = s.points.filter((p) => p.date);
    for (let i = 1; i < dated.length; i++) {
      const a = dated[i - 1];
      const b = dated[i];
      const unit = b.unit ?? a.unit ?? "";
      const d = dir(a.value, b.value);
      const refChanged = a.refText !== b.refText && a.refText && b.refText;
      const detail =
        `${s.name}: ${a.valueText} → ${b.valueText} ${unit}`.trim() +
        ` (${d === "unchanged" ? "no change" : d === "up" ? "increase" : "decrease"}). ` +
        `Latest value is ${flagWord(b.flag)} the lab's stated range${b.refText ? ` (${b.refText})` : ""}.` +
        (refChanged ? " The reference range printed on the two reports differs." : "");
      changes.push({ id: `chg-${key}-${i}`, kind: "lab", title: `${s.name} ${d === "unchanged" ? "unchanged" : d === "up" ? "rose" : "fell"} between reports`, detail, fromDate: a.date, toDate: b.date, eventIds: [a.eventId, b.eventId] });
    }
  }

  // medication history
  const medMap = new Map<string, MedHistory>();
  for (const e of sorted) {
    if (e.category !== "medication" || !e.medication?.generic) continue;
    const g = e.medication.generic;
    const h = medMap.get(g) ?? { generic: g, name: g.charAt(0).toUpperCase() + g.slice(1), entries: [] };
    h.entries.push({ date: e.date, dose: e.medication.dose, frequency: e.medication.frequency, status: e.medication.status, eventId: e.id, docId: e.docId });
    medMap.set(g, h);
  }
  const medications = [...medMap.values()];
  for (const m of medications) {
    for (let i = 1; i < m.entries.length; i++) {
      const a = m.entries[i - 1];
      const b = m.entries[i];
      if (a.dose !== b.dose || a.status !== b.status || a.frequency !== b.frequency) {
        changes.push({
          id: `chg-med-${m.generic}-${i}`,
          kind: "medication",
          title: `${m.name} recorded differently`,
          detail: `${m.name}: ${[a.dose, a.frequency, a.status].filter(Boolean).join(", ")} → ${[b.dose, b.frequency, b.status].filter(Boolean).join(", ")}.`,
          fromDate: a.date,
          toDate: b.date,
          eventIds: [a.eventId, b.eventId],
        });
      }
    }
  }

  // gaps / unclear
  const gaps: Gap[] = [];
  for (const e of sorted) {
    if (!e.date) gaps.push({ id: `gap-nodate-${e.id}`, kind: "missing-date", title: `No date found: ${e.title}`, detail: "SanoAI did not assign a date because none was printed. You can add one if you know it.", eventId: e.id, docId: e.docId });
    else if (e.dateCertainty === "ambiguous") gaps.push({ id: `gap-amb-${e.id}`, kind: "uncertain-date", title: `Ambiguous date: ${e.title}`, detail: `The date is written in a way that could be read as day/month or month/day. It is shown as ${formatDate(e.date)} (day first) — please confirm.`, eventId: e.id, docId: e.docId });
    else if (e.dateCertainty === "partial") gaps.push({ id: `gap-part-${e.id}`, kind: "uncertain-date", title: `Only month/year known: ${e.title}`, detail: "The document gives a month and year but no day.", eventId: e.id, docId: e.docId });
    else if (e.dateCertainty === "unlabeled") gaps.push({ id: `gap-unl-${e.id}`, kind: "uncertain-date", title: `Unlabelled date used: ${e.title}`, detail: "A date appears near the top of the document but is not labelled as a report, visit or collection date.", eventId: e.id, docId: e.docId });
    if (e.confidence === "low") gaps.push({ id: `gap-low-${e.id}`, kind: "low-confidence", title: `Low-confidence extraction: ${e.title}`, detail: "Please verify this item against the original document.", eventId: e.id, docId: e.docId });
    if (e.category === "lab") {
      const noRange = e.values.filter((v) => v.flag === "unknown");
      if (noRange.length) gaps.push({ id: `gap-range-${e.id}`, kind: "no-range", title: `${noRange.length} result${noRange.length === 1 ? "" : "s"} without a lab reference range`, detail: `${noRange.map((v) => v.name).join(", ")} — SanoAI will not judge these as high or low without the lab's range.`, eventId: e.id, docId: e.docId });
    }
  }
  const dedupGaps = gaps.filter((g, i) => gaps.findIndex((x) => x.id === g.id) === i);
  for (const d of docs) {
    if (d.status === "needs_text") dedupGaps.push({ id: `gap-text-${d.id}`, kind: "needs-text", title: `Text not yet extracted: ${d.title}`, detail: d.statusDetail ?? "Paste the text of this document to include it.", docId: d.id });
    else if (d.status === "processed" && !sorted.some((e) => e.docId === d.id)) dedupGaps.push({ id: `gap-none-${d.id}`, kind: "no-events", title: `No structured events found: ${d.title}`, detail: "The document was read but no recognisable dates, results, medicines or symptoms were found.", docId: d.id });
  }

  const labCount = sorted.filter((e) => e.category === "lab").reduce((n, e) => n + e.values.length, 0);
  const outOfRange = sorted.filter((e) => e.category === "lab").reduce((n, e) => n + e.values.filter((v) => v.flag === "low" || v.flag === "high").length, 0);
  const dated = sorted.filter((e) => e.date);
  const stats = {
    documents: new Set(sorted.map((e) => e.docId)).size,
    events: sorted.length,
    labValues: labCount,
    outOfRange,
    medications: medications.length,
    symptoms: sorted.filter((e) => e.category === "symptom").length,
    undated: sorted.length - dated.length,
    first: dated[0]?.date ?? null,
    last: dated[dated.length - 1]?.date ?? null,
  };

  return { events: sorted, series, changes, gaps: dedupGaps, medications, summary: deterministicSummary(sorted, series, medications, stats), stats };
}

function deterministicSummary(events: HealthEvent[], series: TimelineResult["series"], meds: MedHistory[], st: TimelineResult["stats"]): string {
  if (!events.length) return "No structured events have been extracted yet. Upload a record or load the demonstration records to build a timeline.";
  const parts: string[] = [];
  parts.push(
    `Across ${st.documents} document${st.documents === 1 ? "" : "s"}${st.first ? ` (${formatDate(st.first)}${st.last && st.last !== st.first ? ` to ${formatDate(st.last)}` : ""})` : ""}, SanoAI extracted ${st.events} events: ${st.labValues} laboratory measurements (${st.outOfRange} outside the range printed by the lab), ${st.medications} medicine${st.medications === 1 ? "" : "s"} and ${st.symptoms} recorded symptom${st.symptoms === 1 ? "" : "s"}.`,
  );
  const repeated = Object.values(series).filter((s) => s.points.length >= 2 && s.points.some((p) => p.flag === "low" || p.flag === "high"));
  if (repeated.length) {
    const bits = repeated.map((s) => {
      const first = s.points[0];
      const last = s.points[s.points.length - 1];
      return `${s.name} ${first.valueText}→${last.valueText}${last.unit ? " " + last.unit : ""}`;
    });
    parts.push(`Values measured more than once and outside the lab's stated range at least once: ${bits.join("; ")}.`);
  }
  if (meds.length) parts.push(`Medicines mentioned: ${meds.map((m) => m.name).join(", ")}.`);
  if (st.undated) parts.push(`${st.undated} event${st.undated === 1 ? " has" : "s have"} no date and ${st.undated === 1 ? "is" : "are"} listed separately rather than placed on the timeline.`);
  parts.push("This summary only restates what the documents contain. It is not a diagnosis, and extracted details should be checked against the originals.");
  return parts.join(" ");
}

// ───────────────────────── optional AI narrative ─────────────────────────

export async function aiTimelineSummary(userId: string, tl: TimelineResult, level: "plain" | "detailed", language: string): Promise<{ summary: string; meta: AiMeta }> {
  const compact = tl.events.slice(0, 120).map((e) => ({
    date: e.date,
    dateCertainty: e.dateCertainty,
    category: e.category,
    title: e.title,
    values: e.values.map((v) => `${v.name} ${v.valueText}${v.unit ? " " + v.unit : ""} (lab range ${v.refText ?? "not stated"}; ${v.flag})`),
  }));
  const r = await runStructured({
    userId,
    module: "timeline-summary",
    schemaName: "timeline_summary",
    schema: LlmSummarySchema as z.ZodType<z.infer<typeof LlmSummarySchema>>,
    system: [
      "You are the Timeline Summary engine of SanoAI, a health-information app.",
      "Write an understandable summary of the patient's medical history using ONLY the structured events provided. Do not add facts, dates, diagnoses or causes that are not in the events.",
      "Never diagnose, never say a clinician missed something, never advise changing treatment. Where dates are missing or ambiguous, say so.",
      `Reading level: ${level === "plain" ? "plain language, short sentences" : "more detailed, with medical terms explained"}. Write in ${language}.`,
      "Keep it under 220 words.",
    ].join("\n"),
    user: JSON.stringify({ events: compact, changes: tl.changes.map((c) => c.detail).slice(0, 20) }),
  });
  if (!r.ok) return { summary: tl.summary, meta: r.meta };
  return { summary: r.data.summary, meta: r.meta };
}

export { demoMeta };
