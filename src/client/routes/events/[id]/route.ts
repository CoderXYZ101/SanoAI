import { z } from "zod";
import { CATEGORIES, SPECIALTIES, type HealthEvent, type LabValue } from "@/ai/types";
import { ApiError, authed, parseBody } from "@/client/http";
import { getEvent, saveEventEdit, setEventHidden } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

const IsoDate = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, "Use YYYY, YYYY-MM or YYYY-MM-DD");

const ValueEdit = z.object({
  name: z.string().min(1).max(80),
  canonical: z.string().nullable(),
  value: z.number().nullable(),
  valueText: z.string().max(40),
  unit: z.string().max(30).nullable(),
  refLow: z.number().nullable(),
  refHigh: z.number().nullable(),
  refText: z.string().max(60).nullable(),
  flag: z.enum(["low", "high", "normal", "unknown"]),
  labFlag: z.string().max(20).nullable(),
  quote: z.string().max(400).optional(),
});

const Patch = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.enum(CATEGORIES).optional(),
  specialty: z.enum(SPECIALTIES).optional(),
  details: z.string().max(600).optional(),
  date: IsoDate.nullable().optional(),
  values: z.array(ValueEdit).max(60).optional(),
});

/** Flags are ALWAYS recomputed from the stated range after a user edit — never taken on trust. */
const reflag = (v: z.infer<typeof ValueEdit>): LabValue => {
  let flag: LabValue["flag"] = "unknown";
  if (v.value != null && (v.refLow != null || v.refHigh != null)) flag = v.refLow != null && v.value < v.refLow ? "low" : v.refHigh != null && v.value > v.refHigh ? "high" : "normal";
  return { ...v, flag };
};

export const PATCH = authed<Ctx>(async (req, { user, params }) => {
  const { id } = await params;
  const cur = (await getEvent(user.id, id));
  if (!cur) throw new ApiError(404, "Event not found.");
  const p = await parseBody(req, Patch);
  const next: HealthEvent = {
    ...cur.event,
    title: p.title ?? cur.event.title,
    category: p.category ?? cur.event.category,
    specialty: p.specialty ?? cur.event.specialty,
    details: p.details ?? cur.event.details,
    values: p.values ? p.values.map(reflag) : cur.event.values,
    ...(p.date !== undefined ? { date: p.date, dateCertainty: p.date ? ("explicit" as const) : ("missing" as const) } : {}),
    userEdited: true,
  };
  (await saveEventEdit(user.id, next));
  return { event: next };
});

/** "Delete" hides the extracted event (reversible via reset); the source document is untouched. */
export const DELETE = authed<Ctx>(async (_req, { user, params }) => {
  const { id } = await params;
  if (!(await getEvent(user.id, id))) throw new ApiError(404, "Event not found.");
  (await setEventHidden(user.id, id, true));
  return { ok: true };
});
