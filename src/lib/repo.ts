import { uuid } from "./uuid";
import { store } from "./store";
import type { DocType, DocumentDTO, HealthEvent } from "@/ai/types";

/**
 * Repository layer (async, backend-agnostic: SQLite locally, Firestore on Firebase).
 * EVERY function takes a userId and scopes its query with it — there is no query in the app
 * that can read another user's rows. Ordering/limits are applied in memory (per-user data is small),
 * which keeps Firestore queries to simple equality filters (no composite indexes required).
 */

export const uid = () => uuid();
export const now = () => new Date().toISOString();

let seqCounter = 0;
const nextSeq = () => Date.now() * 1000 + (seqCounter++ % 1000);

const byDesc = <T,>(f: keyof T) => (a: T, b: T) => String(b[f]).localeCompare(String(a[f]));
const byAsc = <T,>(f: keyof T) => (a: T, b: T) => String(a[f]).localeCompare(String(b[f]));
const MAX_TEXT = 700_000; // Firestore documents are limited to 1 MiB

// ───────────────────────── users ─────────────────────────
/** Profile document keyed by the Firebase Auth uid. `plan` is read-only for clients (see firestore.rules). */
export interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  plan: "free" | "plus" | "pro";
  plan_until?: string | null;
  demo_plan?: "free" | "plus" | "pro" | null;
  report_credits?: number;
  demo_credits?: number;
  redeemed_code?: string | null;
}
export async function createUser(authUid: string, email: string, name: string): Promise<UserRow> {
  const created = now();
  const row = { id: authUid, user_id: authUid, email, name, created_at: created, plan: "free" as const, plan_until: null, demo_plan: null };
  await store.set("users", row);
  await store.set("settings", { id: authUid, user_id: authUid, consent_external_ai: false, consent_chat_memory: true, reading_level: "plain", language: "English", updated_at: created });
  return row;
}
export async function getUser(id: string): Promise<UserRow | undefined> {
  return ((await store.get("users", id)) as unknown as UserRow | null) ?? undefined;
}
export async function updateUserProfile(id: string, patch: { name?: string; demo_plan?: UserRow["demo_plan"]; report_credits?: number; demo_credits?: number }) {
  const r = await store.get("users", id);
  if (r) await store.set("users", { ...r, ...patch } as { id: string });
}

// ───────────────────────── settings ─────────────────────────
export interface Settings {
  consentExternalAi: boolean;
  /** false until the user has picked SanoAI AI or built-in rules. */
  aiChoiceMade: boolean;
  consentChatMemory: boolean;
  readingLevel: "plain" | "detailed";
  language: string;
}
const toSettings = (r: Record<string, unknown> | null): Settings => ({
  consentExternalAi: !!r?.consent_external_ai,
  aiChoiceMade: !!(r?.ai_choice_made || r?.consent_external_ai),
  consentChatMemory: r ? !!r.consent_chat_memory : true,
  readingLevel: r?.reading_level === "detailed" ? "detailed" : "plain",
  language: typeof r?.language === "string" ? r.language : "English",
});
export async function getSettings(userId: string): Promise<Settings> {
  return toSettings(await store.get("settings", userId));
}
export async function updateSettings(userId: string, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings(userId)), ...patch };
  if (patch.consentExternalAi !== undefined) next.aiChoiceMade = true;
  await store.set("settings", {
    id: userId,
    user_id: userId,
    consent_external_ai: next.consentExternalAi,
    ai_choice_made: next.aiChoiceMade,
    consent_chat_memory: next.consentChatMemory,
    reading_level: next.readingLevel,
    language: next.language,
    updated_at: now(),
  });
  return next;
}

// ───────────────────────── profile ─────────────────────────
export interface HealthProfile {
  ageRange: string;
  sex: string;
  conditions: string[];
  allergies: string[];
  medications: string[];
  notes: string;
}
export const EMPTY_PROFILE: HealthProfile = { ageRange: "", sex: "", conditions: [], allergies: [], medications: [], notes: "" };
export async function getProfile(userId: string): Promise<HealthProfile> {
  const r = await store.get("profiles", userId);
  if (!r) return { ...EMPTY_PROFILE };
  try {
    return { ...EMPTY_PROFILE, ...JSON.parse(String(r.json)) };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}
export async function saveProfile(userId: string, p: HealthProfile) {
  await store.set("profiles", { id: userId, user_id: userId, json: JSON.stringify(p), updated_at: now() });
}

// ───────────────────────── documents ─────────────────────────
export interface DocRow {
  id: string;
  user_id: string;
  title: string;
  doc_type: string;
  original_name: string;
  mime: string;
  size: number;
  storage_key: string | null;
  text_content: string | null;
  text_source: string;
  status: string;
  status_detail: string | null;
  is_demo: boolean;
  extraction_method: string | null;
  extracted_at: string | null;
  created_at: string;
}
const toDocDTO = (r: DocRow): DocumentDTO => ({
  id: r.id,
  title: r.title,
  docType: r.doc_type as DocType,
  originalName: r.original_name,
  mime: r.mime,
  size: r.size,
  textSource: r.text_source,
  status: r.status,
  statusDetail: r.status_detail,
  isDemo: !!r.is_demo,
  extractionMethod: r.extraction_method,
  extractedAt: r.extracted_at,
  createdAt: r.created_at,
  hasText: !!r.text_content,
});

export interface NewDocument {
  title: string;
  docType: DocType;
  originalName: string;
  mime: string;
  size: number;
  storageKey: string | null;
  textContent: string | null;
  textSource: string;
  status: string;
  statusDetail?: string | null;
  isDemo?: boolean;
}
export async function insertDocument(userId: string, d: NewDocument): Promise<string> {
  const id = uid();
  const row: DocRow = {
    id,
    user_id: userId,
    title: d.title,
    doc_type: d.docType,
    original_name: d.originalName,
    mime: d.mime,
    size: d.size,
    storage_key: d.storageKey,
    text_content: d.textContent ? d.textContent.slice(0, MAX_TEXT) : null,
    text_source: d.textSource,
    status: d.status,
    status_detail: d.statusDetail ?? null,
    is_demo: !!d.isDemo,
    extraction_method: null,
    extracted_at: null,
    created_at: now(),
  };
  await store.set("documents", row);
  return id;
}
export async function listDocuments(userId: string): Promise<DocumentDTO[]> {
  const rows = (await store.where("documents", { user_id: userId })) as unknown as DocRow[];
  return rows.sort(byDesc<DocRow>("created_at")).map(toDocDTO);
}
export async function getDocumentRow(userId: string, id: string): Promise<DocRow | undefined> {
  const r = (await store.get("documents", id)) as unknown as DocRow | null;
  return r && r.user_id === userId ? r : undefined; // ownership is verified on every read
}
export async function getDocument(userId: string, id: string): Promise<DocumentDTO | null> {
  const r = await getDocumentRow(userId, id);
  return r ? toDocDTO(r) : null;
}
export async function getDocumentText(userId: string, id: string): Promise<{ text: string | null; title: string; docType: DocType } | null> {
  const r = await getDocumentRow(userId, id);
  return r ? { text: r.text_content, title: r.title, docType: r.doc_type as DocType } : null;
}
export async function updateDocument(
  userId: string,
  id: string,
  patch: Partial<{ title: string; docType: DocType; textContent: string | null; textSource: string; status: string; statusDetail: string | null; extractionMethod: string | null; extractedAt: string | null }>,
) {
  const r = await getDocumentRow(userId, id);
  if (!r) return false;
  await store.set("documents", {
    ...r,
    title: patch.title ?? r.title,
    doc_type: patch.docType ?? r.doc_type,
    text_content: patch.textContent !== undefined ? (patch.textContent ? patch.textContent.slice(0, MAX_TEXT) : null) : r.text_content,
    text_source: patch.textSource ?? r.text_source,
    status: patch.status ?? r.status,
    status_detail: patch.statusDetail !== undefined ? patch.statusDetail : r.status_detail,
    extraction_method: patch.extractionMethod !== undefined ? patch.extractionMethod : r.extraction_method,
    extracted_at: patch.extractedAt !== undefined ? patch.extractedAt : r.extracted_at,
  });
  return true;
}
/** Deletes the document and every event extracted from it; returns the storage key so the caller can erase the file. */
export async function deleteDocument(userId: string, id: string): Promise<{ storageKey: string | null } | null> {
  const r = await getDocumentRow(userId, id);
  if (!r) return null;
  await store.deleteWhere("events", { user_id: userId, doc_id: id });
  await store.delete("documents", id);
  return { storageKey: r.storage_key };
}
export async function allStorageKeys(userId: string): Promise<string[]> {
  return ((await store.where("documents", { user_id: userId })) as unknown as DocRow[]).map((r) => r.storage_key).filter((k): k is string => !!k);
}

// ───────────────────────── events ─────────────────────────
interface EventRow {
  id: string;
  user_id: string;
  doc_id: string;
  json: string;
  original_json: string;
  user_edited: boolean;
  hidden: boolean;
  created_at: string;
}
export async function replaceEventsForDoc(userId: string, docId: string, events: HealthEvent[]) {
  // Re-extraction replaces everything for the document — callers warn the user.
  await store.deleteWhere("events", { user_id: userId, doc_id: docId });
  const t = now();
  await Promise.all(
    events.map((e) => {
      const json = JSON.stringify(e);
      return store.set("events", { id: e.id, user_id: userId, doc_id: docId, json, original_json: json, user_edited: false, hidden: false, created_at: t } satisfies EventRow);
    }),
  );
}
const parseEvent = (r: EventRow): HealthEvent | null => {
  try {
    return { ...(JSON.parse(r.json) as HealthEvent), userEdited: !!r.user_edited };
  } catch {
    return null;
  }
};
export async function listEvents(userId: string, opts: { includeHidden?: boolean } = {}): Promise<HealthEvent[]> {
  const rows = (await store.where("events", { user_id: userId })) as unknown as EventRow[];
  return rows.filter((r) => opts.includeHidden || !r.hidden).map(parseEvent).filter((e): e is HealthEvent => !!e);
}
async function eventRow(userId: string, id: string): Promise<EventRow | null> {
  const r = (await store.get("events", id)) as unknown as EventRow | null;
  return r && r.user_id === userId ? r : null;
}
export async function getEvent(userId: string, id: string): Promise<{ event: HealthEvent; original: HealthEvent; hidden: boolean } | null> {
  const r = await eventRow(userId, id);
  if (!r) return null;
  return { event: { ...(JSON.parse(r.json) as HealthEvent), userEdited: !!r.user_edited }, original: JSON.parse(r.original_json), hidden: !!r.hidden };
}
export async function saveEventEdit(userId: string, event: HealthEvent) {
  const r = await eventRow(userId, event.id);
  if (r) await store.set("events", { ...r, json: JSON.stringify({ ...event, userEdited: true }), user_edited: true });
}
export async function resetEvent(userId: string, id: string) {
  const r = await eventRow(userId, id);
  if (r) await store.set("events", { ...r, json: r.original_json, user_edited: false, hidden: false });
}
export async function setEventHidden(userId: string, id: string, hidden: boolean) {
  const r = await eventRow(userId, id);
  if (r) await store.set("events", { ...r, hidden });
}
export async function insertManualEvent(userId: string, event: HealthEvent) {
  const json = JSON.stringify(event);
  await store.set("events", { id: event.id, user_id: userId, doc_id: event.docId, json, original_json: json, user_edited: true, hidden: false, created_at: now() } satisfies EventRow);
}

// ───────────────────────── analyses cache ─────────────────────────
export async function saveAnalysis(userId: string, kind: string, inputHash: string, mode: string, json: unknown) {
  await store.set("analyses", { id: `${userId}_${kind}`, user_id: userId, kind, input_hash: inputHash, mode, json: JSON.stringify(json), created_at: now() });
}
export async function latestAnalysis<T>(userId: string, kind: string): Promise<{ data: T; mode: string; createdAt: string; inputHash: string } | null> {
  const r = await store.get("analyses", `${userId}_${kind}`);
  if (!r || r.user_id !== userId) return null;
  try {
    return { data: JSON.parse(String(r.json)) as T, mode: String(r.mode), createdAt: String(r.created_at), inputHash: String(r.input_hash) };
  } catch {
    return null;
  }
}

// ───────────────────────── conversations ─────────────────────────
export interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
interface ConvDoc extends ConversationRow {
  user_id: string;
}
export async function createConversation(userId: string, title: string): Promise<string> {
  const id = uid();
  const t = now();
  await store.set("conversations", { id, user_id: userId, title: title.slice(0, 80), created_at: t, updated_at: t } satisfies ConvDoc);
  return id;
}
const toConv = ({ id, title, created_at, updated_at }: ConvDoc): ConversationRow => ({ id, title, created_at, updated_at });
export async function listConversations(userId: string, limit = 50): Promise<ConversationRow[]> {
  return ((await store.where("conversations", { user_id: userId })) as unknown as ConvDoc[]).sort(byDesc<ConvDoc>("updated_at")).slice(0, limit).map(toConv);
}
export async function getConversation(userId: string, id: string): Promise<ConversationRow | undefined> {
  const r = (await store.get("conversations", id)) as unknown as ConvDoc | null;
  return r && r.user_id === userId ? toConv(r) : undefined;
}
export async function deleteConversation(userId: string, id: string) {
  if (!(await getConversation(userId, id))) return;
  await store.deleteWhere("messages", { user_id: userId, conversation_id: id });
  await store.delete("conversations", id);
}
export async function addMessage(userId: string, conversationId: string, role: "user" | "assistant", content: string, meta?: unknown): Promise<string> {
  const id = uid();
  const t = now();
  await store.set("messages", { id, conversation_id: conversationId, user_id: userId, role, content, meta_json: meta ? JSON.stringify(meta) : null, created_at: t, seq: nextSeq() });
  const c = (await store.get("conversations", conversationId)) as unknown as ConvDoc | null;
  if (c && c.user_id === userId) await store.set("conversations", { ...c, updated_at: t });
  return id;
}
export async function listMessages(userId: string, conversationId: string) {
  const rows = (await store.where("messages", { user_id: userId, conversation_id: conversationId })) as unknown as { id: string; role: string; content: string; meta_json: string | null; created_at: string; seq: number }[];
  return rows.sort((a, b) => a.seq - b.seq).map(({ id, role, content, meta_json, created_at }) => ({ id, role, content, meta_json, created_at }));
}

// ───────────────────────── AI audit ─────────────────────────
export interface AuditRow {
  id: string;
  module: string;
  provider: string;
  mode: string;
  external: number;
  consent: number;
  payload_bytes: number;
  outcome: string;
  detail: string | null;
  created_at: string;
}
export async function logAudit(
  userId: string,
  e: { module: string; provider: string; mode: "live" | "demo"; external: boolean; consent: boolean; payloadBytes: number; outcome: string; detail?: string },
) {
  try {
    await store.set("audit", {
      id: uid(),
      user_id: userId,
      module: e.module,
      provider: e.provider,
      mode: e.mode,
      external: e.external ? 1 : 0,
      consent: e.consent ? 1 : 0,
      payload_bytes: e.payloadBytes,
      outcome: e.outcome,
      detail: e.detail?.slice(0, 200) ?? null,
      created_at: now(),
    });
  } catch (err) {
    console.error("[audit] could not write ledger entry", err); // never let logging break a request
  }
}
export async function listAudit(userId: string, limit = 100): Promise<AuditRow[]> {
  return ((await store.where("audit", { user_id: userId })) as unknown as AuditRow[]).sort(byDesc<AuditRow>("created_at")).slice(0, limit);
}

// ───────────────────────── shares / appointments / messages / enquiries ─────────────────────────
export async function createShare(userId: string, s: { doctorId: string; doctorName: string; sections: string[]; summary: unknown; consentText: string }) {
  const id = uid();
  await store.set("shares", { id, user_id: userId, doctor_id: s.doctorId, doctor_name: s.doctorName, sections_json: JSON.stringify(s.sections), summary_json: JSON.stringify(s.summary), consent_text: s.consentText, created_at: now(), revoked_at: null });
  return id;
}
interface ShareRow {
  id: string;
  doctor_id: string;
  doctor_name: string;
  sections_json: string;
  consent_text: string;
  created_at: string;
  revoked_at: string | null;
}
export async function listShares(userId: string): Promise<ShareRow[]> {
  return ((await store.where("shares", { user_id: userId })) as unknown as ShareRow[]).sort(byDesc<ShareRow>("created_at")).map(({ id, doctor_id, doctor_name, sections_json, consent_text, created_at, revoked_at }) => ({ id, doctor_id, doctor_name, sections_json, consent_text, created_at, revoked_at }));
}
export async function revokeShare(userId: string, id: string) {
  const r = await store.get("shares", id);
  if (r && r.user_id === userId && !r.revoked_at) await store.set("shares", { ...r, revoked_at: now(), summary_json: "{}" }); // snapshot erased on revoke
}

export async function createAppointment(userId: string, a: { doctorId: string; doctorName: string; preferred: string; reason: string; mode: string }) {
  const id = uid();
  await store.set("appointments", { id, user_id: userId, doctor_id: a.doctorId, doctor_name: a.doctorName, preferred: a.preferred, reason: a.reason, mode: a.mode, status: "demo-request-not-sent", created_at: now() });
  return id;
}
interface ApptRow {
  id: string;
  doctor_id: string;
  doctor_name: string;
  preferred: string;
  reason: string;
  mode: string;
  status: string;
  created_at: string;
}
export async function listAppointments(userId: string): Promise<ApptRow[]> {
  return ((await store.where("appointments", { user_id: userId })) as unknown as ApptRow[]).sort(byDesc<ApptRow>("created_at"));
}
export async function addDoctorMessage(userId: string, doctorId: string, body: string) {
  const id = uid();
  await store.set("doctor_messages", { id, user_id: userId, doctor_id: doctorId, body, status: "saved-not-delivered", created_at: now() });
  return id;
}
export async function listDoctorMessages(userId: string, doctorId: string) {
  const rows = (await store.where("doctor_messages", { user_id: userId, doctor_id: doctorId })) as unknown as { id: string; body: string; status: string; created_at: string }[];
  return rows.sort(byAsc<{ created_at: string }>("created_at")).map(({ id, body, status, created_at }) => ({ id, body, status, created_at }));
}

export async function createEnquiry(userId: string, e: { pharmacyId: string; pharmacyName: string; items: unknown; message: string; sharedHealthInfo: boolean }) {
  const id = uid();
  await store.set("pharmacy_enquiries", { id, user_id: userId, pharmacy_id: e.pharmacyId, pharmacy_name: e.pharmacyName, items_json: JSON.stringify(e.items), message: e.message, shared_health_info: e.sharedHealthInfo ? 1 : 0, status: "draft-not-sent", created_at: now() });
  return id;
}
interface EnqRow {
  id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  items_json: string;
  message: string;
  shared_health_info: number;
  status: string;
  created_at: string;
}
export async function listEnquiries(userId: string): Promise<EnqRow[]> {
  return ((await store.where("pharmacy_enquiries", { user_id: userId })) as unknown as EnqRow[]).sort(byDesc<EnqRow>("created_at"));
}

// ───────────────────────── account lifecycle ─────────────────────────
const USER_COLLECTIONS = ["settings", "profiles", "documents", "events", "analyses", "conversations", "messages", "audit", "shares", "appointments", "doctor_messages", "pharmacy_enquiries", "file_chunks", "daily_logs", "share_links", "reports", "payments"];
export async function deleteAccount(userId: string) {
  for (const c of USER_COLLECTIONS) await store.deleteWhere(c, { user_id: userId });
  await store.delete("users", userId);
}
export async function exportAccount(userId: string) {
  const user = await getUser(userId);
  const docs = (await store.where("documents", { user_id: userId })) as unknown as DocRow[];
  const convs = await listConversations(userId, 1000);
  return {
    exportedAt: now(),
    account: user ? { email: user.email, name: user.name, createdAt: user.created_at } : null,
    settings: await getSettings(userId),
    profile: await getProfile(userId),
    documents: docs.map(({ id, title, doc_type, original_name, mime, size, text_source, status, is_demo, created_at, text_content }) => ({ id, title, doc_type, original_name, mime, size, text_source, status, is_demo, created_at, text_content })),
    events: await listEvents(userId, { includeHidden: true }),
    conversations: await Promise.all(convs.map(async (c) => ({ ...c, messages: await listMessages(userId, c.id) }))),
    aiAudit: await listAudit(userId, 1000),
    shares: await listShares(userId),
    appointments: await listAppointments(userId),
    pharmacyEnquiries: await listEnquiries(userId),
    paymentClaims: await store.where("payments", { user_id: userId }),
  };
}
