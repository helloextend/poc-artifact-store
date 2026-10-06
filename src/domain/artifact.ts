import { invalidRequest, DomainError } from "./errors.ts";

export const ARTIFACT_TYPES = ["text/html", "image/svg+xml", "application/vnd.mermaid", "application/vnd.react", "text/markdown"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
export const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

export interface Source { client?: string; conversationId?: string }

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: number;
  source?: Source;
}

export interface Version {
  artifactId: string;
  version: number;
  contentKey: string;
  size: number;
  authorEmail: string;
  createdAt: string;
  note?: string;
}

export type Role = "view" | "edit";
/** "everyone" = anyone at Extend signed in with Okta; otherwise one person by email. */
export type Principal = "everyone" | `user:${string}`;
export interface Share { artifactId: string; principal: Principal; role: Role; grantedBy: string; grantedAt: string }

const ID = /^[a-z0-9][a-z0-9-]{1,79}$/;

export function assertId(id: string): void {
  if (!ID.test(id)) throw invalidRequest("artifact id must be 2-80 chars of lowercase letters, digits, and hyphens");
}

export function assertDraft<T extends { title: string; type: string; content: string }>(d: T): asserts d is T & { type: ArtifactType } {
  if (!d.title?.trim() || d.title.length > 200) throw invalidRequest("title is required (max 200 characters)");
  if (!ARTIFACT_TYPES.includes(d.type as ArtifactType)) throw invalidRequest(`type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  if (typeof d.content !== "string" || !d.content.length) throw invalidRequest("content is required");
  if (Buffer.byteLength(d.content) > MAX_CONTENT_BYTES) throw new DomainError("payload_too_large", "content is over 2 MB");
}

export function slugFor(title: string, suffix: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "artifact";
  return `${base}-${suffix}`;
}
