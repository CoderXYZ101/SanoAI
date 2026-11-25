import { z } from "zod";
import { assessUncertainty } from "@/ai/engines/uncertainty";
import { triage } from "@/ai/safety";
import { loadUserContext } from "@/lib/context";
import { authed, parseBody } from "@/client/http";
import { rateLimit } from "@/client/http";
import { ApiError } from "@/client/http";

const Body = z.object({ question: z.string().trim().min(3, "Describe what you'd like to understand").max(600), useRecords: z.boolean().default(true) });

export const POST = authed(async (req, { user }) => {
  if (!rateLimit(`ai:${user.id}`, 40, 60_000)) throw new ApiError(429, "Please slow down a little.");
  const { question, useRecords } = await parseBody(req, Body);
  const ctx = (await loadUserContext(user.id));
  const use = useRecords && ctx.settings.consentChatMemory;
  const tri = triage(question);
  const result = await assessUncertainty(user.id, question, use ? ctx.events : [], use ? ctx.profile : undefined, ctx.settings.language);
  return { result, safety: tri.level === "none" ? null : { level: tri.level, message: tri.message }, usedRecords: use && ctx.events.length > 0 };
});
