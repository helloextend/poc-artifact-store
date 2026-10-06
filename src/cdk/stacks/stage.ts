import type { Construct } from "constructs";
import { DeploymentStage, type DeploymentStageProps } from "extend-cdk-lib/platform";
import { ArtifactStoreStack } from "./artifact-store.ts";

export class ArtifactStoreStage extends DeploymentStage {
  constructor(scope: Construct, id: string, props: DeploymentStageProps) {
    super(scope, id, props);
    const env = { account: props.env.account!, region: props.env.region! };
    new ArtifactStoreStack(this, `${props.serviceName}Api${this.currentEnv}`, { env, isPrimaryRegion: true, stackName: `${props.serviceName}-api`, description: "Serverless artifact store (Lambda + DynamoDB + S3)" });
  }
}
