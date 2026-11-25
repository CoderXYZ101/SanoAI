"use client";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import type { DocumentDTO, HealthEvent } from "@/ai/types";
import { formatDate } from "@/ai/engines/dates";
import { CATEGORY_META, CertaintyBadge } from "@/components/common";
import { Badge, Callout, LoadingBlock, Modal, Segmented } from "@/components/ui";
import { openFile, useApi } from "@/lib/client";

/** Shows the ORIGINAL document text (never AI-modified) with the supporting quote highlighted, next to what was extracted. */
export default function DocViewer({ docId, highlight, onClose }: { docId: string | null; highlight?: string; onClose: () => void }) {
  const { data, error, loading } = useApi<{ document: DocumentDTO; text: string | null; events: HealthEvent[] }>(docId ? `/api/documents/${docId}` : null);
  const [tab, setTab] = useState<"text" | "events">("text");

  const parts = useMemo(() => {
    const text = data?.text ?? "";
    if (!text || !highlight) return null;
    const needle = highlight.replace(/…$/, "").trim();
    if (needle.length < 4) return null;
    // whitespace-tolerant search
    const esc = needle.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
    const m = new RegExp(esc, "i").exec(text);
    if (!m) return null;
    return [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)] as const;
  }, [data, highlight]);

  return (
    <Modal open={!!docId} onClose={onClose} title={data?.document.title ?? "Document"} wide>
      {loading && <LoadingBlock rows={3} />}
      {error && <Callout tone="alert">{error}</Callout>}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-navy-500">
              <Badge tone={data.document.isDemo ? "amber" : "slate"}>{data.document.isDemo ? "Synthetic demo record" : data.document.originalName}</Badge>
              <span>Text source: {data.document.textSource === "ai-vision" ? "AI transcription of the image/PDF" : data.document.textSource === "pdf-text" ? "PDF text layer" : data.document.textSource === "manual" ? "pasted by you" : "file text"}</span>
              <span>· Extraction: {data.document.extractionMethod === "ai-verified" ? "AI, quote-verified" : "rule-based"}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => openFile(`/api/documents/${data.document.id}/file`)} className="inline-flex items-center gap-1 text-[13px] font-medium text-sano-700 hover:underline">
                Open original file <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <Segmented value={tab} onChange={setTab} label="View" options={[{ value: "text", label: "Original text" }, { value: "events", label: `Extracted (${data.events.length})` }]} />
            </div>
          </div>

          {data.document.statusDetail && <Callout tone="warn">{data.document.statusDetail}</Callout>}

          {tab === "text" ? (
            data.text ? (
              <div>
                <p className="mb-2 text-[12px] text-navy-400">This is the document as stored — SanoAI never edits it. {highlight ? "The highlighted passage is the source for the item you opened." : ""}</p>
                <pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-navy-950 p-5 font-mono text-[12.5px] leading-relaxed text-navy-100">
                  {parts ? (
                    <>
                      {parts[0]}
                      <mark id="hl" ref={(el) => el?.scrollIntoView({ block: "center" })} className="rounded bg-sano-400/90 px-0.5 text-navy-950">
                        {parts[1]}
                      </mark>
                      {parts[2]}
                    </>
                  ) : (
                    data.text
                  )}
                </pre>
                {highlight && !parts && <p className="mt-2 text-[12.5px] text-navy-500">Source passage: <span className="font-mono">“{highlight}”</span></p>}
              </div>
            ) : (
              <Callout tone="warn">No text has been extracted from this file yet.</Callout>
            )
          ) : (
            <ul className="max-h-[52vh] space-y-2 overflow-auto pr-1">
              {data.events.map((e) => {
                const m = CATEGORY_META[e.category];
                return (
                  <li key={e.id} className="rounded-xl border border-navy-100 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>
                      <span className="text-[12px] text-navy-400">{formatDate(e.date)}</span>
                      <CertaintyBadge c={e.dateCertainty} edited={e.userEdited} />
                    </div>
                    <p className="mt-1 text-[14px] font-medium text-navy-800">{e.title}</p>
                    <p className="mt-1 font-mono text-[12px] text-navy-500">“{e.sourceQuote}”</p>
                  </li>
                );
              })}
              {!data.events.length && <p className="text-sm text-navy-500">Nothing was extracted from this document.</p>}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
