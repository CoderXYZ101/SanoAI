import { z } from "zod";
import { DEMO_DOCTORS } from "@/ai/knowledge/directory";
import { ApiError, authed, parseBody } from "@/client/http";
import { createAppointment, listAppointments } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => ({
  appointments: (await listAppointments(user.id)).map((a) => ({ id: a.id, doctorId: a.doctor_id, doctorName: a.doctor_name, preferred: a.preferred, reason: a.reason, mode: a.mode, status: a.status, createdAt: a.created_at })),
}));

const Body = z.object({
  doctorId: z.string().max(60),
  preferred: z.string().trim().min(3, "Tell us roughly when you'd like to be seen").max(120),
  reason: z.string().trim().min(5, "Add a short reason for the visit").max(500),
  mode: z.enum(["In person", "Video", "Phone"]),
});

/** Records an appointment REQUEST in the user's own account. Nothing is sent and nothing is booked. */
export const POST = authed(async (req, { user }) => {
  const b = await parseBody(req, Body);
  const doc = DEMO_DOCTORS.find((d) => d.id === b.doctorId);
  if (!doc) throw new ApiError(404, "Doctor not found.");
  if (!doc.modes.includes(b.mode)) throw new ApiError(400, `${doc.name} does not list ${b.mode.toLowerCase()} consultations.`);
  const id = (await createAppointment(user.id, { doctorId: doc.id, doctorName: doc.name, preferred: b.preferred, reason: b.reason, mode: b.mode }));
  return {
    id,
    status: "demo-request-not-sent",
    notice: "Saved as a request in your SanoAI account only. This is a demonstration profile: nothing was sent to a doctor and no appointment is booked or confirmed.",
  };
});
