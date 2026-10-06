import type { Artifact, Role, Share } from "./artifact.ts";

/** Owner can edit; shares grant view or edit to everyone at Extend or to one person. Edit implies view. */
export function roleFor(email: string, artifact: Artifact, shares: readonly Share[]): Role | null {
  if (artifact.ownerEmail === email) return "edit";
  let best: Role | null = null;
  for (const s of shares) {
    if (s.principal === "everyone" || s.principal === `user:${email}`) best = s.role === "edit" || best === "edit" ? "edit" : "view";
  }
  return best;
}
export const canView = (r: Role | null) => r !== null;
export const canEdit = (r: Role | null) => r === "edit";
