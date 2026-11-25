import { analyseCrossSpecialty } from "@/ai/engines/crossSpecialty";
import { buildTimeline } from "@/ai/engines/timeline";
import { buildDoctorBrief } from "@/ai/engines/brief";
import { ApiError, authed } from "@/client/http";
import { getPlan, reportCredits } from "@/lib/billing";
import { loadUserContext } from "@/lib/context";
import { getUser, now, updateUserProfile } from "@/lib/repo";
import { store } from "@/lib/store";

/**
 * Premium Doctor Report: the free brief plus result trends, cross-specialty links and diary averages.
 * Included in paid plans; free users spend one report credit (₹99). The saved snapshot can be reprinted any time.
 */
export const GET = authed(async (_req, { user }) => {
  const saved = await store.get("reports", user.id);
  const plan = await getPlan(user.id);
  return { plan, credits: await reportCredits(user.id), report: saved && saved.user_id === user.id ? JSON.parse(String(saved.json)) : null };
});

export const POST = authed(async (_req, { user }) => {
  const { events, docs, profile } = await loadUserContext(user.id);
  if (!events.length) throw new ApiError(400, "Add or load some records first.");
  const plan = await getPlan(user.id);
  const credits = await reportCredits(user.id);
  if (plan === "free" && credits.paid + credits.demo < 1) throw new ApiError(402, "A Premium Report needs a ₹99 report pass or a paid plan.");

  const cross = analyseCrossSpecialty(events, profile);
  const tl = buildTimeline(events, docs);
  const diary = ((await store.where("daily_logs", { user_id: user.id })) as unknown as { date: string; sleep_hours: number | null; mood: number | null; energy: number | null; stress: number | null; symptoms: string[] }[]).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const avg = (v: (number | null)[]) => { const n = v.filter((x): x is number => x != null); return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : null; };
  const report = {
    createdAt: now(),
    brief: buildDoctorBrief(events, docs, profile, undefined, cross),
    trends: Object.values(tl.series).filter((s) => s.points.filter((p) => p.date).length >= 2).slice(0, 8),
    connections: cross.connections.filter((c) => c.strength === "documented").map((c) => ({ title: c.title, specialties: c.specialties, why: c.why, caution: c.caution })),
    diary: diary.length ? { days: diary.length, sleep: avg(diary.map((d) => d.sleep_hours)), mood: avg(diary.map((d) => d.mood)), energy: avg(diary.map((d) => d.energy)), stress: avg(diary.map((d) => d.stress)), symptoms: [...new Set(diary.flatMap((d) => d.symptoms))] } : null,
  };
  await store.set("reports", { id: user.id, user_id: user.id, json: JSON.stringify(report), created_at: report.createdAt });

  if (plan === "free") {
    const row = await getUser(user.id);
    if (credits.paid > 0) await updateUserProfile(user.id, { report_credits: Number(row?.report_credits ?? 0) - 1 });
    else await updateUserProfile(user.id, { demo_credits: Number(row?.demo_credits ?? 0) - 1 });
  }
  return { report, plan, credits: await reportCredits(user.id) };
});
