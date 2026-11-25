import { uuid } from "@/lib/uuid";
import { z } from "zod";
import { CATEGORIES, SPECIALTIES, type HealthEvent } from "@/ai/types";
import { ApiError, authed, parseBody } from "@/client/http";
import { getDocument, insertManualEvent, listDocuments, listEvents } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => ({ events: (await listEvents(user.id)), documents: (await listDocuments(user.id)) }));

const IsoDate = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, "Use YYYY, YYYY-MM or YYYY-MM-DD");

/** Manually add an event that the extraction missed. It is clearly marked as user-entered. */
const Body = z.object({
  docId: z.string().min(1),
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(1).max(160),
  date: IsoDate.nullable(),
  specialty: z.enum(SPECIALTIES).default("General Medicine"),
  details: z.string().max(600).default(""),
});

export const POST = authed(async (req, { user }) => {
  const b = await parseBody(req, Body);
  if (!(await getDocument(user.id, b.docId))) throw new ApiError(404, "Choose one of your documents to attach this to.");
  const e: HealthEvent = {
    id: uuid(),
    docId: b.docId,
    category: b.category,
    title: b.title,
    date: b.date,
    dateCertainty: b.date ? "explicit" : "missing",
    specialty: b.specialty,
    details: b.details,
    values: [],
    medication: null,
    sourceQuote: "(added manually by you)",
    confidence: "high",
    method: "manual",
    userEdited: true,
  };
  (await insertManualEvent(user.id, e));
  return { event: e };
});
