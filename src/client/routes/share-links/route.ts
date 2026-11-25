import { z } from "zod";
import { buildDoctorBrief } from "@/ai/engines/brief";
import { ApiError, authed, parseBody } from "@/client/http";
import { assertWithin, PlanLimitError } from "@/lib/billing";
import { loadUserContext } from "@/lib/context";
import { now } from "@/lib/repo";
import { store } from "@/lib/store";

/**
 * Secure doctor links: a time-limited, revocable, read-only snapshot of the sections YOU choose, reachable only by
 * someone holding the long random link (Firestore rules allow a single-document read by id, never listing).
 */
const SECTIONS = ["summary", "medicines", "allergies", "results", "symptoms", "questions"] as const;
const token = () =>
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(22)), (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 32);

interface LinkDoc {
  id: string;
  user_id: string;
  label: string;
  sections: string[];
  created_at: string;
  expires_ms: number;
  revoked: boolean;
  brief_json: string;
}

export const GET = authed(async (_req, { user }) => {
  const rows = (await store.where("share_links", { user_id: user.id })) as unknown as LinkDoc[];
  return {
    links: rows
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({ id: r.id, label: r.label, sections: r.sections, createdAt: r.created_at, expiresAt: new Date(r.expires_ms).toISOString(), expired: r.expires_ms < Date.now(), revoked: r.revoked })),
  };
});

const Body = z.object({
  label: z.string().trim().min(1, "Give the link a name").max(60),
  sections: z.array(z.enum(SECTIONS)).min(1, "Choose at least one section"),
  days: z.number().int().min(1).max(30),
  consent: z.literal(true, { error: "You must confirm consent to share" }),
});

export const POST = authed(async (req, { user }) => {
  const b = await parseBody(req, Body);
  const active = ((await store.where("share_links", { user_id: user.id })) as unknown as LinkDoc[]).filter((l) => !l.revoked && l.expires_ms > Date.now()).length;
  try {
    await assertWithin(user.id, "shareLinks", active);
  } catch (e) {
    if (e instanceof PlanLimitError) throw new ApiError(402, e.message);
    throw e;
  }
  const { events, docs, profile } = await loadUserContext(user.id);
  if (!events.length) throw new ApiError(400, "Add or load some records before sharing.");
  const brief = buildDoctorBrief(events, docs, profile);
  const pick: Record<string, unknown> = { generatedAt: brief.generatedAt, patient: brief.patient, disclaimer: brief.disclaimer };
  if (b.sections.includes("summary")) pick.summary = brief.timelineSummary;
  if (b.sections.includes("medicines")) pick.medicines = brief.medicines;
  if (b.sections.includes("allergies")) pick.allergies = brief.allergies;
  if (b.sections.includes("results")) pick.results = brief.recentResults;
  if (b.sections.includes("symptoms")) pick.symptoms = brief.symptoms;
  if (b.sections.includes("questions")) pick.questions = brief.openQuestions;
  const id = token();
  const doc: LinkDoc = { id, user_id: user.id, label: b.label, sections: b.sections, created_at: now(), expires_ms: Date.now() + b.days * 86_400_000, revoked: false, brief_json: JSON.stringify(pick) };
  await store.set("share_links", doc);
  return { id, path: `/share?id=${id}`, expiresAt: new Date(doc.expires_ms).toISOString() };
});

export const DELETE = authed(async (req, { user }) => {
  const { id } = await parseBody(req, z.object({ id: z.string().min(10).max(60) }));
  const r = (await store.get("share_links", id)) as unknown as LinkDoc | null;
  if (r && r.user_id === user.id) await store.delete("share_links", id); // snapshot is erased immediately
  return { ok: true };
});
