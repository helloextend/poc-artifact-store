import { describe, expect, it } from "vitest";
import { DynamoArtifactRepository } from "../src/infrastructure/dynamodb/dynamo-artifact-repository.ts";
import { S3ContentStore } from "../src/infrastructure/s3/s3-content-store.ts";
import { HmacLinkSigner } from "../src/infrastructure/security/hmac-link-signer.ts";
import { documentClient, TEST_TABLE } from "./support/dynamodb-local.ts";

const db = documentClient();
const repo = new DynamoArtifactRepository(db, TEST_TABLE);
const uid = () => `t-${Math.random().toString(36).slice(2, 10)}`;
const art = (id: string, owner: string, at: string, v = 1) => ({ id, title: `T ${id}`, type: "text/html" as const, ownerEmail: owner, createdAt: at, updatedAt: at, latestVersion: v });
const ver = (id: string, n: number) => ({ artifactId: id, version: n, contentKey: `artifacts/${id}/v${n}`, size: 3, authorEmail: "a@x.com", createdAt: "2026-10-06T00:00:00Z" });

describe("DynamoArtifactRepository (DynamoDB Local)", () => {
  it("creates once, then refuses a duplicate id", async () => {
    const id = uid();
    await repo.create(art(id, "a@x.com", "2026-10-06T00:00:00Z"), ver(id, 1));
    expect(await repo.get(id)).toMatchObject({ id, latestVersion: 1 });
    expect(await repo.getVersion(id, 1)).toMatchObject({ contentKey: `artifacts/${id}/v1` });
    await expect(repo.create(art(id, "a@x.com", "x"), ver(id, 1))).rejects.toMatchObject({ kind: "conflict" });
  });
  it("adds versions optimistically and rejects a stale writer", async () => {
    const id = uid();
    await repo.create(art(id, "a@x.com", "2026-10-06T00:00:00Z"), ver(id, 1));
    await repo.addVersion(art(id, "a@x.com", "2026-10-06T01:00:00Z", 2), ver(id, 2), 1);
    await expect(repo.addVersion(art(id, "a@x.com", "2026-10-06T02:00:00Z", 2), ver(id, 2), 1)).rejects.toMatchObject({ kind: "conflict" });
    expect((await repo.get(id))?.latestVersion).toBe(2);
    expect(await repo.getVersion(id, 2)).not.toBeNull();
  });
  it("lists an owner's artifacts newest first through the Owner index", async () => {
    const owner = `${uid()}@x.com`;
    const [a, b] = [uid(), uid()];
    await repo.create(art(a, owner, "2026-10-06T00:00:00Z"), ver(a, 1));
    await repo.create(art(b, owner, "2026-10-06T05:00:00Z"), ver(b, 1));
    expect((await repo.listByOwner(owner, 10)).map((x) => x.id)).toEqual([b, a]);
  });
  it("stores one share per principal and lists them", async () => {
    const id = uid();
    await repo.create(art(id, "a@x.com", "2026-10-06T00:00:00Z"), ver(id, 1));
    await repo.putShare({ artifactId: id, principal: "everyone", role: "view", grantedBy: "a@x.com", grantedAt: "t" });
    await repo.putShare({ artifactId: id, principal: "everyone", role: "edit", grantedBy: "a@x.com", grantedAt: "t2" });
    expect(await repo.listShares(id)).toEqual([{ artifactId: id, principal: "everyone", role: "edit", grantedBy: "a@x.com", grantedAt: "t2" }]);
  });
});

describe("S3ContentStore", () => {
  it("puts with content type and reads back text", async () => {
    const sent: { name: string; input: Record<string, unknown> }[] = [];
    const s3 = { send: async (c: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: c.constructor.name, input: c.input });
      return c.constructor.name === "GetObjectCommand" ? { Body: { transformToString: async () => "<h1>x</h1>" } } : {};
    } };
    const store = new S3ContentStore(s3 as never, "bucket");
    await store.put("artifacts/a/v1", "<h1>x</h1>", "text/html");
    expect(sent[0]).toMatchObject({ name: "PutObjectCommand", input: { Bucket: "bucket", Key: "artifacts/a/v1", ContentType: "text/html; charset=utf-8" } });
    expect(await store.get("artifacts/a/v1")).toBe("<h1>x</h1>");
  });
});

describe("HmacLinkSigner", () => {
  const signer = new HmacLinkSigner("s".repeat(32));
  it("round-trips before expiry and rejects after", () => {
    const t = signer.sign("my-art", 1000);
    expect(signer.verify(t, 999)).toBe("my-art");
    expect(signer.verify(t, 1000)).toBeNull();
  });
  it("rejects tampering and another key", () => {
    const t = signer.sign("my-art", 5000);
    const forged = `${Buffer.from("other.5000").toString("base64url")}.${t.split(".")[1]}`;
    expect(signer.verify(forged, 1)).toBeNull();
    expect(new HmacLinkSigner("k".repeat(32)).verify(t, 1)).toBeNull();
    expect(signer.verify("garbage", 1)).toBeNull();
  });
  it("refuses a short secret", () => {
    expect(() => new HmacLinkSigner("short")).toThrow(/32/);
  });
});
