"use client";
import { ExternalLink, FileText, Pill, Search } from "lucide-react";
import { useState } from "react";
import type { LabelReading, MedicineInfo } from "@/ai/engines/pharmacy";
import NearbyPlaces from "@/components/NearbyPlaces";
import { Badge, Button, Callout, Card, EmptyState, Field, LimitsNote, PageHeader, Segmented } from "@/components/ui";
import { apiFetch } from "@/lib/client";

type Tab = "near" | "medicines" | "label";

export default function PharmacyPage() {
  const [tab, setTab] = useState<Tab>("near");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Medicines" title="Medicines and pharmacies" description="Find a pharmacy near you, look up what a medicine is for, or have a label explained in plain words." />
      <Segmented value={tab} onChange={setTab} label="Medicine tools" options={[{ value: "near", label: "Pharmacies near me" }, { value: "medicines", label: "Look up a medicine" }, { value: "label", label: "Explain a label" }]} />
      {tab === "near" && (
        <>
          <NearbyPlaces medicineAsk groups={[{ id: "pharmacy", label: "Pharmacies", kinds: ["pharmacy"] }]} />
          <Callout tone="teal" title="Save on medicines">The Government of India&apos;s <a className="font-semibold underline" href="https://janaushadhi.gov.in/" target="_blank" rel="noopener noreferrer">Jan Aushadhi Kendras</a> sell generic medicines at lower prices. Ask your doctor or pharmacist whether a generic is suitable for you.</Callout>
        </>
      )}
      {tab === "medicines" && <Medicines />}
      {tab === "label" && <Label />}
      <LimitsNote>Prescription medicines require a valid prescription from a licensed clinician. Never change or stop a prescribed medicine without advice from your prescriber or pharmacist.</LimitsNote>
    </div>
  );
}

function Medicines() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<MedicineInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function search(term = q) {
    if (term.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      setRes((await apiFetch<{ results: MedicineInfo[] }>(`/api/pharmacy/medicines?q=${encodeURIComponent(term)}`)).results);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <input className="field pl-10" aria-label="Medicine name" placeholder="Generic or brand name, e.g. metformin, Glycomet, Dolo, Telma" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button type="submit" loading={busy}>Search</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {["metformin", "amlodipine", "omeprazole", "amoxicillin", "levothyroxine"].map((m) => (
          <button key={m} onClick={() => { setQ(m); void search(m); }} className="rounded-full bg-navy-50 px-3 py-1 text-[12.5px] text-navy-600 hover:bg-sano-50 hover:text-sano-800">{m}</button>
        ))}
      </div>
      {err && <Callout tone="alert">{err}</Callout>}
      {res && res.length === 0 && <EmptyState icon={<Pill className="h-6 w-6" />} title="No match in SanoAI's reference list" body="The list is deliberately small. Check the official label sources, or ask a pharmacist." action={<Button variant="secondary" href="https://medlineplus.gov/druginformation.html">Search MedlinePlus</Button>} />}
      <div className="grid gap-4 md:grid-cols-2">
        {res?.map((m) => (
          <Card key={m.generic} className="card-pad">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold capitalize text-navy-900">{m.generic}</h3>
              <Badge tone={m.rx ? "rose" : "green"}>{m.rx ? "Usually prescription-only" : "Often available without prescription"}</Badge>
            </div>
            <p className="mt-0.5 text-[12.5px] text-navy-400">{m.drugClass} · brands: {m.brands.join(", ")}</p>
            <p className="mt-3 text-[13.5px] text-navy-700">{m.usedFor}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-navy-600">
              {m.generalNotes.map((n) => <li key={n}>{n}</li>)}
            </ul>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-navy-100 pt-3">
              {m.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-sano-700 hover:underline">{l.label}<ExternalLink className="h-3 w-3" /></a>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Label() {
  const [text, setText] = useState("");
  const [r, setR] = useState<LabelReading | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sample = "Tab. Metformin 500 mg\nTake 1 tablet BD after meals\nQty: 60 tablets   Batch: B2231  EXP: 08/2026\nRx only. Keep out of reach of children.\nMay cause stomach upset. Avoid alcohol.";
  async function read() {
    setBusy(true);
    setErr(null);
    try {
      setR((await apiFetch<{ reading: LabelReading }>("/api/pharmacy/label", { method: "POST", json: { text } })).reading);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="card-pad">
        <Field label="Type or paste the text printed on the label" htmlFor="lbl" hint="Type or paste the words on the label. Photos aren't read here.">
          <textarea id="lbl" className="field min-h-[200px] font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={sample} />
        </Field>
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => setText(sample)} icon={<FileText className="h-4 w-4" />}>Use an example</Button>
          <Button loading={busy} disabled={text.trim().length < 8} onClick={read}>Explain this label</Button>
        </div>
        {err && <Callout tone="alert" className="mt-3">{err}</Callout>}
      </Card>
      <div>
        {!r ? (
          <EmptyState icon={<Pill className="h-6 w-6" />} title="Label explainer" body="Paste a label to see the medicine, strength, directions as printed, warnings, expiry, and a plain-language glossary of abbreviations." />
        ) : (
          <Card className="card-pad space-y-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">Medicine</p>
              <p className="text-[16px] font-semibold capitalize text-navy-900">{r.medicine ? `${r.medicine.generic}` : "Not recognised"}</p>
              {r.medicine && <p className="text-[13px] text-navy-500">{r.medicine.drugClass} {r.medicine.rxOnly != null && <Badge tone={r.medicine.rxOnly ? "rose" : "green"} className="ml-1">{r.medicine.rxOnly ? "Prescription-only" : "Non-prescription"}</Badge>}</p>}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              {[["Strength", r.strength], ["Form", r.form], ["Quantity", r.quantity], ["Batch", r.batch], ["Expiry (as printed)", r.expiry?.text]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-navy-50 p-2.5"><dt className="text-[11px] font-semibold uppercase text-navy-400">{k}</dt><dd className="mt-0.5 text-navy-800">{v || "not found"}</dd></div>
              ))}
            </dl>
            {r.directions.length > 0 && <div><p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">Directions — exactly as printed</p><ul className="mt-1 space-y-1 text-[13.5px] text-navy-700">{r.directions.map((d) => <li key={d} className="font-mono text-[12.5px]">“{d}”</li>)}</ul></div>}
            {r.warnings.length > 0 && <div><p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">Warnings printed</p><ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-navy-700">{r.warnings.map((d) => <li key={d}>{d}</li>)}</ul></div>}
            {r.glossary.length > 0 && <div><p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">Abbreviations explained</p><ul className="mt-1 space-y-1 text-[13px] text-navy-700">{r.glossary.map((g) => <li key={g.term}><strong>{g.term}</strong> — {g.meaning}</li>)}</ul></div>}
            <Callout tone="info">{r.notes.map((n) => <p key={n} className="mb-1 last:mb-0">{n}</p>)}</Callout>
          </Card>
        )}
      </div>
    </div>
  );
}
