"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type FileResult } from "@/client/http";
import { localFetch } from "@/client/router";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Same call shape as before (`apiFetch("/api/...")`), but requests are dispatched to in-browser route handlers
 * that talk to Firestore directly — there is no SanoAI server.
 */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  try {
    const out = await localFetch(url, { method: init?.method, json: init?.json, body: init?.body ?? null });
    return out as T;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
      throw new ApiClientError(e.message, e.status);
    }
    const code = (e as { code?: string })?.code;
    if (code === "permission-denied") throw new ApiClientError("You don't have permission to do that.", 403);
    if (code === "unavailable") throw new ApiClientError("Can't reach the database right now. Check your connection and try again.", 0);
    console.error("[client]", e);
    throw new ApiClientError((e as Error)?.message || "Something went wrong. Please try again.", 500);
  }
}

/** Fetches a file-producing route and returns a Blob URL the browser can open/download. */
export async function fetchFileUrl(url: string): Promise<{ url: string; name: string; mime: string }> {
  const r = await apiFetch<FileResult>(url);
  const f = r.__file;
  const blob = new Blob([f.bytes.slice().buffer as ArrayBuffer], { type: f.mime });
  return { url: URL.createObjectURL(blob), name: f.name, mime: f.mime };
}
export async function downloadFile(url: string) {
  const f = await fetchFileUrl(url);
  const a = document.createElement("a");
  a.href = f.url;
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(f.url), 10_000);
}
export async function openFile(url: string) {
  const f = await fetchFileUrl(url);
  window.open(f.url, "_blank", "noopener");
}

/** Minimal data hook: loading / error / reload — no extra dependency. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<T>(url);
      if (my === seq.current) setData(d);
    } catch (e) {
      if (my === seq.current) setError((e as Error).message);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
