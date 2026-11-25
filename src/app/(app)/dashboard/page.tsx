"use client";
import { ArrowRight, Droplets, FileText, FolderHeart, Gauge, MessageSquareHeart, Network, Pill, ScanSearch, SlidersHorizontal, Sparkles, Stethoscope, Waypoints } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { DocumentDTO, HealthEvent } from "@/ai/types";
import { formatDate } from "@/ai/engines/dates";
import { CATEGORY_META, CertaintyBadge } from "@/components/common";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, SectionTitle, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

interface Overview {
  user: { name: string };
  ai: { effective: "live" | "demo"; reason: string; provider: string };
  stats: { documents: number; events: number; labValues: number; outOfRange: number; medications: number; symptoms: number; undated: number; first: string | null; last: string | null };
  documents: DocumentDTO[];
  totalDocuments: number;
  timelinePreview: HealthEvent[];
  insights: { id: string; title: string; strength: "documented" | "partial"; specialties: string[]; why: string }[];
  questions: { id: string; title: string; why: string }[];
  conflicts: number;
  gaps: number;
  conversations: { id: string; title: string; updated_at: string }[];
}

const MODULES = [
  { href: "/assistant", label: "AI Health Assistant", icon: MessageSquareHeart, d: "Ask anything, with sources" },
  { href: "/timeline", label: "Medical Timeline", icon: Waypoints, d: "Your history, reconstructed" },
  { href: "/blind-spots", label: "Blind-Spot Detector", icon: ScanSearch, d: "What the records don't say" },
  { href: "/simulator", label: "Counterfactual Simulator", icon: SlidersHorizontal, d: "Explore “what if”" },
  { href: "/uncertainty", label: "Uncertainty Engine", icon: Gauge, d: "Known · possible · missing" },
  { href: "/cross-specialty", label: "Cross-Specialty", icon: Network, d: "Connect the dots" },
  { href: "/deficiency", label: "Deficiency Finder", icon: Droplets, d: "Lab values explained" },
  { href: "/doctors", label: "Find Doctors", icon: Stethoscope, d: "Prepare & share a brief" },
  { href: "/pharmacy", label: "Pharmacy Connector", icon: Pill, d: "Labels & enquiries" },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  const { data, error, loading, reload } = useApi<Overview>("/api/overview");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function loadDemo() {
    setBusy(true);
    try {
      await apiFetch("/api/documents/demo", { method: "POST" });
      toast("Synthetic demonstration records loaded.");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingBlock rows={4} label="Loading your dashboard" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { stats } = data;
  const empty = data.totalDocuments === 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1.5">{new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-[28px] font-semibold text-navy-900 sm:text-[32px]">
            {greeting()}, {data.user.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] text-navy-500">{empty ? "Add your first record to build your timeline, or explore with synthetic demo records." : "Here's where your health information stands today."}</p>
        </div>
        <div className="flex gap-2">
          <Button href="/records" variant="secondary" icon={<FolderHeart className="h-4 w-4" />}>
            Upload a record
          </Button>
          <Button href="/assistant" icon={<Sparkles className="h-4 w-4" />}>
            Ask SanoAI
          </Button>
        </div>
      </header>

      {empty ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Your dashboard is waiting for its first record"
          body="Upload a blood test, prescription or discharge summary — or load a synthetic patient with five documents, ambiguous dates and conflicting entries, to see every module in action."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button href="/records" variant="secondary">
                Upload a record
              </Button>
              <Button onClick={loadDemo} loading={busy}>
                Load synthetic demo records
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* health overview — one quiet strip rather than many cards */}
          <Card className="grid grid-cols-2 divide-navy-100 sm:grid-cols-4 sm:divide-x">
            {[
              { v: stats.documents, l: "Documents analysed", s: stats.first ? `${formatDate(stats.first)} – ${formatDate(stats.last)}` : "no dates found" },
              { v: stats.events, l: "Events on your timeline", s: `${stats.labValues} lab measurements` },
              { v: stats.outOfRange, l: "Results outside lab range", s: "judged by each lab's own range", tone: stats.outOfRange ? "text-amber-600" : "" },
              { v: data.questions.length, l: "Questions to discuss", s: `${data.conflicts} conflicting entries`, tone: "text-sano-600" },
            ].map((s) => (
              <div key={s.l} className="px-5 py-4">
                <p className={`font-display text-3xl font-semibold ${s.tone ?? "text-navy-900"}`}>{s.v}</p>
                <p className="mt-0.5 text-[13px] font-medium text-navy-700">{s.l}</p>
                <p className="text-[12px] text-navy-400">{s.s}</p>
              </div>
            ))}
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            <div className="space-y-6">
              <Card className="card-pad">
                <SectionTitle title="Medical timeline" hint="Most recent events" action={<Link href="/timeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-sano-700 hover:underline">Open timeline <ArrowRight className="h-3.5 w-3.5" /></Link>} />
                <ol className="relative space-y-4 border-l border-navy-100 pl-5">
                  {data.timelinePreview.map((e) => {
                    const m = CATEGORY_META[e.category];
                    return (
                      <li key={e.id} className="relative">
                        <span className="absolute -left-[27px] top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-sano-600 ring-2 ring-sano-200">{m.icon}</span>
                        <p className="text-[12px] font-medium text-navy-400">{formatDate(e.date)}</p>
                        <p className="text-[14px] font-medium text-navy-800">{e.title}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge tone={m.tone}>{m.label}</Badge>
                          <CertaintyBadge c={e.dateCertainty} edited={e.userEdited} />
                          {e.values.filter((v) => v.flag === "low" || v.flag === "high").length > 0 && <Badge tone="amber">{e.values.filter((v) => v.flag === "low" || v.flag === "high").length} outside range</Badge>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>

              <Card className="card-pad">
                <SectionTitle title="AI insights" hint="Connections across specialties found in your records" action={<Link href="/cross-specialty" className="inline-flex items-center gap-1 text-[13px] font-medium text-sano-700 hover:underline">See the map <ArrowRight className="h-3.5 w-3.5" /></Link>} />
                {data.insights.length ? (
                  <ul className="divide-y divide-navy-100">
                    {data.insights.map((i) => (
                      <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-medium text-navy-800">{i.title}</p>
                          <Badge tone={i.strength === "documented" ? "teal" : "slate"}>{i.strength === "documented" ? "Supported by 2+ areas of your records" : "Partial"}</Badge>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-navy-500">{i.why}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-navy-500">No cross-specialty connections yet. They appear as more information is added.</p>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="card-pad">
                <SectionTitle title="Questions worth asking" hint="From the Blind-Spot Detector" action={<Link href="/blind-spots" className="text-[13px] font-medium text-sano-700 hover:underline">All</Link>} />
                {data.questions.length ? (
                  <ul className="space-y-3">
                    {data.questions.map((q) => (
                      <li key={q.id} className="flex gap-2.5 text-[13.5px] leading-snug text-navy-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sano-500" />
                        {q.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-navy-500">Nothing outstanding — nice.</p>
                )}
              </Card>

              <Card className="card-pad">
                <SectionTitle title="Recent uploads" action={<Link href="/records" className="text-[13px] font-medium text-sano-700 hover:underline">Manage</Link>} />
                <ul className="space-y-2.5">
                  {data.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500">
                        <FileText className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-navy-800">{d.title}</p>
                        <p className="text-[12px] text-navy-400">{d.isDemo ? "Synthetic demo record" : new Date(d.createdAt).toLocaleDateString("en-IN")}</p>
                      </div>
                      <Badge tone={d.status === "processed" ? "green" : "amber"}>{d.status === "processed" ? "Analysed" : "Needs text"}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="card-pad">
                <SectionTitle title="Recent conversations" action={<Link href="/assistant" className="text-[13px] font-medium text-sano-700 hover:underline">Open assistant</Link>} />
                {data.conversations.length ? (
                  <ul className="space-y-2">
                    {data.conversations.map((c) => (
                      <li key={c.id}>
                        <Link href={`/assistant?c=${c.id}`} className="block rounded-lg px-2 py-1.5 text-[13.5px] text-navy-700 hover:bg-navy-50">
                          <span className="line-clamp-1">{c.title}</span>
                          <span className="text-[11.5px] text-navy-400">{new Date(c.updated_at).toLocaleDateString("en-IN")}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-navy-500">No conversations yet — ask SanoAI anything about your health information.</p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <section aria-labelledby="quick">
        <SectionTitle title="Quick access" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="group flex items-start gap-3 rounded-2xl border border-navy-100 bg-white p-3.5 shadow-soft transition hover:-translate-y-0.5 hover:border-sano-200 hover:shadow-lift">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-sano-300 transition group-hover:bg-sano-600 group-hover:text-white">
                <m.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-navy-800">{m.label}</span>
                <span className="block truncate text-[12px] text-navy-400">{m.d}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
