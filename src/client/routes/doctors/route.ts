import { DEMO_DOCTORS } from "@/ai/knowledge/directory";
import { authed } from "@/client/http";

export const GET = authed(async (req) => {
  const u = new URL(req.url);
  const specialty = (u.searchParams.get("specialty") ?? "").toLowerCase();
  const q = (u.searchParams.get("q") ?? "").toLowerCase().trim();
  const loc = (u.searchParams.get("location") ?? "").toLowerCase().trim();
  const doctors = DEMO_DOCTORS.filter(
    (d) =>
      (!specialty || d.specialty.toLowerCase() === specialty) &&
      (!q || `${d.name} ${d.focus} ${d.specialty}`.toLowerCase().includes(q)) &&
      (!loc || `${d.city} ${d.country}`.toLowerCase().includes(loc)),
  );
  return {
    doctors,
    specialties: [...new Set(DEMO_DOCTORS.map((d) => d.specialty))].sort(),
    locations: [...new Set(DEMO_DOCTORS.map((d) => `${d.city}, ${d.country}`))].sort(),
    demo: true,
    integration: { configured: false, implemented: false },
  };
});
