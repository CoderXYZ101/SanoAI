import { z } from "zod";
import { runSimulation } from "@/ai/engines/counterfactual";
import { loadUserContext } from "@/lib/context";
import { ApiError, authed, parseBody } from "@/client/http";
import { rateLimit } from "@/client/http";

const Inputs = z.object({
  sleepHours: z.number().min(2).max(14),
  activityMin: z.number().min(0).max(1200),
  fruitVeg: z.number().min(0).max(15),
  sweetDrinks: z.number().min(0).max(60),
  alcoholUnits: z.number().min(0).max(120),
  smoking: z.enum(["never", "former", "current"]),
  stress: z.number().int().min(1).max(5),
  sittingHours: z.number().min(0).max(18),
});
const Body = z.object({
  baseline: Inputs,
  scenarios: z.array(z.object({ id: z.string().max(20), name: z.string().trim().min(1).max(40), inputs: Inputs })).min(1).max(3),
  useRecords: z.boolean().default(false),
});

export const POST = authed(async (req, { user }) => {
  if (!rateLimit(`ai:${user.id}`, 40, 60_000)) throw new ApiError(429, "Please slow down a little.");
  const b = await parseBody(req, Body);
  const ctx = (await loadUserContext(user.id));
  const use = b.useRecords && ctx.settings.consentChatMemory;
  return { result: await runSimulation(user.id, b.baseline, b.scenarios, ctx.events, ctx.profile, use, ctx.settings.language), usedRecords: use };
});
