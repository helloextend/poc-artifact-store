import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Architecture, FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { ExtTable } from "extend-cdk-lib";
import type { ExtendEnv } from "extend-cdk-lib/environments";
import { NodeCoreStack, NodeLambdaBuilder, type NodeCoreStackProps } from "extend-cdk-lib/platform";
import { artifactTableSchema } from "../../infrastructure/dynamodb/table-schema.ts";
import { lambdaCode } from "../lambda-assets.ts";

export const SERVICE_NAME = "poc-artifact-store";

/** Serverless artifact store: one Lambda (Function URL), one DynamoDB table, one private S3 bucket, one secret. */
export class ArtifactStoreStack extends NodeCoreStack {
  constructor(scope: Construct, id: string, props: NodeCoreStackProps) {
    super(scope, id, { ...props, hasLambdas: true });

    const table = new ExtTable(this.resource, "Artifacts", { sdkSchema: artifactTableSchema });
    const bucket = new Bucket(this.resource, "Content", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const linkSecret = new Secret(this.resource, "LinkSigningSecret", {
      description: "HMAC key for artifact view links",
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });

    const builder = new NodeLambdaBuilder(this.resource, {
      defaults: { runtime: Runtime.NODEJS_22_X, architecture: Architecture.ARM_64, extendOtelLayer: true },
      environmentConfig: { region: this.env.region, environment: this.currentEnv as ExtendEnv, projectName: "extend_platform", teamName: "ai-enablement", serviceName: SERVICE_NAME },
    });
    const api = builder.buildFunction(`${SERVICE_NAME}-api`, {
      handler: "index.handler",
      memorySize: 512,
      timeout: Duration.seconds(30),
      reservedConcurrentExecutions: 20,
      environment: { TABLE_NAME: table.resource.tableName, CONTENT_BUCKET: bucket.bucketName, LINK_SECRET_ARN: linkSecret.secretArn },
    }, lambdaCode("api"));
    table.resource.grantReadWriteData(api);
    bucket.grantReadWrite(api, "artifacts/*");
    linkSecret.grantRead(api);

    // The app authenticates every API and MCP call with Okta and every viewer call with a signed link.
    const url = api.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });
    new CfnOutput(this.resource, "ArtifactStoreUrl", { value: url.url });
  }
}
