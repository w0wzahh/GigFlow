"use client";

/** Client-side API helper with the standard error envelope. */

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function api<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? "GET",
    headers: options?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  let payload: { data?: T; error?: { code: string; message: string; details?: unknown } } | null = null;
  try {
    payload = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok || payload?.error) {
    const e = payload?.error;
    throw new ApiClientError(e?.code ?? "HTTP_" + res.status, e?.message ?? `Request failed (${res.status})`, res.status, e?.details);
  }
  return payload?.data as T;
}
