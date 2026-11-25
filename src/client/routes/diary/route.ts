import { z } from "zod";
import { authed, parseBody } from "@/client/http";
import { getEntitlements } from "@/lib/billing";
import { now } from "@/lib/repo";
import { store } from "@/lib/store";

/** Health diary: one entry per day (sleep, mood, energy, stress, activity, symptoms, notes). */
interface Entry {
  id: string;
  user_id: string;
  date: string;
  sleep_hours: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  activity_min: number | null;
  symptoms: string[];
  notes: string;
  updated_at: string;
}
const toDto = (r: Entry) => ({ date: r.date, sleepHours: r.sleep_hours, mood: r.mood, energy: r.energy, stress: r.stress, activityMin: r.activity_min, symptoms: r.symptoms, notes: r.notes });

export const GET = authed(async (_req, { user }) => {
  const { limits } = await getEntitlements(user.id);
  const all = ((await store.where("daily_logs", { user_id: user.id })) as unknown as Entry[]).sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = limits.logDays < 0 ? null : new Date(Date.now() - limits.logDays * 86_400_000).toISOString().slice(0, 10);
  const visible = cutoff ? all.filter((e) => e.date >= cutoff) : all;
  const avg = (f: (e: Entry) => number | null) => {
    const v = visible.slice(-14).map(f).filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  return {
    entries: visible.map(toDto),
    hidden: all.length - visible.length,
    windowDays: limits.logDays,
    averages14: { sleepHours: avg((e) => e.sleep_hours), mood: avg((e) => e.mood), energy: avg((e) => e.energy), stress: avg((e) => e.stress), activityMin: avg((e) => e.activity_min) },
  };
});

const n = (min: number, max: number) => z.number().min(min).max(max).nullable();
const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  sleepHours: n(0, 24),
  mood: n(1, 5),
  energy: n(1, 5),
  stress: n(1, 5),
  activityMin: n(0, 1440),
  symptoms: z.array(z.string().trim().min(1).max(40)).max(12),
  notes: z.string().max(500),
});

export const PUT = authed(async (req, { user }) => {
  const b = await parseBody(req, Body);
  const row: Entry = { id: `${user.id}_${b.date}`, user_id: user.id, date: b.date, sleep_hours: b.sleepHours, mood: b.mood, energy: b.energy, stress: b.stress, activity_min: b.activityMin, symptoms: b.symptoms, notes: b.notes, updated_at: now() };
  await store.set("daily_logs", row);
  return { entry: toDto(row) };
});

export const DELETE = authed(async (req, { user }) => {
  const { date } = await parseBody(req, z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }));
  await store.delete("daily_logs", `${user.id}_${date}`);
  return { ok: true };
});
