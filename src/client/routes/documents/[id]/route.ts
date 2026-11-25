import { z } from "zod";
import { extractAndStore } from "@/ai/engines/documentIntelligence";
import { DOC_TYPES, type DocType } from "@/ai/types";
import { deleteStored } from "@/lib/files";
import { ApiError, authed, parseBody } from "@/client/http";
import { deleteDocument, getDocument, getDocumentText, listEvents, updateDocument } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async (_req, { user, params }) => {
  const { id } = await params;
  const doc = (await getDocument(user.id, id));
  if (!doc) throw new ApiError(404, "Document not found.");
  return { document: doc, text: (await getDocumentText(user.id, id))?.text ?? null, events: (await listEvents(user.id)).filter((e) => e.docId === id) };
});

const Patch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  docType: z.enum(DOC_TYPES.map((d) => d.value) as [DocType, ...DocType[]]).optional(),
  textContent: z.string().min(20, "Please paste at least a few lines of text").max(200_000).optional(),
});

export const PATCH = authed<Ctx>(async (req, { user, params }) => {
  const { id } = await params;
  const body = await parseBody(req, Patch);
  if (!(await getDocument(user.id, id))) throw new ApiError(404, "Document not found.");
  await updateDocument(user.id, id, {
    title: body.title,
    docType: body.docType,
    ...(body.textContent ? { textContent: body.textContent, textSource: "manual", status: "uploaded", statusDetail: null } : {}),
  });
  // changing the pasted text or the type re-runs extraction (replaces extracted events for this document)
  if (body.textContent || body.docType) await extractAndStore(user.id, id);
  return { document: (await getDocument(user.id, id)) };
});

export const DELETE = authed<Ctx>(async (_req, { user, params }) => {
  const { id } = await params;
  const r = (await deleteDocument(user.id, id));
  if (!r) throw new ApiError(404, "Document not found.");
  await deleteStored(user.id, r.storageKey); // original file is erased from disk, extracted events cascade in the DB
  return { ok: true };
});
