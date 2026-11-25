import type { DateCertainty } from "../types";

/**
 * Deterministic date parser. It NEVER guesses: ambiguous numeric dates (e.g. 03/04/2024)
 * and partial dates (e.g. "March 2024") are returned with an explicit certainty marker.
 */
export interface ParsedDate {
  iso: string; // yyyy-mm-dd or yyyy-mm
  certainty: DateCertainty;
  raw: string;
  index: number;
  end: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const pad = (n: number) => String(n).padStart(2, "0");
const validDay = (y: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const sane = (y: number) => y >= 1900 && y <= 2100;

export function findDates(text: string): ParsedDate[] {
  const out: ParsedDate[] = [];
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => !taken.some(([s, e]) => a < e && b > s);
  const push = (p: ParsedDate) => {
    if (free(p.index, p.end)) {
      taken.push([p.index, p.end]);
      out.push(p);
    }
  };

  // 1) ISO yyyy-mm-dd
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (sane(y) && validDay(y, mo, d)) push({ iso: `${y}-${pad(mo)}-${pad(d)}`, certainty: "explicit", raw: m[0], index: m.index!, end: m.index! + m[0].length });
  }
  // 2) 12 March 2024 / 12-Mar-2024 / 12th March, 2024
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/,.]*${MON}\\.?[\\s\\-/,.]*(\\d{4})\\b`, "gi"))) {
    const [d, mo, y] = [+m[1], MONTHS[m[2].toLowerCase()], +m[3]];
    if (sane(y) && validDay(y, mo, d)) push({ iso: `${y}-${pad(mo)}-${pad(d)}`, certainty: "explicit", raw: m[0], index: m.index!, end: m.index! + m[0].length });
  }
  // 3) March 12, 2024
  for (const m of text.matchAll(new RegExp(`\\b${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"))) {
    const [mo, d, y] = [MONTHS[m[1].toLowerCase()], +m[2], +m[3]];
    if (sane(y) && validDay(y, mo, d)) push({ iso: `${y}-${pad(mo)}-${pad(d)}`, certainty: "explicit", raw: m[0], index: m.index!, end: m.index! + m[0].length });
  }
  // 4) numeric d/m/y or m/d/y — ambiguity is surfaced, never resolved silently
  for (const m of text.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})\b/g)) {
    const a = +m[1];
    const b = +m[2];
    let y = +m[3];
    const twoDigit = m[3].length === 2;
    if (twoDigit) y += 2000;
    let day: number;
    let mon: number;
    let certainty: DateCertainty = "explicit";
    if (a > 12 && b <= 12) {
      day = a;
      mon = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      mon = a;
    } else if (a === b) {
      day = a;
      mon = b;
    } else {
      // both ≤ 12 and different → genuinely ambiguous; interpret day-first but flag it
      day = a;
      mon = b;
      certainty = "ambiguous";
    }
    if (twoDigit && certainty === "explicit") certainty = "ambiguous";
    if (sane(y) && validDay(y, mon, day)) push({ iso: `${y}-${pad(mon)}-${pad(day)}`, certainty, raw: m[0], index: m.index!, end: m.index! + m[0].length });
  }
  // 5) March 2024 (partial)
  for (const m of text.matchAll(new RegExp(`\\b${MON}\\.?\\s*,?\\s+(\\d{4})\\b`, "gi"))) {
    const [mo, y] = [MONTHS[m[1].toLowerCase()], +m[2]];
    if (sane(y)) push({ iso: `${y}-${pad(mo)}`, certainty: "partial", raw: m[0], index: m.index!, end: m.index! + m[0].length });
  }
  return out.sort((a, b) => a.index - b.index);
}

export const firstDate = (text: string) => findDates(text)[0] ?? null;

/** Blank out date substrings so numbers inside dates are not mistaken for lab values / ranges. */
export function maskDates(text: string): string {
  let t = text;
  for (const d of findDates(text).sort((a, b) => b.index - a.index)) {
    t = t.slice(0, d.index) + " ".repeat(d.end - d.index) + t.slice(d.end);
  }
  return t;
}

export function formatDate(iso: string | null, opts: { short?: boolean } = {}): string {
  if (!iso) return "Date not found";
  const [y, m, d] = iso.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!m) return String(y);
  if (!d) return `${names[m - 1]} ${y}`;
  return opts.short ? `${d} ${names[m - 1]} ${y}` : `${d} ${names[m - 1]} ${y}`;
}

/** Sort key: ISO strings compare lexicographically; partial dates sort at the start of their month. */
export const sortKey = (iso: string | null) => (iso ? (iso.length === 7 ? `${iso}-00` : iso) : "9999-99-99");
