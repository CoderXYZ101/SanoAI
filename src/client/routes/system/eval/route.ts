import { runEvals } from "@/ai/eval";
import { authed } from "@/client/http";

/** Runs the deterministic module self-checks (no network, no data from the user's account). */
export const POST = authed(async () => {
  const results = await runEvals();
  return { results, passed: results.filter((r) => r.passed).length, total: results.length };
});
