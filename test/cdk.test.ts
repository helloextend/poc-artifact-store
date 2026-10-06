import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ArtifactStoreStack } from "../src/cdk/stacks/artifact-store.ts";

let t: Template;
beforeAll(() => {
  if (!existsSync("dist/api/index.js")) execSync("pnpm build", { stdio: "pipe" });
  const app = new App({ context: { "@extend-cdk/platform:v9CutoverAcknowledged": true } });
  t = Template.fromStack(new ArtifactStoreStack(app, "Store", { env: { account: "596633517684", region: "us-east-1" }, isPrimaryRegion: true } as never).resource as never);
}, 180_000);

describe("artifact store stack", () => {
  it("is serverless: Lambda, DynamoDB, S3, Secrets Manager; no VPC, containers, or databases servers", () => {
    for (const type of ["AWS::EC2::VPC", "AWS::EC2::NatGateway", "AWS::ECS::Cluster", "AWS::RDS::DBCluster", "AWS::DocDB::DBCluster", "AWS::ElasticLoadBalancingV2::LoadBalancer"]) t.resourceCountIs(type, 0);
    t.resourceCountIs("AWS::Lambda::Function", 1);
    t.resourceCountIs("AWS::DynamoDB::Table", 1);
    t.resourceCountIs("AWS::S3::Bucket", 1);
    t.resourceCountIs("AWS::SecretsManager::Secret", 1);
  });
  it("keeps content private, encrypted, TLS-only, and retained", () => {
    t.hasResourceProperties("AWS::S3::Bucket", { PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true } });
    const bucket = Object.values(t.findResources("AWS::S3::Bucket"))[0]!;
    expect(bucket.DeletionPolicy).toBe("Retain");
    expect(JSON.stringify(t.findResources("AWS::S3::BucketPolicy"))).toContain("aws:SecureTransport");
  });
  it("uses house keys with the EntityType and Owner indexes", () => {
    const table = Object.values(t.findResources("AWS::DynamoDB::Table"))[0]!.Properties as { KeySchema: unknown; GlobalSecondaryIndexes: { IndexName: string }[] };
    expect(table.KeySchema).toEqual([{ AttributeName: "itemId", KeyType: "HASH" }, { AttributeName: "sortKey", KeyType: "RANGE" }]);
    expect(table.GlobalSecondaryIndexes.map((g) => g.IndexName).sort()).toEqual(["EntityType", "Owner"]);
  });
  it("wires env and least-privilege grants; secret value never appears in env", () => {
    const fn = Object.values(t.findResources("AWS::Lambda::Function"))[0]!.Properties as { Environment: { Variables: Record<string, unknown> }; Handler: string };
    expect(fn.Handler).toBe("index.handler");
    expect(Object.keys(fn.Environment.Variables)).toEqual(expect.arrayContaining(["TABLE_NAME", "CONTENT_BUCKET", "LINK_SECRET_ARN"]));
    const statements = JSON.stringify(t.findResources("AWS::IAM::Policy"));
    expect(statements).toContain("secretsmanager:GetSecretValue");
    expect(statements).toContain("artifacts/*");
    expect(statements).not.toMatch(/"s3:\*"/);
    t.resourceCountIs("AWS::IAM::User", 0);
  });
  it("exposes one Function URL", () => {
    t.resourceCountIs("AWS::Lambda::Url", 1);
  });
});
