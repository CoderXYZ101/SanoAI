import { detectBlindSpots, runBlindSpots } from "@/ai/engines/blindspots";
import type { BlindSpotResult } from "@/ai/types";
import { demoMeta } from "@/ai/structured";
import { hashOf, loadUserContext } from "@/lib/context";
import { authed } from "@/client/http";
import { latestAnalysis, saveAnalysis } from "@/lib/repo";

/** GET: cached/deterministic result (cheap, no AI call). POST: run the full analysis (AI-assisted if consented). */
export const GET = authed(async (_req, { user }) => {
  const { events, profile, docs, ai } = (await loadUserContext(user.id));
  const hash = hashOf({ e: events.map((e) => e.id + JSON.stringify(e.values) + e.date), p: profile });
  const cached = (await latestAnalysis<BlindSpotResult>(user.id, "blind-spots"));
  if (cached && cached.inputHash === hash) return { result: cached.data, cached: true, ai: { effective: ai.effective, reason: ai.reason }, documents: docs.length };
  const result: BlindSpotResult = { ...detectBlindSpots(events, profile), meta: (await demoMeta(user.id)) };
  return { result, cached: false, ai: { effective: ai.effective, reason: ai.reason }, documents: docs.length };
});

export const POST = authed(async (_req, { user }) => {
  const { events, profile, settings, ai } = (await loadUserContext(user.id));
  const hash = hashOf({ e: events.map((e) => e.id + JSON.stringify(e.values) + e.date), p: profile });
  const result = await runBlindSpots(user.id, events, profile, settings.language);
  (await saveAnalysis(user.id, "blind-spots", hash, result.meta.mode, result));
  return { result, cached: false, ai: { effective: ai.effective, reason: ai.reason } };
});
