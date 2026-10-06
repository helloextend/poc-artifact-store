export interface LinkSigner {
  sign(artifactId: string, expiresAt: number): string;
  /** Returns the artifact id the token grants, or null if it is invalid or expired. */
  verify(token: string, now: number): string | null;
}
export interface IdGenerator { next(): string }
