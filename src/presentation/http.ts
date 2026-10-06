import { DomainError, invalidRequest, type DomainErrorKind } from "../domain/errors.ts";

const STATUS: Record<DomainErrorKind, number> = { invalid_request: 400, payload_too_large: 413, unauthenticated: 401, forbidden: 403, not_found: 404, conflict: 409 };

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function errorResponse(e: unknown): Response | null {
  return e instanceof DomainError ? json(STATUS[e.kind], { error: { code: e.kind, message: e.message } }) : null;
}

export async function readJson<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (text.length > 3 * 1024 * 1024) throw new DomainError("payload_too_large", "request body too large");
  try { return (text ? JSON.parse(text) : {}) as T; } catch { throw invalidRequest("body must be JSON"); }
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() || null : null;
}
