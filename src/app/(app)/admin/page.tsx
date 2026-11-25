"use client";
import { AlertTriangle, Check, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/common";
import { Badge, Button, Callout, Card, EmptyState, ErrorState, Field, LoadingBlock, Modal, PageHeader, Segmented, useToast } from "@/components/ui";
import { AMOUNTS } from "@/lib/billing";
import { apiFetch, useApi } from "@/lib/client";
import type { AdminUser, PaymentClaim } from "@/lib/payments";

type Pending = PaymentClaim & { user: AdminUser | null; referenceUsed: boolean };
interface Data {
  pending: Pending[];
  history: PaymentClaim[];
  leads: (Record<string, string> & { id: string })[];
  codes: (Record<string, string | null> & { id: string })[];
}
const ITEM: Record<string, string> = { plus: "Sano Plus", pro: "Sano Pro", report: "Premium report" };
const price = (c: PaymentClaim) => AMOUNTS[c.item][c.period];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN") : "");
const what = (c: PaymentClaim) => `${ITEM[c.item]}${c.item === "report" ? "" : c.period === "year" ? " · yearly" : " · monthly"}`;

export default function AdminPage() {
  const { data, error, loading, reload } = useApi<Data>("/api/admin");
  const [tab, setTab] = useState<"payments" | "codes" | "leads">("payments");
  const [busy, setBusy] = useState<string | null>(null);
  const [approve, setApprove] = useState<Pending | null>(null);
  const [reject, setReject] = useState<Pending | null>(null);
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  const [form, setForm] = useState({ count: 10, plan: "plus", validUntil: "", sponsor: "" });
  const [fresh, setFresh] = useState<string[]>([]);
  const toast = useToast();

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <LoadingBlock rows={4} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Payments and partners" description="Verify payments, create sponsor codes and read business enquiries. Administrators cannot see anyone's medical records." actions={<Button variant="secondary" onClick={reload} loading={loading}>Refresh</Button>} />
      <Segmented value={tab} onChange={setTab} label="Admin sections" options={[{ value: "payments", label: `Payments (${data.pending.length})` }, { value: "codes", label: `Sponsor codes (${data.codes.length})` }, { value: "leads", label: `Enquiries (${data.leads.length})` }]} />

      {tab === "payments" && (
        <div className="space-y-6">
          <Callout tone="warn" title="Check the money arrived before approving">Find the reference (UTR) and amount in your bank, UPI or Razorpay statement. A screenshot sent by the customer is not proof.</Callout>
          {data.pending.length === 0 ? (
            <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No payments waiting" body="New payment claims appear here." />
          ) : (
            <ul className="space-y-3">
              {data.pending.map((c) => (
                <li key={c.id}>
                  <Card className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-2xl font-semibold text-navy-900">₹{c.amount.toLocaleString("en-IN")}</p>
                        <Badge tone="teal">{what(c)}</Badge>
                        <Badge tone="slate">{c.method.toUpperCase()}</Badge>
                      </div>
                      <p className="mt-1 text-[13.5px] text-navy-700">{c.user?.name ?? "Unknown user"} · {c.email}</p>
                      <p className="mt-1 break-all font-mono text-[13px] text-navy-900">Ref: {c.reference}</p>
                      <p className="text-[12px] text-navy-400">Submitted {when(c.created_at)}</p>
                      {c.amount !== price(c) && <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-rose-700"><AlertTriangle className="h-4 w-4" /> Amount does not match the price (₹{price(c).toLocaleString("en-IN")}). Reject this claim.</p>}
                      {c.referenceUsed && <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-rose-700"><AlertTriangle className="h-4 w-4" /> This reference was already approved once. Do not approve it again.</p>}
                      {c.item !== "report" && c.user && c.user.plan !== "free" && c.user.plan !== c.item && c.user.plan_until && new Date(c.user.plan_until) > new Date() && (
                        <p className="mt-2 text-[13px] text-amber-700">This user already has {ITEM[c.user.plan]} until {new Date(c.user.plan_until).toLocaleDateString("en-IN")}. Approving replaces it.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button disabled={c.referenceUsed || !c.user || c.amount !== price(c)} icon={<Check className="h-4 w-4" />} onClick={() => { setChecked(false); setApprove(c); }}>Approve</Button>
                      <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => { setNote(""); setReject(c); }}>Reject</Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {data.history.length > 0 && (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-navy-50 text-[11px] uppercase tracking-wide text-navy-400"><tr><th className="px-4 py-2.5">Reviewed</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5">Amount</th><th className="px-4 py-2.5">Reference</th><th className="px-4 py-2.5">Result</th></tr></thead>
                <tbody className="divide-y divide-navy-100">
                  {data.history.map((c) => (
                    <tr key={c.id}><td className="whitespace-nowrap px-4 py-2 text-navy-500">{when(c.reviewed_at)}</td><td className="px-4 py-2">{c.email}</td><td className="px-4 py-2">{what(c)}</td><td className="px-4 py-2">₹{c.amount.toLocaleString("en-IN")}</td><td className="px-4 py-2 font-mono text-[12px]">{c.reference}</td><td className="px-4 py-2"><Badge tone={c.status === "approved" ? "green" : "rose"}>{c.status}</Badge> {c.note && <span className="text-navy-400">{c.note}</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === "codes" && (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Card className="card-pad space-y-3">
            <h2 className="text-[15px] font-semibold text-navy-900">Create sponsor codes</h2>
            <Field label="Sponsor" htmlFor="sp"><input id="sp" className="field" placeholder="e.g. City Diagnostics" value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="How many (max 50)" htmlFor="ct"><input id="ct" type="number" min={1} max={50} className="field" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} /></Field>
              <Field label="Plan" htmlFor="pl"><select id="pl" className="field" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}><option value="plus">Sano Plus</option><option value="pro">Sano Pro</option></select></Field>
            </div>
            <Field label="Access valid until" htmlFor="vu"><input id="vu" type="date" className="field" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
            <Button className="w-full" loading={busy === "codes"} disabled={!form.sponsor.trim() || !form.validUntil} onClick={() => act("codes", async () => { const r = await apiFetch<{ codes: string[] }>("/api/admin", { method: "PUT", json: form }); setFresh(r.codes); toast(`${r.codes.length} codes created.`); })}>Create codes</Button>
            {fresh.length > 0 && <div className="rounded-xl bg-navy-50 p-3"><pre className="max-h-40 overflow-auto font-mono text-[12.5px] text-navy-800">{fresh.join("\n")}</pre><div className="mt-2"><CopyButton text={fresh.join("\n")} label="Copy codes" /></div></div>}
          </Card>
          <Card className="max-h-[560px] overflow-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-navy-50 text-[11px] uppercase tracking-wide text-navy-400"><tr><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Sponsor</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Until</th><th className="px-4 py-2.5">Status</th></tr></thead>
              <tbody className="divide-y divide-navy-100">
                {data.codes.map((c) => <tr key={c.id}><td className="px-4 py-2 font-mono text-[12px]">{c.id}</td><td className="px-4 py-2">{c.sponsor}</td><td className="px-4 py-2">{c.plan}</td><td className="px-4 py-2 text-navy-500">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-IN") : ""}</td><td className="px-4 py-2"><Badge tone={c.redeemed_by ? "slate" : "green"}>{c.redeemed_by ? "Used" : "Unused"}</Badge></td></tr>)}
                {!data.codes.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-navy-400">No codes yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "leads" && (
        data.leads.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.leads.map((l) => <li key={l.id}><Card className="p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-[15px] font-semibold text-navy-900">{l.org}</p><Badge tone="teal">{l.type}</Badge></div><p className="mt-1 text-[13.5px] text-navy-700">{l.name} · {l.contact}</p>{l.volume && <p className="text-[13px] text-navy-500">Volume: {l.volume}</p>}{l.message && <p className="mt-1 text-[13px] text-navy-600">{l.message}</p>}<p className="mt-1 text-[12px] text-navy-400">{when(l.created_at)}</p></Card></li>)}
          </ul>
        ) : <EmptyState title="No enquiries yet" body="Submissions from the business page appear here. The form is public, so check each one before replying." />
      )}

      <Modal open={!!approve} onClose={() => setApprove(null)} title="Approve this payment?">
        {approve && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-navy-600">{approve.email} will get <strong>{what(approve)}</strong> for ₹{approve.amount.toLocaleString("en-IN")}.</p>
            <p className="break-all rounded-xl bg-navy-50 p-3 font-mono text-[13px]">{approve.reference}</p>
            <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-navy-700"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-sano-600" checked={checked} onChange={(e) => setChecked(e.target.checked)} />I found this reference in my statement and the amount received is ₹{approve.amount.toLocaleString("en-IN")}.</label>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setApprove(null)}>Cancel</Button><Button disabled={!checked} loading={busy === approve.id} onClick={() => act(approve.id, async () => { await apiFetch("/api/admin", { method: "POST", json: { action: "approve", id: approve.id } }); toast("Approved. Access is active."); setApprove(null); })}>Approve</Button></div>
          </div>
        )}
      </Modal>
      <Modal open={!!reject} onClose={() => setReject(null)} title="Reject this payment">
        {reject && (
          <div className="space-y-4">
            <Field label="Reason (the customer will see this)" htmlFor="rn"><input id="rn" className="field" maxLength={200} placeholder="e.g. No payment found with this reference" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setReject(null)}>Cancel</Button><Button variant="danger" disabled={note.trim().length < 3} loading={busy === reject.id} onClick={() => act(reject.id, async () => { await apiFetch("/api/admin", { method: "POST", json: { action: "reject", id: reject.id, note } }); toast("Rejected."); setReject(null); })}>Reject</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
