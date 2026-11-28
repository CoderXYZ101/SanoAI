import { detectBlindSpots } from "@/ai/engines/blindspots";
import { latestByKey } from "@/ai/engines/signals";
import { analyseCrossSpecialty } from "@/ai/engines/crossSpecialty";
import { buildTimeline } from "@/ai/engines/timeline";
import type { BlindSpotResult } from "@/ai/types";
import { loadUserContext } from "@/lib/context";
import { authed } from "@/client/http";
import { latestAnalysis, listConversations } from "@/lib/repo";

/** Dashboard data — assembled only from the signed-in user's own records using the deterministic engines. */
export const GET = authed(async (_req, { user }) => {
  const { events, docs, profile, settings, ai } = (await loadUserContext(user.id));
  const tl = buildTimeline(events, docs);
  const bs = (await latestAnalysis<BlindSpotResult>(user.id, "blind-spots"))?.data ?? detectBlindSpots(events, profile);
  const cs = analyseCrossSpecialty(events, profile);
  return {
    user,
    settings,
    ai: { effective: ai.effective, reason: ai.reason, provider: ai.provider.label },
    stats: tl.stats,
    documents: docs.slice(0, 5),
    totalDocuments: docs.length,
    attention: [...latestByKey(events).values()]
      .filter((p) => p.value.flag === "low" || p.value.flag === "high")
      .map((p) => ({ name: p.value.name, valueText: p.value.valueText, unit: p.value.unit, value: p.value.value, refLow: p.value.refLow, refHigh: p.value.refHigh, flag: p.value.flag, date: p.date })),
    timelinePreview: tl.events.filter((e) => e.date).slice(-6).reverse(),
    insights: cs.connections.slice(0, 3).map((c) => ({ id: c.id, title: c.title, strength: c.strength, specialties: c.specialties, why: c.why })),
    questions: bs.questions.slice(0, 4).map((q) => ({ id: q.id, title: q.title, why: q.why })),
    conflicts: bs.unclear.filter((f) => f.kind === "conflict").length,
    gaps: bs.unclear.length,
    conversations: (await listConversations(user.id, 4)),
  };
});
