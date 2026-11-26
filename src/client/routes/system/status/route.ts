import { aiStatus } from "@/ai/structured";
import { authed } from "@/client/http";
import { managedAiUrl } from "@/lib/aiKeys";
import { demoBilling, getEntitlements } from "@/lib/billing";

/** Honest capability report: what is configured, what is simulated. Never returns secrets. */
export const GET = authed(async (_req, { user }) => {
  const ai = await aiStatus(user.id);
  const ent = await getEntitlements(user.id);
  return {
    ai: {
      provider: ai.provider.id,
      label: ai.provider.label,
      model: ai.provider.model,
      configured: ai.chain.length > 0,
      chain: ai.chain.map((c) => ({ id: c.id, label: c.label, model: c.model, local: !c.external })),
      economy: true,
      consent: ai.consent,
      effective: ai.effective,
      reason: ai.reason,
    },
    integrations: {
      doctorDirectory: { configured: false, implemented: false, note: "Demonstration directory in use (fictional doctors)." },
      pharmacyNetwork: { configured: false, implemented: false, note: "Demonstration pharmacies in use; no live stock or e-prescription verification." },
      managedAi: { configured: Boolean(managedAiUrl()), implemented: true, note: managedAiUrl() ? "SanoAI AI proxy configured (all plans)." : "No managed-AI proxy configured; users bring their own AI key or run offline." },
      billing: { configured: demoBilling() || Boolean(process.env.NEXT_PUBLIC_RAZORPAY_LINK_PLUS), implemented: true, note: demoBilling() ? "DEMO billing: plans switch without payment." : process.env.NEXT_PUBLIC_RAZORPAY_LINK_PLUS ? "Razorpay payment pages configured." : "No payment link configured." },
    },
    plan: ent.plan,
    security: { secretsConfigured: true, note: "Browser-only app: data is in Firestore under security rules; AI keys never leave this browser except to the provider you chose." },
  };
});
