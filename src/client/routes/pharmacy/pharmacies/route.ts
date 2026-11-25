import { DEMO_PHARMACIES } from "@/ai/knowledge/directory";
import { authed } from "@/client/http";

export const GET = authed(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase().trim();
  return {
    pharmacies: DEMO_PHARMACIES.filter((p) => !q || `${p.name} ${p.city} ${p.country}`.toLowerCase().includes(q)),
    locations: [...new Set(DEMO_PHARMACIES.map((p) => `${p.city}, ${p.country}`))],
    demo: true,
    integration: { configured: false, implemented: false },
  };
});
