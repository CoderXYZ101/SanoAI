"use client";
import { Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/common";
import { Badge, Button, Callout, Card, Field, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";
import { AMOUNTS, type BillingPeriod, type PayItem } from "@/lib/billing";
import type { PaymentClaim } from "@/lib/payments";

interface Data {
  claims: PaymentClaim[];
  upi: { id: string; name: string };
  demo: boolean;
}
const LABEL: Record<PayItem, string> = { plus: "Sano Plus", pro: "Sano Pro", report: "Premium report" };

/** Pay by UPI, then submit the transaction reference for manual verification. */
export default function UpiPayment({ period }: { period: BillingPeriod }) {
  const { data, reload } = useApi<Data>("/api/payments");
  const [item, setItem] = useState<PayItem>("plus");
  const [reference, setReference] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const amount = AMOUNTS[item][period];
  const upi = data?.upi.id ?? "";
  const link = upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(data!.upi.name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`SanoAI ${LABEL[item]}`)}` : "";

  useEffect(() => {
    if (!link) return setQr("");
    QRCode.toDataURL(link, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(""));
  }, [link]);

  if (!data) return null;
  if (!upi && !data.demo && !data.claims.length) return null; // UPI not offered on this deployment

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/payments", { method: "POST", json: { item, period, method: "upi", reference } });
      toast("Submitted. Access starts once the payment is verified.");
      setReference("");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="card-pad">
      <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-sano-600" /><h2 className="text-[15px] font-semibold text-navy-900">Pay by UPI</h2></div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="What are you paying for?" htmlFor="upi-item">
            <select id="upi-item" className="field" value={item} onChange={(e) => setItem(e.target.value as PayItem)}>
              <option value="plus">Sano Plus — ₹{AMOUNTS.plus[period].toLocaleString("en-IN")} {period === "year" ? "per year" : "for a month"}</option>
              <option value="pro">Sano Pro — ₹{AMOUNTS.pro[period].toLocaleString("en-IN")} {period === "year" ? "per year" : "for a month"}</option>
              <option value="report">Premium report — ₹99 once</option>
            </select>
          </Field>
          {upi ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-navy-50 p-5 text-center">
              {qr && <img src={qr} alt={`UPI QR code to pay ₹${amount}`} width={180} height={180} className="rounded-xl bg-white p-2" />}
              <p className="text-[13px] text-navy-600">Scan with any UPI app and pay <strong>₹{amount.toLocaleString("en-IN")}</strong></p>
              <p className="break-all font-mono text-[14px] font-semibold text-navy-900">{upi}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <CopyButton text={upi} label="Copy UPI ID" />
                <a href={link} className="inline-flex h-8 items-center rounded-xl bg-navy-900 px-3 text-[13px] font-medium text-white sm:hidden">Open UPI app</a>
              </div>
            </div>
          ) : (
            <Callout tone="warn" title="UPI is not set up yet">{data.demo ? "Demo mode: do not pay anything. Enter any made-up reference to try the verification flow." : "Online UPI payment is unavailable right now."}</Callout>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-[13.5px] leading-relaxed text-navy-600">After paying, enter the <strong>UPI transaction reference (UTR)</strong> shown in your UPI app, usually 12 digits. We check it against our statement before activating access.</p>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex gap-2">
            <input aria-label="UPI transaction reference" className="field font-mono" placeholder="e.g. 432109876543" maxLength={40} value={reference} onChange={(e) => setReference(e.target.value.trim())} />
            <Button type="submit" loading={busy} disabled={reference.length < 8 || (!upi && !data.demo)}>Submit</Button>
          </form>
          <p className="text-[12px] text-navy-400">Never share your UPI PIN or OTP. We will never ask for them.</p>
          {data.claims.length > 0 && (
            <ul className="divide-y divide-navy-100 rounded-xl border border-navy-100">
              {data.claims.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                  <span className="min-w-0"><span className="font-medium text-navy-800">{LABEL[c.item]} · ₹{c.amount.toLocaleString("en-IN")}</span><span className="block truncate font-mono text-[12px] text-navy-400">{c.reference}</span>{c.note && <span className="block text-[12px] text-rose-700">{c.note}</span>}</span>
                  <Badge tone={c.status === "approved" ? "green" : c.status === "rejected" ? "rose" : "amber"}>{c.status === "pending" ? "Waiting for review" : c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
