import { authed, type FileResult } from "@/client/http";
import { toUtf8 } from "@/lib/bytes";
import { exportAccount } from "@/lib/repo";

/** Everything SanoAI holds about the signed-in user as JSON (data portability). */
export const GET = authed(async (_req, { user }) => ({ __file: { bytes: toUtf8(JSON.stringify(await exportAccount(user.id), null, 2)), mime: "application/json", name: "sanoai-export.json" } }) satisfies FileResult);
