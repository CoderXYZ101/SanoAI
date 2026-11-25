import { loadDemoRecords } from "@/ai/engines/documentIntelligence";
import { deleteStored } from "@/lib/files";
import { ApiError, authed } from "@/client/http";
import { deleteDocument, listDocuments } from "@/lib/repo";

export const POST = authed(async (_req, { user }) => {
  if ((await listDocuments(user.id)).some((d) => d.isDemo)) throw new ApiError(409, "The demonstration records are already loaded.");
  const n = await loadDemoRecords(user.id);
  return { loaded: n };
});

/** Remove all demonstration documents (and their extracted events). */
export const DELETE = authed(async (_req, { user }) => {
  let n = 0;
  for (const d of (await listDocuments(user.id)).filter((x) => x.isDemo)) {
    const r = (await deleteDocument(user.id, d.id));
    await deleteStored(user.id, r?.storageKey ?? null);
    n++;
  }
  return { removed: n };
});
