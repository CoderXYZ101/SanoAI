import { ApiError, type RouteReq } from "./http";
import { REGISTRY } from "./registry";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface InitLike {
  method?: string;
  json?: unknown;
  body?: BodyInit | null;
}

/** Dispatches an "/api/..." request to the matching in-browser route handler (no network involved). */
export async function localFetch(rawUrl: string, init: InitLike = {}): Promise<unknown> {
  const u = new URL(rawUrl, "http://sano.local");
  const method = (init.method ?? "GET").toUpperCase() as Method;
  for (const r of REGISTRY) {
    const m = r.pattern.exec(u.pathname);
    if (!m) continue;
    const mod = await r.load();
    const handler = (mod as Record<string, unknown>)[method] as ((req: RouteReq, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>) | undefined;
    if (!handler) throw new ApiError(405, "Method not allowed.");
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const req: RouteReq = {
      method,
      url: u.toString(),
      json: async () => (init.json !== undefined ? init.json : init.body ? JSON.parse(String(init.body)) : {}),
      formData: async () => {
        if (init.body instanceof FormData) return init.body;
        throw new ApiError(400, "Expected a form upload.");
      },
    };
    return handler(req, { params: Promise.resolve(params) });
  }
  throw new ApiError(404, "Not found.");
}
