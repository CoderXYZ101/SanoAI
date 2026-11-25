import { searchMedicines } from "@/ai/engines/pharmacy";
import { authed } from "@/client/http";

export const GET = authed(async (req) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return {
    results: searchMedicines(q.slice(0, 80)),
    notice: "General reference only — names, class and label links. SanoAI never recommends medicines, substitutes or doses.",
  };
});
