import { z } from "zod";
import { aiTimelineSummary, buildTimeline } from "@/ai/engines/timeline";
import { demoMeta } from "@/ai/structured";
import { loadUserContext } from "@/lib/context";
import { authed, parseBody } from "@/client/http";

export const GET = authed(async (_req, { user }) => {
  const { events, docs, ai } = (await loadUserContext(user.id));
  return { timeline: buildTimeline(events, docs), documents: docs, ai: { effective: ai.effective, reason: ai.reason, provider: ai.provider.label } };
});

/** Optional AI-written narrative of the timeline (falls back to the deterministic summary). */
export const POST = authed(async (req, { user }) => {
  const { level } = await parseBody(req, z.object({ level: z.enum(["plain", "detailed"]).default("plain") }));
  const { events, docs, settings } = (await loadUserContext(user.id));
  const tl = buildTimeline(events, docs);
  if (!events.length) return { summary: tl.summary, meta: (await demoMeta(user.id)) };
  return aiTimelineSummary(user.id, tl, level, settings.language);
});
