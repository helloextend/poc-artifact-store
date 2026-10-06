import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { IdentityVerifier } from "../../application/ports/identity-verifier.ts";
import { forbidden, unauthenticated } from "../../domain/errors.ts";
import type { UserIdentity } from "../../domain/identity/user-identity.ts";
import type { OktaAuthorizationServer } from "./okta-config.ts";

const USER_LOGIN = /^[^@\s]+@[^@\s]+$/;

/** Same checks the Chorus MCP's authorizer applies: signature, issuer, audience, client, scope. */
export class OktaIdentityVerifier implements IdentityVerifier {
  private readonly keys: JWTVerifyGetKey;

  constructor(
    private readonly server: OktaAuthorizationServer,
    keys?: JWTVerifyGetKey,
  ) {
    this.keys = keys ?? createRemoteJWKSet(new URL(`${server.issuer}/v1/keys`));
  }

  async verify(token: string): Promise<UserIdentity> {
    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(token, this.keys, { issuer: this.server.issuer, audience: this.server.audience, algorithms: ["RS256"] }));
    } catch {
      throw unauthenticated("invalid Okta token");
    }
    const clientId = String(claims.cid ?? claims.client_id ?? "");
    if (!this.server.allowedClientIds.includes(clientId)) throw forbidden("token was not issued to an allowed client");
    const scopes = Array.isArray(claims.scp) ? (claims.scp as string[]) : String(claims.scp ?? claims.scope ?? "").split(" ");
    if (!scopes.includes(this.server.requiredScope)) throw forbidden("token lacks the required scope");
    const subject = String(claims.sub ?? "");
    // Okta access tokens carry the user's login in `sub`; client-credentials tokens carry a client id.
    if (!USER_LOGIN.test(subject)) throw forbidden("token subject is not a user login");
    return { email: subject.toLowerCase(), subject };
  }
}
