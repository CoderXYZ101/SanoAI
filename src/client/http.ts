import type { z } from "zod";
import { currentUser, type SessionUser } from "@/lib/auth";

/**
 * In-browser replacement for the old server route helpers. Route modules in ./routes are plain async
 * handlers that run inside the user's browser against Firestore (with Firestore security rules as the
 * authorisation layer) — the same code shape as server routes, so engines and UI stay unchanged.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface RouteReq {
  method: string;
  url: string;
  json(): Promise<unknown>;
  formData(): Promise<FormData>;
}

type Handler<C> = (req: RouteReq, ctx: C & { user: SessionUser }) => Promise<unknown>;

export function authed<C = unknown>(handler: Handler<C>) {
  return async (req: RouteReq, ctx: C) => {
    const user = await currentUser();
    if (!user) throw new ApiError(401, "Please sign in to continue.");
    if (!user.verified) throw new ApiError(403, "Please verify your email address first.");
    return handler(req, { ...(ctx as C), user });
  };
}

export async function parseBody<S extends z.ZodTypeAny>(req: RouteReq, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new ApiError(400, `${first.path.join(".") || "input"}: ${first.message}`);
  }
  return r.data;
}

// small client-side limiter (protects the browser from accidental rapid-fire requests; real abuse controls live in Firebase)
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < t) {
    buckets.set(key, { count: 1, reset: t + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/** Marker returned by routes that produce a downloadable file instead of JSON. */
export interface FileResult {
  __file: { bytes: Uint8Array; mime: string; name: string };
}
