import { DRUGS, findDrug, type DrugDef } from "../knowledge/drugs";
import { maskDates, findDates } from "./dates";

/**
 * Pharmacy Connector helpers. Deliberately non-prescriptive:
 *  - never recommends a medicine, dose or substitute
 *  - never claims stock (no live pharmacy data is connected)
 *  - prescription-only items require the user to confirm they hold a valid prescription
 */

export interface MedicineInfo {
  generic: string;
  brands: string[];
  drugClass: string;
  rx: boolean;
  usedFor: string;
  generalNotes: string[];
  links: { label: string; url: string }[];
}

const links = (q: string) => [
  { label: "Jan Aushadhi generic stores (Govt of India)", url: "https://janaushadhi.gov.in/" },
  { label: "MedlinePlus drug information", url: `https://medlineplus.gov/druginformation.html` },
];
const toInfo = (d: DrugDef): MedicineInfo => ({ generic: d.generic, brands: d.brands, drugClass: d.drugClass, rx: d.rx, usedFor: d.usedFor, generalNotes: d.generalNotes, links: links(d.generic) });

export function searchMedicines(query: string): MedicineInfo[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const exact = findDrug(q);
  const partial = DRUGS.filter((d) => d.generic.includes(q) || d.brands.some((b) => b.includes(q)) || d.drugClass.toLowerCase().includes(q));
  const all = [...(exact ? [exact.def] : []), ...partial].filter((d, i, a) => a.indexOf(d) === i);
  return all.slice(0, 8).map(toInfo);
}

// ─────────── label reader ───────────
const GLOSSARY: Record<string, string> = {
  od: "Once daily (as written on the label — follow the prescriber's instruction)",
  qd: "Once daily",
  bd: "Twice daily",
  bid: "Twice daily",
  tds: "Three times daily",
  tid: "Three times daily",
  qid: "Four times daily",
  prn: "As needed",
  sos: "If required / as needed",
  hs: "At bedtime",
  ac: "Before meals",
  pc: "After meals",
  po: "By mouth",
  tab: "Tablet",
  cap: "Capsule",
  syp: "Syrup",
  inj: "Injection",
  mg: "Milligram (a unit of weight)",
  mcg: "Microgram (1/1000 of a milligram)",
  "µg": "Microgram",
  ml: "Millilitre (a unit of volume)",
  iu: "International unit",
  exp: "Expiry date",
  "rx": "Prescription",
};

export interface LabelReading {
  medicine: { name: string; generic: string | null; drugClass: string | null; rxOnly: boolean | null } | null;
  strength: string | null;
  form: string | null;
  directions: string[];
  warnings: string[];
  expiry: { text: string; date: string | null } | null;
  batch: string | null;
  quantity: string | null;
  glossary: { term: string; meaning: string }[];
  notes: string[];
}

export function readLabel(text: string): LabelReading {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const hit = findDrug(text);
  const strength = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|iu|ml)\b(?:\s*\/\s*\d*\s*(?:ml|tablet|capsule|5ml))?/i.exec(text);
  const form = /\b(tablets?|capsules?|syrup|suspension|injection|cream|ointment|drops|inhaler|gel|sachets?)\b/i.exec(text);
  const directions = lines.filter((l) => /^(take|use|apply|directions?|dosage|sig|inhale|instil|swallow|dissolve)\b/i.test(l) || /\b(once|twice|three times|every \d+ hours|daily|at night|with (food|meals)|before (food|meals)|after (food|meals))\b/i.test(l)).slice(0, 5);
  const warnings = lines.filter((l) => /\b(warning|caution|do not|avoid|keep out of reach|not for|may cause|drowsiness|alcohol|pregnan|driving)\b/i.test(l)).slice(0, 6);
  const expLine = lines.find((l) => /\b(exp(iry|\.|ires)?|use by|best before)\b/i.test(l));
  const expDate = expLine ? findDates(maskDates(" ") + expLine)[0] ?? findDates(expLine)[0] : null;
  const batch = /\b(batch|lot|b\.?\s*no\.?)\s*[:#]?\s*([A-Z0-9-]{3,})/i.exec(text);
  const qty = /\b(\d+)\s*(tablets?|capsules?|ml|sachets?)\b/i.exec(text);
  const rxOnly = /\b(rx only|prescription only|schedule h|only on (the )?prescription)\b/i.test(text) ? true : hit ? hit.def.rx : null;

  const tokens = new Set((text.toLowerCase().match(/[a-zµ]+/g) ?? []).filter((t) => t in GLOSSARY));
  const glossary = [...tokens].map((term) => ({ term: term.toUpperCase(), meaning: GLOSSARY[term] }));

  const notes = [
    "SanoAI explains the words on a label; it does not tell you how much to take. Follow the instructions given by your prescriber or pharmacist.",
    "If the label is unclear, or differs from what your doctor told you, ask your pharmacist before taking the medicine.",
  ];
  if (rxOnly) notes.push("This medicine is normally dispensed only with a valid prescription.");
  if (hit?.def.generalNotes.length) hit.def.generalNotes.forEach((n) => notes.push(n));

  return {
    medicine: hit ? { name: hit.matched, generic: hit.def.generic, drugClass: hit.def.drugClass, rxOnly } : null,
    strength: strength ? strength[0] : null,
    form: form ? form[1] : null,
    directions,
    warnings,
    expiry: expLine ? { text: expLine, date: expDate ? expDate.iso : null } : null,
    batch: batch ? batch[2] : null,
    quantity: qty ? qty[0] : null,
    glossary,
    notes,
  };
}

// ─────────── enquiry builder ───────────
export interface EnquiryItem {
  name: string;
  strength?: string;
  quantity?: string;
}
export function composeEnquiry(opts: { pharmacyName: string; items: EnquiryItem[]; hasPrescription: boolean; allergies: string[]; userName: string }): { message: string; rxItems: string[] } {
  const rxItems = opts.items.filter((i) => findDrug(i.name)?.def.rx).map((i) => i.name);
  const lines = [
    `Hello ${opts.pharmacyName},`,
    "",
    "I would like to check whether the following are currently available and how I can collect them:",
    ...opts.items.map((i) => `• ${i.name}${i.strength ? ` ${i.strength}` : ""}${i.quantity ? ` — quantity: ${i.quantity}` : ""}`),
    "",
  ];
  if (rxItems.length) lines.push(`Prescription-only item(s): ${rxItems.join(", ")}. ${opts.hasPrescription ? "I have a valid prescription and will present it." : ""}`.trim(), "");
  if (opts.allergies.length) lines.push(`Allergies (shared with my consent): ${opts.allergies.join(", ")}.`, "");
  lines.push("Please let me know about availability, price and opening hours. Thank you.", opts.userName);
  return { message: lines.join("\n"), rxItems };
}
