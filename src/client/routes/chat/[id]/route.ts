import type { ChatMessageDTO } from "@/ai/types";
import { ApiError, authed } from "@/client/http";
import { deleteConversation, getConversation, listMessages } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async (_req, { user, params }) => {
  const { id } = await params;
  const conv = (await getConversation(user.id, id));
  if (!conv) throw new ApiError(404, "Conversation not found.");
  const messages: ChatMessageDTO[] = (await listMessages(user.id, id)).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.created_at,
    meta: m.meta_json ? JSON.parse(m.meta_json) : undefined,
  }));
  return { conversation: conv, messages };
});

export const DELETE = authed<Ctx>(async (_req, { user, params }) => {
  const { id } = await params;
  if (!(await getConversation(user.id, id))) throw new ApiError(404, "Conversation not found.");
  (await deleteConversation(user.id, id));
  return { ok: true };
});
