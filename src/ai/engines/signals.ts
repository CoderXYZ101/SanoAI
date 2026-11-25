import { DRUGS, findDrug } from "../knowledge/drugs";
import type { EvidenceRef, HealthEvent, LabValue } from "../types";
import type { HealthProfile } from "@/lib/repo";
import { sortKey } from "./dates";
import { DIAGNOSES, SYMPTOMS } from "./rules";

/**
 * Converts a user's structured records into "signals" (e.g. lab:low_vitamin_b12, med:metformin,
 * sx:fatigue, dx:hypertension). Signals are the shared vocabulary of the Blind-Spot, Uncertainty
 * and Cross-Specialty engines. Each signal keeps pointers back to the events that produced it.
 */
export class SignalSet {
  private map = new Map<string, EvidenceRef[]>();
  add(signal: string, ref: EvidenceRef) {
    const arr = this.map.get(signal) ?? [];
    if (!arr.some((r) => r.eventId && r.eventId === ref.eventId && r.quote === ref.quote)) arr.push(ref);
    this.map.set(signal, arr);
  }
  has(signal: string) {
    return this.map.has(signal);
  }
  hasAny(signals: string[]) {
    return signals.some((s) => this.map.has(s));
  }
  refs(signals: string | string[]): EvidenceRef[] {
    const list = Array.isArray(signals) ? signals : [signals];
    return list.flatMap((s) => this.map.get(s) ?? []);
  }
  all() {
    return [...this.map.keys()];
  }
}

export interface LabPoint {
  key: string;
  date: string | null;
  value: LabValue;
  event: HealthEvent;
}

/** All lab values across events, sorted by date ascending. */
export function labPoints(events: HealthEvent[]): LabPoint[] {
  const pts: LabPoint[] = [];
  for (const e of events) {
    if (e.category !== "lab") continue;
    for (const v of e.values) if (v.canonical) pts.push({ key: v.canonical, date: e.date, value: v, event: e });
  }
  return pts.sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)));
}

export function latestByKey(events: HealthEvent[]): Map<string, LabPoint> {
  const m = new Map<string, LabPoint>();
  for (const p of labPoints(events)) m.set(p.key, p); // ascending → last wins = most recent
  return m;
}

const isNegatedRecord = (e: HealthEvent) => /\(as recorded\)$/i.test(e.title) || /absent\/denied/i.test(e.details);

export function computeSignals(events: HealthEvent[], profile?: HealthProfile): SignalSet {
  const s = new SignalSet();
  const ref = (e: HealthEvent, quote?: string): EvidenceRef => ({ eventId: e.id, docId: e.docId, quote: quote ?? e.sourceQuote });

  // labs: presence for every value; abnormal flag signals from the MOST RECENT value per marker only
  for (const p of labPoints(events)) s.add(`lab:${p.key}`, ref(p.event, p.value.quote));
  for (const [key, p] of latestByKey(events)) {
    if (p.value.flag === "low") s.add(`lab:low_${key}`, ref(p.event, p.value.quote));
    if (p.value.flag === "high") s.add(`lab:high_${key}`, ref(p.event, p.value.quote));
  }

  for (const e of events) {
    const text = `${e.title} ${e.details}`;
    switch (e.category) {
      case "diagnosis":
        if (!isNegatedRecord(e)) for (const d of DIAGNOSES) if (d.re.test(text)) s.add(`dx:${d.key}`, ref(e));
        break;
      case "medication":
        if (e.medication && e.medication.status !== "stopped") {
          s.add("profile:meds_known", ref(e));
          const def = DRUGS.find((d) => d.generic === e.medication!.generic);
          def?.tags.forEach((t) => s.add(t, ref(e)));
        }
        break;
      case "symptom":
        s.add("sx:any", ref(e));
        for (const sym of SYMPTOMS) if (sym.re.test(text)) s.add(`sx:${sym.key}`, ref(e));
        break;
      case "imaging":
      case "procedure":
        if (/\b(ecg|ekg|electrocardiogram)\b/i.test(text)) s.add("proc:ecg", ref(e));
        if (/\bholter\b/i.test(text)) s.add("proc:holter", ref(e));
        if (/\becho/i.test(text)) s.add("proc:echo", ref(e));
        break;
      case "visit":
        s.add(`visit:${e.specialty.toLowerCase().replace(/\s+/g, "_")}`, ref(e));
        if (e.specialty === "Cardiology") s.add("visit:cardiology", ref(e));
        break;
      case "allergy":
        if (!/no known/i.test(e.title)) {
          if (/penicillin|amoxicillin|ampicillin/i.test(text)) s.add("allergy:penicillin", ref(e));
          s.add("allergy:any", ref(e));
        }
        break;
      case "other": {
        const bp = /blood pressure reading:\s*(\d{2,3})\/(\d{2,3})/i.exec(e.title);
        if (bp) {
          s.add("vital:bp", ref(e));
          if (+bp[1] >= 140 || +bp[2] >= 90) s.add("vital:high_bp", ref(e));
        }
        break;
      }
    }
  }

  if (profile) {
    for (const m of profile.medications) {
      const hit = findDrug(m);
      if (hit) {
        s.add("profile:meds_known", { quote: `Health profile: ${m}` });
        hit.def.tags.forEach((t) => s.add(t, { quote: `Health profile: ${m}` }));
      }
    }
    for (const c of profile.conditions) for (const d of DIAGNOSES) if (d.re.test(c)) s.add(`dx:${d.key}`, { quote: `Health profile: ${c}` });
    for (const a of profile.allergies) if (/penicillin|amoxicillin/i.test(a)) s.add("allergy:penicillin", { quote: `Health profile: ${a}` });
  }
  return s;
}
