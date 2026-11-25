import { z } from "zod";
import { CATEGORIES, DATE_CERTAINTY, DOC_TYPES, SPECIALTIES, type Category, type DateCertainty, type DocType, type Specialty } from "./constants";

export { CATEGORIES, DATE_CERTAINTY, DOC_TYPES, SPECIALTIES };
export type { Category, DateCertainty, DocType, Specialty };

/**
 * Shared domain model + validation schemas for every SanoAI AI engine.
 * All AI output is parsed with these schemas before it reaches the UI.
 */




export const LabValueSchema = z.object({
  name: z.string(),
  canonical: z.string().nullable(),
  value: z.number().nullable(),
  valueText: z.string(),
  unit: z.string().nullable(),
  refLow: z.number().nullable(),
  refHigh: z.number().nullable(),
  refText: z.string().nullable(),
  /** Computed ONLY from the reference range printed on the report. */
  flag: z.enum(["low", "high", "normal", "unknown"]),
  /** Flag as printed on the report (L / H / LOW …), if any. */
  labFlag: z.string().nullable(),
  /** The exact source line this value was read from (traceability). */
  quote: z.string().optional(),
});
export type LabValue = z.infer<typeof LabValueSchema>;

export const MedicationSchema = z.object({
  name: z.string(),
  generic: z.string().nullable(),
  drugClass: z.string().nullable(),
  dose: z.string().nullable(),
  frequency: z.string().nullable(),
  status: z.enum(["active", "stopped", "unknown"]),
});
export type Medication = z.infer<typeof MedicationSchema>;

export const HealthEventSchema = z.object({
  id: z.string(),
  docId: z.string(),
  category: z.enum(CATEGORIES),
  title: z.string().min(1),
  date: z.string().nullable(), // ISO yyyy-mm-dd | yyyy-mm | null
  dateCertainty: z.enum(DATE_CERTAINTY),
  specialty: z.enum(SPECIALTIES),
  details: z.string(),
  values: z.array(LabValueSchema),
  medication: MedicationSchema.nullable(),
  /** Verbatim text from the source document supporting this event. */
  sourceQuote: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  method: z.enum(["rules", "llm", "manual"]),
  userEdited: z.boolean(),
});
export type HealthEvent = z.infer<typeof HealthEventSchema>;


export interface AiMeta {
  mode: "live" | "demo" | "rules";
  provider: string;
  model?: string;
  /** Plain-language notice when something degraded (failed call, no consent, …). */
  notice?: string;
}

/** Documents as sent to the client (no storage keys). */
export interface DocumentDTO {
  id: string;
  title: string;
  docType: DocType;
  originalName: string;
  mime: string;
  size: number;
  textSource: string;
  status: string;
  statusDetail: string | null;
  isDemo: boolean;
  extractionMethod: string | null;
  extractedAt: string | null;
  createdAt: string;
  hasText: boolean;
}

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export interface EvidenceRef {
  eventId?: string;
  docId?: string;
  quote?: string;
}

// ───────────────────────── Blind-spot detector ─────────────────────────
export interface Finding {
  id: string;
  title: string;
  detail: string;
  why: string;
  evidence: EvidenceRef[];
  kind: "confirmed" | "unclear" | "missing" | "conflict" | "question";
  source: "rules" | "ai";
}
export interface BlindSpotResult {
  confirmed: Finding[];
  unclear: Finding[]; // unclear or missing, incl. conflicts
  questions: Finding[];
  meta: AiMeta;
  generatedAt: string;
}

// ───────────────────────── Uncertainty engine ─────────────────────────
export type Basis = "records" | "reference" | "ai-general";
export interface UStatement {
  text: string;
  basis: Basis;
  sourceIds: string[]; // KB source ids
  eventIds: string[];
}
export interface UncertaintyAssessment {
  topic: string;
  question: string;
  supported: UStatement[];
  possibilities: UStatement[];
  missing: UStatement[];
  alternatives: UStatement[];
  professional: UStatement[];
  whyNotDefinitive: string[];
  sources: SourceRef[];
  meta: AiMeta;
  generatedAt: string;
}

// ───────────────────────── Cross-specialty ─────────────────────────
export interface Connection {
  id: string;
  title: string;
  specialties: Specialty[];
  strength: "documented" | "partial";
  matched: { label: string; evidence: EvidenceRef[] }[];
  notFound: string[];
  why: string;
  caution: string;
  questions: string[];
  sourceIds: string[];
}
export interface CrossSpecialtyResult {
  specialtiesInvolved: { specialty: Specialty; items: string[] }[];
  connections: Connection[];
  edges: { a: Specialty; b: Specialty; count: number }[];
  integratedSummary: string;
  coordinationQuestions: string[];
  consultPrep: { specialty: Specialty; bring: string[]; ask: string[] }[];
  sources: SourceRef[];
  meta: AiMeta;
  generatedAt: string;
}

// ───────────────────────── Biomarker / deficiency ─────────────────────────
export interface BiomarkerRow {
  key: string;
  name: string;
  eventId: string;
  docId: string;
  docTitle: string;
  date: string | null;
  dateCertainty: DateCertainty;
  valueText: string;
  value: number | null;
  unit: string | null;
  refText: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: "low" | "high" | "normal" | "unknown";
  labFlag: string | null;
  explanation: string;
  possibleReasons: string[];
  limitations: string[];
  missingInfo: string[];
  doctorQuestions: string[];
  sourceIds: string[];
}
export interface BiomarkerResult {
  rows: BiomarkerRow[];
  notFound: { key: string; name: string; why: string }[];
  sources: SourceRef[];
  meta: AiMeta;
  generatedAt: string;
}

// ───────────────────────── Chat ─────────────────────────
export interface ChatCitation {
  n: number;
  sourceId: string;
  title: string;
  publisher: string;
  url: string;
}
export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  meta?: {
    ai?: AiMeta;
    citations?: ChatCitation[];
    followUps?: string[];
    safety?: { level: "emergency" | "urgent"; message: string } | null;
    uncertainty?: { known: string[]; unsure: string[]; missing: string[] } | null;
    modules?: { href: string; label: string }[];
    usedRecords?: boolean;
  };
}

// ───────────────────────── LLM output schemas ─────────────────────────
const quoteStr = z.string().min(3).max(400);

export const LlmExtractionSchema = z.object({
  documentDate: z.string().nullable().describe("ISO date (YYYY-MM-DD) of the report as printed, or null if not stated"),
  documentDateQuote: z.string().nullable(),
  events: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        title: z.string().max(160),
        date: z.string().nullable().describe("ISO date YYYY-MM-DD / YYYY-MM or null. NEVER guess."),
        dateQuote: z.string().nullable(),
        specialty: z.enum(SPECIALTIES),
        details: z.string().max(600),
        values: z
          .array(
            z.object({
              name: z.string(),
              value: z.number().nullable(),
              valueText: z.string(),
              unit: z.string().nullable(),
              refLow: z.number().nullable(),
              refHigh: z.number().nullable(),
              refText: z.string().nullable(),
              labFlag: z.string().nullable(),
            }),
          )
          .default([]),
        medication: z
          .object({
            name: z.string(),
            dose: z.string().nullable(),
            frequency: z.string().nullable(),
            status: z.enum(["active", "stopped", "unknown"]),
          })
          .nullable()
          .default(null),
        sourceQuote: quoteStr.describe("Exact, verbatim text copied from the document that supports this event"),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(120),
});
export type LlmExtraction = z.infer<typeof LlmExtractionSchema>;

const uStatement = z.object({
  text: z.string().min(3).max(400),
  basis: z.enum(["records", "reference", "ai-general"]),
  sourceIds: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
});
export const LlmUncertaintySchema = z.object({
  supported: z.array(uStatement).max(8),
  possibilities: z.array(uStatement).max(8),
  missing: z.array(uStatement).max(8),
  alternatives: z.array(uStatement).max(8),
  professional: z.array(uStatement).max(6),
  whyNotDefinitive: z.array(z.string().max(300)).max(5),
});

export const LlmBlindSpotSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(["unclear", "missing", "conflict", "question"]),
        title: z.string().max(140),
        detail: z.string().max(500),
        why: z.string().max(500),
        eventIds: z.array(z.string()).default([]),
      }),
    )
    .max(12),
});

export const LlmChatSchema = z.object({
  answer: z.string().min(1).max(6000),
  citedSourceIds: z.array(z.string()).default([]),
  followUps: z.array(z.string().max(160)).max(4).default([]),
  known: z.array(z.string().max(240)).max(4).default([]),
  unsure: z.array(z.string().max(240)).max(4).default([]),
  missing: z.array(z.string().max(240)).max(4).default([]),
});

export const LlmSimulatorSchema = z.object({
  overview: z.string().max(1200),
  perScenario: z.array(z.object({ scenarioId: z.string(), explanation: z.string().max(1200) })).max(4),
  doctorQuestions: z.array(z.string().max(200)).max(6),
});

export const LlmSummarySchema = z.object({
  summary: z.string().max(2500),
});
