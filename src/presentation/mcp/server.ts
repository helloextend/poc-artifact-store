import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { ArtifactService } from "../../application/artifact-service.ts";
import { ARTIFACT_TYPES, type Principal } from "../../domain/artifact.ts";
import type { UserIdentity } from "../../domain/identity/user-identity.ts";

const ok = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: (e as Error).message }] });
const guard = <A>(fn: (a: A) => Promise<unknown>) => async (a: A) => { try { return ok(await fn(a)); } catch (e) { return fail(e); } };

/** One stateless MCP server per request, scoped to the Okta-verified caller. */
export function mcpServer(service: ArtifactService, user: UserIdentity): McpServer {
  const server = new McpServer({ name: "extend-artifacts", version: "0.1.0" });
  server.registerTool("publish_artifact", {
    description: "Save an artifact (web page, diagram, SVG, React component, or Markdown doc) to Extend's artifact store. Pass id to publish a new version of an existing artifact.",
    inputSchema: { title: z.string(), type: z.enum(ARTIFACT_TYPES), content: z.string(), id: z.string().optional(), note: z.string().optional(), source_client: z.string().optional(), conversation_id: z.string().optional() },
  }, guard((a) => service.publish(user, { title: a.title, type: a.type, content: a.content, ...(a.id ? { id: a.id } : {}), ...(a.note ? { note: a.note } : {}), source: { ...(a.source_client ? { client: a.source_client } : {}), ...(a.conversation_id ? { conversationId: a.conversation_id } : {}) } })));
  server.registerTool("get_artifact", { description: "Read an artifact you can access, latest version unless version is given.", inputSchema: { id: z.string(), version: z.number().int().positive().optional() }, annotations: { readOnlyHint: true } },
    guard((a) => service.get(user, a.id, a.version)));
  server.registerTool("search_artifacts", { description: "List your artifacts, newest first, optionally filtered by title.", inputSchema: { query: z.string().optional() }, annotations: { readOnlyHint: true } },
    guard(async (a) => (await service.list(user, a.query)).map(({ id, title, type, latestVersion, updatedAt }) => ({ id, title, type, latestVersion, updatedAt }))));
  server.registerTool("share_artifact", { description: "Share an artifact you own with everyone at Extend or one person (user:<email>), as view or edit.", inputSchema: { id: z.string(), principal: z.string(), role: z.enum(["view", "edit"]) } },
    guard(async (a) => { await service.share(user, a.id, a.principal as Principal, a.role); return { shared: true }; }));
  server.registerTool("get_artifact_link", { description: "Get a 7-day link that opens the artifact in a browser.", inputSchema: { id: z.string() }, annotations: { readOnlyHint: true } },
    guard((a) => service.viewLink(user, a.id)));
  return server;
}

export async function handleMcp(service: ArtifactService, user: UserIdentity, req: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = mcpServer(service, user);
  await server.connect(transport);
  try { return await transport.handleRequest(req); } finally { void server.close(); }
}
