export type DomainErrorKind = "invalid_request" | "payload_too_large" | "unauthenticated" | "forbidden" | "not_found" | "conflict";

export class DomainError extends Error {
  constructor(readonly kind: DomainErrorKind, message: string) {
    super(message);
    this.name = "DomainError";
  }
}
export const invalidRequest = (m: string) => new DomainError("invalid_request", m);
export const unauthenticated = (m = "missing or invalid credentials") => new DomainError("unauthenticated", m);
export const forbidden = (m: string) => new DomainError("forbidden", m);
export const notFound = (m: string) => new DomainError("not_found", m);
export const conflict = (m: string) => new DomainError("conflict", m);
