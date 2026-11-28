"use client";
import { motion } from "framer-motion";
import { FileText, Image as ImageIcon, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import { DOC_TYPES, type DocType } from "@/ai/constants";
import type { DocumentDTO } from "@/ai/types";
import DocViewer from "@/components/DocViewer";
import { Badge, Button, Callout, Card, EmptyState, ErrorState, Field, LimitsNote, LoadingBlock, Modal, PageHeader, SectionTitle, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

const MAX = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv";

function TagInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t) && value.length < 30) onChange([...value, t.slice(0, 80)]);
    setDraft("");
  };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-navy-100 bg-white p-2 focus-within:border-sano-400 focus-within:ring-4 focus-within:ring-sano-200/50">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-sano-50 px-2.5 py-1 text-[13px] text-sano-900 ring-1 ring-sano-200">
            {v}
            <button onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-sano-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-navy-300"
          aria-label={label}
        />
      </div>
    </Field>
  );
}

function Records() {
  const params = useSearchParams();
  const { data, error, loading, reload } = useApi<{ documents: DocumentDTO[] }>("/api/documents");
  const toast = useToast();
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType | "auto">("auto");
  const [view, setView] = useState<string | null>(params.get("doc"));
  const [confirmDel, setConfirmDel] = useState<DocumentDTO | null>(null);
  const [pasteFor, setPasteFor] = useState<DocumentDTO | null>(null);
  const [pasted, setPasted] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      for (const f of Array.from(files)) {
        if (f.size > MAX) {
          toast(`${f.name} is larger than 10 MB.`, "err");
          continue;
        }
        setUploading(f.name);
        try {
          const fd = new FormData();
          fd.append("file", f);
          fd.append("docType", docType);
          const r = await apiFetch<{ document: DocumentDTO }>("/api/documents", { method: "POST", body: fd });
          toast(r.document.status === "processed" ? `${f.name} analysed.` : `${f.name} saved — it needs its text added.`, r.document.status === "processed" ? "ok" : "err");
        } catch (e) {
          toast(`${f.name}: ${(e as Error).message}`, "err");
        }
      }
      setUploading(null);
      reload();
    },
    [docType, reload, toast],
  );

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await fn();
      toast(ok);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusyId(null);
    }
  }

  const docs = data?.documents ?? [];
  const hasDemo = docs.some((d) => d.isDemo);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My records"
        title="Your reports in one place"
        description="Add reports, prescriptions and summaries. Only you can see them."
        actions={
          hasDemo ? (
            <Button variant="secondary" onClick={() => act("demo", () => apiFetch("/api/documents/demo", { method: "DELETE" }), "Demo records removed.")} loading={busyId === "demo"} icon={<Trash2 className="h-4 w-4" />}>
              Remove demo records
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => act("demo", () => apiFetch("/api/documents/demo", { method: "POST" }), "Synthetic demo records loaded.")} loading={busyId === "demo"}>
              Load synthetic demo records
            </Button>
          )
        }
      />

      {/* upload */}
      <Card className="card-pad">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
          }}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-sano-400 bg-sano-50" : "border-navy-200 bg-navy-50/40"}`}
        >
          {uploading ? (
            <div role="status" className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-sano-500" />
              <p className="text-sm font-medium text-navy-700">Reading and verifying {uploading}…</p>
              <p className="text-xs text-navy-400">Extracting text, then extracting facts with source quotes.</p>
            </div>
          ) : (
            <>
              <motion.div animate={{ y: drag ? -4 : 0 }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sano-600 shadow-soft">
                <UploadCloud className="h-6 w-6" />
              </motion.div>
              <p className="mt-3 text-[15px] font-semibold text-navy-900">Drag files here, or choose files</p>
              <p className="mt-1 text-[13px] text-navy-500">PDF, PNG/JPG/WebP images, or text files · up to 10 MB each</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <div className="w-52">
                  <select aria-label="Document type" className="field !py-2" value={docType} onChange={(e) => setDocType(e.target.value as DocType | "auto")}>
                    <option value="auto">Detect type automatically</option>
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={() => input.current?.click()} icon={<UploadCloud className="h-4 w-4" />}>
                  Choose files
                </Button>
                <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-navy-500">
          Text and digital PDFs are read locally. Scanned PDFs and photos need the optional AI vision provider <em>and</em> your consent in Settings; otherwise you can paste the text. Nothing is sent to an external AI service without your consent.
        </p>
      </Card>

      {/* list */}
      <section>
        <SectionTitle title="Documents" hint={`${docs.length} stored`} />
        {loading && !data ? (
          <LoadingBlock rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : docs.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No documents yet" body="Upload your first record above, or load the synthetic demo records to explore." />
        ) : (
          <ul className="space-y-2.5">
            {docs.map((d) => (
              <li key={d.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-sano-300">{d.mime.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
                    <div className="min-w-0">
                      <button onClick={() => setView(d.id)} className="block max-w-full truncate text-left text-[15px] font-semibold text-navy-900 hover:text-sano-700">
                        {d.title}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-navy-400">
                        <Badge tone="slate">{DOC_TYPES.find((t) => t.value === d.docType)?.label}</Badge>
                        {d.isDemo && <Badge tone="amber">Synthetic demo</Badge>}
                        <Badge tone={d.status === "processed" ? "green" : "amber"}>{d.status === "processed" ? `Analysed · ${d.extractionMethod === "ai-verified" ? "AI, quote-verified" : "rule-based"}` : "Needs text"}</Badge>
                        <span>{(d.size / 1024).toFixed(0)} KB · {new Date(d.createdAt).toLocaleDateString("en-IN")}</span>
                      </div>
                      {d.statusDetail && <p className="mt-1.5 text-[12.5px] text-amber-700">{d.statusDetail}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {d.status === "needs_text" && (
                      <Button size="sm" onClick={() => { setPasteFor(d); setPasted(""); }}>
                        Add text
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setView(d.id)}>
                      View
                    </Button>
                    {d.hasText && (
                      <Button size="sm" variant="ghost" loading={busyId === d.id} icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => act(d.id, () => apiFetch(`/api/documents/${d.id}/reprocess`, { method: "POST" }), "Re-analysed. Your manual edits to this document's events were reset.")} aria-label={`Re-analyse ${d.title}`}>
                        Re-analyse
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDel(d)} aria-label={`Delete ${d.title}`}>
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <HealthProfile />

      <LimitsNote>You can delete any document at any time. Deleting erases the stored file and every fact extracted from it. Extraction can contain mistakes — open a document to compare what was extracted with the original.</LimitsNote>

      <DocViewer docId={view} onClose={() => setView(null)} />

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete this document?">
        <p className="text-sm leading-relaxed text-navy-600">
          <strong>{confirmDel?.title}</strong> and everything extracted from it will be permanently erased from your account. This can&apos;t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDel(null)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const d = confirmDel!;
              setConfirmDel(null);
              await act(d.id, () => apiFetch(`/api/documents/${d.id}`, { method: "DELETE" }), "Document deleted.");
            }}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>

      <Modal open={!!pasteFor} onClose={() => setPasteFor(null)} title={`Add text for “${pasteFor?.title ?? ""}”`} wide>
        <p className="mb-3 text-[13.5px] text-navy-500">Type or paste the text of the document exactly as written. SanoAI stores it as the original text and then extracts facts from it.</p>
        <textarea className="field min-h-[220px] font-mono text-[13px]" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Haemoglobin 11.2 g/dL (12.0 - 15.5) LOW …" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPasteFor(null)}>
            Cancel
          </Button>
          <Button
            disabled={pasted.trim().length < 20}
            loading={busyId === pasteFor?.id}
            onClick={async () => {
              const d = pasteFor!;
              await act(d.id, () => apiFetch(`/api/documents/${d.id}`, { method: "PATCH", json: { textContent: pasted } }), "Text added and analysed.");
              setPasteFor(null);
            }}
          >
            Save & analyse
          </Button>
        </div>
      </Modal>
    </div>
  );
}

interface Profile {
  ageRange: string;
  sex: string;
  conditions: string[];
  allergies: string[];
  medications: string[];
  notes: string;
}
function HealthProfile() {
  const { data, loading, error } = useApi<{ profile: Profile }>("/api/profile");
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const cur = p ?? data?.profile ?? null;
  const set = (patch: Partial<Profile>) => cur && setP({ ...cur, ...patch });
  return (
    <section id="profile">
      <SectionTitle title="Health profile" hint="Self-reported. Used as context by the assistant and modules — only if you allow it in Settings." />
      <Card className="card-pad">
        {loading && !cur ? (
          <LoadingBlock rows={2} />
        ) : error || !cur ? (
          <ErrorState message={error ?? "Couldn't load your profile."} />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Age range" htmlFor="age">
                <select id="age" className="field" value={cur.ageRange} onChange={(e) => set({ ageRange: e.target.value })}>
                  <option value="">Prefer not to say</option>
                  {["Under 18", "18–29", "30–44", "45–59", "60–74", "75+"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sex (as relevant to health)" htmlFor="sex">
                <select id="sex" className="field" value={cur.sex} onChange={(e) => set({ sex: e.target.value })}>
                  <option value="">Prefer not to say</option>
                  {["Female", "Male", "Another / not listed"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
            </div>
            <TagInput label="Known conditions" value={cur.conditions} onChange={(conditions) => set({ conditions })} placeholder="e.g. Type 2 diabetes — press Enter" />
            <TagInput label="Allergies" value={cur.allergies} onChange={(allergies) => set({ allergies })} placeholder="e.g. Penicillin — press Enter" />
            <TagInput label="Current medicines" value={cur.medications} onChange={(medications) => set({ medications })} placeholder="e.g. Metformin 500 mg — press Enter" />
            <Field label="Notes for yourself" htmlFor="notes">
              <textarea id="notes" className="field min-h-[80px]" maxLength={1500} value={cur.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button
                loading={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await apiFetch("/api/profile", { method: "PUT", json: cur });
                    toast("Profile saved.");
                  } catch (e) {
                    toast((e as Error).message, "err");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save profile
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<LoadingBlock rows={3} />}>
      <Records />
      <Callout tone="info" className="mt-6" title="Where your files live">
        Uploaded files are stored in your private area of Cloud Firestore. Security rules let only your signed-in account read or delete them, and Google Cloud encrypts the data at rest.
      </Callout>
    </Suspense>
  );
}
