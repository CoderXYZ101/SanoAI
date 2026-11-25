"use client";
import { Printer } from "lucide-react";
import type { DoctorBrief } from "@/ai/engines/brief";
import { CopyButton, NoRecords } from "@/components/common";
import PremiumReport from "@/components/PremiumReport";
import { Badge, Button, Card, ErrorState, LoadingBlock, Logo, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client";

export default function BriefPage() {
  const { data, error, loading, reload } = useApi<{ brief: DoctorBrief; text: string; hasRecords: boolean }>("/api/brief");
  if (loading && !data) return <LoadingBlock rows={4} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const b = data.brief;
  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader eyebrow="Consultation summary" title="Doctor brief" description="A one-page summary assembled only from your own documents, with every item traceable to its source. Print it, save it as PDF, or copy it into a message." actions={data.hasRecords && (<><CopyButton text={data.text} label="Copy as text" /><Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / save as PDF</Button></>)} />
      </div>
      {!data.hasRecords ? (
        <NoRecords what="The doctor brief" onLoaded={reload} />
      ) : (
        <Card className="print-sheet mx-auto max-w-3xl space-y-6 p-8 sm:p-10">
          <div className="flex items-start justify-between border-b border-navy-100 pb-5">
            <Logo />
            <div className="text-right text-[12px] text-navy-400"><p className="font-semibold text-navy-700">Doctor brief</p><p>Prepared {new Date(b.generatedAt).toLocaleDateString("en-IN")}</p></div>
          </div>
          {(b.patient.ageRange || b.patient.sex) && <p className="text-[14px] text-navy-700"><strong>Patient:</strong> {[b.patient.ageRange, b.patient.sex].filter(Boolean).join(", ")}</p>}
          <Section title="Summary of records"><p>{b.timelineSummary}</p></Section>
          <div className="grid gap-6 sm:grid-cols-2">
            <Section title="Allergies">{b.allergies.length ? <ul>{b.allergies.map((a) => <li key={a}>{a}</li>)}</ul> : <p className="text-navy-400">None recorded</p>}</Section>
            <Section title="Medicines (as recorded)">{b.medicines.length ? <ul>{b.medicines.map((m) => <li key={m.name + m.source}><strong className="capitalize">{m.name}</strong> — {m.detail} <span className="text-navy-400">[{m.source}]</span></li>)}</ul> : <p className="text-navy-400">None recorded</p>}</Section>
          </div>
          <Section title="Conditions written in the records">{b.recordedConditions.length ? <ul>{b.recordedConditions.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-navy-400">None</p>}</Section>
          <Section title="Most recent results (lab's own ranges)">
            <table className="w-full text-left text-[12.5px]">
              <thead className="text-navy-400"><tr><th className="py-1 pr-3 font-medium">Test</th><th className="py-1 pr-3 font-medium">Result</th><th className="py-1 pr-3 font-medium">Lab range</th><th className="py-1 pr-3 font-medium">Status</th><th className="py-1 font-medium">Date</th></tr></thead>
              <tbody className="divide-y divide-navy-100">{b.recentResults.map((r) => <tr key={r.name}><td className="py-1.5 pr-3 font-medium">{r.name}</td><td className="py-1.5 pr-3">{r.value}</td><td className="py-1.5 pr-3 text-navy-500">{r.range}</td><td className="py-1.5 pr-3">{r.flag === "low" || r.flag === "high" ? <Badge tone={r.flag === "high" ? "rose" : "amber"}>{r.flag}</Badge> : r.flag}</td><td className="py-1.5 text-navy-500">{r.date}</td></tr>)}</tbody>
            </table>
          </Section>
          {b.symptoms.length > 0 && <Section title="Symptoms noted in records"><p>{b.symptoms.join(" · ")}</p></Section>}
          {b.conflicts.length > 0 && <Section title="Records that may need reconciling"><ul>{b.conflicts.map((c) => <li key={c}>{c}</li>)}</ul></Section>}
          <Section title="Questions I'd like to discuss"><ol className="list-decimal pl-5">{b.openQuestions.map((q) => <li key={q.title}>{q.title}</li>)}</ol></Section>
          <p className="border-t border-navy-100 pt-4 text-[11.5px] leading-relaxed text-navy-400">{b.disclaimer}</p>
        </Card>
      )}
      {data.hasRecords && <PremiumReport />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-sano-700">{title}</h2>
      <div className="space-y-1 text-[13.5px] leading-relaxed text-navy-700 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
