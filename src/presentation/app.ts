import type { ArtifactService, PublishInput } from "../application/artifact-service.ts";
import type { IdentityVerifier } from "../application/ports/identity-verifier.ts";
import type { Logger } from "../application/ports/logger.ts";
import type { Principal, Role } from "../domain/artifact.ts";
import { notFound, unauthenticated } from "../domain/errors.ts";
import type { UserIdentity } from "../domain/identity/user-identity.ts";
import { bearer, errorResponse, json, readJson } from "./http.ts";
import { handleMcp } from "./mcp/server.ts";
import { contentPage, viewerPage } from "./viewer/viewer.ts";

export interface AppDeps { service: ArtifactService; identity: IdentityVerifier; logger: Logger }

/** Web-standard handler: REST API and MCP (Okta bearer), viewer (signed link). */
export function createApp({ service, identity, logger }: AppDeps) {
  const user = async (req: Request): Promise<UserIdentity> => {
    const token = bearer(req);
    if (!token) throw unauthenticated();
    return identity.verify(token);
  };

  async function route(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const m = req.method;
    if (m === "GET" && url.pathname === "/healthz") return json(200, { ok: true });
    if (parts[0] === "a" && parts[1] && m === "GET") {
      const opened = await service.openByLink(parts[1], url.searchParams.get("t") ?? "");
      return parts[2] === "content" ? contentPage(opened.type, opened.content) : viewerPage(parts[1], url.searchParams.get("t") ?? "", opened);
    }
    if (url.pathname === "/mcp") return handleMcp(service, await user(req), req);
    if (parts[0] !== "v1" || parts[1] !== "artifacts") throw notFound("not found");
    const u = await user(req);
    const id = parts[2];
    if (!id && m === "POST") return json(201, await service.publish(u, await readJson<PublishInput>(req)));
    if (!id && m === "GET") return json(200, { artifacts: await service.list(u, url.searchParams.get("q") ?? undefined) });
    if (id && !parts[3] && m === "GET") { const v = url.searchParams.get("version"); return json(200, await service.get(u, id, v ? Number(v) : undefined)); }
    if (id && parts[3] === "shares" && m === "POST") { const b = await readJson<{ principal: Principal; role: Role }>(req); await service.share(u, id, b.principal, b.role); return new Response(null, { status: 204 }); }
    if (id && parts[3] === "link" && m === "POST") return json(200, await service.viewLink(u, id));
    throw notFound("not found");
  }

  return async (req: Request): Promise<Response> => {
    try {
      return await route(req);
    } catch (e) {
      const mapped = errorResponse(e);
      if (mapped) return mapped;
      logger.error("unhandled_error", { name: (e as Error).name, message: (e as Error).message });
      return json(500, { error: { code: "internal_error", message: "internal error" } });
    }
  };
}
