import type { Artifact, Share, Version } from "./artifact.ts";

export interface ArtifactRepository {
  get(id: string): Promise<Artifact | null>;
  /** Fails with conflict if the id already exists. */
  create(artifact: Artifact, version: Version): Promise<void>;
  /** Optimistic: fails with conflict unless the stored latestVersion is `expectedVersion`. */
  addVersion(artifact: Artifact, version: Version, expectedVersion: number): Promise<void>;
  getVersion(id: string, version: number): Promise<Version | null>;
  listByOwner(email: string, limit: number): Promise<Artifact[]>;
  putShare(share: Share): Promise<void>;
  listShares(id: string): Promise<Share[]>;
}

export interface ContentStore {
  put(key: string, content: string, contentType: string): Promise<void>;
  get(key: string): Promise<string>;
}
