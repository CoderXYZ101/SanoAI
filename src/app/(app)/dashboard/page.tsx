"use client";
import { ArrowRight, FileUp, HeartPulse, MessageSquareHeart, ScanSearch, Search, Sparkles, Stethoscope, UploadCloud, Waypoints } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DocumentDTO, HealthEvent } from "@/ai/types";
import { formatDate } from "@/ai/engines/dates";
import { CATEGORY_META } from "@/components/common";
import RangeBar, { type Reading } from "@/components/RangeBar";
import { Button, Card, ErrorState, LoadingBlock, SectionTitle, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

interface Overview {
  user: { name: string };
  stats: { documents: number; events: number; labValues: number; outOfRange: number; medications: number; symptoms: number };
  documents: DocumentDTO[];
  totalDocuments: number;
  attention: Reading[];
  timelinePreview: HealthEvent[];
  questions: { id: string; title: string; why: string }[];
}

const ACTIONS = [
  { href: "/records", icon: UploadCloud, title: "Add a report", text: "Upload a blood test or prescription", tint: "from-sky-500 to-blue-600" },
  { href: "/assistant", icon: MessageSquareHeart, title: "Ask a question", text: "Get a clear, sourced answer", tint: "from-sano-500 to-cyanx-500" },
  { href: "/blind-spots", icon: ScanSearch, title: "See what's missing", text: "Find gaps to raise with your doctor", tint: "from-violet-500 to-indigo-500" },
  { href: "/doctors", icon: Stethoscope, title: "Find care near me", text: "Real hospitals, clinics and pharmacies", tint: "from-rose-500 to-orange-400" },
];

const STEPS = [
  { icon: FileUp, title: "1. Add your reports", text: "PDF, photo or typed text." },
  { icon: Waypoints, title: "2. See your health story", text: "Dates and results, in order, with the source line." },
  { icon: HeartPulse, title: "3. Walk in prepared", text: "A one-page summary and questions for your doctor." },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function HomePage() {
  const { data, error, loading, reload } = useApi<Overview>("/api/overview");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const toast = useToast();
  const router = useRouter();

  async function loadSample() {
    setBusy(true);
    try {
      await apiFetch("/api/documents/demo", { method: "POST" });
      toast("Sample patient loaded. These records are fictional.");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingBlock rows={4} label="Loading your home page" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const empty = data.totalDocuments === 0;
  const { stats } = data;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-sano-700 p-6 text-white shadow-lift sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyanx-500/30 blur-3xl" />
        <p className="text-[13px] font-medium text-sano-200">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 text-[28px] font-semibold sm:text-[38px]">{greeting()}, {data.user.name.split(" ")[0]}</h1>
        <p className="mt-1.5 text-[16px] text-navy-100">What would you like to understand today?</p>
        <form
          className="relative mt-5 flex max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(question.trim() ? `/assistant?q=${encodeURIComponent(question.trim())}` : "/assistant");
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-300" />
            <input className="h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-[15px] text-navy-900 shadow-lift outline-none placeholder:text-navy-300 focus:ring-4 focus:ring-sano-300/50" aria-label="Your health question" placeholder="e.g. What does low haemoglobin mean?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <button type="submit" className="inline-flex h-14 shrink-0 items-center gap-2 rounded-2xl bg-sano-400 px-5 text-[15px] font-semibold text-navy-950 transition hover:brightness-110">
            <Sparkles className="h-4 w-4" /> Ask
          </button>
        </form>
      </section>

      <section aria-label="What you can do" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="group flex flex-col rounded-3xl border border-navy-100 bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${a.tint} text-white shadow-sm transition group-hover:scale-105`}>
              <a.icon className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <span className="mt-4 text-[17px] font-semibold leading-snug text-navy-900">{a.title}</span>
            <span className="mt-1 text-[13.5px] leading-snug text-navy-500">{a.text}</span>
          </Link>
        ))}
      </section>

      {empty ? (
        <Card className="overflow-hidden">
          <div className="grid gap-px bg-navy-100 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="bg-white p-6">
                <s.icon className="h-8 w-8 text-sano-600" strokeWidth={1.6} />
                <h2 className="mt-3 text-[16px] font-semibold text-navy-900">{s.title}</h2>
                <p className="mt-1 text-[14px] text-navy-500">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3 border-t border-navy-100 bg-sano-50 px-6 py-7 text-center">
            <h2 className="text-xl font-semibold text-navy-900">Just looking? See it working in one tap</h2>
            <p className="max-w-lg text-[14.5px] text-navy-600">Load a fictional sample patient with five reports, then explore every feature.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={loadSample} loading={busy}>Try with a sample patient</Button>
              <Button size="lg" variant="secondary" href="/records">Add my own report</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <section aria-label="Your numbers" className="grid grid-cols-3 gap-3">
            {[
              { v: stats.documents, l: "Reports read", href: "/records", c: "text-navy-900" },
              { v: data.attention.length, l: "Results to look at", href: "/deficiency", c: data.attention.length ? "text-amber-600" : "text-sano-600" },
              { v: data.questions.length, l: "Questions for your doctor", href: "/blind-spots", c: "text-sano-600" },
            ].map((s) => (
              <Link key={s.l} href={s.href} className="rounded-2xl border border-navy-100 bg-white p-4 text-center shadow-soft transition hover:shadow-lift sm:p-5">
                <p className={`font-display text-3xl font-semibold sm:text-4xl ${s.c}`}>{s.v}</p>
                <p className="mt-1 text-[12.5px] font-medium leading-snug text-navy-600 sm:text-[13.5px]">{s.l}</p>
              </Link>
            ))}
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
            <Card className="card-pad">
              <SectionTitle title="Results to look at" hint="Latest values outside the range printed on your report" action={<Link href="/timeline" className="text-[13px] font-medium text-sano-700 hover:underline">All results</Link>} />
              {data.attention.length ? (
                <ul className="space-y-5">
                  {data.attention.slice(0, 5).map((r) => <li key={r.name}><RangeBar r={r} /></li>)}
                </ul>
              ) : (
                <p className="rounded-xl bg-sano-50 p-4 text-sm text-sano-800">No latest result is outside the range printed on your reports.</p>
              )}
              <p className="mt-4 text-[12px] text-navy-400">A result outside the range is not a diagnosis. Your doctor can explain what it means for you.</p>
            </Card>

            <Card className="card-pad">
              <SectionTitle title="Ask your doctor" hint="Open questions found in your records" action={<Link href="/blind-spots" className="text-[13px] font-medium text-sano-700 hover:underline">All</Link>} />
              {data.questions.length ? (
                <ol className="space-y-3">
                  {data.questions.slice(0, 4).map((q, i) => (
                    <li key={q.id} className="flex gap-3 rounded-2xl bg-navy-50/70 p-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sano-600 text-[13px] font-semibold text-white">{i + 1}</span>
                      <span className="text-[14px] leading-snug text-navy-800">{q.title}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-navy-500">Nothing outstanding right now.</p>
              )}
              <Button href="/brief" variant="secondary" className="mt-4 w-full">Make my doctor summary</Button>
            </Card>
          </div>

          <Card className="card-pad">
            <SectionTitle title="Latest in your health story" action={<Link href="/timeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-sano-700 hover:underline">Open <ArrowRight className="h-3.5 w-3.5" /></Link>} />
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.timelinePreview.map((e) => (
                <li key={e.id} className="flex gap-3 rounded-2xl border border-navy-100 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sano-50 text-sano-700">{CATEGORY_META[e.category].icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-navy-400">{formatDate(e.date)}</span>
                    <span className="line-clamp-2 text-[14px] font-medium text-navy-800">{e.title}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </div>
  );
}
