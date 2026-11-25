"use client";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, EyeOff, FilePlus2, FileSearch, Pencil, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { formatDate, sortKey } from "@/ai/engines/dates";
import type { TimelineResult } from "@/ai/engines/timeline";
import { CATEGORIES, SPECIALTIES, type Category } from "@/ai/constants";
import type { AiMeta, DocumentDTO, HealthEvent, LabValue } from "@/ai/types";
import { CATEGORY_META, CertaintyBadge, NoRecords } from "@/components/common";
import { SeriesChart } from "@/components/charts";
import DocViewer from "@/components/DocViewer";
import { AiModeChip, Badge, Button, Callout, Card, EmptyState, ErrorState, Field, flagLabel, flagTone, LimitsNote, LoadingBlock, MetaNotice, Modal, PageHeader, Segmented, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

type Data = { timeline: TimelineResult; documents: DocumentDTO[]; ai: { effective: string; reason: string; provider: string } };

export default function TimelinePage() {
  const { data, error, loading, reload } = useApi<Data>("/api/timeline");
  const [tab, setTab] = useState<"timeline" | "compare" | "changes">("timeline");
  const [cats, setCats] = useState<Set<Category>>(new Set());
  const [onlyUncertain, setOnlyUncertain] = useState(false);
  const [selected, setSelected] = useState<HealthEvent | null>(null);
  const [view, setView] = useState<{ docId: string; quote?: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [summary, setSummary] = useState<{ text: string; meta?: AiMeta } | null>(null);
  const [level, setLevel] = useState<"plain" | "detailed">("plain");
  const [summarising, setSummarising] = useState(false);
  const toast = useToast();

  const docMap = useMemo(() => new Map((data?.documents ?? []).map((d) => [d.id, d])), [data]);
  const events = data?.timeline.events ?? [];
  const filtered = useMemo(
    () =>
      events.filter((e) => (cats.size === 0 || cats.has(e.category)) && (!onlyUncertain || (e.dateCertainty !== "explicit" && e.dateCertainty !== "document") || e.confidence !== "high") ),
    [events, cats, onlyUncertain],
  );
  const dated = filtered.filter((e) => e.date);
  const undated = filtered.filter((e) => !e.date);
  const groups = useMemo(() => {
    const m = new Map<string, HealthEvent[]>();
    for (const e of dated) {
      const k = e.date!.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dated]);

  const catCounts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {};
    events.forEach((e) => (c[e.category] = (c[e.category] ?? 0) + 1));
    return c;
  }, [events]);

  const aiSummary = useCallback(async () => {
    setSummarising(true);
    try {
      const r = await apiFetch<{ summary: string; meta: AiMeta }>("/api/timeline", { method: "POST", json: { level } });
      setSummary({ text: r.summary, meta: r.meta });
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSummarising(false);
    }
  }, [level, toast]);

  if (loading && !data) return <LoadingBlock rows={4} label="Reconstructing your timeline" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const tl = data.timeline;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Medical Timeline Reconstruction"
        title="Your history, in order"
        description="Every item is traced to the exact line of the document it came from. Dates that aren't clearly printed are marked, never guessed."
        actions={
          <>
            <Button variant="secondary" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setAdding(true)} disabled={!data.documents.length}>
              Add event
            </Button>
            <Button href="/brief" variant="secondary">
              Doctor brief
            </Button>
          </>
        }
      />

      {!events.length ? (
        <NoRecords what="The timeline" onLoaded={reload} />
      ) : (
        <>
          <Card className="card-pad">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-navy-900">Summary of your history</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented value={level} onChange={setLevel} label="Reading level" options={[{ value: "plain", label: "Plain language" }, { value: "detailed", label: "Detailed" }]} />
                <Button size="sm" variant="secondary" loading={summarising} onClick={aiSummary} icon={<Sparkles className="h-3.5 w-3.5" />}>
                  {data.ai.effective === "live" ? "Write with AI" : "Refresh summary"}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[14.5px] leading-relaxed text-navy-700">{summary?.text ?? tl.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AiModeChip meta={summary?.meta ?? { mode: "demo", provider: "SanoAI rule-based engine" }} />
              <span className="text-[12px] text-navy-400">Facts come from your documents; this wording is generated and never replaces them.</span>
            </div>
            <MetaNotice meta={summary?.meta} />
          </Card>

          <Segmented
            value={tab}
            onChange={setTab}
            label="Timeline views"
            options={[
              { value: "timeline", label: `Timeline (${events.length})` },
              { value: "compare", label: "Compare results" },
              { value: "changes", label: `Changes & gaps (${tl.changes.length + tl.gaps.length})` },
            ]}
          />

          {tab === "timeline" && (
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <aside className="lg:sticky lg:top-6 lg:self-start">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-navy-400">Filter by category</p>
                <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-1">
                  <button onClick={() => setCats(new Set())} className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${cats.size === 0 ? "bg-navy-900 text-white" : "bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50"}`}>
                    All <span className="ml-2 text-[11px] opacity-70">{events.length}</span>
                  </button>
                  {CATEGORIES.filter((c) => catCounts[c]).map((c) => {
                    const on = cats.has(c);
                    return (
                      <button key={c} aria-pressed={on} onClick={() => setCats((s) => { const n = new Set(s); on ? n.delete(c) : n.add(c); return n; })} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${on ? "bg-sano-600 text-white" : "bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50"}`}>
                        <span className="flex items-center gap-2">{CATEGORY_META[c].icon}{CATEGORY_META[c].label}</span>
                        <span className="text-[11px] opacity-70">{catCounts[c]}</span>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-navy-600">
                  <input type="checkbox" className="h-4 w-4 accent-sano-600" checked={onlyUncertain} onChange={(e) => setOnlyUncertain(e.target.checked)} />
                  Only uncertain items
                </label>
              </aside>

              <div>
                {filtered.length === 0 ? (
                  <EmptyState title="Nothing matches these filters" body="Try removing a category filter." action={<Button variant="secondary" onClick={() => { setCats(new Set()); setOnlyUncertain(false); }}>Clear filters</Button>} />
                ) : (
                  <>
                    <ol className="relative space-y-8 border-l-2 border-navy-100 pl-6 sm:pl-8">
                      {groups.map(([month, evs]) => (
                        <li key={month} className="relative">
                          <span className="absolute -left-[33px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-sano-100 sm:-left-[41px]">
                            <span className="h-2 w-2 rounded-full bg-sano-500" />
                          </span>
                          <h3 className="mb-3 font-display text-[15px] font-semibold text-navy-900">{formatDate(month)}</h3>
                          <ul className="space-y-2.5">
                            {evs.map((e, i) => (
                              <EventCard key={e.id} e={e} doc={docMap.get(e.docId)} index={i} onOpen={() => setSelected(e)} />
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                    {undated.length > 0 && (
                      <div className="mt-10">
                        <h3 className="mb-1 flex items-center gap-2 font-display text-[15px] font-semibold text-navy-900">
                          <CalendarClock className="h-4 w-4 text-amber-600" /> No date found ({undated.length})
                        </h3>
                        <p className="mb-3 text-[13px] text-navy-500">SanoAI did not guess dates for these. Open an item to add one if you know it.</p>
                        <ul className="space-y-2.5">
                          {undated.map((e, i) => (
                            <EventCard key={e.id} e={e} doc={docMap.get(e.docId)} index={i} onOpen={() => setSelected(e)} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "compare" && <Compare tl={tl} />}
          {tab === "changes" && <Changes tl={tl} docs={docMap} onOpen={(id) => setSelected(events.find((e) => e.id === id) ?? null)} />}
        </>
      )}

      <LimitsNote>The timeline restates your documents. It can contain extraction errors (use “Edit” to correct them) and is not a diagnosis or a complete medical record.</LimitsNote>

      <EventModal
        event={selected}
        doc={selected ? docMap.get(selected.docId) : undefined}
        onClose={() => setSelected(null)}
        onViewSource={(docId, quote) => setView({ docId, quote })}
        onChanged={() => {
          setSelected(null);
          reload();
        }}
      />
      <DocViewer docId={view?.docId ?? null} highlight={view?.quote} onClose={() => setView(null)} />
      <AddEventModal open={adding} docs={data.documents} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload(); }} />
    </div>
  );
}

function EventCard({ e, doc, index, onOpen }: { e: HealthEvent; doc?: DocumentDTO; index: number; onOpen: () => void }) {
  const m = CATEGORY_META[e.category];
  const abnormal = e.values.filter((v) => v.flag === "low" || v.flag === "high");
  return (
    <motion.li initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(index, 4) * 0.04 }}>
      <button onClick={onOpen} className="group w-full rounded-2xl border border-navy-100 bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-sano-200 hover:shadow-lift">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-sano-300">{m.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={m.tone}>{m.label}</Badge>
              <Badge tone="slate">{e.specialty}</Badge>
              <span className="text-[12px] text-navy-400">{formatDate(e.date)}</span>
              <CertaintyBadge c={e.dateCertainty} edited={e.userEdited} />
              {e.method === "manual" && <Badge tone="teal">Added by you</Badge>}
              {e.confidence !== "high" && <Badge tone="amber">Verify extraction</Badge>}
            </div>
            <p className="mt-1.5 text-[15px] font-semibold text-navy-900">{e.title}</p>
            {e.category === "lab" && abnormal.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {abnormal.slice(0, 6).map((v) => (
                  <span key={v.name} className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2 py-1 text-[12px] text-navy-700">
                    {v.name} <strong>{v.valueText}</strong>
                    <span className={v.flag === "high" ? "text-rose-600" : "text-amber-600"}>{v.flag === "high" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}</span>
                  </span>
                ))}
                {abnormal.length > 6 && <span className="text-[12px] text-navy-400">+{abnormal.length - 6} more</span>}
              </div>
            )}
            {e.category !== "lab" && e.details && <p className="mt-1 line-clamp-2 text-[13px] text-navy-500">{e.details}</p>}
            <p className="mt-2 flex items-center gap-1 text-[12px] text-navy-400">
              <FileSearch className="h-3.5 w-3.5" /> {doc?.title ?? "Document"} <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </p>
          </div>
        </div>
      </button>
    </motion.li>
  );
}

// ─────────────────────── compare tab ───────────────────────
function Compare({ tl }: { tl: TimelineResult }) {
  const keys = Object.keys(tl.series).filter((k) => tl.series[k].points.length > 0);
  const multi = keys.filter((k) => tl.series[k].points.filter((p) => p.date).length >= 2);
  const [key, setKey] = useState(multi[0] ?? keys[0] ?? "");
  const s = tl.series[key];
  if (!keys.length) return <EmptyState title="No lab values to compare" body="Upload blood test reports with numeric results to compare them across dates." />;
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-navy-400">Measurement</p>
        <ul className="space-y-1">
          {keys.map((k) => {
            const n = tl.series[k].points.filter((p) => p.date).length;
            const last = tl.series[k].points[tl.series[k].points.length - 1];
            return (
              <li key={k}>
                <button onClick={() => setKey(k)} aria-pressed={key === k} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${key === k ? "bg-navy-900 text-white" : "bg-white text-navy-700 ring-1 ring-navy-100 hover:bg-navy-50"}`}>
                  <span className="truncate">{tl.series[k].name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] opacity-80">
                    {n}×<span className={`h-2 w-2 rounded-full ${last.flag === "high" ? "bg-rose-500" : last.flag === "low" ? "bg-amber-500" : last.flag === "normal" ? "bg-sano-500" : "bg-slate-400"}`} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {s && (
        <Card className="card-pad">
          <h3 className="text-lg font-semibold text-navy-900">{s.name}</h3>
          <p className="mb-3 text-[13px] text-navy-500">Shaded band = the reference range printed on the most recent report. High/low is judged only against each report&apos;s own range.</p>
          <SeriesChart points={s.points.map((p) => ({ date: p.date, value: p.value, valueText: p.valueText, flag: p.flag, refLow: p.refLow, refHigh: p.refHigh }))} unit={s.points[0].unit} />
          {s.points.filter((p) => p.date).length < 2 && <p className="mt-2 text-[13px] text-navy-500">Only one dated value exists — upload another report to see a trend.</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wide text-navy-400">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Result</th>
                  <th className="py-2 pr-4 font-semibold">Lab range</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {s.points.map((p, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4 text-navy-700">
                      {formatDate(p.date)} {p.dateCertainty === "ambiguous" && <Badge tone="amber">date ambiguous</Badge>}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-navy-900">
                      {p.valueText} {p.unit}
                    </td>
                    <td className="py-2.5 pr-4 text-navy-500">{p.refText ?? "not printed"}</td>
                    <td className="py-2.5">
                      <Badge tone={flagTone(p.flag)}>{flagLabel(p.flag)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────── changes & gaps ───────────────────────
function Changes({ tl, docs, onOpen }: { tl: TimelineResult; docs: Map<string, DocumentDTO>; onOpen: (eventId: string) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="card-pad">
        <h3 className="text-[15px] font-semibold text-navy-900">Changes between reports</h3>
        <p className="mb-3 text-[13px] text-navy-500">Computed directly from your recorded values.</p>
        {tl.changes.length === 0 ? (
          <p className="text-sm text-navy-500">Nothing measured more than once yet.</p>
        ) : (
          <ul className="space-y-3">
            {tl.changes.map((c) => (
              <li key={c.id} className="rounded-xl border border-navy-100 p-3.5">
                <p className="text-[14px] font-semibold text-navy-800">{c.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-navy-600">{c.detail}</p>
                <p className="mt-1.5 text-[12px] text-navy-400">{formatDate(c.fromDate)} → {formatDate(c.toDate)}</p>
              </li>
            ))}
          </ul>
        )}
        {tl.medications.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 text-[15px] font-semibold text-navy-900">Medication history</h3>
            <ul className="space-y-2.5">
              {tl.medications.map((m) => (
                <li key={m.generic} className="rounded-xl bg-navy-50 p-3 text-[13px]">
                  <p className="font-semibold text-navy-800">{m.name}</p>
                  {m.entries.map((e, i) => (
                    <p key={i} className="text-navy-600">
                      {formatDate(e.date)} — {[e.dose, e.frequency].filter(Boolean).join(", ") || "dose not recorded"}
                      {e.status === "stopped" ? " (stopped)" : ""} <span className="text-navy-400">· {docs.get(e.docId)?.title}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Card className="card-pad">
        <h3 className="text-[15px] font-semibold text-navy-900">Missing or unclear information</h3>
        <p className="mb-3 text-[13px] text-navy-500">Things SanoAI could not pin down — flagged rather than filled in.</p>
        {tl.gaps.length === 0 ? (
          <Callout tone="teal" title="No unclear items found" />
        ) : (
          <ul className="space-y-2.5">
            {tl.gaps.map((g) => (
              <li key={g.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                <p className="text-[13.5px] font-semibold text-amber-950">{g.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-900/80">{g.detail}</p>
                {g.eventId && (
                  <button onClick={() => onOpen(g.eventId!)} className="mt-1.5 text-[12.5px] font-medium text-sano-700 hover:underline">
                    Review &amp; correct
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────── event detail / edit ───────────────────────
function EventModal({ event, doc, onClose, onViewSource, onChanged }: { event: HealthEvent | null; doc?: DocumentDTO; onClose: () => void; onViewSource: (docId: string, quote: string) => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ title: string; date: string; details: string; category: Category; specialty: string; values: LabValue[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const e = event;
  const startEdit = () => {
    if (!e) return;
    setForm({ title: e.title, date: e.date ?? "", details: e.details, category: e.category, specialty: e.specialty, values: e.values.map((v) => ({ ...v })) });
    setEditing(true);
  };
  const close = () => {
    setEditing(false);
    setForm(null);
    onClose();
  };
  async function call(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      setEditing(false);
      onChanged();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!e} onClose={close} title={e ? (editing ? "Correct this item" : e.title) : ""} wide>
      {e && !editing && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={CATEGORY_META[e.category].tone} icon={CATEGORY_META[e.category].icon}>{CATEGORY_META[e.category].label}</Badge>
            <Badge tone="slate">{e.specialty}</Badge>
            <span className="text-[13px] font-medium text-navy-700">{formatDate(e.date)}</span>
            <CertaintyBadge c={e.dateCertainty} edited={e.userEdited} />
            <Badge tone="slate">{e.method === "llm" ? "Extracted by AI, quote-verified" : e.method === "manual" ? "Entered by you" : "Rule-based extraction"}</Badge>
          </div>
          {e.details && <p className="text-[14px] leading-relaxed text-navy-700">{e.details}</p>}

          {e.values.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-navy-100">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-navy-50 text-[11.5px] uppercase tracking-wide text-navy-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Measurement</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                    <th className="px-3 py-2 font-semibold">Lab range</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {e.values.map((v, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium text-navy-800">{v.name}</td>
                      <td className="px-3 py-2">
                        {v.valueText} {v.unit}
                      </td>
                      <td className="px-3 py-2 text-navy-500">{v.refText ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge tone={flagTone(v.flag)}>{flagLabel(v.flag)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {e.medication && (
            <p className="rounded-xl bg-navy-50 px-4 py-3 text-[13.5px] text-navy-700">
              <strong>{e.medication.name}</strong> · {e.medication.dose ?? "dose not recorded"} · {e.medication.frequency ?? "frequency not recorded"} · {e.medication.status}
              {e.medication.drugClass && <span className="text-navy-400"> · {e.medication.drugClass}</span>}
            </p>
          )}

          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-navy-400">Source — exactly as written</p>
            <blockquote className="rounded-xl border-l-4 border-sano-400 bg-sano-50/60 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-navy-700">“{e.sourceQuote}”</blockquote>
            <p className="mt-1.5 text-[12.5px] text-navy-500">From: {doc?.title ?? "document"}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-100 pt-4">
            <Button variant="secondary" icon={<FileSearch className="h-4 w-4" />} onClick={() => onViewSource(e.docId, e.sourceQuote)}>
              View original document
            </Button>
            <div className="flex flex-wrap gap-2">
              {e.userEdited && (
                <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} loading={busy} onClick={() => call(() => apiFetch(`/api/events/${e.id}/reset`, { method: "POST" }), "Restored to the original extraction.")}>
                  Reset
                </Button>
              )}
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<EyeOff className="h-4 w-4" />} loading={busy} onClick={() => call(() => apiFetch(`/api/events/${e.id}`, { method: "DELETE" }), "Hidden from your timeline. The source document is unchanged.")}>
                Hide
              </Button>
              <Button icon={<Pencil className="h-4 w-4" />} onClick={startEdit}>
                Correct
              </Button>
            </div>
          </div>
        </div>
      )}

      {e && editing && form && (
        <div className="space-y-4">
          <Callout tone="info">Your correction changes only SanoAI&apos;s interpretation. The original document stays exactly as uploaded, and you can reset to the original extraction at any time.</Callout>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="t">
              <input id="t" className="field" value={form.title} onChange={(x) => setForm({ ...form, title: x.target.value })} />
            </Field>
            <Field label="Date" htmlFor="d" hint="YYYY-MM-DD, YYYY-MM or leave empty if unknown">
              <input id="d" className="field" placeholder="2024-03-04" value={form.date} onChange={(x) => setForm({ ...form, date: x.target.value })} />
            </Field>
            <Field label="Category" htmlFor="c">
              <select id="c" className="field" value={form.category} onChange={(x) => setForm({ ...form, category: x.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Specialty" htmlFor="s">
              <select id="s" className="field" value={form.specialty} onChange={(x) => setForm({ ...form, specialty: x.target.value })}>
                {SPECIALTIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Details" htmlFor="dt">
            <textarea id="dt" className="field min-h-[70px]" value={form.details} onChange={(x) => setForm({ ...form, details: x.target.value })} />
          </Field>
          {form.values.length > 0 && (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-navy-700">Measurements</p>
              <div className="space-y-2">
                {form.values.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center gap-2 text-[13px]">
                    <span className="truncate font-medium text-navy-700">{v.name}</span>
                    {(["value", "unit", "refLow", "refHigh"] as const).map((f) => (
                      <input
                        key={f}
                        aria-label={`${v.name} ${f}`}
                        className="field !px-2 !py-1.5"
                        placeholder={f}
                        value={v[f] ?? ""}
                        onChange={(x) => {
                          const values = form.values.map((vv, j) => {
                            if (j !== i) return vv;
                            if (f === "unit") return { ...vv, unit: x.target.value || null };
                            const n = x.target.value === "" ? null : Number(x.target.value);
                            const next = { ...vv, [f]: Number.isNaN(n) ? vv[f] : n } as LabValue;
                            if (f === "value" && n != null && !Number.isNaN(n)) next.valueText = String(n);
                            next.refText = next.refLow != null || next.refHigh != null ? `${next.refLow ?? "…"} - ${next.refHigh ?? "…"}${next.unit ? " " + next.unit : ""}` : null;
                            return next;
                          });
                          setForm({ ...form, values });
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-navy-400">High/low flags are recalculated from the range you enter — never typed in by hand.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
            <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                call(
                  () => apiFetch(`/api/events/${e.id}`, { method: "PATCH", json: { title: form.title, date: form.date.trim() || null, details: form.details, category: form.category, specialty: form.specialty, values: form.values } }),
                  "Correction saved.",
                )
              }
            >
              Save correction
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AddEventModal({ open, docs, onClose, onAdded }: { open: boolean; docs: DocumentDTO[]; onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ docId: "", category: "symptom" as Category, title: "", date: "", details: "" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Add an event the extraction missed">
      <div className="space-y-4">
        <Callout tone="info">Added events are labelled “Added by you” and are never presented as part of the original document.</Callout>
        <Field label="Attach to document" htmlFor="ad">
          <select id="ad" className="field" value={f.docId} onChange={(e) => setF({ ...f, docId: e.target.value })}>
            <option value="">Choose a document…</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="ac">
            <select id="ac" className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>
              {CATEGORIES.filter((c) => c !== "lab").map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Date" htmlFor="adt" hint="YYYY-MM-DD, or leave empty">
            <input id="adt" className="field" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} placeholder="2024-05-12" />
          </Field>
        </div>
        <Field label="What happened?" htmlFor="at">
          <input id="at" className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />
        </Field>
        <Field label="Details (optional)" htmlFor="ad2">
          <textarea id="ad2" className="field min-h-[70px]" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            disabled={!f.docId || !f.title.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await apiFetch("/api/events", { method: "POST", json: { docId: f.docId, category: f.category, title: f.title, date: f.date.trim() || null, details: f.details } });
                toast("Event added.");
                setF({ ...f, title: "", date: "", details: "" });
                onAdded();
              } catch (e) {
                toast((e as Error).message, "err");
              } finally {
                setBusy(false);
              }
            }}
          >
            Add event
          </Button>
        </div>
      </div>
    </Modal>
  );
}

void sortKey;
