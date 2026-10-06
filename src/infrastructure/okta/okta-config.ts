/** From corporate-okta-iac: `okta_auth_server.mcp` (account.tf), `chorus_read` scope (chorus.tf); client id from the Chorus connector. */
export const OKTA_MCP_AUTHORIZATION_SERVER = {
  issuer: "https://extend.okta.com/oauth2/ausx4wgc88r0QbLYE4x7",
  audience: "api://mcp.extend",
  allowedClientIds: ["0oawze39w43y2qJBP4x7"],
  requiredScope: "extend.chorus.read",
  loopbackRedirectUri: "http://localhost:8080/callback",
} as const;

export type OktaAuthorizationServer = {
  issuer: string;
  audience: string;
  allowedClientIds: readonly string[];
  requiredScope: string;
  loopbackRedirectUri: string;
};
