import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { beforeEach, describe, expect, it } from "vitest";
import { ArtifactService } from "../src/application/artifact-service.ts";
import { unauthenticated } from "../src/domain/errors.ts";
import { createApp } from "../src/presentation/app.ts";
import { ALICE, BOB, FakeSigner, FixedClock, MemoryContent, MemoryRepo, SeqIds } from "./support/fakes.ts";

const BASE = "https://art.example.com";
const identity = { verify: async (t: string) => { if (t === "alice-token") return ALICE; if (t === "bob-token") return BOB; throw unauthenticated(); } };
const logger = { info() {}, error() {} };
let handle: (r: Request) => Promise<Response>;
beforeEach(() => {
  const svc = new ArtifactService(new MemoryRepo(), new MemoryContent(), new SeqIds(), new FixedClock(), new FakeSigner(), BASE);
  handle = createApp({ service: svc, identity, logger });
});
const call = (path: string, init: RequestInit = {}, token: string | null = "alice-token") =>
  handle(new Request(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers as Record<string, string>) } }));
const publish = async (body: object, token = "alice-token") => (await call("/v1/artifacts", { method: "POST", body: JSON.stringify(body) }, token)).json() as Promise<{ id: string; version: number }>;

describe("REST API", () => {
  it("requires an Okta token", async () => {
    expect((await call("/v1/artifacts", {}, null)).status).toBe(401);
    expect((await call("/v1/artifacts", {}, "forged")).status).toBe(401);
    expect((await call("/healthz", {}, null)).status).toBe(200);
  });
  it("publishes, reads, lists, shares, and links", async () => {
    const { id, version } = await publish({ title: "Chart", type: "text/html", content: "<h1>c</h1>" });
    expect(version).toBe(1);
    expect(await (await call(`/v1/artifacts/${id}`)).json()).toMatchObject({ artifact: { id, title: "Chart" }, content: "<h1>c</h1>" });
    expect((await (await call("/v1/artifacts?q=char")).json()).artifacts.map((a: { id: string }) => a.id)).toEqual([id]);
    expect((await call(`/v1/artifacts/${id}`, {}, "bob-token")).status).toBe(404);
    expect((await call(`/v1/artifacts/${id}/shares`, { method: "POST", body: JSON.stringify({ principal: "everyone", role: "view" }) })).status).toBe(204);
    expect((await call(`/v1/artifacts/${id}`, {}, "bob-token")).status).toBe(200);
    const link = await (await call(`/v1/artifacts/${id}/link`, { method: "POST" })).json();
    expect(link.url).toMatch(new RegExp(`^${BASE}/a/${id}\\?t=`));
  });
  it("maps errors to status codes", async () => {
    expect((await call("/v1/artifacts", { method: "POST", body: JSON.stringify({ title: "x", type: "bad", content: "c" }) })).status).toBe(400);
    expect((await call("/v1/artifacts", { method: "POST", body: "{nope" })).status).toBe(400);
    expect((await call("/v1/nothing")).status).toBe(404);
  });
});

describe("viewer", () => {
  it("serves a frame page and the artifact under a strict CSP, only with a valid link", async () => {
    const { id } = await publish({ title: "Diagram", type: "application/vnd.mermaid", content: "graph TD; A-->B" });
    const t = new URL((await (await call(`/v1/artifacts/${id}/link`, { method: "POST" })).json()).url).searchParams.get("t")!;
    const page = await handle(new Request(`${BASE}/a/${id}?t=${encodeURIComponent(t)}`));
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Diagram");
    expect(html).toMatch(/<iframe[^>]+sandbox="allow-scripts"[^>]+src="\/a\/[^"]+\/content\?t=/);
    const content = await handle(new Request(`${BASE}/a/${id}/content?t=${encodeURIComponent(t)}`));
    expect(content.headers.get("content-security-policy")).toMatch(/connect-src 'none'.*frame-ancestors 'self'/);
    expect(await content.text()).toContain("mermaid");
    expect((await handle(new Request(`${BASE}/a/${id}?t=bad.1`))).status).toBe(403);
  });
});

describe("MCP endpoint (official SDK client)", () => {
  const connect = async (token: string) => {
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } }, fetch: (input, init) => handle(new Request(input as string, init)) }));
    return client;
  };
  const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0]!.text);

  it("lists the artifact tools", async () => {
    const client = await connect("alice-token");
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual(["get_artifact", "get_artifact_link", "publish_artifact", "search_artifacts", "share_artifact"]);
  });
  it("publishes, searches, gets, and links through tools", async () => {
    const client = await connect("alice-token");
    const pub = JSON.parse(text(await client.callTool({ name: "publish_artifact", arguments: { title: "Roadmap", type: "text/markdown", content: "# Q4" } })));
    expect(pub).toMatchObject({ version: 1 });
    expect(JSON.parse(text(await client.callTool({ name: "search_artifacts", arguments: { query: "road" } })))[0]).toMatchObject({ id: pub.id });
    expect(JSON.parse(text(await client.callTool({ name: "get_artifact", arguments: { id: pub.id } })))).toMatchObject({ content: "# Q4" });
    expect(JSON.parse(text(await client.callTool({ name: "get_artifact_link", arguments: { id: pub.id } }))).url).toContain(`/a/${pub.id}?t=`);
  });
  it("returns tool errors instead of crashing, and rejects unauthenticated MCP calls", async () => {
    const client = await connect("alice-token");
    const r = await client.callTool({ name: "get_artifact", arguments: { id: "missing-id" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/not found/);
    expect((await call("/mcp", { method: "POST", body: "{}" }, null)).status).toBe(401);
  });
});
