import { canEdit, canView, roleFor } from "../domain/access.ts";
import { type Artifact, assertDraft, assertId, type Principal, type Role, slugFor, type Source } from "../domain/artifact.ts";
import { forbidden, invalidRequest, notFound } from "../domain/errors.ts";
import type { UserIdentity } from "../domain/identity/user-identity.ts";
import type { ArtifactRepository, ContentStore } from "../domain/repositories.ts";
import type { Clock } from "./ports/clock.ts";
import type { IdGenerator, LinkSigner } from "./ports/link-signer.ts";

export interface PublishInput { id?: string; title: string; type: string; content: string; note?: string; source?: Source }
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL = /^[^@\s]+@[^@\s]+$/;

/** Use cases for the artifact store. Callers are always an Okta-verified user. */
export class ArtifactService {
  constructor(
    private readonly repo: ArtifactRepository,
    private readonly content: ContentStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly links: LinkSigner,
    private readonly publicBaseUrl: string,
  ) {}

  async publish(user: UserIdentity, input: PublishInput): Promise<{ id: string; version: number }> {
    assertDraft(input);
    if (input.id !== undefined) assertId(input.id);
    const now = this.clock.now().toISOString();
    const existing = input.id ? await this.repo.get(input.id) : null;
    if (existing) {
      if (!canEdit(await this.role(user, existing))) throw forbidden("you can't edit this artifact");
      const version = existing.latestVersion + 1;
      const key = await this.store(existing.id, version, input);
      const updated: Artifact = { ...existing, title: input.title, type: input.type, updatedAt: now, latestVersion: version };
      await this.repo.addVersion(updated, { artifactId: existing.id, version, contentKey: key, size: Buffer.byteLength(input.content), authorEmail: user.email, createdAt: now, ...(input.note ? { note: input.note } : {}) }, existing.latestVersion);
      return { id: existing.id, version };
    }
    const id = input.id ?? slugFor(input.title, this.ids.next());
    const key = await this.store(id, 1, input);
    await this.repo.create(
      { id, title: input.title, type: input.type, ownerEmail: user.email, createdAt: now, updatedAt: now, latestVersion: 1, ...(input.source ? { source: input.source } : {}) },
      { artifactId: id, version: 1, contentKey: key, size: Buffer.byteLength(input.content), authorEmail: user.email, createdAt: now, ...(input.note ? { note: input.note } : {}) },
    );
    return { id, version: 1 };
  }

  async get(user: UserIdentity, id: string, version?: number) {
    const artifact = await this.visible(user, id);
    const v = await this.repo.getVersion(id, version ?? artifact.latestVersion);
    if (!v) throw notFound(`version ${version} of ${id} not found`);
    return { artifact, version: v, content: await this.content.get(v.contentKey) };
  }

  async list(user: UserIdentity, query?: string, limit = 50): Promise<Artifact[]> {
    const mine = await this.repo.listByOwner(user.email, Math.min(limit, 100));
    const q = query?.trim().toLowerCase();
    return q ? mine.filter((a) => a.title.toLowerCase().includes(q)) : mine;
  }

  async share(user: UserIdentity, id: string, principal: Principal, role: Role): Promise<void> {
    const artifact = await this.visible(user, id);
    if (artifact.ownerEmail !== user.email) throw forbidden("only the owner can share this artifact");
    if (principal !== "everyone" && !(principal.startsWith("user:") && EMAIL.test(principal.slice(5)))) throw invalidRequest("share with 'everyone' or 'user:<email>'");
    if (role !== "view" && role !== "edit") throw invalidRequest("role must be view or edit");
    await this.repo.putShare({ artifactId: id, principal: principal.toLowerCase() as Principal, role, grantedBy: user.email, grantedAt: this.clock.now().toISOString() });
  }

  async viewLink(user: UserIdentity, id: string): Promise<{ url: string; expiresAt: string }> {
    await this.visible(user, id);
    const exp = this.clock.now().getTime() + LINK_TTL_MS;
    return { url: `${this.publicBaseUrl}/a/${encodeURIComponent(id)}?t=${this.links.sign(id, exp)}`, expiresAt: new Date(exp).toISOString() };
  }

  /** For the browser viewer: a signed link stands in for Okta until the viewer has its own sign-in. */
  async openByLink(id: string, token: string) {
    if (this.links.verify(token, this.clock.now().getTime()) !== id) throw forbidden("this link is invalid or has expired");
    const artifact = await this.repo.get(id);
    if (!artifact) throw notFound("artifact not found");
    const v = await this.repo.getVersion(id, artifact.latestVersion);
    return { title: artifact.title, type: artifact.type, ownerEmail: artifact.ownerEmail, version: artifact.latestVersion, updatedAt: artifact.updatedAt, content: await this.content.get(v!.contentKey) };
  }

  private async store(id: string, version: number, input: { type: string; content: string }) {
    const key = `artifacts/${id}/v${version}`;
    await this.content.put(key, input.content, input.type);
    return key;
  }

  private async role(user: UserIdentity, a: Artifact) {
    return roleFor(user.email, a, a.ownerEmail === user.email ? [] : await this.repo.listShares(a.id));
  }

  /** Not-found for anything the caller can't see, so ids don't leak. */
  private async visible(user: UserIdentity, id: string): Promise<Artifact> {
    const a = await this.repo.get(id);
    if (!a || !canView(await this.role(user, a))) throw notFound("artifact not found");
    return a;
  }
}
