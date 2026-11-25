"use client";
import { Copy, Link2, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, Card, Field, SectionTitle, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

interface LinkRow {
  id: string;
  label: string;
  sections: string[];
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  revoked: boolean;
}
const SECTION_LABELS: Record<string, string> = { summary: "Timeline summary", medicines: "Medicines", allergies: "Allergies", results: "Recent results", symptoms: "Symptoms", questions: "My questions" };

/** Create/revoke secure, time-limited, read-only links a patient can send to ANY doctor. */
export default function ShareLinksCard() {
  const { data, reload } = useApi<{ links: LinkRow[] }>("/api/share-links");
  const [label, setLabel] = useState("");
  const [secs, setSecs] = useState<string[]>(["summary", "medicines", "allergies", "results", "questions"]);
  const [days, setDays] = useState(7);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const toast = useToast();

  async function create() {
    setBusy(true);
    setLimitMsg(null);
    try {
      const r = await apiFetch<{ path: string }>("/api/share-links", { method: "POST", json: { label, sections: secs, days, consent: true } });
      const url = `${window.location.origin}${r.path}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast("Secure link created and copied to your clipboard.");
      setLabel("");
      setConsent(false);
      reload();
    } catch (e) {
      const m = (e as Error).message;
      if (/plan includes/i.test(m)) setLimitMsg(m);
      else toast(m, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionTitle title="Share securely with any doctor" hint="A private, read-only link — only the sections you choose, expires automatically, revocable any time." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="card-pad space-y-4">
          <div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-sano-600" /><h3 className="text-[15px] font-semibold text-navy-900">Create a link</h3></div>
          <Field label="Who is it for?" htmlFor="sl-label"><input id="sl-label" className="field" placeholder="e.g. Dr. Perera — cardiology visit" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(SECTION_LABELS).map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-navy-100 px-3 py-2 text-[13px] text-navy-700">
                <input type="checkbox" className="h-4 w-4 accent-sano-600" checked={secs.includes(k)} onChange={(e) => setSecs((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />
                {l}
              </label>
            ))}
          </div>
          <Field label="Link expires after" htmlFor="sl-days">
            <select id="sl-days" className="field" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
            </select>
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-sano-50 p-3.5 text-[13px] leading-relaxed text-sano-950">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-sano-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I consent to anyone who has this link seeing the selected sections until it expires or I revoke it. I understand a copy of those sections is stored in my account for the link to work.</span>
          </label>
          {limitMsg && <Callout tone="warn">{limitMsg} <Link href="/pricing" className="font-semibold underline">See plans</Link></Callout>}
          <Button className="w-full" loading={busy} disabled={!consent || !label.trim() || !secs.length} icon={<ShieldCheck className="h-4 w-4" />} onClick={create}>Create secure link</Button>
        </Card>
        <div className="space-y-2.5">
          {data?.links.length ? (
            data.links.map((l) => {
              const url = typeof window !== "undefined" ? `${window.location.origin}/share?id=${l.id}` : "";
              const dead = l.expired || l.revoked;
              return (
                <Card key={l.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-navy-900">{l.label}</p>
                      <p className="mt-0.5 text-[12.5px] text-navy-500">{l.sections.map((s) => SECTION_LABELS[s]).join(", ")}</p>
                      <p className="mt-1 text-[12px] text-navy-400">{dead ? "Expired" : `Expires ${new Date(l.expiresAt).toLocaleDateString("en-IN")}`}</p>
                    </div>
                    {dead ? <Badge tone="slate">Inactive</Badge> : <Badge tone="green">Active</Badge>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {!dead && <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={async () => { await navigator.clipboard.writeText(url); toast("Link copied."); }}>Copy link</Button>}
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => { await apiFetch("/api/share-links", { method: "DELETE", json: { id: l.id } }); toast("Link revoked and its data erased."); reload(); }}>Revoke &amp; erase</Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-navy-200 p-5 text-sm text-navy-500">No links yet. Create one to send your summary to a doctor without email attachments.</p>
          )}
        </div>
      </div>
    </section>
  );
}
