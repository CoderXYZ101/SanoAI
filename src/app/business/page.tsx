"use client";
import { Building2, CheckCircle2, FlaskConical, Stethoscope, Users } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Callout, Card, Field, Logo } from "@/components/ui";
import { fbDb } from "@/lib/firebase";
import { uuid } from "@/lib/uuid";

const OFFERS = [
  { icon: FlaskConical, who: "Diagnostic labs", price: "₹5–15", unit: "per report", points: ["Plain-language explanations alongside every report", "Compared only with your lab's own reference ranges", "Sponsor codes to give patients free access"] },
  { icon: Stethoscope, who: "Clinics & small hospitals", price: "from ₹3,000", unit: "per month", points: ["Patient timeline and summary before each visit", "Secure, expiring links shared with patient consent", "Questions and record conflicts highlighted"] },
  { icon: Users, who: "Employers", price: "₹50–100", unit: "per employee / month", points: ["Sponsor codes for staff", "Private by design: employers never see health data", "Health diary and accessible explanations"] },
];

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function BusinessPage() {
  const [reports, setReports] = useState(2000);
  const [rate, setRate] = useState(8);
  const [f, setF] = useState({ org: "", type: "Diagnostic lab", name: "", contact: "", volume: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const id = uuid();
      await setDoc(doc(fbDb(), "sano_leads", id), { id, ...f, created_at: new Date().toISOString() });
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" aria-label="SanoAI home"><Logo dark size={32} /></Link>
          <Link href="/login" className="text-sm font-medium text-navy-100 hover:text-white">Sign in</Link>
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-8">
          <p className="eyebrow !text-sano-300">SanoAI for business</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">Reports your patients can <span className="text-gradient">actually understand</span></h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-navy-200">For diagnostic labs, clinics and employers in India. An information service: it never diagnoses or replaces a clinician.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-5 py-12">
        <section className="grid gap-5 md:grid-cols-3">
          {OFFERS.map((o) => (
            <Card key={o.who} className="card-pad flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-900 text-sano-300"><o.icon className="h-5 w-5" /></span>
              <h2 className="mt-4 text-lg font-semibold text-navy-900">{o.who}</h2>
              <p className="mt-2"><span className="font-display text-3xl font-semibold text-navy-900">{o.price}</span> <span className="text-[13px] text-navy-400">{o.unit}</span></p>
              <ul className="mt-4 space-y-2">
                {o.points.map((p) => (
                  <li key={p} className="flex gap-2 text-[13.5px] text-navy-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sano-600" />{p}</li>
                ))}
              </ul>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="card-pad">
            <h2 className="text-[17px] font-semibold text-navy-900">Lab partnership calculator</h2>
            <p className="mt-1 text-[13px] text-navy-500">An estimate from your own inputs — not a quote or a promise.</p>
            <label htmlFor="r" className="mt-5 flex justify-between text-[13px] font-medium text-navy-700"><span>Reports per month</span><span>{reports.toLocaleString("en-IN")}</span></label>
            <input id="r" type="range" min={100} max={20000} step={100} value={reports} onChange={(e) => setReports(Number(e.target.value))} className="mt-1 w-full accent-sano-600" />
            <label htmlFor="p" className="mt-4 flex justify-between text-[13px] font-medium text-navy-700"><span>Price per report</span><span>{inr(rate)}</span></label>
            <input id="p" type="range" min={5} max={15} step={1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-1 w-full accent-sano-600" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-navy-900 p-4 text-white"><p className="text-[12px] text-navy-300">Monthly fee</p><p className="font-display text-2xl font-semibold">{inr(reports * rate)}</p></div>
              <div className="rounded-2xl bg-sano-50 p-4 text-sano-900"><p className="text-[12px] text-sano-700">Over a year</p><p className="font-display text-2xl font-semibold">{inr(reports * rate * 12)}</p></div>
            </div>
          </Card>

          <Card className="card-pad">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold text-navy-900"><Building2 className="h-5 w-5 text-sano-600" /> Talk to us about a pilot</h2>
            {state === "done" ? (
              <Callout tone="teal" title="Thank you" className="mt-4">Your enquiry has been saved. We will contact you.</Callout>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Organisation" htmlFor="org"><input id="org" required maxLength={120} className="field" value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} /></Field>
                  <Field label="Type" htmlFor="ty"><select id="ty" className="field" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["Diagnostic lab", "Clinic or hospital", "Employer", "Pharmacy", "Other"].map((t) => <option key={t}>{t}</option>)}</select></Field>
                  <Field label="Your name" htmlFor="nm"><input id="nm" required maxLength={80} className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
                  <Field label="Email or phone" htmlFor="ct"><input id="ct" required maxLength={120} className="field" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
                </div>
                <Field label="Monthly reports / patients / staff" htmlFor="vl"><input id="vl" maxLength={60} className="field" value={f.volume} onChange={(e) => setF({ ...f, volume: e.target.value })} /></Field>
                <Field label="Anything else? (please don't include patient information)" htmlFor="ms"><textarea id="ms" maxLength={1000} className="field min-h-[70px]" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
                {state === "error" && <Callout tone="alert">We couldn't save that. Please check your connection and try again.</Callout>}
                <Button type="submit" className="w-full" loading={state === "busy"}>Send enquiry</Button>
              </form>
            )}
          </Card>
        </section>
        <p className="text-center text-[12.5px] text-navy-400">Prices are indicative. SanoAI does not sell health data, show health advertising or take commissions from doctors.</p>
      </main>
    </div>
  );
}
