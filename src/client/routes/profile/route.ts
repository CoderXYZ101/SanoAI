import { z } from "zod";
import { authed, parseBody } from "@/client/http";
import { getProfile, saveProfile } from "@/lib/repo";

const list = z.array(z.string().trim().min(1).max(80)).max(30);
const Body = z.object({
  ageRange: z.string().trim().max(20).default(""),
  sex: z.string().trim().max(30).default(""),
  conditions: list.default([]),
  allergies: list.default([]),
  medications: list.default([]),
  notes: z.string().max(1500).default(""),
});

export const GET = authed(async (_req, { user }) => ({ profile: (await getProfile(user.id)) }));
export const PUT = authed(async (req, { user }) => {
  const p = await parseBody(req, Body);
  (await saveProfile(user.id, p));
  return { profile: p };
});
