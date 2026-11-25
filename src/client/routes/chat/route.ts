import { z } from "zod";
import { chatTurn } from "@/ai/engines/conversation";
import type { ChatMessageDTO } from "@/ai/types";
import { rateLimit } from "@/client/http";
import { loadUserContext } from "@/lib/context";
import { ApiError, authed, parseBody } from "@/client/http";
import { assertWithin, PlanLimitError } from "@/lib/billing";
import { addMessage, createConversation, getConversation, listConversations, listMessages } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => ({ conversations: (await listConversations(user.id)) }));

const Body = z.object({ conversationId: z.string().max(60).nullable().optional(), message: z.string().trim().min(1, "Type a message").max(2000, "Please keep messages under 2,000 characters") });

export const POST = authed(async (req, { user }) => {
  if (!rateLimit(`chat:${user.id}`, 30, 60_000)) throw new ApiError(429, "You're sending messages quickly — please wait a moment.");
  const { conversationId, message } = await parseBody(req, Body);
  let convId = conversationId ?? null;
  if (convId && !(await getConversation(user.id, convId))) throw new ApiError(404, "Conversation not found.");
  if (!convId) {
    try {
      await assertWithin(user.id, "conversations", (await listConversations(user.id)).length);
    } catch (e) {
      if (e instanceof PlanLimitError) throw new ApiError(402, `${e.message} You can delete old conversations to free a slot.`);
      throw e;
    }
    convId = await createConversation(user.id, message);
  }

  const prior = (await listMessages(user.id, convId)).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const userMsgId = (await addMessage(user.id, convId, "user", message));

  const ctx = (await loadUserContext(user.id));
  const useRecords = ctx.settings.consentChatMemory;
  const { content, meta } = await chatTurn({
    userId: user.id,
    message,
    history: prior,
    events: useRecords ? ctx.events : [],
    docs: ctx.docs,
    profile: useRecords ? ctx.profile : undefined,
    useRecords,
    language: ctx.settings.language,
    readingLevel: ctx.settings.readingLevel,
  });
  const id = (await addMessage(user.id, convId, "assistant", content, meta));
  const now = new Date().toISOString();
  const userMsg: ChatMessageDTO = { id: userMsgId, role: "user", content: message, createdAt: now };
  const assistant: ChatMessageDTO = { id, role: "assistant", content, createdAt: now, meta };
  return { conversationId: convId, messages: [userMsg, assistant] };
});
