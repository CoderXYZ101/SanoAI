"use client";
import { ArrowUpRight, Beaker, CalendarClock, ClipboardList, FileHeart, FlaskConical, HeartPulse, Pill, ScanLine, ShieldAlert, Stethoscope, Syringe, Thermometer } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Category, DocumentDTO, EvidenceRef } from "@/ai/types";
import { Badge, Button, EmptyState, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

export function useDocMap() {
  const { data, reload } = useApi<{ documents: DocumentDTO[] }>("/api/documents");
  const map = useMemo(() => new Map((data?.documents ?? []).map((d) => [d.id, d])), [data]);
  return { map, docs: data?.documents ?? [], reload };
}

/** Empty state shown by every analysis module when there are no records yet. */
export function NoRecords({ what, onLoaded }: { what: string; onLoaded?: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ loaded: number }>("/api/documents/demo", { method: "POST" });
      toast(`Loaded ${r.loaded} synthetic demonstration documents.`);
      onLoaded?.();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }, [onLoaded, toast]);
  return (
    <EmptyState
      icon={<FileHeart className="h-6 w-6" />}
      title="No records to analyse yet"
      body={`${what} works from your own documents. Upload a report or prescription, or load the synthetic demonstration records to see how it works.`}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button href="/records" variant="secondary">
            Upload a record
          </Button>
          <Button onClick={load} loading={busy}>
            Load demo records
          </Button>
        </div>
      }
    />
  );
}

export const CATEGORY_META: Record<Category, { label: string; icon: ReactNode; tone: "teal" | "sky" | "amber" | "rose" | "slate" | "navy" | "green" }> = {
  lab: { label: "Lab results", icon: <FlaskConical className="h-4 w-4" />, tone: "teal" },
  medication: { label: "Medication", icon: <Pill className="h-4 w-4" />, tone: "sky" },
  symptom: { label: "Symptom", icon: <Thermometer className="h-4 w-4" />, tone: "amber" },
  diagnosis: { label: "Diagnosis / impression", icon: <ClipboardList className="h-4 w-4" />, tone: "navy" },
  visit: { label: "Visit / admission", icon: <Stethoscope className="h-4 w-4" />, tone: "green" },
  procedure: { label: "Procedure / test", icon: <HeartPulse className="h-4 w-4" />, tone: "sky" },
  imaging: { label: "Imaging", icon: <ScanLine className="h-4 w-4" />, tone: "sky" },
  allergy: { label: "Allergy", icon: <ShieldAlert className="h-4 w-4" />, tone: "rose" },
  other: { label: "Other", icon: <Syringe className="h-4 w-4" />, tone: "slate" },
};

export const CERTAINTY_LABEL: Record<string, string> = {
  explicit: "Date as printed",
  document: "Date from document header",
  ambiguous: "Ambiguous date — please confirm",
  partial: "Month / year only",
  unlabeled: "Unlabelled date",
  missing: "No date found",
};

export function CertaintyBadge({ c, edited }: { c: string; edited?: boolean }) {
  if (edited) return <Badge tone="teal">Confirmed by you</Badge>;
  if (c === "explicit") return null;
  return <Badge tone={c === "missing" || c === "ambiguous" ? "amber" : "slate"} icon={<CalendarClock className="h-3 w-3" />}>{CERTAINTY_LABEL[c]}</Badge>;
}

/** Evidence quotes with a link back to the source document — traceability everywhere. */
export function EvidenceList({ evidence, docs, max = 3 }: { evidence: EvidenceRef[]; docs: Map<string, DocumentDTO>; max?: number }) {
  const items = evidence.filter((e) => e.quote).slice(0, max);
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((e, i) => {
        const d = e.docId ? docs.get(e.docId) : undefined;
        return (
          <li key={i} className="rounded-lg bg-navy-50/80 px-3 py-2 text-[12.5px] leading-snug text-navy-600">
            <span className="font-mono text-[12px]">“{e.quote!.length > 160 ? e.quote!.slice(0, 160) + "…" : e.quote}”</span>
            {d && (
              <Link href={`/records?doc=${d.id}`} className="ml-2 inline-flex items-center gap-0.5 font-medium text-sano-700 hover:underline">
                {d.title} <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<Beaker className="hidden" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast("Copied to clipboard.");
        } catch {
          toast("Couldn't copy — select the text and copy manually.", "err");
        }
      }}
    >
      {label}
    </Button>
  );
}
