import { z } from "zod";
import { retrieve, type Retrieved } from "../knowledge/retrieve";
import type { SourceRef, AiMeta, ChatCitation, ChatMessageDTO, DocumentDTO, HealthEvent } from "../types";
import { LlmChatSchema } from "../types";
import type { HealthProfile } from "@/lib/repo";
import { triage } from "../safety";
import { demoMeta, runStructured } from "../structured";
import { formatDate } from "./dates";
import { assessUncertaintyRules } from "./uncertainty";
import { buildTimeline } from "./timeline";
import { latestByKey } from "./signals";

/**
 * Conversational AI Engine — the orchestrator behind the SanoAI assistant.
 *   1. deterministic safety triage (never delegated to a model)
 *   2. intent routing to other SanoAI modules
 *   3. retrieval (RAG) from the cited knowledge base
 *   4. consent-gated use of the user's own records
 *   5. answer: model-written (validated + guarded) or rule-based composition; always with citations
 */

type Meta = NonNullable<ChatMessageDTO["meta"]>;

const MODULES: { re: RegExp; href: string; label: string }[] = [
  { re: /\b(timeline|my (history|reports|records)|chronolog)/i, href: "/timeline", label: "Health story" },
  { re: /\b(missing|gaps?|overlooked|unanswered|inconsisten|conflict|blind[- ]?spot)/i, href: "/blind-spots", label: "What's missing" },
  { re: /\bwhat if\b|\bscenario|\bsimulat|if i (sleep|exercise|walk|eat|quit|stop drinking)/i, href: "/simulator", label: "What if…?" },
  { re: /\b(uncertain|how sure|confidence|can'?t (you )?be sure)/i, href: "/uncertainty", label: "How sure can we be?" },
  { re: /\b(specialist|cardiolog|endocrin|neurolog|gastro).*(connect|relat|link)|cross[- ]specialty/i, href: "/cross-specialty", label: "Body connections" },
  { re: /\b(deficien|b12|vitamin|ferritin|iron|folate|haemoglobin|hemoglobin|blood test|lab result)/i, href: "/deficiency", label: "Nutrients check" },
  { re: /\b(find|see|book).*(doctor|specialist)|appointment/i, href: "/doctors", label: "Find care" },
  { re: /\b(pharmacy|medicine (label|available)|in stock|where (can i )?(buy|get))/i, href: "/pharmacy", label: "Medicines" },
];

const RECORD_Q = /\b(my|mine)\b.*\b(result|report|test|record|medication|medicine|history|level|value|blood|document)s?\b|\bsummari[sz]e\b|\bwhat (do|does) my\b|\bin my (records|reports)\b/i;
const SUMMARISE = /\b(summari[sz]e|summary|overview|what('s| is) in)\b.*\b(my|the)\b.*\b(records?|reports?|history|documents?|timeline)\b|\bsummari[sz]e (my|the)\b/i;
const DEFINITION_Q = /^\s*(what is|what's|what are|what does|tell me about|explain)\b/i;
const CONSULT_BRIEF = /\b(prepare|prep|brief|summary).*(consult|appointment|visit|doctor)|consultation (summary|brief)/i;

export function recordBrief(events: HealthEvent[], profile?: HealthProfile, docs: DocumentDTO[] = []): string {
  if (!events.length && !profile) return "";
  const tl = buildTimeline(events, docs);
  const latest = latestByKey(events);
  const abn = [...latest.values()].filter((p) => p.value.flag === "low" || p.value.flag === "high");
  const meds = tl.medications.map((m) => `${m.name} (${m.entries.map((e) => [e.dose, e.frequency].filter(Boolean).join(" ")).filter(Boolean).slice(-1)[0] ?? "dose not recorded"})`);
  const lines = [
    `Documents: ${tl.stats.documents}; events: ${tl.stats.events}${tl.stats.first ? `; period ${formatDate(tl.stats.first)} – ${formatDate(tl.stats.last)}` : ""}.`,
    abn.length ? `Most recent results outside the lab's stated range: ${abn.map((p) => `${p.value.name} ${p.value.valueText}${p.value.unit ? " " + p.value.unit : ""} (${p.value.flag}, ${formatDate(p.date)})`).join("; ")}.` : "No results outside the lab's stated range in the most recent values.",
    meds.length ? `Medicines recorded: ${meds.join(", ")}.` : "",
    events.filter((e) => e.category === "diagnosis" && !/\(as recorded\)$/i.test(e.title)).length ? `Diagnoses/impressions written in records: ${[...new Set(events.filter((e) => e.category === "diagnosis" && !/\(as recorded\)$/i.test(e.title)).map((e) => e.title))].join("; ")}.` : "",
    events.filter((e) => e.category === "symptom").length ? `Symptoms recorded: ${[...new Set(events.filter((e) => e.category === "symptom").map((e) => e.title))].join(", ")}.` : "",
    events.filter((e) => e.category === "allergy" && !/no known/i.test(e.title)).length ? `Allergies: ${events.filter((e) => e.category === "allergy" && !/no known/i.test(e.title)).map((e) => e.title.replace(/^Allergy:\s*/, "")).join(", ")}.` : "",
    profile && (profile.conditions.length || profile.medications.length || profile.allergies.length) ? `Self-reported profile — conditions: ${profile.conditions.join(", ") || "none"}; medicines: ${profile.medications.join(", ") || "none"}; allergies: ${profile.allergies.join(", ") || "none"}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function numberSources(hits: Retrieved[]): { list: ChatCitation[]; byEntry: Map<string, number[]> } {
  const list: ChatCitation[] = [];
  const idx = new Map<string, number>();
  const byEntry = new Map<string, number[]>();
  for (const h of hits) {
    const nums: number[] = [];
    for (const s of h.sources) {
      if (!idx.has(s.id)) {
        idx.set(s.id, list.length + 1);
        list.push({ n: list.length + 1, sourceId: s.id, title: s.title, publisher: s.publisher, url: s.url });
      }
      nums.push(idx.get(s.id)!);
    }
    byEntry.set(h.entry.id, nums);
  }
  return { list, byEntry };
}
const cite = (nums: number[] | undefined) => (nums?.length ? " " + nums.map((n) => `[${n}]`).join("") : "");

function followUps(hits: Retrieved[], hasRecords: boolean, message: string): string[] {
  const t = hits[0]?.entry.title;
  const out: string[] = [];
  if (t) {
    const short = t.toLowerCase();
    out.push(`What are the common causes related to ${short}?`, `What information would a doctor want to know about ${short}?`, `When should I seek medical care about ${short}?`);
  } else {
    out.push("What can SanoAI help me with?", "How do I read the reference range on a blood test?");
  }
  if (hasRecords && !/my (records|reports)/i.test(message)) out.push("How does this relate to my records?");
  return out.slice(0, 4);
}

function composeFromKb(hits: Retrieved[], nums: Map<string, number[]>, recordLines: string[]): string {
  const [top, ...rest] = hits;
  const e = top.entry;
  const out: string[] = [];
  out.push(`### ${e.title}`);
  out.push(`${e.summary}${cite(nums.get(e.id))}`);
  const est = e.facts.filter((f) => f.status === "established").slice(0, 4);
  if (est.length) out.push("#### What is well established\n" + est.map((f) => `- ${f.text}`).join("\n") + cite(nums.get(e.id)));
  const emerging = e.facts.filter((f) => f.status === "emerging");
  if (emerging.length) out.push("#### Still uncertain or being studied\n" + emerging.map((f) => `- ${f.text}`).join("\n") + cite(nums.get(e.id)));
  if (e.causes.length) out.push("#### Possible contributors (not a diagnosis)\n" + e.causes.slice(0, 5).map((c) => `- ${c}`).join("\n"));
  if (recordLines.length) out.push("#### In your own records\n" + recordLines.map((l) => `- ${l}`).join("\n"));
  out.push(`#### When to get medical help\n${e.whenToSeek}${cite(nums.get(e.id))}`);
  if (rest.length) out.push(`_Related topics in SanoAI's library: ${rest.map((r) => r.entry.title).join("; ")}._`);
  out.push("_SanoAI shares general health information, not a diagnosis. Only a clinician who can examine you can interpret this for your situation._");
  return out.join("\n\n");
}

export interface ChatInput {
  userId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  events: HealthEvent[];
  docs: DocumentDTO[];
  profile?: HealthProfile;
  useRecords: boolean;
  language: string;
  readingLevel: "plain" | "detailed";
}

export async function chatTurn(inp: ChatInput): Promise<{ content: string; meta: Meta }> {
  const { message } = inp;
  const tri = triage(message);
  const modules = MODULES.filter((m) => m.re.test(message)).slice(0, 3).map((m) => ({ href: m.href, label: m.label }));
  const hasRecords = inp.useRecords && inp.events.length > 0;

  // Emergency: deterministic response only, never model-generated.
  if (tri.level === "emergency") {
    return {
      content: `### Please seek urgent help now\n\n${tri.message}\n\nI am an information tool and cannot assess an emergency. Once you are safe, I can help you understand your health information.`,
      meta: { ai: { mode: "rules", provider: "SanoAI safety layer" }, safety: { level: "emergency", message: tri.message }, citations: [], followUps: [], modules: [], usedRecords: false },
    };
  }

  // Build query with context for short follow-ups
  const lastUser = [...inp.history].reverse().find((h) => h.role === "user")?.content ?? "";
  const q = message.split(/\s+/).length < 6 && lastUser ? `${lastUser} ${message}` : message;
  const hits = retrieve(q, 3);
  const { list: citations, byEntry } = numberSources(hits);

  // Record-grounded shortcuts (deterministic; no AI needed to restate the user's own data)
  if (hasRecords && (SUMMARISE.test(message) || CONSULT_BRIEF.test(message))) {
    const tl = buildTimeline(inp.events, inp.docs);
    const brief = recordBrief(inp.events, inp.profile, inp.docs);
    const content = [
      CONSULT_BRIEF.test(message) ? "### Consultation summary (from your records)" : "### Summary of your records",
      tl.summary,
      "**Key points**\n" + brief.split("\n").map((l) => `- ${l}`).join("\n"),
      `Open the [Health story](/timeline) to inspect each item and its source document, or the [Doctor Brief](/brief) for a printable one-pager.`,
      "_This restates your documents; it is not a diagnosis. Extracted details can contain errors — check them against the originals._",
    ].join("\n\n");
    return { content, meta: { ai: (await demoMetaFor(inp.userId)), citations: [], followUps: ["What information might be missing from my records?", "Which of my results are outside the lab's range?", "Prepare questions for my next appointment"], safety: tri.level === "urgent" ? { level: "urgent", message: tri.message } : null, modules: [{ href: "/timeline", label: "Health story" }, { href: "/brief", label: "Doctor Brief" }], usedRecords: true } };
  }

  const unc = hits.length ? assessUncertaintyRules(q, hasRecords ? inp.events : [], inp.profile, hits) : null;
  const recordLines = unc ? unc.supported.filter((s) => s.basis === "records").slice(0, 4).map((s) => s.text) : [];
  const uncertainty = unc ? { known: unc.supported.slice(0, 3).map((s) => s.text), unsure: unc.possibilities.slice(0, 2).map((s) => s.text), missing: unc.missing.slice(0, 3).map((s) => s.text) } : null;

  // Live model answer (if consented + configured), with validation and graceful fallback
  const passages = hits.map((h) => ({ topic: h.entry.title, sourceNumbers: byEntry.get(h.entry.id), summary: h.entry.summary, facts: h.entry.facts.map((f) => `[${f.status}] ${f.text}`), causes: h.entry.causes, redFlags: h.entry.redFlags, whenToSeek: h.entry.whenToSeek }));
  const brief = hasRecords ? recordBrief(inp.events, inp.profile, inp.docs) : "";
  // Economy mode: only a short "what is X" question that the cited library clearly covers is answered without AI.
  const strong = hits.length > 0 && hits[0].score >= 9 && DEFINITION_Q.test(message) && inp.language === "English" && !RECORD_Q.test(message) && message.split(/\s+/).length <= 8;
  const r = strong
    ? ({ ok: false, meta: { mode: "rules", provider: "SanoAI cited library (economy mode — no AI tokens used)" } } as const)
    : await runStructured({
    userId: inp.userId,
    module: "medical-chatbot",
    schemaName: "chat_answer",
    schema: LlmChatSchema as z.ZodType<z.infer<typeof LlmChatSchema>>,
    system: [
      "You are SanoAI, a health-information assistant. You are NOT a doctor. You never diagnose, never prescribe, and never advise starting, stopping or changing a medicine or dose.",
      "Ground medical statements in the numbered reference passages provided and cite with their SOURCE NUMBERS like [1]. If the passages do not cover the question, say so plainly rather than guessing, and give only widely-accepted general information marked as general knowledge.",
      "Distinguish established facts from emerging/uncertain evidence. State what is unknown or missing. Never give percentages or probabilities.",
      "If the user's records are provided, you may refer to them, always as 'your records show…' and note that a clinician must interpret them. Do not claim a clinician made an error.",
      "Explain when medical attention is needed. Use short paragraphs and bullet points in Markdown. Fill 'known', 'unsure', 'missing' with up to 3 brief points each about THIS answer's certainty.",
      `Reading level: ${inp.readingLevel === "plain" ? "plain language (about age 12–14)" : "detailed, with medical terms explained"}. Respond in ${inp.language}.`,
      tri.level === "urgent" ? "The user's message includes warning signs: START the answer by urging prompt medical assessment." : "",
    ].filter(Boolean).join("\n"),
    user: JSON.stringify({ question: message, recentConversation: inp.history.slice(-6), referencePassages: passages, sourceList: citations.map((c) => ({ n: c.n, title: c.title, publisher: c.publisher })), userRecords: brief || "(not shared or none)" }),
    maxTokens: 6000,
  });

  let content: string;
  let ai: AiMeta;
  let fups: string[];
  let unsureBlock = uncertainty;
  let usedCitations = citations;
  if (r.ok) {
    content = r.data.answer;
    ai = r.meta;
    fups = r.data.followUps.length ? r.data.followUps : followUps(hits, hasRecords, message);
    if (r.data.known.length || r.data.unsure.length || r.data.missing.length) unsureBlock = { known: r.data.known, unsure: r.data.unsure, missing: r.data.missing };
    const used = new Set([...content.matchAll(/\[(\d+)\]/g)].map((m) => +m[1]));
    usedCitations = used.size ? citations.filter((c) => used.has(c.n)) : citations;
    if (!/not a (doctor|diagnosis)|clinician|doctor/i.test(content)) content += "\n\n_SanoAI shares general health information, not a diagnosis. Please discuss concerns with a clinician._";
  } else {
    ai = r.meta;
    fups = followUps(hits, hasRecords, message);
    if (hits.length) content = composeFromKb(hits, byEntry, recordLines);
    else {
      content =
        "I couldn't find reliable reference material for that in SanoAI's library, so I don't want to guess.\n\n" +
        "**What I can do**\n- Explain common conditions, tests, nutrients and lifestyle topics with cited sources\n- Summarise and organise the records you've uploaded\n- Point out information that may be missing from your records\n\n" +
        "For this question, a clinician or pharmacist is the best source. If you tell me more, or rephrase it, I'll try again.";
      usedCitations = [];
    }
    if (inp.useRecords && !hasRecords && RECORD_Q.test(message)) content += "\n\n_You haven't uploaded any records yet — add some in [My Medical Records](/records) and I can answer questions about them._";
  }

  if (tri.level === "urgent") content = `> **${tri.message}**\n\n${content}`;
  return {
    content,
    meta: { ai, citations: usedCitations, followUps: fups, safety: tri.level === "urgent" ? { level: "urgent", message: tri.message } : null, uncertainty: unsureBlock, modules, usedRecords: hasRecords && recordLines.length > 0 },
  };
}

async function demoMetaFor(userId: string): Promise<AiMeta> {
  return (await demoMeta(userId));
}

export const sourceToCitation = (s: SourceRef, n: number): ChatCitation => ({ n, sourceId: s.id, title: s.title, publisher: s.publisher, url: s.url });
