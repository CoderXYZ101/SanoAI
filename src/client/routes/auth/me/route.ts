import { aiStatus } from "@/ai/structured";
import { authed } from "@/client/http";
import { getEntitlements, getUsage } from "@/lib/billing";
import { getSettings } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => ({
  user,
  settings: await getSettings(user.id),
  ai: await aiStatus(user.id),
  plan: await getEntitlements(user.id).then((e) => ({ id: e.plan, name: e.def.name, limits: e.limits })),
  usage: await getUsage(user.id),
}));
