import { z } from "zod";
import { composeEnquiry } from "@/ai/engines/pharmacy";
import { DEMO_PHARMACIES } from "@/ai/knowledge/directory";
import { ApiError, authed, parseBody } from "@/client/http";
import { createEnquiry, getProfile, listEnquiries } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => ({
  enquiries: (await listEnquiries(user.id)).map((e) => ({ id: e.id, pharmacyName: e.pharmacy_name, items: JSON.parse(e.items_json), message: e.message, sharedHealthInfo: !!e.shared_health_info, status: e.status, createdAt: e.created_at })),
}));

const Body = z.object({
  pharmacyId: z.string().max(60),
  items: z.array(z.object({ name: z.string().trim().min(2).max(80), strength: z.string().trim().max(30).optional(), quantity: z.string().trim().max(30).optional() })).min(1, "Add at least one medicine").max(10),
  hasPrescription: z.boolean().default(false),
  shareAllergies: z.boolean().default(false),
});

/** Builds an enquiry DRAFT. It is never sent and never claims stock. Prescription-only items require confirmation. */
export const POST = authed(async (req, { user }) => {
  const b = await parseBody(req, Body);
  const ph = DEMO_PHARMACIES.find((p) => p.id === b.pharmacyId);
  if (!ph) throw new ApiError(404, "Pharmacy not found.");
  const profile = (await getProfile(user.id));
  const draft = composeEnquiry({ pharmacyName: ph.name, items: b.items, hasPrescription: b.hasPrescription, allergies: b.shareAllergies ? profile.allergies : [], userName: user.name });
  if (draft.rxItems.length && !b.hasPrescription) {
    throw new ApiError(400, `${draft.rxItems.join(", ")} normally require a valid prescription. SanoAI can't help request prescription medicines without one — confirm you hold a valid prescription, or speak to a clinician.`);
  }
  const id = (await createEnquiry(user.id, { pharmacyId: ph.id, pharmacyName: ph.name, items: b.items, message: draft.message, sharedHealthInfo: b.shareAllergies }));
  return { id, message: draft.message, rxItems: draft.rxItems, status: "draft-not-sent", notice: "This is a draft saved in your account. It has not been sent, and SanoAI has no live stock data, so availability is unknown until you contact the pharmacy." };
});
