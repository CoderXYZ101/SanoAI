import { uuid } from "@/lib/uuid";
import { ALIAS_INDEX, BIOMARKER_BY_KEY } from "../knowledge/biomarkers";
import { DRUG_NAME_INDEX } from "../knowledge/drugs";
import type { DateCertainty, DocType, HealthEvent, LabValue, Medication, Specialty } from "../types";
import { findDates, firstDate, maskDates, type ParsedDate } from "./dates";

/**
 * Rule-based extraction engine (always available; no external services).
 * Every event it returns carries a verbatim `sourceQuote` copied from the document,
 * so traceability holds by construction. It never infers dates or values that are not printed.
 */

export interface RawDoc {
  id: string;
  docType: DocType;
  title: string;
  text: string;
}
export interface RuleResult {
  documentDate: { iso: string; certainty: DateCertainty; quote: string } | null;
  events: HealthEvent[];
}

const nid = () => uuid();
const clip = (s: string, n = 400) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const num = (s: string) => parseFloat(s.replace(",", "."));

// ───────────────────────── lab parsing ─────────────────────────

function normaliseForAlias(line: string): string {
  let s = line.toLowerCase();
  s = s.replace(/25\s*[-(]?\s*(?:oh|hydroxy)\)?\s*[-,]?\s*(?:vitamin|vit\.?)\s*d3?/g, "vitamin d");
  s = s.replace(/(?:vitamin|vit\.?)\s*d3?\s*[,(-]?\s*25\s*[-(]?\s*(?:oh|hydroxy)\)?(?:\s*(?:vitamin d|d)\b)?/g, "vitamin d");
  s = s.replace(/hb\s+a1c/g, "hba1c");
  return s;
}

const KNOWN_UNITS = new Set(["fl", "%", "pg", "iu", "mmol", "meq", "u", "g", "mg", "ng", "ug", "mcg", "µg", "μg"]);
const FLAG_WORDS = new Set(["l", "h", "low", "high", "normal", "abnormal", "critical", "hh", "ll", "ref", "range"]);

export function parseLabLine(line: string): LabValue | null {
  const cleaned = line.replace(/[|\t]+/g, "  ");
  const norm = normaliseForAlias(cleaned);
  // find earliest, longest alias with word boundaries within the first 45 chars
  let best: { alias: string; key: string; idx: number; end: number } | null = null;
  for (const { alias, key } of ALIAS_INDEX) {
    const re = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
    const m = re.exec(norm);
    if (!m) continue;
    const idx = m.index + m[1].length;
    if (idx > 45) continue;
    if (!best || idx < best.idx || (idx === best.idx && alias.length > best.alias.length)) best = { alias, key, idx, end: idx + alias.length };
  }
  if (!best) return null;
  const def = BIOMARKER_BY_KEY.get(best.key)!;

  const remainderNorm = norm.slice(best.end);
  let rem = cleaned.slice(cleaned.length - remainderNorm.length);
  // strip descriptor parentheticals / words between name and value
  for (let i = 0; i < 4; i++) {
    const before = rem;
    rem = rem.replace(/^[\s:=\-–|.,]+/, "");
    rem = rem.replace(/^\([A-Za-z0-9 .,/+-]*[A-Za-z][A-Za-z0-9 .,/+-]*\)\s*/, (m) => (/\d/.test(m.replace(/25|b12|d3|a1c|t4|b9/gi, "")) ? m : ""));
    rem = rem.replace(/^(level|levels|serum|total|result|results|value|fasting|calculated|direct|plasma|blood)\b[\s:.-]*/i, "");
    if (rem === before) break;
  }
  const vm = /^([<>≤≥]=?)?\s*(\d+(?:[.,]\d+)?)/.exec(rem);
  if (!vm) return null;
  const value = num(vm[2]);
  const valueText = `${vm[1] ?? ""}${vm[2]}`.trim();
  let after = rem.slice(vm[0].length);

  // unit
  let unit: string | null = null;
  const um = /^\s*([A-Za-zµμ%][A-Za-z0-9µμ%/.^-]{0,11})/.exec(after);
  if (um) {
    const tok = um[1].replace(/[.,;:]+$/, "");
    const lower = tok.toLowerCase();
    if (!FLAG_WORDS.has(lower) && (tok.includes("/") || KNOWN_UNITS.has(lower))) {
      unit = tok;
      after = after.slice(um[0].length);
    }
  } else if (/^\s*%/.test(after)) {
    unit = "%";
    after = after.replace(/^\s*%/, "");
  }

  // reference range (dates masked so 14-02-2024 is not read as a range)
  const refZone = maskDates(after);
  let refLow: number | null = null;
  let refHigh: number | null = null;
  let refText: string | null = null;
  const range = /(\d+(?:[.,]\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?)/.exec(refZone);
  const lt = /(?:<|≤|less than|upto|up to)\s*=?\s*(\d+(?:[.,]\d+)?)/i.exec(refZone);
  const gt = /(?:>|≥|greater than|more than)\s*=?\s*(\d+(?:[.,]\d+)?)/i.exec(refZone);
  if (range) {
    refLow = num(range[1]);
    refHigh = num(range[2]);
    refText = `${range[1]} - ${range[2]}`;
  } else if (lt) {
    refHigh = num(lt[1]);
    refText = `< ${lt[1]}`;
  } else if (gt) {
    refLow = num(gt[1]);
    refText = `> ${gt[1]}`;
  }
  if (refText && unit) refText += ` ${unit}`;
  else if (refText && !unit) refText += "";

  const fm = /(?:^|\s)(LOW|HIGH|HH|LL|L|H|ABNORMAL|CRITICAL|NORMAL)\s*\**\s*$/i.exec(after.trim());
  const labFlag = fm ? fm[1].toUpperCase() : null;

  let flag: LabValue["flag"] = "unknown";
  if (refLow != null || refHigh != null) {
    if (refLow != null && value < refLow) flag = "low";
    else if (refHigh != null && value > refHigh) flag = "high";
    else flag = "normal";
  }
  return { name: def.name, canonical: def.key, value, valueText, unit, refLow, refHigh, refText, flag, labFlag, quote: clip(line.trim(), 300) };
}

// ───────────────────────── vocab ─────────────────────────

interface Sym {
  key: string;
  label: string;
  re: RegExp;
  specialty: Specialty;
}
export const SYMPTOMS: Sym[] = [
  { key: "fatigue", label: "Fatigue / tiredness", re: /\b(fatigue|tired(ness)?|lethargy|lethargic|exhaust(ed|ion)|low energy)\b/i, specialty: "General Medicine" },
  { key: "palpitations", label: "Palpitations", re: /\b(palpitations?|heart racing|racing heart|irregular heart ?beat|fluttering)\b/i, specialty: "Cardiology" },
  { key: "dyspnea", label: "Shortness of breath", re: /\b(short(ness)? of breath|breathless(ness)?|dyspn(o)?ea|difficulty breathing)\b/i, specialty: "Cardiology" },
  { key: "chestpain", label: "Chest pain / discomfort", re: /\bchest (pain|discomfort|tightness|pressure)\b/i, specialty: "Cardiology" },
  { key: "neuropathy", label: "Tingling / numbness", re: /\b(tingling|numbness|pins and needles|par(a)?esthesia|burning (sensation )?(in )?(the )?(feet|hands|toes))\b/i, specialty: "Neurology" },
  { key: "dizziness", label: "Dizziness", re: /\b(dizz(y|iness)|light-?headed(ness)?|vertigo)\b/i, specialty: "Neurology" },
  { key: "headache", label: "Headache", re: /\b(headaches?|migraines?)\b/i, specialty: "Neurology" },
  { key: "gi", label: "Digestive symptoms", re: /\b(bloating|diarrh(o)?ea|constipation|abdominal pain|stomach pain|nausea|vomiting|heartburn|acid reflux|indigestion)\b/i, specialty: "Gastroenterology" },
  { key: "weight", label: "Weight change", re: /\b(weight (loss|gain)|lost weight|gained weight)\b/i, specialty: "Endocrinology" },
  { key: "cold", label: "Cold intolerance", re: /\b(cold intolerance|feeling cold|always cold|intolerance to cold)\b/i, specialty: "Endocrinology" },
  { key: "hair", label: "Hair loss / thinning", re: /\bhair (loss|thinning|fall)\b/i, specialty: "General Medicine" },
  { key: "bone", label: "Bone / muscle / joint pain", re: /\b(bone pain|joint pain|muscle pain|muscle weakness|muscle cramps?|myalgia)\b/i, specialty: "General Medicine" },
  { key: "thirst", label: "Excess thirst / urination", re: /\b(excess(ive)? thirst|increased thirst|polydipsia|frequent urination|polyuria)\b/i, specialty: "Endocrinology" },
  { key: "vision", label: "Blurred vision", re: /\bblurred vision\b/i, specialty: "General Medicine" },
  { key: "insomnia", label: "Poor sleep", re: /\b(insomnia|poor sleep|difficulty sleeping|trouble sleeping)\b/i, specialty: "General Medicine" },
  { key: "mood", label: "Low mood / anxiety", re: /\b(low mood|anxiety|anxious|depress(ed|ion))\b/i, specialty: "General Medicine" },
];

export interface DxDef {
  key: string;
  label: string;
  re: RegExp;
  specialty: Specialty;
}
export const DIAGNOSES: DxDef[] = [
  { key: "diabetes", label: "Type 2 diabetes", re: /\b(type\s*2 diabetes|t2dm|diabetes mellitus|diabetes|prediabetes|pre-diabetes)\b/i, specialty: "Endocrinology" },
  { key: "hypertension", label: "Hypertension", re: /\b(hypertension|high blood pressure|elevated blood pressure|raised blood pressure)\b/i, specialty: "Cardiology" },
  { key: "hypothyroid", label: "Hypothyroidism", re: /\b(hypothyroid(ism)?|underactive thyroid|subclinical hypothyroid)\b/i, specialty: "Endocrinology" },
  { key: "iron_deficiency", label: "Iron-deficiency anaemia", re: /\biron[- ]deficiency( an(a)?emia)?\b/i, specialty: "Haematology" },
  { key: "anemia", label: "Anaemia", re: /\ban(a)?emia\b/i, specialty: "Haematology" },
  { key: "dyslipidemia", label: "Dyslipidaemia", re: /\b(dyslipid(a)?emia|hyperlipid(a)?emia|high cholesterol|hypercholesterol(a)?emia)\b/i, specialty: "Cardiology" },
  { key: "gerd", label: "GERD / acid reflux", re: /\b(gerd|gastro-?oesophageal reflux|gastro-?esophageal reflux|acid reflux)\b/i, specialty: "Gastroenterology" },
  { key: "ibs", label: "Irritable bowel syndrome", re: /\b(ibs|irritable bowel)\b/i, specialty: "Gastroenterology" },
  { key: "celiac", label: "Coeliac disease", re: /\b(coeliac|celiac)\b/i, specialty: "Gastroenterology" },
  { key: "ckd", label: "Chronic kidney disease", re: /\b(ckd|chronic kidney disease)\b/i, specialty: "Nephrology" },
  { key: "asthma", label: "Asthma", re: /\basthma\b/i, specialty: "General Medicine" },
  { key: "migraine", label: "Migraine", re: /\bmigraine\b/i, specialty: "Neurology" },
  { key: "osteoporosis", label: "Osteoporosis", re: /\bosteopor(o|e)sis\b/i, specialty: "Endocrinology" },
  { key: "af", label: "Atrial fibrillation", re: /\b(atrial fibrillation|a-?fib)\b/i, specialty: "Cardiology" },
  { key: "cad", label: "Coronary artery disease", re: /\b(coronary artery disease|cad|angina|ischa?emic heart)\b/i, specialty: "Cardiology" },
];

const PROCEDURES: { re: RegExp; label: string; category: "imaging" | "procedure"; specialty: Specialty }[] = [
  { re: /\b(ecg|ekg|electrocardiogram)\b/i, label: "ECG", category: "procedure", specialty: "Cardiology" },
  { re: /\bholter\b/i, label: "Holter monitoring", category: "procedure", specialty: "Cardiology" },
  { re: /\b(echocardiogram|echo\b|2d echo)/i, label: "Echocardiogram", category: "imaging", specialty: "Cardiology" },
  { re: /\b(stress test|tmt|treadmill test)\b/i, label: "Exercise stress test", category: "procedure", specialty: "Cardiology" },
  { re: /\b(ultrasound|ultrasonography|usg)\b/i, label: "Ultrasound", category: "imaging", specialty: "General Medicine" },
  { re: /\b(chest )?x-?ray\b/i, label: "X-ray", category: "imaging", specialty: "General Medicine" },
  { re: /\bmri\b/i, label: "MRI", category: "imaging", specialty: "General Medicine" },
  { re: /\bct (scan|abdomen|chest|head)\b/i, label: "CT scan", category: "imaging", specialty: "General Medicine" },
  { re: /\b(endoscopy|gastroscopy|colonoscopy)\b/i, label: "Endoscopy", category: "procedure", specialty: "Gastroenterology" },
];

const SPECIALTY_HEADERS: [RegExp, Specialty][] = [
  [/cardiolog/i, "Cardiology"],
  [/endocrin|diabet/i, "Endocrinology"],
  [/neurolog/i, "Neurology"],
  [/gastro|hepatolog/i, "Gastroenterology"],
  [/nutrition|dietetic|dietitian/i, "Nutrition"],
  [/haematolog|hematolog/i, "Haematology"],
  [/nephrolog|renal/i, "Nephrology"],
  [/general (medicine|practice|physician)|\bgp\b|family medicine|internal medicine|primary care/i, "General Medicine"],
];

const PLANNED = /\b(advis(ed|e)|recommend(ed)?|plan(ned)?|refer(red|ral)?|to be (done|arranged)|schedule(d)?|suggest(ed)?|requested|awaiting|pending|will (be|need)|follow[- ]?up)\b/i;
const NEGATION = /\b(no|denies|denied|without|nil|negative for|absence of|not (had|have|having|report(ed)?))\b/i;
const INSTRUCTION = /\b(if (you|symptoms|pain)|should (you|symptoms)|return (if|to)|seek (urgent|medical|emergency)|call (an? )?(ambulance|doctor|emergency)|precaution|warning signs?|red flag|counsel(l)?ing)\b/i;
const FAMILY = /\bfamily (history|h\/o)\b|\b(mother|father|sibling|brother|sister|parent)s?\b[^.]{0,30}\b(had|has|with|history)\b/i;

// ───────────────────────── helpers ─────────────────────────

function inferSpecialtyFromDoc(text: string, fallback: Specialty = "General Medicine"): Specialty {
  const head = text.split("\n").slice(0, 12).join(" ");
  for (const [re, sp] of SPECIALTY_HEADERS) if (re.test(head)) return sp;
  return fallback;
}

function eventDate(
  lineDates: ParsedDate[],
  doc: RuleResult["documentDate"],
): { date: string | null; dateCertainty: DateCertainty } {
  if (lineDates.length) return { date: lineDates[0].iso, dateCertainty: lineDates[0].certainty };
  if (doc) {
    const c: DateCertainty = doc.certainty === "explicit" ? "document" : doc.certainty;
    return { date: doc.iso, dateCertainty: c };
  }
  return { date: null, dateCertainty: "missing" };
}

const DATE_LABELS: { re: RegExp; priority: number }[] = [
  { re: /\b(sample (collected|collection|date)|collected( on)?|collection date|specimen (collected|date))\b/i, priority: 1 },
  { re: /\b(consultation date|date of consultation|visit date|date of visit|date of (clinic )?visit|seen on)\b/i, priority: 1 },
  { re: /\bdate of discharge\b|\bdischarge date\b/i, priority: 2 },
  { re: /\b(report(ed)? date|date of report|date reported|reported on)\b/i, priority: 3 },
  { re: /\b(date issued|issue date|prescription date|prescribed on|date of prescription)\b/i, priority: 3 },
  { re: /^\s*date\s*[:\-]/i, priority: 4 },
];

function findDocumentDate(lines: string[]): RuleResult["documentDate"] {
  let best: { p: number; iso: string; certainty: DateCertainty; quote: string } | null = null;
  for (const l of lines) {
    for (const { re, priority } of DATE_LABELS) {
      if (re.test(l)) {
        const d = firstDate(l);
        if (d && (!best || priority < best.p)) best = { p: priority, iso: d.iso, certainty: d.certainty, quote: l.trim() };
        break;
      }
    }
  }
  if (best) return { iso: best.iso, certainty: best.certainty, quote: clip(best.quote, 200) };
  for (const l of lines.slice(0, 10)) {
    const d = firstDate(l);
    if (d) return { iso: d.iso, certainty: d.certainty === "explicit" ? "unlabeled" : d.certainty, quote: clip(l.trim(), 200) };
  }
  return null;
}

const FREQ_RE =
  /\b(once|twice|thrice)\s+(?:a\s+|per\s+)?(daily|day|week|weekly)\b|\b(three|four)\s+times\s+(?:a\s+|per\s+)?(day|daily)\b|\b(\d)\s*(?:times|x)\s*(?:a\s+|per\s+)?(day|daily|week)\b|\b(od|bd|bid|tds|tid|qid|qd|hs|prn|nocte|mane)\b|\b(daily|weekly|every (?:morning|night|evening|\d+ hours))\b|\bat (night|bedtime)\b/i;
const DOSE_RE = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|μg|g|iu|ml|units?)\b/i;
const STOPPED_RE = /\b(discontinu(ed|e)|stopp(ed|ing)|ceas(ed|e)|withdrawn|no longer|previously|was on|used to take)\b/i;

function findMedication(line: string): Medication | null {
  for (const { name, def } of DRUG_NAME_INDEX) {
    const re = new RegExp(`(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
    const m = re.exec(line);
    if (!m) continue;
    const after = line.slice(m.index + m[1].length + name.length);
    const dose = DOSE_RE.exec(after);
    const freq = FREQ_RE.exec(after);
    const stopped = STOPPED_RE.test(line);
    return {
      name: name === def.generic ? def.generic : `${name} (${def.generic})`,
      generic: def.generic,
      drugClass: def.drugClass,
      dose: dose ? `${dose[1]} ${dose[2].toLowerCase()}` : null,
      frequency: freq ? freq[0].trim() : null,
      status: stopped ? "stopped" : "active",
    };
  }
  return null;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ───────────────────────── main ─────────────────────────

export function extractWithRules(doc: RawDoc): RuleResult {
  // safety caps: keep one document's extraction well inside database document limits
  const rawLines = doc.text.slice(0, 400_000).replace(/\r/g, "").split("\n");
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
  const documentDate = findDocumentDate(lines);
  const events: HealthEvent[] = [];
  const base = (e: Partial<HealthEvent> & Pick<HealthEvent, "category" | "title" | "sourceQuote">): HealthEvent => ({
    id: nid(),
    docId: doc.id,
    date: null,
    dateCertainty: "missing",
    specialty: "General Medicine",
    details: "",
    values: [],
    medication: null,
    confidence: "high",
    method: "rules",
    userEdited: false,
    ...e,
    sourceQuote: clip(e.sourceQuote),
  });

  const docSpecialty = inferSpecialtyFromDoc(doc.text);
  const consumed = new Set<number>();

  // ── labs ──
  const labs: { v: LabValue; lineDates: ParsedDate[] }[] = [];
  lines.forEach((l, i) => {
    if (/^(patient|name|age|sex|ref(erred)?|doctor|dr\.?)\b/i.test(l)) return;
    const v = parseLabLine(l);
    if (v) {
      labs.push({ v, lineDates: findDates(l) });
      consumed.add(i);
    }
  });
  if (labs.length > 300) labs.length = 300; // a real report never has more; protects storage limits
  if (labs.length) {
    // one event per distinct date (usually exactly one per report)
    const groups = new Map<string, { date: string | null; certainty: DateCertainty; vals: LabValue[] }>();
    for (const { v, lineDates } of labs) {
      const ed = eventDate(lineDates, documentDate);
      const k = ed.date ?? "none";
      const g = groups.get(k) ?? { date: ed.date, certainty: ed.dateCertainty, vals: [] };
      g.vals.push(v);
      groups.set(k, g);
    }
    for (const g of groups.values()) {
      const abnormal = g.vals.filter((v) => v.flag === "low" || v.flag === "high");
      const noRef = g.vals.filter((v) => v.flag === "unknown").length;
      const first = abnormal[0] ?? g.vals[0];
      events.push(
        base({
          category: "lab",
          title: `Laboratory results (${g.vals.length} measurement${g.vals.length === 1 ? "" : "s"})`,
          date: g.date,
          dateCertainty: g.certainty,
          specialty: "General Medicine",
          details: `${abnormal.length} outside the lab's stated range${noRef ? `; ${noRef} without a stated range` : ""}.`,
          values: g.vals,
          sourceQuote: first.quote ?? first.name,
          confidence: noRef ? "medium" : "high",
        }),
      );
    }
  }

  // ── allergies ──
  lines.forEach((l, i) => {
    if (consumed.has(i)) return;
    const m = /^(?:known |drug )?allerg(?:y|ies)\s*[:\-–]\s*(.+)$/i.exec(l);
    if (m) {
      consumed.add(i);
      const txt = m[1].trim();
      const none = /^(nil|none|nka|nkda|no known)/i.test(txt);
      events.push(base({ category: "allergy", title: none ? "No known drug allergies (as recorded)" : `Allergy: ${txt}`, ...eventDate(findDates(l), documentDate), details: l, sourceQuote: l }));
    } else if (/\bnkda\b/i.test(l)) {
      consumed.add(i);
      events.push(base({ category: "allergy", title: "No known drug allergies (as recorded)", ...eventDate([], documentDate), details: l, sourceQuote: l }));
    }
  });

  // ── visits / admissions ──
  if (doc.docType === "consultation" || doc.docType === "discharge") {
    const headerLine = lines.slice(0, 8).find((l) => /(consultation|clinic|discharge summary|department|hospital|summary)/i.test(l)) ?? lines[0] ?? doc.title;
    if (doc.docType === "discharge") {
      const adm = lines.find((l) => /date of admission|admission date|admitted on/i.test(l));
      const dis = lines.find((l) => /date of discharge|discharge date|discharged on/i.test(l));
      const admD = adm ? findDates(adm)[0] : null;
      const disD = dis ? findDates(dis)[0] : null;
      if (admD) events.push(base({ category: "visit", title: "Hospital admission", date: admD.iso, dateCertainty: admD.certainty, specialty: docSpecialty, details: clip(adm!, 200), sourceQuote: adm! }));
      if (disD) events.push(base({ category: "visit", title: "Hospital discharge", date: disD.iso, dateCertainty: disD.certainty, specialty: docSpecialty, details: clip(dis!, 200), sourceQuote: dis! }));
      if (!admD && !disD) events.push(base({ category: "visit", title: "Hospital stay / discharge summary", ...eventDate([], documentDate), specialty: docSpecialty, details: "", sourceQuote: headerLine }));
    } else {
      const label = docSpecialty === "General Medicine" ? "Consultation" : `${docSpecialty} consultation`;
      events.push(base({ category: "visit", title: label, ...eventDate([], documentDate), specialty: docSpecialty, details: clip(headerLine, 200), sourceQuote: headerLine }));
    }
  }

  // ── vitals (blood pressure) ──
  lines.forEach((l, i) => {
    if (consumed.has(i)) return;
    const m = /\b(?:bp|blood pressure)\b[^0-9]{0,15}(\d{2,3})\s*\/\s*(\d{2,3})/i.exec(l);
    if (m) {
      consumed.add(i);
      events.push(base({ category: "other", title: `Blood pressure reading: ${m[1]}/${m[2]} mmHg`, ...eventDate(findDates(l), documentDate), specialty: "Cardiology", details: l, sourceQuote: l }));
    }
  });

  // ── diagnoses ──
  const DX_HEADER = /^(?:final |provisional |working |primary |secondary |discharge |clinical )?(diagnos[ie]s|impression|assessment|dx|problem list|known case of|diagnosed with|past (?:medical )?history|pmh|history of|h\/o)\s*[:\-–]?\s*(.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const m = DX_HEADER.exec(lines[i]);
    if (!m || FAMILY.test(lines[i])) continue;
    const items: { text: string; quote: string }[] = [];
    if (m[2].trim()) m[2].split(/;|\.(?:\s+|$)/).forEach((t) => t.trim() && items.push({ text: t.trim(), quote: lines[i] }));
    let j = i + 1;
    while (j < lines.length && /^\s*(\d+[.)]|[-•*])\s+/.test(lines[j])) {
      items.push({ text: lines[j].replace(/^\s*(\d+[.)]|[-•*])\s+/, "").trim(), quote: lines[j] });
      consumed.add(j);
      j++;
    }
    consumed.add(i);
    for (const it of items) {
      if (!/allerg/i.test(it.text) && /\b(no|not on|nil|none)\b[^.]{0,30}\b(regular )?(medication|medicine|drugs?|tablets)\b/i.test(it.text)) {
        events.push(base({ category: "medication", title: "No regular medication reported", ...eventDate(findDates(it.quote), documentDate), details: "Recorded as no regular medication in this document.", sourceQuote: it.quote }));
        continue;
      }
      const negated = /^(no|nil|denies|not)\b/i.test(it.text) || /\bno known\b/i.test(it.text);
      const dx = DIAGNOSES.find((d) => d.re.test(it.text));
      const sp = dx?.specialty ?? docSpecialty;
      events.push(
        base({
          category: "diagnosis",
          title: negated ? `${titleCase(it.text)} (as recorded)` : titleCase(clip(it.text, 140)),
          ...eventDate(findDates(it.quote), documentDate),
          specialty: sp,
          details: negated ? "Recorded as absent/denied in this document." : it.quote === it.text ? "" : clip(it.quote, 300),
          sourceQuote: it.quote,
          confidence: dx || negated ? "high" : "medium",
        }),
      );
    }
  }

  // ── procedures / imaging (performed vs advised) ──
  lines.forEach((l, i) => {
    if (consumed.has(i) || FAMILY.test(l)) return;
    const pr = PROCEDURES.find((p) => p.re.test(l));
    if (!pr) return;
    const planned = PLANNED.test(l);
    consumed.add(i);
    if (planned) {
      events.push(base({ category: "other", title: `Advised / planned: ${pr.label}`, ...eventDate([], documentDate), specialty: pr.specialty, details: "A result for this was not found in this document.", sourceQuote: l }));
    } else {
      events.push(base({ category: pr.category, title: pr.label, ...eventDate(findDates(l), documentDate), specialty: pr.specialty, details: l, sourceQuote: l }));
    }
  });

  // ── medications ──
  const medSeen = new Set<string>();
  lines.forEach((l, i) => {
    if (consumed.has(i)) return;
    // "no known drug allergies" is about allergies, not medicines
    if (!/allerg/i.test(l) && /\b(no|not on|nil|none)\b[^.]{0,30}\b(regular )?(medication|medicine|drugs?|tablets)\b/i.test(l)) {
      consumed.add(i);
      events.push(base({ category: "medication", title: "No regular medication reported", ...eventDate(findDates(l), documentDate), details: "Recorded as no regular medication in this document.", sourceQuote: l }));
      return;
    }
    if (/allerg|intoleran/i.test(l) || FAMILY.test(l)) return;
    const med = findMedication(l);
    if (!med) return;
    const key = `${med.generic}:${med.status}`;
    if (medSeen.has(key)) return;
    medSeen.add(key);
    consumed.add(i);
    const ed = eventDate(findDates(l), documentDate);
    events.push(
      base({
        category: "medication",
        title: `${titleCase(med.name)}${med.dose ? ` ${med.dose}` : ""}${med.frequency ? ` — ${med.frequency}` : ""}${med.status === "stopped" ? " (stopped)" : ""}`,
        ...ed,
        specialty: doc.docType === "prescription" ? docSpecialty : "General Medicine",
        details: med.drugClass ?? "",
        medication: med,
        sourceQuote: l,
        confidence: med.dose ? "high" : "medium",
      }),
    );
  });

  // ── symptoms ──
  const symSeen = new Set<string>();
  lines.forEach((l, i) => {
    if (consumed.has(i) || FAMILY.test(l) || INSTRUCTION.test(l) || PLANNED.test(l) && !/complain|present|report|c\/o|symptom/i.test(l)) return;
    for (const s of SYMPTOMS) {
      const m = s.re.exec(l);
      if (!m || symSeen.has(s.key)) continue;
      const pre = l.slice(Math.max(0, m.index - 45), m.index);
      if (NEGATION.test(pre)) continue;
      symSeen.add(s.key);
      events.push(base({ category: "symptom", title: s.label, ...eventDate(findDates(l), documentDate), specialty: s.specialty, details: `Recorded in the document: “${clip(l, 220)}”`, sourceQuote: l, confidence: "medium" }));
    }
  });

  return { documentDate, events: events.slice(0, 400) };
}
