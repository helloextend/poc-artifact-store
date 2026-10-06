import { NodeCoreService } from "extend-cdk-lib/platform";
import { serviceConfig } from "./config/index.ts";
import { ArtifactStoreStage } from "./stacks/stage.ts";

export class ArtifactStoreService extends NodeCoreService {
  constructor() {
    super("poc-artifact-store", { ...serviceConfig, ServiceInstance: ArtifactStoreStage });
  }
}
