import { toBase64, utf8 } from "@/lib/bytes";
import { uuid } from "@/lib/uuid";
import { z } from "zod";
import { ALIAS_INDEX } from "../knowledge/biomarkers";
import { DRUG_NAME_INDEX } from "../knowledge/drugs";
import { SAMPLE_DOCS } from "../demo/sampleRecords";
import { aiStatus, runStructured, runText } from "../structured";
import type { DocType, HealthEvent, LabValue, LlmExtraction } from "../types";
import { LlmExtractionSchema } from "../types";
import { findDates } from "./dates";
import { extractWithRules, parseLabLine } from "./rules";
import { getDocumentRow, getSettings, insertDocument, replaceEventsForDoc, updateDocument } from "@/lib/repo";

/**
 * Document Intelligence Engine — turns an uploaded file into (1) original text and (2) structured events.
 *
 *   file ──► text acquisition (text / PDF text layer / AI vision if consented) ──► extraction
 *                                                                                    │
 *            ┌───────────────────────────────────────────────────────────────────────┘
 *            ▼
 *   AI extraction (if live) ─► zod validation ─► VERBATIM-QUOTE VERIFICATION ─► events
 *   (otherwise / on failure)  rule-based extraction ─────────────────────────► events
 *
 * Original text is stored separately from AI interpretation; every event keeps a verbatim quote.
 */

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function detectDocType(text: string): DocType {
  const labCount = text.split("\n").filter((l) => parseLabLine(l.trim())).length;
  if (/discharge summary|date of discharge/i.test(text)) return "discharge";
  if (labCount >= 2) return "lab_report";
  if (/\b(prescription|rx\b|tab\.|cap\.)/i.test(text) && !/consultation/i.test(text)) return "prescription";
  if (/consultation|outpatient|clinic|presenting complaints|impression/i.test(text)) return "consultation";
  if (/\b(x-?ray|mri|ct scan|ultrasound|echocardiogram)\b.*\b(report|findings)\b/i.test(text)) return "imaging";
  return "other";
}

export async function pdfToText(buf: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).replace(/\u0000/g, "").trim();
}

const TRANSCRIBE_SYSTEM =
  "You transcribe medical documents. Output ONLY the text visible in the document, preserving line breaks and table rows (one row per line). Do not summarise, interpret, correct, translate or add anything. If something is illegible write [illegible].";

/** Try AI vision transcription (only when the user consented and a provider is configured). */
async function transcribeWithAi(userId: string, buf: Uint8Array, mime: string): Promise<{ text: string | null; notice?: string }> {
  const r = await runText({ userId, module: "document-transcription", system: TRANSCRIBE_SYSTEM, user: "Transcribe this document.", attachments: [{ mime, base64: toBase64(buf) }], maxTokens: 6000 });
  if (r.ok && r.text.trim().length > 20) return { text: r.text.trim() };
  return { text: null, notice: r.ok ? "The AI returned too little text." : r.meta.notice };
}

export async function acquireText(userId: string, file: { buf: Uint8Array; isPdf: boolean; isImage: boolean; isText: boolean; mime: string }): Promise<{ text: string | null; source: string; detail?: string }> {
  if (file.isText) return { text: utf8(file.buf).replace(/^\uFEFF/, ""), source: "direct" };
  if (file.isPdf) {
    try {
      const t = await pdfToText(file.buf);
      if (t.length >= 40) return { text: t, source: "pdf-text" };
    } catch {
      /* fall through to vision */
    }
  }
  // scanned PDF or image → AI vision, if allowed
  const st = (await aiStatus(userId));
  if (st.effective === "live") {
    const r = await transcribeWithAi(userId, file.buf, file.mime);
    if (r.text) return { text: r.text, source: "ai-vision" };
    return { text: null, source: "none", detail: `Could not read this file automatically (${r.notice ?? "unknown reason"}). Paste its text below.` };
  }
  return {
    text: null,
    source: "none",
    detail: file.isPdf
      ? "This PDF has no selectable text (it looks scanned). Reading scanned pages needs an AI key (Settings → AI keys) and your consent — or paste the text below."
      : "Images need an AI vision provider (not configured, or no consent given). Paste the text of the document below to include it.",
  };
}

// ───────────────────────── extraction ─────────────────────────

function toLab(v: LlmExtraction["events"][number]["values"][number], docNorm: string): LabValue {
  const key = ALIAS_INDEX.find((a) => norm(v.name).includes(a.alias))?.key ?? null;
  let flag: LabValue["flag"] = "unknown";
  if (v.value != null && (v.refLow != null || v.refHigh != null)) flag = v.refLow != null && v.value < v.refLow ? "low" : v.refHigh != null && v.value > v.refHigh ? "high" : "normal";
  void docNorm;
  return { name: v.name, canonical: key, value: v.value, valueText: v.valueText, unit: v.unit, refLow: v.refLow, refHigh: v.refHigh, refText: v.refText, flag, labFlag: v.labFlag };
}

async function extractWithAi(userId: string, doc: { id: string; docType: DocType; title: string; text: string }): Promise<{ events: HealthEvent[]; discarded: number; meta: { provider: string; model?: string } } | null> {
  const r = await runStructured({
    userId,
    module: "medical-information-extraction",
    schemaName: "medical_extraction",
    schema: LlmExtractionSchema as z.ZodType<LlmExtraction>,
    skipGuard: true, // output is quotes of the user's own record, not generated advice
    system: [
      "You are the Medical Information Extraction engine of SanoAI. Extract structured events from ONE patient document.",
      "RULES: (1) Extract only what is explicitly written. (2) NEVER invent or infer dates, values, diagnoses or medicines. If a date is not printed, use null. (3) Every event MUST include sourceQuote: an exact, verbatim substring copied from the document. (4) Dates must be ISO (YYYY-MM-DD, or YYYY-MM if the day is missing) and dateQuote must be the verbatim text containing the date. (5) For lab values copy the unit and the reference range printed on the report; do not use outside knowledge for ranges. (6) Categories: lab (group all values of one report date in ONE event), medication, symptom, diagnosis, visit, procedure, imaging, allergy, other. (7) Do not interpret results or add advice.",
      "If the document states that something is advised/planned but not done, use category 'other' with a title starting 'Advised / planned:'.",
    ].join("\n"),
    user: `Document title: ${doc.title}\nDocument type (user-selected): ${doc.docType}\n\n--- DOCUMENT START ---\n${doc.text.slice(0, 24000)}\n--- DOCUMENT END ---`,
    maxTokens: 6000,
  });
  if (!r.ok) return null;

  const docNorm = norm(doc.text);
  const verified = (q: string | null | undefined) => !!q && q.trim().length >= 3 && docNorm.includes(norm(q));
  const docDateOk = r.data.documentDate && verified(r.data.documentDateQuote) ? r.data.documentDate : null;
  let discarded = 0;
  const events: HealthEvent[] = [];
  for (const e of r.data.events) {
    if (!verified(e.sourceQuote)) {
      discarded++;
      continue; // anti-fabrication: unverifiable events are dropped
    }
    let date: string | null = null;
    let dateCertainty: HealthEvent["dateCertainty"] = "missing";
    if (e.date && verified(e.dateQuote)) {
      const found = findDates(e.dateQuote!)[0];
      date = found ? found.iso : e.date;
      dateCertainty = found?.certainty ?? "explicit";
    } else if (docDateOk) {
      date = docDateOk;
      dateCertainty = "document";
    }
    const medLookup = e.medication ? DRUG_NAME_INDEX.find((d) => norm(e.medication!.name).includes(d.name)) : null;
    events.push({
      id: uuid(),
      docId: doc.id,
      category: e.category,
      title: e.title,
      date,
      dateCertainty,
      specialty: e.specialty,
      details: e.details,
      values: e.values.map((v) => toLab(v, docNorm)),
      medication: e.medication ? { name: e.medication.name, generic: medLookup?.def.generic ?? null, drugClass: medLookup?.def.drugClass ?? null, dose: e.medication.dose, frequency: e.medication.frequency, status: e.medication.status } : null,
      sourceQuote: e.sourceQuote.slice(0, 400),
      confidence: e.confidence,
      method: "llm",
      userEdited: false,
    });
  }
  return { events, discarded, meta: { provider: r.meta.provider, model: r.meta.model } };
}

export async function extractAndStore(userId: string, docId: string): Promise<{ events: number; method: "llm" | "rules"; discarded: number }> {
  const row = (await getDocumentRow(userId, docId));
  if (!row) throw new Error("Document not found");
  if (!row.text_content) {
    (await updateDocument(userId, docId, { status: "needs_text" }));
    return { events: 0, method: "rules", discarded: 0 };
  }
  const raw = { id: row.id, docType: row.doc_type as DocType, title: row.title, text: row.text_content };
  let events: HealthEvent[] | null = null;
  let method: "llm" | "rules" = "rules";
  let discarded = 0;
  let detail: string | null = null;

  // Economy mode: rule-based extraction first; spend AI tokens only when it finds (almost) nothing.
  const ruleFirst = true /* economy mode: don't spend AI calls when rules suffice */ ? extractWithRules(raw).events : null;
  if ((await aiStatus(userId)).effective === "live" && !(ruleFirst && ruleFirst.length >= 3)) {
    const ai = await extractWithAi(userId, raw);
    if (ai && ai.events.length) {
      events = ai.events;
      method = "llm";
      discarded = ai.discarded;
      detail = discarded ? `${discarded} AI-proposed item${discarded === 1 ? " was" : "s were"} discarded because its source text could not be found in the document.` : null;
    } else {
      detail = "AI extraction was unavailable or returned nothing verifiable; rule-based extraction was used.";
    }
  }
  if (!events) events = ruleFirst ?? extractWithRules(raw).events;

  (await replaceEventsForDoc(userId, docId, events));
  (await updateDocument(userId, docId, { status: "processed", statusDetail: detail, extractionMethod: method === "llm" ? "ai-verified" : "rules", extractedAt: new Date().toISOString() }));
  return { events: events.length, method, discarded };
}

// ───────────────────────── demo records ─────────────────────────
export async function loadDemoRecords(userId: string): Promise<number> {
  let n = 0;
  for (const s of SAMPLE_DOCS) {
    const id = await insertDocument(userId, {
      title: s.title,
      docType: s.docType,
      originalName: s.fileName,
      mime: "text/plain",
      size: new TextEncoder().encode(s.text).length,
      storageKey: null,
      textContent: s.text,
      textSource: "direct",
      status: "uploaded",
      isDemo: true,
    });
    await extractAndStore(userId, id);
    n++;
  }
  return n;
}

export { getSettings };
