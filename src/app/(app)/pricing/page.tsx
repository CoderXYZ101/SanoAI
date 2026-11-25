"use client";
import { motion } from "framer-motion";
import { Building2, Check, Crown, FileText, Gift, Sparkles } from "lucide-react";
import { useState } from "react";
import UpiPayment from "@/components/UpiPayment";
import { Badge, Button, Callout, Card, ErrorState, LimitsNote, LoadingBlock, PageHeader, Segmented, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";
import type { BillingPeriod, PlanDef, PlanId, PlanLimits } from "@/lib/billing";

interface BillingData {
  plan: PlanId;
  planUntil: string | null;
  limits: PlanLimits;
  usage: { managedAi: number };
  plans: PlanDef[];
  credits: { paid: number; demo: number };
  demoBilling: boolean;
  managedAiAvailable: boolean;
  checkout: { month: { plus: boolean; pro: boolean }; year: { plus: boolean; pro: boolean }; report: boolean };
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const unlimited = max < 0;
  const pct = unlimited || max === 0 ? 0 : Math.min(100, (used / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-[12.5px]">
        <span className="font-medium text-navy-700">{label}</span>
        <span className="text-navy-500">{unlimited ? `${used} · unlimited` : `${used} / ${max}`}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-100">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full rounded-full ${pct > 85 ? "bg-amber-500" : "bg-sano-500"}`} />
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { data, error, loading, reload } = useApi<BillingData>("/api/billing");
  const docs = useApi<{ documents: unknown[] }>("/api/documents");
  const [busy, setBusy] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const [code, setCode] = useState("");
  const toast = useToast();

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(null);
    }
  }
  async function pay(item: "plus" | "pro" | "report") {
    const r = await apiFetch<{ url: string }>("/api/billing", { method: "POST", json: { item, period } });
    window.location.href = r.url;
  }
  const upgrade = (plan: PlanId) =>
    run(plan, async () => {
      if (!data) return;
      if (plan !== "free" && data.checkout[period][plan]) return pay(plan);
      if (data.demoBilling) {
        await apiFetch("/api/billing", { method: "PUT", json: { plan } });
        toast(plan === "free" ? "Switched to Free (demo)." : "Plan switched in demo mode. No payment was taken.");
        reload();
      }
    });
  const buyReport = () =>
    run("report", async () => {
      if (data?.checkout.report) return pay("report");
      await apiFetch("/api/billing", { method: "PUT", json: { addCredit: true } });
      toast("One demo report pass added. No payment was taken.");
      reload();
    });
  const redeem = () =>
    run("redeem", async () => {
      const r = await apiFetch<{ name: string; until: string; sponsor: string | null }>("/api/redeem", { method: "POST", json: { code } });
      toast(`${r.name} activated until ${new Date(r.until).toLocaleDateString("en-IN")}${r.sponsor ? `, sponsored by ${r.sponsor}` : ""}.`);
      setCode("");
      reload();
    });

  if (loading && !data) return <LoadingBlock rows={3} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const canBuy = (p: PlanId) => p !== "free" && data.checkout[period][p];
  const rank = { free: 0, plus: 1, pro: 2 };
  const credits = data.credits.paid + data.credits.demo;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Plans" title="Start free. Pay only if it helps your care." description="The core intelligence and every safety feature are free. Paid plans add managed AI (no key needed), more documents, secure doctor links and longer diary history." actions={<Segmented value={period} onChange={setPeriod} label="Billing period" options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly · 2 months free" }]} />} />

      {data.demoBilling && <Callout tone="warn" title="Demo billing is on">Purchases here take effect instantly and no payment is taken. For real revenue, set up Razorpay payment pages and the webhook (see BILLING.md).</Callout>}

      <div className="grid gap-5 lg:grid-cols-3">
        {data.plans.map((p) => {
          const current = data.plan === p.id;
          const yearly = period === "year" && p.yearPrice;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={`relative flex h-full flex-col p-6 ${p.highlight ? "border-sano-300 shadow-glow" : ""}`}>
                {p.highlight && <Badge tone="teal" className="absolute -top-2.5 left-6" icon={<Sparkles className="h-3 w-3" />}>Most popular</Badge>}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-navy-900">{p.name}</h2>
                  {current && <Badge tone="green">Your plan</Badge>}
                </div>
                <p className="mt-1 text-[13.5px] text-navy-500">{p.tagline}</p>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold text-navy-900">{yearly ? p.yearPrice : p.price}</span>
                  <span className="text-[13px] text-navy-400">{yearly ? "per year" : p.period}</span>
                </p>
                <p className="h-5 text-[12px] text-navy-400">{p.id !== "free" ? "UPI, cards, netbanking" : ""}</p>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-[13.5px] text-navy-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-sano-600" /> {f}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  {current ? (
                    <Button variant="secondary" className="w-full" disabled>Current plan</Button>
                  ) : canBuy(p.id) || data.demoBilling ? (
                    <Button className="w-full" variant={p.highlight ? "primary" : "secondary"} loading={busy === p.id} onClick={() => upgrade(p.id)}>
                      {rank[p.id] < rank[data.plan] ? `Switch to ${p.name}` : data.demoBilling && !canBuy(p.id) ? `Try ${p.name} (demo)` : `Upgrade to ${p.name}`}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="secondary" disabled>Checkout not set up</Button>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <UpiPayment period={period} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="card-pad">
          <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-sano-600" /><h2 className="text-[15px] font-semibold text-navy-900">Premium Doctor Report — ₹99, once</h2></div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-navy-600">No subscription. Adds result trend charts, cross-specialty links and your diary averages to the free doctor brief. Included in Plus and Pro.</p>
          <p className="mt-2 text-[13px] text-navy-500">{data.plan !== "free" ? "Included in your plan." : `Report passes available: ${credits}`}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.plan === "free" && (data.checkout.report || data.demoBilling) && <Button loading={busy === "report"} onClick={buyReport}>{data.checkout.report ? "Buy a report pass · ₹99" : "Add a pass (demo)"}</Button>}
            <Button variant="secondary" href="/brief">Open doctor brief</Button>
          </div>
        </Card>
        <Card className="card-pad">
          <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-sano-600" /><h2 className="text-[15px] font-semibold text-navy-900">Have a sponsor code?</h2></div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-navy-600">Your lab, clinic or employer may have given you free access.</p>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void redeem(); }}>
            <input className="field uppercase" aria-label="Sponsor code" placeholder="e.g. LAB-7K2M9Q" value={code} maxLength={32} onChange={(e) => setCode(e.target.value)} />
            <Button type="submit" loading={busy === "redeem"} disabled={code.trim().length < 6}>Redeem</Button>
          </form>
          {data.planUntil && data.plan !== "free" && <p className="mt-2 text-[12.5px] text-navy-500">Access valid until {new Date(data.planUntil).toLocaleDateString("en-IN")}.</p>}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="card-pad">
          <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-sano-600" /><h2 className="text-[15px] font-semibold text-navy-900">Your usage</h2></div>
          <div className="mt-4 space-y-4">
            <Meter label="Documents stored" used={docs.data?.documents.length ?? 0} max={data.limits.documents} />
            <Meter label="Managed AI answers this month" used={data.usage.managedAi} max={data.limits.managedAiCalls} />
          </div>
          <p className="mt-3 text-[12.5px] text-navy-400">{data.managedAiAvailable ? "Managed AI is available on paid plans." : "Managed AI isn't connected in this deployment. You can still add your own key in Settings."}</p>
        </Card>
        <Card className="card-pad">
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-sano-600" /><h2 className="text-[15px] font-semibold text-navy-900">Labs, clinics &amp; employers</h2></div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-navy-600">Offer SanoAI to your patients or staff with per-report pricing, clinic licences and sponsor codes.</p>
          <Button className="mt-4" variant="secondary" href="/business">See business plans</Button>
        </Card>
      </div>
      <LimitsNote>Prices are in Indian rupees and are placeholders you can change in <code>src/lib/billing.ts</code> (add GST as applicable). Paid plans never add diagnosis or treatment advice, and SanoAI does not sell health data or show health ads.</LimitsNote>
    </div>
  );
}
