/**
 * Safety layer — runs independently of any LLM.
 *  1. triage():        deterministic red-flag detection → urgent-care guidance
 *  2. guardLanguage(): rejects AI/engine text that diagnoses, blames clinicians,
 *                      or tells users to change prescribed treatment
 */

export interface TriageResult {
  level: "emergency" | "urgent" | "none";
  reasons: string[];
  message: string;
}

const EMERGENCY: { re: RegExp; reason: string }[] = [
  { re: /chest (pain|pressure|tightness)[^.]{0,80}(arm|jaw|back|sweat|short(ness)? of breath|breathless|nausea|faint)/i, reason: "chest pain with other warning features" },
  { re: /(arm|jaw)[^.]{0,40}(pain|numb)[^.]{0,60}chest/i, reason: "chest and arm/jaw symptoms" },
  { re: /(crushing|severe|sudden) chest (pain|pressure)/i, reason: "severe or sudden chest pain" },
  { re: /(can'?t|cannot|unable to) (breathe|get (a )?breath)|struggling to breathe|severe (shortness of breath|breathlessness)/i, reason: "severe difficulty breathing" },
  { re: /(face|facial) (is )?drooping|slurred speech|sudden(ly)? (weak|numb)[^.]{0,30}(one side|arm|leg|face)|can'?t (lift|move) (my|one) (arm|leg)/i, reason: "possible stroke signs" },
  { re: /worst headache (of|in) my life|thunderclap headache/i, reason: "sudden severe headache" },
  { re: /(swelling|tight)[^.]{0,30}(throat|tongue|lips)|anaphyla/i, reason: "possible severe allergic reaction" },
  { re: /(vomit(ing)?|coughing( up)?|cough(ed)?) (up )?blood|black,? tarry (stool|stools)|blood in (my )?(vomit|stool)[^.]{0,20}(heavy|lots)/i, reason: "possible serious bleeding" },
  { re: /(suicid|kill myself|end my life|want to die|self[- ]harm|hurt myself)/i, reason: "thoughts of self-harm" },
  { re: /(loss of|lost) consciousness|passed out|unresponsive|seizure|convulsion/i, reason: "loss of consciousness or seizure" },
  { re: /sudden (loss of|blurred|double) vision|sudden vision loss/i, reason: "sudden vision change" },
  { re: /overdos|took too many (pills|tablets)|poison/i, reason: "possible overdose or poisoning" },
];

const URGENT: { re: RegExp; reason: string }[] = [
  { re: /(high|persistent|fever)[^.]{0,20}(39|40|102|103|104)|fever (of|over) (39|40)/i, reason: "very high fever" },
  { re: /(blood|bleeding) (in|when)[^.]{0,20}(urine|stool|cough)|rectal bleeding/i, reason: "bleeding that should be assessed promptly" },
  { re: /palpitations?[^.]{0,60}(faint|dizzy|chest|short(ness)? of breath)/i, reason: "palpitations with other symptoms" },
  { re: /(severe|intense|unbearable)[^.]{0,20}(abdominal|stomach|belly) pain/i, reason: "severe abdominal pain" },
  { re: /(pregnan)[^.]{0,60}(bleed|severe pain|reduced movement)/i, reason: "pregnancy-related warning sign" },
  { re: /confus(ed|ion)[^.]{0,30}(sudden|new)|sudden(ly)? confus/i, reason: "sudden confusion" },
  { re: /(signs of|symptoms of)[^.]{0,20}(dehydrat)[^.]{0,40}(severe|can'?t keep)/i, reason: "severe dehydration" },
  { re: /(unintentional|unexplained)[^.]{0,30}weight loss/i, reason: "unexplained weight loss" },
];

export function triage(text: string): TriageResult {
  const t = text || "";
  const emergency = EMERGENCY.filter((p) => p.re.test(t)).map((p) => p.reason);
  if (emergency.length) {
    const selfHarm = emergency.includes("thoughts of self-harm");
    return {
      level: "emergency",
      reasons: emergency,
      message: selfHarm
        ? "What you describe matters, and you deserve support right now. In India you can call Tele-MANAS on 14416 (or 1-800-891-4416), the government mental-health helpline, at any time. If you may act on these thoughts or are in immediate danger, call the emergency number 112 or go to the nearest emergency department. If you can, tell someone you trust to stay with you. SanoAI cannot provide crisis care."
        : "Some of what you describe can be a sign of a medical emergency. Please do not wait for an AI answer: call 112 now (or 108 for an ambulance where available) or go to the nearest emergency department. If someone is with you, ask them to help.",
    };
  }
  const urgent = URGENT.filter((p) => p.re.test(t)).map((p) => p.reason);
  if (urgent.length) {
    return {
      level: "urgent",
      reasons: urgent,
      message:
        "This may need prompt medical assessment. Please contact a doctor, an urgent-care service or your local health line today rather than waiting for a routine appointment. If symptoms get worse or you feel unsafe, call 112.",
    };
  }
  return { level: "none", reasons: [], message: "" };
}

// ───────────────────────── Language guard ─────────────────────────

const FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /missed (a |the |your )?diagnos/i, why: "claims a missed diagnosis" },
  { re: /misdiagnos/i, why: "claims misdiagnosis" },
  { re: /(your |the )?(doctor|physician|clinician|gp|specialist)s? (has |have |had )?(made a mistake|got it wrong|was wrong|were wrong|failed to|overlooked|missed)/i, why: "blames a clinician" },
  { re: /\b(i|we) (can )?diagnos(e|ed)\b/i, why: "AI diagnosing" },
  { re: /\byou (definitely |certainly |clearly )?(have|are suffering from|suffer from) (a |an )?(?!no |not |any )(diabetes|anaemia|anemia|hypothyroid|hyperthyroid|cancer|deficiency|disease|infection|condition)/i, why: "states a diagnosis" },
  { re: /\bthis (is|confirms|proves) (a )?(diabetes|anaemia|anemia|hypothyroid|deficiency|cancer)/i, why: "states a diagnosis" },
  { re: /\b(stop|skip|discontinue|double|halve|reduce|increase|lower|raise)\b[^.]{0,25}\b(your|the)\b[^.]{0,25}\b(medication|medicine|tablet|pill|dose|dosage|insulin|metformin|statin)/i, why: "advises changing prescribed treatment" },
  { re: /\b(take|start taking|try)\s+\d+(\.\d+)?\s*(mg|mcg|µg|iu|g)\b/i, why: "recommends a dose" },
  { re: /\bguarantee(d|s)?\b|\b100% (sure|certain|accurate)\b/i, why: "overconfident claim" },
  { re: /\bthis (will|can) cure\b|\bcures?\s+(your|the)\b/i, why: "cure claim" },
];

export interface GuardResult {
  ok: boolean;
  violations: string[];
}

export function guardLanguage(text: string): GuardResult {
  const violations = FORBIDDEN.filter((f) => f.re.test(text)).map((f) => f.why);
  return { ok: violations.length === 0, violations };
}

/** Deep-scan any JSON-serialisable value for forbidden phrasing. */
export function guardValue(value: unknown): GuardResult {
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return guardLanguage(strings.join("\n"));
}

export const STANDARD_LIMITATIONS = [
  "SanoAI is an educational and decision-support tool. It is not a doctor and cannot diagnose, treat or prescribe.",
  "Results depend on the documents you provide and may contain extraction errors — always check them against the original.",
  "Only a qualified clinician who can examine you and see your full history can interpret these findings.",
];
