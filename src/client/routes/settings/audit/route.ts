import { authed } from "@/client/http";
import { listAudit } from "@/lib/repo";

/** Transparency ledger: every AI call attempt — module, provider, size, outcome. Never the content itself. */
export const GET = authed(async (_req, { user }) => ({
  entries: (await listAudit(user.id, 200)).map((r) => ({
    id: r.id,
    module: r.module,
    provider: r.provider,
    mode: r.mode,
    sentToExternalService: !!r.external,
    consentGiven: !!r.consent,
    payloadKB: Math.round(r.payload_bytes / 102.4) / 10,
    outcome: r.outcome,
    detail: r.detail,
    at: r.created_at,
  })),
}));
