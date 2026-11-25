"use client";
import { Printer, ShieldCheck } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Badge, Button, Callout, Logo, Spinner } from "@/components/ui";
import { fbDb } from "@/lib/firebase";

interface Shared {
  generatedAt: string;
  patient?: { ageRange?: string; sex?: string };
  summary?: string;
  medicines?: { name: string; detail: string; source: string }[];
  allergies?: string[];
  results?: { name: string; value: string; range: string; flag: string; date: string }[];
  symptoms?: string[];
  questions?: { title: string; why: string }[];
  disclaimer: string;
}

/** Public, read-only view of a patient-created secure link. No sign-in; the long random link is the credential. */
function ShareView() {
  const id = useSearchParams().get("id") ?? "";
  const [state, setState] = useState<{ status: "loading" | "ok" | "gone"; data?: Shared; label?: string; expires?: number }>({ status: "loading" });

  useEffect(() => {
    if (!id) return setState({ status: "gone" });
    getDoc(doc(fbDb(), "sano_share_links", id))
      .then((s) => {
        const d = s.data();
        if (!s.exists() || !d || d.revoked || d.expires_ms < Date.now()) return setState({ status: "gone" });
        setState({ status: "ok", data: JSON.parse(d.brief_json), label: d.label, expires: d.expires_ms });
      })
      .catch(() => setState({ status: "gone" }));
  }, [id]);

  if (state.status === "loading") return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  if (state.status === "gone" || !state.data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold text-navy-900">This link is no longer available</h1>
        <p className="mt-2 text-[15px] text-navy-500">It may have expired or been withdrawn by the patient. Ask them for a new link.</p>
      </main>
    );
  }
  const d = state.data;
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
      <div className="no-print mb-6 flex items-center justify-between">
        <Logo />
        <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / save as PDF</Button>
      </div>
      <div className="card print-sheet space-y-6 p-8 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 pb-4">
          <div>
            <p className="eyebrow">Patient-shared summary</p>
            <h1 className="mt-1 text-xl font-semibold text-navy-900">{state.label}</h1>
          </div>
          <div className="text-right text-[12px] text-navy-400">
            <Badge tone="teal" icon={<ShieldCheck className="h-3 w-3" />}>Shared with patient consent</Badge>
            <p className="mt-1">Prepared {new Date(d.generatedAt).toLocaleDateString("en-IN")} · link expires {new Date(state.expires!).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
        {(d.patient?.ageRange || d.patient?.sex) && <p className="text-[14px] text-navy-700"><strong>Patient:</strong> {[d.patient.ageRange, d.patient.sex].filter(Boolean).join(", ")}</p>}
        {d.summary && <Block title="Summary of records"><p>{d.summary}</p></Block>}
        {d.allergies && <Block title="Allergies">{d.allergies.length ? <ul>{d.allergies.map((a) => <li key={a}>{a}</li>)}</ul> : <p>None recorded</p>}</Block>}
        {d.medicines && <Block title="Medicines (as recorded)">{d.medicines.length ? <ul>{d.medicines.map((m) => <li key={m.name + m.source}><strong className="capitalize">{m.name}</strong> — {m.detail}</li>)}</ul> : <p>None recorded</p>}</Block>}
        {d.results && (
          <Block title="Most recent results (lab's own ranges)">
            <table className="w-full text-left text-[12.5px]">
              <thead className="text-navy-400"><tr><th className="py-1 pr-3 font-medium">Test</th><th className="py-1 pr-3 font-medium">Result</th><th className="py-1 pr-3 font-medium">Lab range</th><th className="py-1 pr-3 font-medium">Status</th><th className="py-1 font-medium">Date</th></tr></thead>
              <tbody className="divide-y divide-navy-100">{d.results.map((r) => <tr key={r.name}><td className="py-1.5 pr-3 font-medium">{r.name}</td><td className="py-1.5 pr-3">{r.value}</td><td className="py-1.5 pr-3 text-navy-500">{r.range}</td><td className="py-1.5 pr-3">{r.flag}</td><td className="py-1.5 text-navy-500">{r.date}</td></tr>)}</tbody>
            </table>
          </Block>
        )}
        {d.symptoms && d.symptoms.length > 0 && <Block title="Symptoms noted"><p>{d.symptoms.join(" · ")}</p></Block>}
        {d.questions && d.questions.length > 0 && <Block title="Questions the patient would like to discuss"><ol className="list-decimal pl-5">{d.questions.map((q) => <li key={q.title}>{q.title}</li>)}</ol></Block>}
        <Callout tone="info">{d.disclaimer}</Callout>
      </div>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-sano-700">{title}</h2>
      <div className="space-y-1 text-[13.5px] leading-relaxed text-navy-700 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </section>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <ShareView />
    </Suspense>
  );
}
