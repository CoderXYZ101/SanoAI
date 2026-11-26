import { KB, type KbEntry } from "./kb";
import { sourcesFor } from "./sources";
import type { SourceRef } from "../types";

/**
 * Retrieval for RAG: BM25 over the curated knowledge base (in-process, no external vector DB).
 * Replaceable: swap `retrieve()` for an embedding / vector-store implementation without
 * touching the engines that consume `Retrieved`.
 */

const STOP = new Set(
  "a an and are as at be but by can could do does for from had has have how i if in into is it its me my of on or our should so than that the their them then there these they this to was we were what when where which who why will with would you your about am been being just not no any some very".split(
    " ",
  ),
);

/**
 * Words found in many health questions that say nothing about the topic. Matching only these is NOT relevance
 * (otherwise "too much oily food" matches vitamin D, because that entry mentions oily fish and "too much").
 */
const GENERIC_WORDS =
  "side effect much many too more less eat eating food foods drink drinking high low normal level levels cause causes symptom symptoms sign signs test tests result results report read reading health healthy body day daily get getting feel feeling make take taking help tell know thing bad good risk problem happen long time often blood pain disease chronic function condition treatment doctor vitamin persistent fast energy study example";

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}
function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

interface Doc {
  entry: KbEntry;
  tf: Map<string, number>;
  len: number;
  /** Topic words: from the title and one-word aliases. */
  anchors: Set<string>;
  /** Aliases matched as whole phrases. */
  phrases: RegExp[];
}

let generic: Set<string> | null = null;
const isGeneric = (token: string) => (generic ??= new Set(tokenize(GENERIC_WORDS))).has(token);
const phrase = (alias: string) => new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?($|[^a-z0-9])`);

function build(): { docs: Doc[]; df: Map<string, number>; avg: number } {
  const docs: Doc[] = KB.map((entry) => {
    const weighted: string[] = [];
    const add = (text: string, w: number) => {
      const toks = tokenize(text);
      for (let i = 0; i < w; i++) weighted.push(...toks);
    };
    add(entry.title, 4);
    add(entry.aliases.join(" "), 5);
    add(entry.summary, 2);
    add(entry.facts.map((f) => f.text).join(" "), 1);
    add(entry.causes.join(" "), 1);
    add(entry.redFlags.join(" "), 1);
    const tf = new Map<string, number>();
    weighted.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    const single = entry.aliases.filter((a) => !a.includes(" "));
    const anchors = new Set(tokenize([entry.title, ...single].join(" ")).filter((t) => !isGeneric(t)));
    // a one-word alias that is a generic word ("high", "low") never identifies a topic by itself
    const phrases = entry.aliases.filter((a) => a.includes(" ") || tokenize(a).some((t) => !isGeneric(t))).map(phrase);
    return { entry, tf, len: weighted.length, anchors, phrases };
  });
  const df = new Map<string, number>();
  docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const avg = docs.reduce((n, d) => n + d.len, 0) / docs.length;
  return { docs, df, avg };
}

let INDEX: ReturnType<typeof build> | null = null;

export interface Retrieved {
  entry: KbEntry;
  score: number;
  sources: SourceRef[];
}

export function retrieve(query: string, k = 4, minScore = 1.2): Retrieved[] {
  INDEX ??= build();
  const { docs, df, avg } = INDEX;
  const q = tokenize(query);
  if (!q.length) return [];
  const N = docs.length;
  const k1 = 1.4;
  const b = 0.75;
  const lowerQuery = query.toLowerCase();
  const scored = docs.map((d) => {
    let score = 0;
    for (const t of new Set(q)) {
      const f = d.tf.get(t) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avg)));
    }
    // Exact alias phrase boost
    const named = d.phrases.filter((re) => re.test(lowerQuery)).length;
    score += 3 * named;
    const onTopic = named > 0 || q.some((t) => d.anchors.has(t));
    return { entry: d.entry, score: onTopic ? score : 0, sources: sourcesFor(d.entry.sourceIds) };
  });
  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k);
}

/** Look up entries by id (for engines that already know the topic). */
export function byIds(ids: string[]): Retrieved[] {
  return KB.filter((e) => ids.includes(e.id)).map((entry) => ({ entry, score: 99, sources: sourcesFor(entry.sourceIds) }));
}
