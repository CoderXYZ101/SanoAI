import { z } from "zod";
import { buildDoctorBrief } from "@/ai/engines/brief";
import { DEMO_DOCTORS } from "@/ai/knowledge/directory";
import { loadUserContext } from "@/lib/context";
import { ApiError, authed, parseBody } from "@/client/http";
import { createShare, listShares, revokeShare } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => ({
  shares: (await listShares(user.id)).map((s) => ({ id: s.id, doctorId: s.doctor_id, doctorName: s.doctor_name, sections: JSON.parse(s.sections_json) as string[], consentText: s.consent_text, createdAt: s.created_at, revokedAt: s.revoked_at })),
}));

const SECTIONS = ["summary", "medicines", "allergies", "results", "symptoms", "questions"] as const;
const Body = z.object({
  doctorId: z.string().max(60),
  sections: z.array(z.enum(SECTIONS)).min(1, "Choose at least one section to share"),
  consent: z.literal(true, { error: "You must tick the consent box to share" }),
});

/**
 * Explicit-consent sharing. Only the sections the user ticked are snapshotted. In demonstration mode
 * the snapshot stays inside the user's account (nothing is transmitted) and can be revoked at any time.
 */
export const POST = authed(async (req, { user }) => {
  const b = await parseBody(req, Body);
  const doc = DEMO_DOCTORS.find((d) => d.id === b.doctorId);
  if (!doc) throw new ApiError(404, "Doctor not found.");
  const { events, docs, profile } = (await loadUserContext(user.id));
  const brief = buildDoctorBrief(events, docs, profile);
  const pick: Record<string, unknown> = {};
  if (b.sections.includes("summary")) pick.summary = brief.timelineSummary;
  if (b.sections.includes("medicines")) pick.medicines = brief.medicines;
  if (b.sections.includes("allergies")) pick.allergies = brief.allergies;
  if (b.sections.includes("results")) pick.results = brief.recentResults;
  if (b.sections.includes("symptoms")) pick.symptoms = brief.symptoms;
  if (b.sections.includes("questions")) pick.questions = brief.openQuestions;
  const consentText = `I consent to share ${b.sections.join(", ")} from my SanoAI records with ${doc.name} (demonstration profile). I can revoke this at any time.`;
  const id = (await createShare(user.id, { doctorId: doc.id, doctorName: doc.name, sections: b.sections, summary: pick, consentText }));
  return { id, notice: "Consent recorded. Because this is a demonstration profile, the selected summary was saved in your account only — nothing was transmitted to any doctor." };
});

export const DELETE = authed(async (req, { user }) => {
  const { id } = await parseBody(req, z.object({ id: z.string().max(60) }));
  (await revokeShare(user.id, id));
  return { ok: true };
});
