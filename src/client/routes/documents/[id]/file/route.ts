import { ApiError, authed, type FileResult } from "@/client/http";
import { readFile } from "@/lib/files";
import { toUtf8 } from "@/lib/bytes";
import { getDocumentRow } from "@/lib/repo";

/** Returns the user's own original file (read from their private Firestore area). */
export const GET = authed<{ params: Promise<{ id: string }> }>(async (_req, { user, params }) => {
  const { id } = await params;
  const row = await getDocumentRow(user.id, id);
  if (!row) throw new ApiError(404, "Document not found.");
  const bytes = row.storage_key ? await readFile(user.id, row.storage_key).catch(() => null) : toUtf8(row.text_content ?? "");
  if (!bytes) throw new ApiError(410, "The stored file could not be read.");
  return { __file: { bytes, mime: row.storage_key ? row.mime : "text/plain", name: row.original_name } } satisfies FileResult;
});
