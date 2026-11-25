import { z } from "zod";
import type { AiMeta, BlindSpotResult, EvidenceRef, Finding, HealthEvent } from "../types";
import { LlmBlindSpotSchema } from "../types";
import type { HealthProfile } from "@/lib/repo";
import { formatDate } from "./dates";
import { DIAGNOSES } from "./rules";
import { computeSignals, labPoints, latestByKey } from "./signals";
import { buildTimeline } from "./timeline";
import { demoMeta, runStructured } from "../structured";

/**
 * Diagnostic Blind-Spot Detector.
 * Language contract: it only describes what the PROVIDED RECORDS do or do not contain and which
 * questions may be worth raising. It never says a diagnosis was missed or that a clinician erred.
 */

const NOTE = "Based only on the documents you provided — a clinician may hold information that is not in these records.";

const ev = (e: HealthEvent, quote?: string): EvidenceRef => ({ eventId: e.id, docId: e.docId, quote: quote ?? e.sourceQuote });
const fmt = (e: HealthEvent) => formatDate(e.date);

export function detectBlindSpots(events: HealthEvent[], profile?: HealthProfile): Omit<BlindSpotResult, "meta"> {
  const sig = computeSignals(events, profile);
  const latest = latestByKey(events);
  const pts = labPoints(events);
  const confirmed: Finding[] = [];
  const unclear: Finding[] = [];
  const questions: Finding[] = [];

  const add = (list: Finding[], f: Omit<Finding, "source">) => list.push({ ...f, source: "rules" });

  // ───────────── 1. CONFIRMED in records ─────────────
  for (const e of events.filter((x) => x.category === "lab")) {
    const abn = e.values.filter((v) => v.flag === "low" || v.flag === "high");
    add(confirmed, {
      id: `ok-lab-${e.id}`,
      kind: "confirmed",
      title: `Laboratory results recorded — ${fmt(e)}`,
      detail: `${e.values.length} measurements; ${abn.length} outside the lab's own stated range${abn.length ? `: ${abn.map((v) => `${v.name} ${v.valueText}${v.unit ? " " + v.unit : ""} (${v.flag})`).join(", ")}` : ""}.`,
      why: "These values are printed in the report itself; high/low is judged only against the range printed by the laboratory.",
      evidence: [ev(e)],
    });
  }
  for (const e of events.filter((x) => x.category === "diagnosis" && !/\(as recorded\)$/i.test(x.title))) {
    add(confirmed, { id: `ok-dx-${e.id}`, kind: "confirmed", title: `Diagnosis / impression written in the records: ${e.title}`, detail: `Recorded ${fmt(e)}.`, why: "A clinician-written statement appears in your documents.", evidence: [ev(e)] });
  }
  for (const e of events.filter((x) => x.category === "medication" && x.medication && x.medication.status !== "stopped")) {
    add(confirmed, { id: `ok-med-${e.id}`, kind: "confirmed", title: `Medicine listed: ${e.title}`, detail: `Appears in the records dated ${fmt(e)}.`, why: "A medicine entry appears in your documents.", evidence: [ev(e)] });
  }
  for (const e of events.filter((x) => x.category === "allergy" && !/no known/i.test(x.title))) {
    add(confirmed, { id: `ok-al-${e.id}`, kind: "confirmed", title: e.title, detail: `Recorded ${fmt(e)}.`, why: "Allergy information appears in your documents.", evidence: [ev(e)] });
  }
  for (const e of events.filter((x) => x.category === "procedure" || x.category === "imaging")) {
    add(confirmed, { id: `ok-pr-${e.id}`, kind: "confirmed", title: `${e.title} recorded`, detail: `Recorded ${fmt(e)}: “${e.sourceQuote}”`, why: "A test or procedure is documented as performed.", evidence: [ev(e)] });
  }
  for (const e of events.filter((x) => x.category === "symptom")) {
    add(confirmed, { id: `ok-sx-${e.id}`, kind: "confirmed", title: `Symptom noted in records: ${e.title}`, detail: `Documented ${fmt(e)}.`, why: "The symptom is written in the document.", evidence: [ev(e)] });
  }

  // ───────────── 2. UNCLEAR / MISSING / CONFLICTING ─────────────
  // 2a conflicts
  const noKnown = events.filter((e) => e.category === "diagnosis" && /\(as recorded\)$/i.test(e.title) && /^no known|^nil|^no /i.test(e.title));
  for (const n of noKnown) {
    const def = DIAGNOSES.find((d) => d.re.test(n.title));
    if (!def) continue;
    const present = sig.refs(`dx:${def.key}`).filter((r) => r.eventId !== n.id);
    if (present.length) {
      add(unclear, {
        id: `conflict-dx-${def.key}`,
        kind: "conflict",
        title: `Records differ about ${def.label.toLowerCase()}`,
        detail: `One document states “${n.sourceQuote}”, while another document records ${def.label.toLowerCase()}. ${NOTE}`,
        why: "When records disagree, clinicians usually reconcile them so that everyone works from the same information. A discrepancy can have an ordinary explanation (for example a template that was not updated).",
        evidence: [ev(n), ...present.slice(0, 2)],
      });
    }
  }
  const noMeds = events.filter((e) => e.category === "medication" && !e.medication && /no regular medication/i.test(e.title));
  const activeMeds = events.filter((e) => e.category === "medication" && e.medication && e.medication.status !== "stopped");
  if (noMeds.length && activeMeds.length) {
    add(unclear, {
      id: "conflict-meds",
      kind: "conflict",
      title: "Records differ about regular medicines",
      detail: `A document states “${noMeds[0].sourceQuote}”, but medicines are listed in the records (${[...new Set(activeMeds.map((m) => m.medication!.generic))].join(", ")}). ${NOTE}`,
      why: "An accurate current medicine list helps every clinician and pharmacist avoid duplicate, missing or interacting treatments.",
      evidence: [ev(noMeds[0]), ...activeMeds.slice(0, 3).map((m) => ev(m))],
    });
  }
  if (sig.has("allergy:penicillin") && sig.has("med:penicillin")) {
    add(unclear, {
      id: "conflict-allergy-penicillin",
      kind: "conflict",
      title: "A recorded penicillin allergy and a penicillin-type antibiotic both appear",
      detail: `The records list a penicillin allergy and also list amoxicillin, which belongs to the penicillin family. ${NOTE}`,
      why: "Allergy records and prescriptions are normally cross-checked. There can be good reasons (for example the allergy label was reviewed), but it is worth confirming with the prescriber or pharmacist — do not change any medicine on your own.",
      evidence: [...sig.refs("allergy:penicillin").slice(0, 1), ...sig.refs("med:penicillin").slice(0, 1)],
    });
  }
  const nkda = events.find((e) => e.category === "allergy" && /no known/i.test(e.title));
  if (nkda && sig.has("allergy:any")) {
    add(unclear, {
      id: "conflict-allergy-nkda",
      kind: "conflict",
      title: "Records differ about drug allergies",
      detail: `One document states “${nkda.sourceQuote}” while another lists an allergy. ${NOTE}`,
      why: "Allergy information is safety-critical, so consistent records matter.",
      evidence: [ev(nkda), ...sig.refs("allergy:any").slice(0, 1)],
    });
  }
  // duplicate lab values on the same date that disagree
  const seen = new Map<string, (typeof pts)[number]>();
  for (const p of pts) {
    const k = `${p.key}|${p.date}`;
    const o = seen.get(k);
    if (o && p.date && o.value.value !== p.value.value && o.event.id !== p.event.id) {
      add(unclear, {
        id: `conflict-lab-${k}`,
        kind: "conflict",
        title: `${p.value.name}: two different values for ${formatDate(p.date)}`,
        detail: `${o.value.valueText} and ${p.value.valueText} are both recorded for the same date.`,
        why: "Conflicting results for the same date could be a transcription issue or a repeat sample.",
        evidence: [ev(o.event, o.value.quote), ev(p.event, p.value.quote)],
      });
    } else seen.set(k, p);
  }

  // 2b dates
  const ambiguous = events.filter((e) => e.dateCertainty === "ambiguous");
  if (ambiguous.length) {
    add(unclear, {
      id: "unclear-dates-ambiguous",
      kind: "unclear",
      title: `${ambiguous.length} item${ambiguous.length === 1 ? "" : "s"} with an ambiguous date`,
      detail: `For example “${ambiguous[0].sourceQuote}”. Numeric dates such as 02/11/2024 can mean 2 November or 11 February; SanoAI displays them day-first and marks them uncertain.`,
      why: "The order of events matters when comparing results and treatments. Please confirm these dates against the original document.",
      evidence: ambiguous.slice(0, 3).map((e) => ev(e)),
    });
  }
  const undated = events.filter((e) => !e.date);
  if (undated.length) {
    add(unclear, { id: "unclear-dates-missing", kind: "missing", title: `${undated.length} item${undated.length === 1 ? "" : "s"} without any date`, detail: "No date is printed for these items, so SanoAI has not placed them on the timeline.", why: "Without dates, it is hard to tell whether information is current.", evidence: undated.slice(0, 3).map((e) => ev(e)) });
  }

  // 2c reference ranges
  const noRange = pts.filter((p) => p.value.flag === "unknown");
  if (noRange.length) {
    add(unclear, { id: "unclear-no-range", kind: "missing", title: `${noRange.length} result${noRange.length === 1 ? "" : "s"} without a printed reference range`, detail: `${[...new Set(noRange.map((p) => p.value.name))].join(", ")}. SanoAI does not judge these as high or low.`, why: "Reference ranges differ between laboratories, so a number alone is hard to interpret.", evidence: noRange.slice(0, 3).map((p) => ev(p.event, p.value.quote)) });
  }

  // 2d persistently outside range
  const persistent = [...new Set(pts.map((p) => p.key))]
    .map((k) => pts.filter((p) => p.key === k && p.date))
    .filter((arr) => arr.length >= 2 && arr.filter((p) => p.value.flag === "low" || p.value.flag === "high").length >= 2);
  if (persistent.length) {
    add(unclear, {
      id: "unclear-persistent",
      kind: "unclear",
      title: `Results outside the lab's range in more than one report: ${persistent.map((a) => a[0].value.name).join(", ")}`,
      detail: persistent.map((a) => `${a[0].value.name}: ${a.map((p) => p.value.valueText).join(" → ")} ${a[a.length - 1].value.unit ?? ""}`.trim()).join("; ") + `. ${NOTE}`,
      why: "A result that stays outside the range over time is usually followed up to understand why. The records provided do not describe how these were addressed.",
      evidence: persistent.flatMap((a) => a.filter((p) => p.value.flag !== "normal").slice(-1).map((p) => ev(p.event, p.value.quote))).slice(0, 4),
    });
  }

  // 2e missing companion information
  const hb = latest.get("hemoglobin");
  if (hb?.value.flag === "low" && !latest.has("ferritin") && !latest.has("iron") && !latest.has("transferrin_saturation")) {
    add(unclear, { id: "missing-iron", kind: "missing", title: "Iron studies not found alongside low haemoglobin", detail: `Haemoglobin is below the lab's range (${hb.value.valueText} ${hb.value.unit ?? ""}) but no ferritin or iron results appear in the provided records.`, why: "Ferritin and iron studies help clinicians work out whether low haemoglobin relates to iron.", evidence: [ev(hb.event, hb.value.quote)] });
  }
  const tsh = latest.get("tsh");
  if (tsh?.value.flag === "high" && !latest.has("free_t4")) {
    add(unclear, { id: "missing-ft4", kind: "missing", title: "No free T4 result found with the raised TSH", detail: `TSH is above the lab's range (${tsh.value.valueText} ${tsh.value.unit ?? ""}). No free T4 result appears in the records.`, why: "TSH is usually interpreted together with free T4 to understand thyroid function.", evidence: [ev(tsh.event, tsh.value.quote)] });
  }
  const b12 = latest.get("vitamin_b12");
  if (b12?.value.flag === "low") {
    add(unclear, { id: "missing-b12-followup", kind: "missing", title: "No record of how the low vitamin B12 was followed up", detail: `Vitamin B12 is below the lab's range (${b12.value.valueText} ${b12.value.unit ?? ""}). The records do not show whether a cause was looked into or what the plan is.`, why: "Clinicians often consider diet, absorption and medicines when B12 is low.", evidence: [ev(b12.event, b12.value.quote)] });
  }
  const diabetesSignal = sig.hasAny(["dx:diabetes", "lab:high_hba1c", "lab:high_fasting_glucose"]);
  if (diabetesSignal && !latest.has("creatinine") && !latest.has("egfr")) {
    add(unclear, { id: "missing-kidney", kind: "missing", title: "No kidney function result found", detail: "Raised blood sugar or diabetes is recorded, but no creatinine or eGFR appears in the records.", why: "Kidney function is routinely checked in diabetes and high blood pressure.", evidence: sig.refs(["dx:diabetes", "lab:high_hba1c"]).slice(0, 2) });
  } else if (diabetesSignal && sig.hasAny(["dx:hypertension", "vital:high_bp", "med:antihypertensive"])) {
    add(unclear, { id: "missing-urine-albumin", kind: "missing", title: "No urine albumin (kidney screening) result found", detail: "Diabetes and raised blood pressure are both recorded. Creatinine is present, but no urine albumin result was found in the records.", why: "Urine albumin is a standard early kidney screening test in this situation; its absence from your documents does not mean it was not done.", evidence: sig.refs(["dx:diabetes", "dx:hypertension", "vital:high_bp"]).slice(0, 2) });
  }
  const bps = events.filter((e) => /^Blood pressure reading/i.test(e.title));
  if (bps.length === 1 && sig.hasAny(["vital:high_bp", "dx:hypertension"])) {
    add(unclear, { id: "missing-bp-repeat", kind: "missing", title: "Only one blood pressure reading found", detail: `A single reading is recorded (“${bps[0].sourceQuote}”). No repeat, home or follow-up readings appear.`, why: "Blood pressure is usually confirmed with repeated measurements before conclusions are drawn.", evidence: [ev(bps[0])] });
  }
  // advised / planned procedures with no performed result
  for (const e of events.filter((x) => x.category === "other" && /^Advised \/ planned:/i.test(x.title))) {
    const label = e.title.replace(/^Advised \/ planned:\s*/i, "");
    const done = events.some((x) => (x.category === "procedure" || x.category === "imaging") && x.title.toLowerCase() === label.toLowerCase());
    if (!done) {
      add(unclear, { id: `missing-result-${e.id}`, kind: "missing", title: `${label} was advised — no result found`, detail: `“${e.sourceQuote}” (${fmt(e)}). No result for this test appears in the provided records.`, why: "A test that was suggested but has no result in your records may not have been done yet, or the result may simply be in another document.", evidence: [ev(e)] });
    }
  }
  if (sig.has("sx:palpitations") && !sig.has("proc:ecg") && !sig.has("proc:holter")) {
    add(unclear, { id: "missing-rhythm", kind: "missing", title: "Palpitations recorded without a heart-rhythm test", detail: "No ECG or rhythm monitoring result appears in the records.", why: "Palpitations are often assessed with an ECG or monitoring.", evidence: sig.refs("sx:palpitations").slice(0, 1) });
  }
  const noDose = activeMeds.filter((m) => !m.medication!.dose);
  if (noDose.length) {
    add(unclear, { id: "unclear-dose", kind: "unclear", title: `${noDose.length} medicine${noDose.length === 1 ? "" : "s"} listed without a dose`, detail: noDose.map((m) => m.title).join("; "), why: "Strength and frequency are needed to understand any medicine entry.", evidence: noDose.slice(0, 3).map((m) => ev(m)) });
  }

  // ───────────── 3. QUESTIONS ─────────────
  const q = (id: string, title: string, why: string, evidence: EvidenceRef[]) => add(questions, { id: `q-${id}`, kind: "question", title, detail: "", why, evidence });
  if (sig.has("lab:low_vitamin_b12") && sig.has("med:metformin")) q("b12-metformin", "Could my metformin be related to my low vitamin B12, and does B12 need monitoring or follow-up?", "Long-term metformin is associated with lower B12 levels (NIH ODS); low B12 can also affect blood counts and nerves.", [...sig.refs("lab:low_vitamin_b12").slice(0, 1), ...sig.refs("med:metformin").slice(0, 1)]);
  else if (sig.has("lab:low_vitamin_b12")) q("b12", "What might be causing my low vitamin B12 and how should it be followed up?", "Low B12 has several possible causes (diet, absorption, medicines).", sig.refs("lab:low_vitamin_b12").slice(0, 1));
  if (sig.has("lab:low_hemoglobin") && sig.hasAny(["lab:low_ferritin", "lab:low_mcv"])) q("anaemia-cause", "Low haemoglobin, small red cells and/or low ferritin appear together — has the underlying cause been explored?", "Clinicians usually look for the cause of low iron stores (intake, absorption, blood loss), not just the number.", sig.refs(["lab:low_hemoglobin", "lab:low_ferritin"]).slice(0, 2));
  if (sig.has("lab:high_tsh")) q("thyroid", "Should free T4 or a repeat thyroid test be done to interpret my raised TSH?", "A raised TSH is typically interpreted with free T4 and sometimes repeated.", sig.refs("lab:high_tsh").slice(0, 1));
  if (events.some((e) => e.category === "other" && /^Advised \/ planned: Holter/i.test(e.title)) && !sig.has("proc:holter")) q("holter", "What happened with the advised Holter heart-rhythm monitoring, and has the result been reviewed?", "The follow-up appointment was meant to review it; the result is not in the records provided.", events.filter((e) => /Holter/i.test(e.title) && e.category === "other").slice(0, 1).map((e) => ev(e)));
  if (sig.has("allergy:penicillin") && sig.has("med:penicillin")) q("allergy-antibiotic", "Can my recorded penicillin allergy and my antibiotic prescription be reconciled by my prescriber or pharmacist?", "Allergy status is safety-critical and should be consistent across records.", [...sig.refs("allergy:penicillin").slice(0, 1), ...sig.refs("med:penicillin").slice(0, 1)]);
  if (unclear.some((f) => f.id.startsWith("conflict-dx") || f.id === "conflict-meds")) q("reconcile", "Can my records (diagnoses and medicines) be reconciled so every clinician sees the same information?", "Conflicting statements across documents can lead to incomplete decisions.", unclear.filter((f) => f.kind === "conflict").flatMap((f) => f.evidence).slice(0, 3));
  if (unclear.some((f) => f.id.startsWith("missing-kidney") || f.id === "missing-urine-albumin")) q("kidney", "Are my kidney checks (eGFR and urine albumin) up to date given my blood sugar and blood pressure?", "Kidney screening is a routine part of care when diabetes and high blood pressure coexist.", sig.refs(["dx:diabetes", "dx:hypertension"]).slice(0, 2));
  if (sig.has("lab:low_vitamin_d")) q("vitd", "Does my low vitamin D need follow-up, and should calcium or kidney function be reviewed with it?", "Vitamin D, calcium and kidney function are interpreted together.", sig.refs("lab:low_vitamin_d").slice(0, 1));
  if (sig.has("sx:neuropathy")) q("tingling", "Could my tingling in the feet be related to my blood sugar, vitamin B12, or something else, and is a nerve assessment needed?", "Diabetes and low B12 are both recognised causes of nerve symptoms, and other causes exist.", sig.refs("sx:neuropathy").slice(0, 1));
  const specialtiesSeen = new Set(events.filter((e) => e.category === "visit").map((e) => e.specialty));
  if (specialtiesSeen.size >= 2) q("coordination", "Do my different specialists have each other's latest results, and who is coordinating my overall care?", "Information recorded by one specialty (for example thyroid or blood count) can be relevant to another.", events.filter((e) => e.category === "visit").slice(0, 2).map((e) => ev(e)));
  if (events.filter((e) => e.category === "lab").some((e) => e.values.some((v) => v.flag === "low" || v.flag === "high"))) q("repeat", "Which of my abnormal results should be repeated, and when?", "Timing of repeat tests depends on the result and your situation.", []);

  return { confirmed, unclear, questions, generatedAt: new Date().toISOString() };
}

// ───────────────────────── AI augmentation ─────────────────────────

export async function runBlindSpots(userId: string, events: HealthEvent[], profile: HealthProfile | undefined, language: string): Promise<BlindSpotResult> {
  const base = detectBlindSpots(events, profile);
  if (!events.length) return { ...base, meta: (await demoMeta(userId)) };

  const ids = new Set(events.map((e) => e.id));
  const compact = events.slice(0, 150).map((e) => ({
    id: e.id,
    date: e.date,
    dateCertainty: e.dateCertainty,
    category: e.category,
    title: e.title,
    specialty: e.specialty,
    values: e.values.map((v) => `${v.name} ${v.valueText}${v.unit ? " " + v.unit : ""} (lab range ${v.refText ?? "not stated"}; ${v.flag})`),
    quote: e.sourceQuote,
  }));
  const r = await runStructured({
    userId,
    module: "blind-spot-detector",
    schemaName: "blind_spot_items",
    schema: LlmBlindSpotSchema as z.ZodType<z.infer<typeof LlmBlindSpotSchema>>,
    system: [
      "You are the Blind-Spot engine of SanoAI, a patient-facing health-information app.",
      "Examine the structured medical events extracted from the user's own documents and list ADDITIONAL information that is unclear, missing, or conflicting, and questions the user could discuss with a clinician.",
      "STRICT RULES: (1) Only describe what the PROVIDED RECORDS do or do not contain. (2) NEVER say a diagnosis was missed, that a clinician made a mistake or overlooked something, or that the user has a condition. (3) Phrase everything as 'the records provided do not show…' or 'it may be worth asking…'. (4) Never recommend starting, stopping or changing a medicine or dose. (5) Every item must cite eventIds taken ONLY from the provided events. (6) Do not repeat the already-found items. (7) Be concise and specific; max 8 items.",
      `Write in ${language}.`,
    ].join("\n"),
    user: JSON.stringify({ events: compact, alreadyFound: [...base.unclear, ...base.questions].map((f) => f.title) }),
    validate: (d) => (d.items.some((i) => i.eventIds.some((id) => !ids.has(id))) ? "an item cited an eventId that does not exist" : null),
  });
  if (!r.ok) return { ...base, meta: r.meta };

  const byId = new Map(events.map((e) => [e.id, e]));
  const extra: Finding[] = r.data.items.map((it, i) => ({
    id: `ai-${i}`,
    kind: it.kind,
    title: it.title,
    detail: it.detail,
    why: it.why,
    evidence: it.eventIds.map((id) => ({ eventId: id, docId: byId.get(id)?.docId, quote: byId.get(id)?.sourceQuote })),
    source: "ai" as const,
  }));
  return {
    confirmed: base.confirmed,
    unclear: [...base.unclear, ...extra.filter((f) => f.kind !== "question")],
    questions: [...base.questions, ...extra.filter((f) => f.kind === "question")],
    generatedAt: base.generatedAt,
    meta: r.meta as AiMeta,
  };
}

export { buildTimeline };
