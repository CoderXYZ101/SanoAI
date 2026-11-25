"use client";
import { BadgeCheck, CalendarPlus, Globe2, MapPin, MessageSquare, Search, ShareIcon, Stethoscope, Undo2 } from "lucide-react";
import { useState } from "react";
import type { DemoDoctor } from "@/ai/knowledge/directory";
import { Badge, Button, Callout, Card, EmptyState, ErrorState, Field, LimitsNote, LoadingBlock, Modal, PageHeader, SectionTitle, Segmented, useToast } from "@/components/ui";
import ShareLinksCard from "@/components/ShareLinksCard";
import { apiFetch, useApi } from "@/lib/client";

type DoctorsData = { doctors: DemoDoctor[]; specialties: string[]; locations: string[]; demo: boolean; integration: { configured: boolean; implemented: boolean } };
type Appt = { id: string; doctorName: string; preferred: string; reason: string; mode: string; status: string; createdAt: string };
type Share = { id: string; doctorName: string; sections: string[]; createdAt: string; revokedAt: string | null };

const SECTION_LABELS: Record<string, string> = { summary: "Timeline summary", medicines: "Medicines", allergies: "Allergies", results: "Most recent results", symptoms: "Symptoms noted", questions: "My questions" };

export default function DoctorsPage() {
  const [specialty, setSpecialty] = useState("");
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const url = `/api/doctors?specialty=${encodeURIComponent(specialty)}&q=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}`;
  const { data, error, loading, reload } = useApi<DoctorsData>(url);
  const mine = useApi<{ appointments: Appt[] }>("/api/doctors/appointments");
  const shares = useApi<{ shares: Share[] }>("/api/doctors/share");
  const [sel, setSel] = useState<DemoDoctor | null>(null);
  const toast = useToast();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Talk to Doctors" title="Find a clinician and arrive prepared" description="Discover doctors by specialty and place, request a visit, and share a summary of your records — only the parts you choose, only with your explicit consent." />
      <Callout tone="warn" title="Demonstration directory — every doctor shown here is fictional">
        No real doctors, credentials, availability or bookings are shown, and no request is transmitted anywhere. Credentials are labelled “not verified”. A live directory and booking integration can replace this data ({data?.integration.configured ? "integration variables are set but the adapter isn't built yet" : "no integration is configured"}).
      </Callout>

      <Card className="card-pad">
        <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
            <input className="field pl-10" placeholder="Search name or focus (e.g. thyroid)" aria-label="Search doctors" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="field" aria-label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">All specialties</option>
            {data?.specialties.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
            <input className="field pl-10" list="locs" placeholder="City or country" aria-label="Location" value={loc} onChange={(e) => setLoc(e.target.value)} />
            <datalist id="locs">
              {data?.locations.map((l) => (
                <option key={l} value={l.split(",")[0]} />
              ))}
            </datalist>
          </div>
        </div>
      </Card>

      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.doctors.length === 0 ? (
        <EmptyState icon={<Stethoscope className="h-6 w-6" />} title="No doctors match" body="Try a different specialty or location." action={<Button variant="secondary" onClick={() => { setQ(""); setSpecialty(""); setLoc(""); }}>Clear filters</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data?.doctors.map((d) => (
            <li key={d.id}>
              <button onClick={() => setSel(d)} className="group flex h-full w-full items-start gap-4 rounded-2xl border border-navy-100 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-sano-200 hover:shadow-lift">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 font-display text-lg font-semibold text-sano-300">{d.name.replace("Dr. ", "").slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[15.5px] font-semibold text-navy-900">{d.name}</span>
                    <Badge tone="amber">Demo profile</Badge>
                  </span>
                  <span className="mt-0.5 block text-[13px] font-medium text-sano-700">{d.specialty}</span>
                  <span className="mt-1 block text-[13px] text-navy-500">{d.focus}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-navy-400">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{d.city}, {d.country}</span>
                    <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />{d.languages.join(", ")}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="My appointment requests" hint="Saved in your account only" />
          {mine.data?.appointments.length ? (
            <ul className="space-y-2.5">
              {mine.data.appointments.map((a) => (
                <li key={a.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-navy-900">{a.doctorName}</p>
                      <Badge tone="amber">Not sent · not booked</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-navy-600">{a.mode} · {a.preferred}</p>
                    <p className="mt-0.5 text-[12.5px] text-navy-400">{a.reason}</p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-navy-200 p-5 text-sm text-navy-500">No requests yet.</p>
          )}
        </section>
        <section>
          <SectionTitle title="What I've shared (consent record)" hint="You can revoke any time" />
          {shares.data?.shares.length ? (
            <ul className="space-y-2.5">
              {shares.data.shares.map((s) => (
                <li key={s.id}>
                  <Card className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="text-[14px] font-semibold text-navy-900">{s.doctorName}</p>
                      <p className="mt-0.5 text-[12.5px] text-navy-500">{s.sections.map((x) => SECTION_LABELS[x]).join(", ")}</p>
                      <p className="text-[12px] text-navy-400">{new Date(s.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                    {s.revokedAt ? (
                      <Badge tone="slate">Revoked</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={async () => { await apiFetch("/api/doctors/share", { method: "DELETE", json: { id: s.id } }); toast("Consent revoked and the shared snapshot erased."); shares.reload(); }}>
                        Revoke
                      </Button>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-navy-200 p-5 text-sm text-navy-500">You haven&apos;t shared anything.</p>
          )}
        </section>
      </div>
      <ShareLinksCard />
      <LimitsNote>SanoAI does not provide medical advice, and demonstration profiles cannot be contacted. For emergencies call 112.</LimitsNote>

      <DoctorModal doctor={sel} onClose={() => setSel(null)} onChange={() => { mine.reload(); shares.reload(); }} />
    </div>
  );
}

function DoctorModal({ doctor, onClose, onChange }: { doctor: DemoDoctor | null; onClose: () => void; onChange: () => void }) {
  const [tab, setTab] = useState<"profile" | "request" | "message" | "share">("profile");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [f, setF] = useState({ preferred: "", reason: "", mode: "In person" as "In person" | "Video" | "Phone" });
  const [msg, setMsg] = useState("");
  const [secs, setSecs] = useState<string[]>(["summary", "results", "questions"]);
  const [consent, setConsent] = useState(false);
  const toast = useToast();
  const thread = useApi<{ messages: { id: string; body: string; createdAt: string; status: string }[] }>(doctor && tab === "message" ? `/api/doctors/messages?doctorId=${doctor.id}` : null);

  async function run(fn: () => Promise<{ notice?: string }>) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fn();
      setNotice(r.notice ?? null);
      onChange();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }
  const d = doctor;
  return (
    <Modal open={!!d} onClose={() => { setNotice(null); onClose(); }} title={d?.name ?? ""} wide>
      {d && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">Demonstration profile — fictional</Badge>
            <Badge tone="slate" icon={<BadgeCheck className="h-3 w-3" />}>Credentials not verified</Badge>
          </div>
          <Segmented value={tab} onChange={(t) => { setTab(t); setNotice(null); }} label="Doctor actions" options={[{ value: "profile", label: "Profile" }, { value: "request", label: "Request appointment" }, { value: "message", label: "Message" }, { value: "share", label: "Share summary" }]} />
          {notice && <Callout tone="teal">{notice}</Callout>}

          {tab === "profile" && (
            <div className="space-y-3 text-[14px] text-navy-700">
              <p><strong>{d.specialty}</strong> · {d.focus}</p>
              <p>{d.about}</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[["Location", `${d.city}, ${d.country}`], ["Languages", d.languages.join(", ")], ["Experience", `${d.experienceYears} years (demo)`], ["Consultation types", d.modes.join(", ")], ["Qualifications", d.qualifications], ["Availability & fees", "Not live in demonstration mode"]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-navy-50 p-3"><dt className="text-[11.5px] font-semibold uppercase tracking-wide text-navy-400">{k}</dt><dd className="mt-0.5">{v}</dd></div>
                ))}
              </dl>
            </div>
          )}

          {tab === "request" && (
            <div className="space-y-4">
              <Callout tone="info">This saves a request in your SanoAI account. In demonstration mode nothing is sent and no appointment is booked or confirmed.</Callout>
              <Field label="Consultation type" htmlFor="m">
                <select id="m" className="field" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as typeof f.mode })}>
                  {d.modes.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Preferred time" htmlFor="p"><input id="p" className="field" placeholder="e.g. weekday mornings next week" value={f.preferred} onChange={(e) => setF({ ...f, preferred: e.target.value })} /></Field>
              <Field label="Reason for visit" htmlFor="r"><textarea id="r" className="field min-h-[80px]" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
              <div className="flex justify-end"><Button icon={<CalendarPlus className="h-4 w-4" />} loading={busy} disabled={f.preferred.trim().length < 3 || f.reason.trim().length < 5} onClick={() => run(() => apiFetch("/api/doctors/appointments", { method: "POST", json: { doctorId: d.id, ...f } }))}>Save request</Button></div>
            </div>
          )}

          {tab === "message" && (
            <div className="space-y-4">
              <Callout tone="info">Messages are saved in your account only. Demonstration doctors are not connected, so nothing is delivered and no replies will arrive. Do not use this for urgent problems.</Callout>
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {thread.data?.messages.map((m) => (
                  <li key={m.id} className="ml-8 rounded-2xl rounded-br-md bg-navy-900 px-4 py-2.5 text-[13.5px] text-white">{m.body}<span className="mt-1 block text-[11px] text-navy-300">Saved · not delivered</span></li>
                ))}
              </ul>
              <textarea className="field min-h-[90px]" aria-label="Message" placeholder="Write a message you'd send to this doctor…" value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} />
              <div className="flex justify-end"><Button icon={<MessageSquare className="h-4 w-4" />} loading={busy} disabled={!msg.trim()} onClick={() => run(async () => { const r = await apiFetch<{ notice: string }>("/api/doctors/messages", { method: "POST", json: { doctorId: d.id, body: msg } }); setMsg(""); thread.reload(); return r; })}>Save message</Button></div>
            </div>
          )}

          {tab === "share" && (
            <div className="space-y-4">
              <p className="text-[13.5px] text-navy-600">Choose exactly what to include. Nothing is shared unless you tick the consent box, and you can revoke it later.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(SECTION_LABELS).map(([k, label]) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-navy-100 px-3.5 py-2.5 text-[13.5px] text-navy-700">
                    <input type="checkbox" className="h-4 w-4 accent-sano-600" checked={secs.includes(k)} onChange={(e) => setSecs((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />
                    {label}
                  </label>
                ))}
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-sano-50 p-4 text-[13.5px] leading-relaxed text-sano-950">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-sano-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I consent to share the selected sections of my SanoAI records with {d.name}. I understand this is a demonstration profile, so the summary is stored in my account only and not transmitted. I can revoke this at any time.</span>
              </label>
              <div className="flex justify-end"><Button icon={<ShareIcon className="h-4 w-4" />} loading={busy} disabled={!consent || !secs.length} onClick={() => run(async () => { const r = await apiFetch<{ notice: string }>("/api/doctors/share", { method: "POST", json: { doctorId: d.id, sections: secs, consent: true } }); setConsent(false); return r; })}>Record consent &amp; share</Button></div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
