import { briefToText, buildDoctorBrief } from "@/ai/engines/brief";
import { loadUserContext } from "@/lib/context";
import { authed } from "@/client/http";

export const GET = authed(async (_req, { user }) => {
  const { events, docs, profile } = (await loadUserContext(user.id));
  const brief = buildDoctorBrief(events, docs, profile);
  return { brief, text: briefToText(brief), hasRecords: events.length > 0 };
});
