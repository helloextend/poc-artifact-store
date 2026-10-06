import type { Clock } from "../../src/application/ports/clock.ts";
import type { IdGenerator, LinkSigner } from "../../src/application/ports/link-signer.ts";
import type { Artifact, Share, Version } from "../../src/domain/artifact.ts";
import { conflict } from "../../src/domain/errors.ts";
import type { ArtifactRepository, ContentStore } from "../../src/domain/repositories.ts";

export const ALICE = { email: "alice@extend.com", subject: "alice@extend.com" };
export const BOB = { email: "bob@extend.com", subject: "bob@extend.com" };

export class FixedClock implements Clock { constructor(public t = new Date("2026-10-06T12:00:00Z")) {} now() { return this.t; } }
export class SeqIds implements IdGenerator { n = 0; next() { return `x${++this.n}`; } }

export class MemoryRepo implements ArtifactRepository {
  artifacts = new Map<string, Artifact>(); versions = new Map<string, Version>(); shares: Share[] = [];
  async get(id: string) { return this.artifacts.get(id) ?? null; }
  async create(a: Artifact, v: Version) { if (this.artifacts.has(a.id)) throw conflict("exists"); this.artifacts.set(a.id, a); this.versions.set(`${a.id}#${v.version}`, v); }
  async addVersion(a: Artifact, v: Version, expected: number) { if (this.artifacts.get(a.id)?.latestVersion !== expected) throw conflict("stale"); this.artifacts.set(a.id, a); this.versions.set(`${a.id}#${v.version}`, v); }
  async getVersion(id: string, n: number) { return this.versions.get(`${id}#${n}`) ?? null; }
  async listByOwner(email: string, limit: number) { return [...this.artifacts.values()].filter((a) => a.ownerEmail === email).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)).slice(0, limit); }
  async putShare(s: Share) { this.shares = this.shares.filter((x) => !(x.artifactId === s.artifactId && x.principal === s.principal)); this.shares.push(s); }
  async listShares(id: string) { return this.shares.filter((s) => s.artifactId === id); }
}
export class MemoryContent implements ContentStore {
  objects = new Map<string, string>();
  async put(k: string, c: string) { this.objects.set(k, c); }
  async get(k: string) { const c = this.objects.get(k); if (c === undefined) throw new Error("missing"); return c; }
}
export class FakeSigner implements LinkSigner {
  sign(id: string, exp: number) { return `${id}.${exp}`; }
  verify(t: string, now: number) { const [id, exp] = t.split("."); return Number(exp) > now ? id! : null; }
}
