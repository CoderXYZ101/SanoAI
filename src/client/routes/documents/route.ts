import { z } from "zod";
import { acquireText, detectDocType, extractAndStore } from "@/ai/engines/documentIntelligence";
import { DOC_TYPES, type DocType } from "@/ai/constants";
import { ApiError, authed, rateLimit } from "@/client/http";
import { assertWithin, PlanLimitError } from "@/lib/billing";
import { MAX_UPLOAD_BYTES, saveFile, validateUpload } from "@/lib/files";
import { getDocument, insertDocument, listDocuments, updateDocument } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => ({ documents: await listDocuments(user.id) }));

const TypeSchema = z.enum(DOC_TYPES.map((d) => d.value) as [DocType, ...DocType[]]).or(z.literal("auto"));

export const POST = authed(async (req, { user }) => {
  if (!rateLimit(`upload:${user.id}`, 30, 60_000)) throw new ApiError(429, "You're uploading quickly — please wait a moment.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "The file is larger than the 10 MB limit.");
  const typeParsed = TypeSchema.safeParse(form.get("docType") ?? "auto");
  if (!typeParsed.success) throw new ApiError(400, "Unknown document type.");
  const title = String(form.get("title") ?? "").trim().slice(0, 120) || file.name.replace(/\.[^.]+$/, "").slice(0, 120);

  try {
    await assertWithin(user.id, "documents", (await listDocuments(user.id)).length);
  } catch (e) {
    if (e instanceof PlanLimitError) throw new ApiError(402, e.message);
    throw e;
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const v = validateUpload(file.name, file.type, buf);
  if ("error" in v) throw new ApiError(400, v.error);

  const storageKey = await saveFile(user.id, buf);
  const acquired = await acquireText(user.id, { buf, isPdf: v.isPdf, isImage: v.isImage, isText: v.isText, mime: v.mime });
  const docType: DocType = typeParsed.data === "auto" ? (acquired.text ? detectDocType(acquired.text) : "other") : typeParsed.data;

  const id = await insertDocument(user.id, {
    title,
    docType,
    originalName: file.name.slice(0, 200),
    mime: v.mime,
    size: buf.length,
    storageKey,
    textContent: acquired.text,
    textSource: acquired.source,
    status: acquired.text ? "uploaded" : "needs_text",
    statusDetail: acquired.detail ?? null,
  });
  if (acquired.text) await extractAndStore(user.id, id);
  else await updateDocument(user.id, id, { status: "needs_text", statusDetail: acquired.detail ?? null });
  return { document: await getDocument(user.id, id) };
});
