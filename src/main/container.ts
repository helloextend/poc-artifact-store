import { randomBytes } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { ArtifactService } from "../application/artifact-service.ts";
import { connect } from "../infrastructure/dynamodb/base-repository.ts";
import { DynamoArtifactRepository } from "../infrastructure/dynamodb/dynamo-artifact-repository.ts";
import { OKTA_MCP_AUTHORIZATION_SERVER } from "../infrastructure/okta/okta-config.ts";
import { OktaIdentityVerifier } from "../infrastructure/okta/okta-identity-verifier.ts";
import { S3ContentStore } from "../infrastructure/s3/s3-content-store.ts";
import { HmacLinkSigner } from "../infrastructure/security/hmac-link-signer.ts";
import { JsonLogger } from "../infrastructure/system/json-logger.ts";
import { SystemClock } from "../infrastructure/system/system-clock.ts";
import { createApp } from "../presentation/app.ts";

export interface RuntimeConfig { tableName: string; bucket: string; linkSecretArn: string; publicBaseUrl?: string }

export function readConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const missing = ["TABLE_NAME", "CONTENT_BUCKET", "LINK_SECRET_ARN"].filter((k) => !env[k]);
  if (missing.length) throw new Error(`missing env: ${missing.join(", ")}`);
  return { tableName: env.TABLE_NAME!, bucket: env.CONTENT_BUCKET!, linkSecretArn: env.LINK_SECRET_ARN!, ...(env.PUBLIC_BASE_URL ? { publicBaseUrl: env.PUBLIC_BASE_URL } : {}) };
}

/** Builds the real handler once per cold start; the base URL defaults to the caller's own host (the Function URL). */
export async function createHandler(env: NodeJS.ProcessEnv) {
  const config = readConfig(env);
  const secret = (await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: config.linkSecretArn }))).SecretString ?? "";
  const repo = new DynamoArtifactRepository(connect(), config.tableName);
  const content = new S3ContentStore(new S3Client({}), config.bucket);
  const signer = new HmacLinkSigner(secret);
  const identity = new OktaIdentityVerifier(OKTA_MCP_AUTHORIZATION_SERVER);
  const logger = new JsonLogger();
  const ids = { next: () => randomBytes(4).toString("hex") };
  const apps = new Map<string, (r: Request) => Promise<Response>>();
  return (req: Request) => {
    const base = config.publicBaseUrl ?? new URL(req.url).origin;
    let app = apps.get(base);
    if (!app) apps.set(base, (app = createApp({ service: new ArtifactService(repo, content, ids, new SystemClock(), signer, base), identity, logger })));
    return app(req);
  };
}
