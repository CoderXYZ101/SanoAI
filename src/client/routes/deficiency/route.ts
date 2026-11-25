import { runBiomarkers } from "@/ai/engines/biomarkerAnalysis";
import { loadUserContext } from "@/lib/context";
import { authed } from "@/client/http";

export const GET = authed(async (_req, { user }) => {
  const { events, docs } = (await loadUserContext(user.id));
  return { result: runBiomarkers(user.id, events, docs), hasRecords: events.length > 0 };
});
