"use client";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { TimelineResult } from "@/ai/engines/timeline";
import { SeriesChart } from "@/components/charts";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

interface Report {
  createdAt: string;
  trends: TimelineResult["series"][string][];
  connections: { title: string; specialties: string[]; why: string; caution: string }[];
  diary: { days: number; sleep: number | null; mood: number | null; energy: number | null; stress: number | null; symptoms: string[] } | null;
}
interface Data {
  plan: string;
  credits: { paid: number; demo: number };
  report: Report | null;
}

/** Premium sections appended to the doctor brief (₹99 report pass, or included in paid plans). */
export default function PremiumReport() {
  const { data, reload } = useApi<Data>("/api/report");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!data) return null;
  const credits = data.credits.paid + data.credits.demo;
  const allowed = data.plan !== "free" || credits > 0;
  const r = data.report;

  async function generate() {
    setBusy(true);
    try {
      await apiFetch("/api/report", { method: "POST" });
      toast("Premium report ready.");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="no-print flex flex-col gap-3 border-sano-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-navy-900"><Sparkles className="h-4 w-4 text-sano-600" /> Premium Doctor Report <Badge tone="teal">{data.plan !== "free" ? "In your plan" : "₹99"}</Badge></p>
          <p className="mt-1 text-[13px] text-navy-500">Trend charts, cross-specialty links and diary averages, saved so you can reprint it.{data.plan === "free" ? ` Passes available: ${credits}.` : ""}</p>
        </div>
        {allowed ? <Button loading={busy} onClick={generate}>{r ? "Refresh report" : "Create report"}{data.plan === "free" ? " (uses 1 pass)" : ""}</Button> : <Link href="/pricing" className="whitespace-nowrap text-sm font-semibold text-sano-700 hover:underline">Get a ₹99 pass</Link>}
      </Card>
      {r && (
        <Card className="print-sheet space-y-6 p-8 sm:p-10">
          <p className="text-[12px] text-navy-400">Premium sections · saved {new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
          {r.trends.length > 0 && (
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-sano-700">Result trends (each lab&apos;s own range)</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {r.trends.map((t) => (
                  <div key={t.name} className="break-inside-avoid rounded-xl border border-navy-100 p-3">
                    <p className="text-[13px] font-semibold text-navy-800">{t.name} <span className="font-normal text-navy-400">{t.points[0]?.unit}</span></p>
                    <SeriesChart points={t.points} unit={t.points[0]?.unit} height={220} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {r.connections.length > 0 && (
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-sano-700">Possible cross-specialty links (associations, not diagnoses)</h2>
              <ul className="space-y-3">
                {r.connections.map((c) => (
                  <li key={c.title} className="break-inside-avoid text-[13.5px] text-navy-700"><strong>{c.title}</strong> <span className="text-navy-400">({c.specialties.join(", ")})</span><p>{c.why}</p><p className="text-navy-500">{c.caution}</p></li>
                ))}
              </ul>
            </section>
          )}
          {r.diary && (
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-sano-700">Health diary ({r.diary.days} logged days, self-reported)</h2>
              <p className="text-[13.5px] text-navy-700">Average sleep {r.diary.sleep ?? "—"} h · mood {r.diary.mood ?? "—"}/5 · energy {r.diary.energy ?? "—"}/5 · stress {r.diary.stress ?? "—"}/5</p>
              {r.diary.symptoms.length > 0 && <p className="mt-1 text-[13.5px] text-navy-700">Symptoms logged: {r.diary.symptoms.join(", ")}</p>}
            </section>
          )}
        </Card>
      )}
    </div>
  );
}
