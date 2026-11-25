import { extractAndStore } from "@/ai/engines/documentIntelligence";
import { ApiError, authed } from "@/client/http";
import { getDocument } from "@/lib/repo";

export const POST = authed<{ params: Promise<{ id: string }> }>(async (_req, { user, params }) => {
  const { id } = await params;
  if (!(await getDocument(user.id, id))) throw new ApiError(404, "Document not found.");
  const r = await extractAndStore(user.id, id);
  return { ...r, document: (await getDocument(user.id, id)) };
});
