import { z } from "zod";
import { readLabel } from "@/ai/engines/pharmacy";
import { authed, parseBody } from "@/client/http";

export const POST = authed(async (req) => {
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(8, "Paste the text printed on the label").max(4000) }));
  return { reading: readLabel(text) };
});
