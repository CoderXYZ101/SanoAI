import type { BlindSpotResult, CrossSpecialtyResult, DocumentDTO, HealthEvent } from "../types";
import type { HealthProfile } from "@/lib/repo";
import { detectBlindSpots } from "./blindspots";
import { analyseCrossSpecialty } from "./crossSpecialty";
import { formatDate } from "./dates";
import { latestByKey } from "./signals";
import { buildTimeline } from "./timeline";

/**
 * Doctor Brief — a one-page, printable, source-traceable consultation summary assembled from the
 * user's own records. Deterministic (no AI), so it can be shared with consent without anything
 * fabricated. Everything lists where it came from.
 */
export interface DoctorBrief {
  generatedAt: string;
  patient: { ageRange: string; sex: string };
  allergies: string[];
  medicines: { name: string; detail: string; source: string }[];
  recordedConditions: string[];
  recentResults: { name: string; value: string; range: string; flag: string; date: string }[];
  symptoms: string[];
  openQuestions: { title: string; why: string }[];
  coordination: string[];
  conflicts: string[];
  documents: { title: string; date: string }[];
  timelineSummary: string;
  disclaimer: string;
}

export function buildDoctorBrief(events: HealthEvent[], docs: DocumentDTO[], profile: HealthProfile, blind?: Omit<BlindSpotResult, "meta">, cross?: Omit<CrossSpecialtyResult, "meta">): DoctorBrief {
  const tl = buildTimeline(events, docs);
  const bs = blind ?? detectBlindSpots(events, profile);
  const cs = cross ?? analyseCrossSpecialty(events, profile);
  const docTitle = new Map(docs.map((d) => [d.id, d.title]));
  const latest = latestByKey(events);

  const allergies = [
    ...new Set([
      ...profile.allergies,
      ...events.filter((e) => e.category === "allergy" && !/no known/i.test(e.title)).map((e) => e.title.replace(/^Allergy:\s*/i, "")),
    ]),
  ];
  const medicines = tl.medications
    .map((m) => {
      const last = m.entries[m.entries.length - 1];
      return { name: m.name, detail: [last.dose, last.frequency, last.status === "stopped" ? "stopped" : ""].filter(Boolean).join(", ") || "dose not recorded", source: docTitle.get(last.docId) ?? "record" };
    })
    .concat(profile.medications.map((m) => ({ name: m, detail: "self-reported", source: "health profile" })));
  const recordedConditions = [...new Set(events.filter((e) => e.category === "diagnosis" && !/\(as recorded\)$/i.test(e.title)).map((e) => e.title))];
  const recentResults = [...latest.values()]
    .sort((a, b) => a.value.name.localeCompare(b.value.name))
    .map((p) => ({ name: p.value.name, value: `${p.value.valueText}${p.value.unit ? " " + p.value.unit : ""}`, range: p.value.refText ?? "not stated", flag: p.value.flag === "unknown" ? "no range printed" : p.value.flag, date: formatDate(p.date) }));
  return {
    generatedAt: new Date().toISOString(),
    patient: { ageRange: profile.ageRange, sex: profile.sex },
    allergies,
    medicines,
    recordedConditions,
    recentResults,
    symptoms: [...new Set(events.filter((e) => e.category === "symptom").map((e) => e.title))],
    openQuestions: bs.questions.map((q) => ({ title: q.title, why: q.why })),
    coordination: cs.coordinationQuestions,
    conflicts: bs.unclear.filter((f) => f.kind === "conflict").map((f) => f.title),
    documents: docs.filter((d) => d.status === "processed").map((d) => ({ title: d.title, date: formatDate(d.createdAt.slice(0, 10)) })),
    timelineSummary: tl.summary,
    disclaimer: "Prepared by SanoAI from the patient's own documents to support a conversation with a clinician. It is not a clinical document, may contain extraction errors, and does not contain a diagnosis. Please verify against the original records.",
  };
}

export function briefToText(b: DoctorBrief): string {
  const L: string[] = ["SANOAI DOCTOR BRIEF", `Prepared ${new Date(b.generatedAt).toLocaleDateString("en-IN")}`, ""];
  if (b.patient.ageRange || b.patient.sex) L.push(`Patient: ${[b.patient.ageRange, b.patient.sex].filter(Boolean).join(", ")}`, "");
  L.push(`Allergies: ${b.allergies.join(", ") || "none recorded"}`);
  L.push("", "MEDICINES (as recorded)", ...(b.medicines.length ? b.medicines.map((m) => `- ${m.name}: ${m.detail} [${m.source}]`) : ["- none recorded"]));
  L.push("", "CONDITIONS WRITTEN IN RECORDS", ...(b.recordedConditions.length ? b.recordedConditions.map((c) => `- ${c}`) : ["- none"]));
  L.push("", "MOST RECENT RESULTS", ...b.recentResults.map((r) => `- ${r.name}: ${r.value} (lab range ${r.range}; ${r.flag}) — ${r.date}`));
  L.push("", "SYMPTOMS NOTED", ...(b.symptoms.length ? b.symptoms.map((s) => `- ${s}`) : ["- none"]));
  if (b.conflicts.length) L.push("", "RECORDS TO RECONCILE", ...b.conflicts.map((c) => `- ${c}`));
  L.push("", "QUESTIONS I WOULD LIKE TO DISCUSS", ...b.openQuestions.map((q, i) => `${i + 1}. ${q.title}`));
  L.push("", b.disclaimer);
  return L.join("\n");
}
