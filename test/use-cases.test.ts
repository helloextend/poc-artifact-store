import { beforeEach, describe, expect, it } from "vitest";
import { ArtifactService } from "../src/application/artifact-service.ts";
import { ALICE, BOB, FakeSigner, FixedClock, MemoryContent, MemoryRepo, SeqIds } from "./support/fakes.ts";

let repo: MemoryRepo, content: MemoryContent, clock: FixedClock, svc: ArtifactService;
beforeEach(() => {
  repo = new MemoryRepo(); content = new MemoryContent(); clock = new FixedClock();
  svc = new ArtifactService(repo, content, new SeqIds(), clock, new FakeSigner(), "https://art.example.com");
});
const draft = { title: "Login flow", type: "application/vnd.mermaid", content: "graph TD; A-->B" };

describe("publish", () => {
  it("creates version 1 with a slug id, stores content, and records the source", async () => {
    const r = await svc.publish(ALICE, { ...draft, source: { client: "extendabot" } });
    expect(r).toMatchObject({ id: "login-flow-x1", version: 1 });
    expect(repo.artifacts.get(r.id)).toMatchObject({ ownerEmail: ALICE.email, latestVersion: 1, source: { client: "extendabot" } });
    expect(content.objects.get("artifacts/login-flow-x1/v1")).toBe("graph TD; A-->B");
  });
  it("adds a new version when the owner republishes with the id", async () => {
    const { id } = await svc.publish(ALICE, draft);
    const r = await svc.publish(ALICE, { ...draft, id, content: "graph TD; A-->C", note: "fix arrow" });
    expect(r.version).toBe(2);
    expect((await svc.get(ALICE, id)).content).toBe("graph TD; A-->C");
    expect((await svc.get(ALICE, id, 1)).content).toBe("graph TD; A-->B");
  });
  it("lets an editor add a version but refuses a viewer or a stranger", async () => {
    const { id } = await svc.publish(ALICE, draft);
    await expect(svc.publish(BOB, { ...draft, id })).rejects.toMatchObject({ kind: "forbidden" });
    await svc.share(ALICE, id, "everyone", "view");
    await expect(svc.publish(BOB, { ...draft, id })).rejects.toMatchObject({ kind: "forbidden" });
    await svc.share(ALICE, id, `user:${BOB.email}`, "edit");
    await expect(svc.publish(BOB, { ...draft, id })).resolves.toMatchObject({ version: 2 });
  });
  it("validates type, title, id and size", async () => {
    await expect(svc.publish(ALICE, { ...draft, type: "application/pdf" })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(svc.publish(ALICE, { ...draft, title: " " })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(svc.publish(ALICE, { ...draft, id: "Bad Id!" })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(svc.publish(ALICE, { ...draft, content: "x".repeat(2 * 1024 * 1024 + 1) })).rejects.toMatchObject({ kind: "payload_too_large" });
  });
});

describe("get, list, share, links", () => {
  it("hides an unshared artifact from others as not found", async () => {
    const { id } = await svc.publish(ALICE, draft);
    await expect(svc.get(BOB, id)).rejects.toMatchObject({ kind: "not_found" });
    await svc.share(ALICE, id, "everyone", "view");
    await expect(svc.get(BOB, id)).resolves.toMatchObject({ artifact: { id }, content: draft.content });
  });
  it("only the owner can share", async () => {
    const { id } = await svc.publish(ALICE, draft);
    await svc.share(ALICE, id, `user:${BOB.email}`, "edit");
    await expect(svc.share(BOB, id, "everyone", "view")).rejects.toMatchObject({ kind: "forbidden" });
    await expect(svc.share(ALICE, id, "user:not-an-email" as never, "view")).rejects.toMatchObject({ kind: "invalid_request" });
  });
  it("lists my artifacts newest first and filters by title", async () => {
    await svc.publish(ALICE, draft);
    clock.t = new Date("2026-10-06T13:00:00Z");
    await svc.publish(ALICE, { ...draft, title: "Budget dashboard", type: "text/html", content: "<h1>b</h1>" });
    expect((await svc.list(ALICE)).map((a) => a.title)).toEqual(["Budget dashboard", "Login flow"]);
    expect((await svc.list(ALICE, "login")).map((a) => a.title)).toEqual(["Login flow"]);
    expect(await svc.list(BOB)).toEqual([]);
  });
  it("issues a 7-day view link only to someone who can view", async () => {
    const { id } = await svc.publish(ALICE, draft);
    const link = await svc.viewLink(ALICE, id);
    expect(link.url).toBe(`https://art.example.com/a/${id}?t=${id}.${Date.parse("2026-10-13T12:00:00Z")}`);
    await expect(svc.viewLink(BOB, id)).rejects.toMatchObject({ kind: "not_found" });
  });
  it("opens content by a valid link token and rejects expired or mismatched ones", async () => {
    const { id } = await svc.publish(ALICE, draft);
    const token = new URL((await svc.viewLink(ALICE, id)).url).searchParams.get("t")!;
    await expect(svc.openByLink(id, token)).resolves.toMatchObject({ type: "application/vnd.mermaid", content: draft.content });
    await expect(svc.openByLink("other-id", token)).rejects.toMatchObject({ kind: "forbidden" });
    clock.t = new Date("2026-10-14T00:00:00Z");
    await expect(svc.openByLink(id, token)).rejects.toMatchObject({ kind: "forbidden" });
  });
});
