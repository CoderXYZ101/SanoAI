import { analyseCrossSpecialty, runCrossSpecialty } from "@/ai/engines/crossSpecialty";
import { demoMeta } from "@/ai/structured";
import { loadUserContext } from "@/lib/context";
import { authed } from "@/client/http";

export const GET = authed(async (_req, { user }) => {
  const { events, profile, ai } = (await loadUserContext(user.id));
  return { result: { ...analyseCrossSpecialty(events, profile), meta: (await demoMeta(user.id)) }, ai: { effective: ai.effective, reason: ai.reason }, hasRecords: events.length > 0 };
});

export const POST = authed(async (_req, { user }) => {
  const { events, profile, settings } = (await loadUserContext(user.id));
  return { result: await runCrossSpecialty(user.id, events, profile, settings.language), hasRecords: events.length > 0 };
});
