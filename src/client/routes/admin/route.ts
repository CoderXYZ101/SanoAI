import { z } from "zod";
import { ApiError, authed, parseBody } from "@/client/http";
import { adminLists, allClaims, approveClaim, createCodes, isAdmin, rejectClaim } from "@/lib/payments";

// The real protection is in firestore.rules; this check just gives a clear message to non-admins.
async function requireAdmin(userId: string) {
  if (!(await isAdmin(userId))) throw new ApiError(403, "This page is for administrators only.");
}

export const GET = authed(async (_req, { user }) => {
  await requireAdmin(user.id);
  const [claims, lists] = await Promise.all([allClaims(), adminLists()]);
  return { ...claims, ...lists };
});

const Decide = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), id: z.string().min(1).max(60) }),
  z.object({ action: z.literal("reject"), id: z.string().min(1).max(60), note: z.string().trim().min(3, "Give a short reason").max(200) }),
]);

export const POST = authed(async (req, { user }) => {
  await requireAdmin(user.id);
  const b = await parseBody(req, Decide);
  try {
    if (b.action === "approve") await approveClaim(user.id, b.id);
    else await rejectClaim(user.id, b.id, b.note);
  } catch (e) {
    throw new ApiError(409, (e as Error).message);
  }
  return { ok: true };
});

export const PUT = authed(async (req, { user }) => {
  await requireAdmin(user.id);
  const b = await parseBody(req, z.object({ count: z.number().int().min(1).max(50), plan: z.enum(["plus", "pro"]), validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an expiry date"), sponsor: z.string().trim().min(2, "Name the sponsor").max(80) }));
  if (new Date(b.validUntil).getTime() < Date.now()) throw new ApiError(400, "The expiry date must be in the future.");
  return { codes: await createCodes(b) };
});
