import { z } from "zod";
import { aiStatus } from "@/ai/structured";
import { authed, parseBody } from "@/client/http";
import { getSettings, updateSettings } from "@/lib/repo";

const Body = z.object({
  consentExternalAi: z.boolean().optional(),
  consentChatMemory: z.boolean().optional(),
  readingLevel: z.enum(["plain", "detailed"]).optional(),
  language: z.string().trim().min(2).max(30).optional(),
});

export const GET = authed(async (_req, { user }) => ({ settings: (await getSettings(user.id)), ai: (await aiStatus(user.id)) }));
export const PUT = authed(async (req, { user }) => {
  const patch = await parseBody(req, Body);
  const settings = (await updateSettings(user.id, patch));
  return { settings, ai: (await aiStatus(user.id)) };
});
