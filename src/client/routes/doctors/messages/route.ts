import { z } from "zod";
import { DEMO_DOCTORS } from "@/ai/knowledge/directory";
import { triage } from "@/ai/safety";
import { ApiError, authed, parseBody } from "@/client/http";
import { addDoctorMessage, listDoctorMessages } from "@/lib/repo";

export const GET = authed(async (req, { user }) => {
  const doctorId = new URL(req.url).searchParams.get("doctorId") ?? "";
  if (!DEMO_DOCTORS.some((d) => d.id === doctorId)) throw new ApiError(404, "Doctor not found.");
  return { messages: (await listDoctorMessages(user.id, doctorId)).map((m) => ({ id: m.id, body: m.body, status: m.status, createdAt: m.created_at })) };
});

const Body = z.object({ doctorId: z.string().max(60), body: z.string().trim().min(1, "Write a message").max(2000) });

/** Stores a message draft in the user's account. No doctor is connected in demonstration mode, so no reply can arrive. */
export const POST = authed(async (req, { user }) => {
  const b = await parseBody(req, Body);
  if (!DEMO_DOCTORS.some((d) => d.id === b.doctorId)) throw new ApiError(404, "Doctor not found.");
  const id = (await addDoctorMessage(user.id, b.doctorId, b.body));
  const t = triage(b.body);
  return {
    id,
    status: "saved-not-delivered",
    notice: "Saved in your account only — this demonstration profile is not connected to a real clinician, so the message was not delivered and no reply will arrive.",
    safety: t.level === "none" ? null : { level: t.level, message: t.message },
  };
});
