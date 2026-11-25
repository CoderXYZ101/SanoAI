import { concat, fromBase64, latin1, toBase64 } from "./bytes";
import { store } from "./store";
import { uuid } from "./uuid";

/**
 * Document file storage for the browser-only edition.
 * Original files are kept as chunked documents in the signed-in user's private Firestore area
 * (free Spark plan — no Cloud Storage needed). Access is restricted by Firestore security rules to the
 * owning user. Storage keys are random UUIDs; original file names are never used as keys.
 */

const ALLOWED: Record<string, { mimes: string[]; magic?: (b: Uint8Array) => boolean }> = {
  ".pdf": { mimes: ["application/pdf"], magic: (b) => latin1(b.subarray(0, 5)) === "%PDF-" },
  ".png": { mimes: ["image/png"], magic: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v) },
  ".jpg": { mimes: ["image/jpeg"], magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  ".jpeg": { mimes: ["image/jpeg"], magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  ".webp": { mimes: ["image/webp"], magic: (b) => latin1(b.subarray(0, 4)) === "RIFF" && latin1(b.subarray(8, 12)) === "WEBP" },
  ".txt": { mimes: ["text/plain"] },
  ".md": { mimes: ["text/markdown", "text/plain"] },
  ".csv": { mimes: ["text/csv", "text/plain", "application/vnd.ms-excel"] },
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface ValidatedUpload {
  ext: string;
  mime: string;
  isText: boolean;
  isPdf: boolean;
  isImage: boolean;
}

const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
};

export function validateUpload(name: string, declaredMime: string, buf: Uint8Array): ValidatedUpload | { error: string } {
  if (buf.length === 0) return { error: "The file is empty." };
  if (buf.length > MAX_UPLOAD_BYTES) return { error: "The file is larger than the 10 MB limit." };
  const ext = extOf(name);
  const rule = ALLOWED[ext];
  if (!rule) return { error: "Unsupported file type. Upload a PDF, image (PNG/JPG/WebP) or text file." };
  if (declaredMime && !rule.mimes.includes(declaredMime) && declaredMime !== "application/octet-stream") {
    return { error: "The file type does not match its extension." };
  }
  if (rule.magic && !rule.magic(buf)) return { error: "The file content does not match its type." };
  if (!rule.magic && buf.subarray(0, 4096).includes(0)) return { error: "This text file contains binary data." };
  const mime = rule.mimes[0];
  return { ext, mime, isText: !rule.magic, isPdf: ext === ".pdf", isImage: mime.startsWith("image/") };
}

const CHUNK = 600_000; // bytes per chunk → ~800 KB base64, safely under Firestore's 1 MiB document limit

export async function saveFile(userId: string, data: Uint8Array): Promise<string> {
  const key = `${userId}/${uuid()}`;
  const n = Math.ceil(data.length / CHUNK);
  for (let i = 0; i < n; i++) {
    await store.set("file_chunks", { id: `${key.replace("/", "_")}_${String(i).padStart(4, "0")}`, user_id: userId, file_key: key, i, n, data: toBase64(data.subarray(i * CHUNK, (i + 1) * CHUNK)) });
  }
  return key;
}

export async function readFile(userId: string, storageKey: string): Promise<Uint8Array> {
  const rows = (await store.where("file_chunks", { user_id: userId, file_key: storageKey })) as unknown as { i: number; n: number; data: string }[];
  if (!rows.length || rows.length !== rows[0].n) throw new Error("The stored file is incomplete.");
  return concat(rows.sort((a, b) => a.i - b.i).map((r) => fromBase64(r.data)));
}

export async function deleteStored(userId: string, storageKey: string | null) {
  if (!storageKey) return;
  try {
    await store.deleteWhere("file_chunks", { user_id: userId, file_key: storageKey });
  } catch {
    /* already gone */
  }
}

export async function deleteUserFiles(userId: string) {
  try {
    await store.deleteWhere("file_chunks", { user_id: userId });
  } catch {
    /* ignore */
  }
}
