import { extendAccounts } from "extend-cdk-lib/environments";
import type { NodeCoreServiceProps } from "extend-cdk-lib/platform";
import { ArtifactStoreStage } from "../stacks/stage.ts";

/** Infra-only service (corporate-okta-iac shape): no Lambda build; one account, one wave. */
export const serviceConfig: Omit<NodeCoreServiceProps, "ServiceInstance"> = {
  owner: { primaryPOC: "heather@extend.com", teamName: "ai-enablement" },
  accounts: [{ accountId: extendAccounts["ai-integrations"], subStages: [{ name: "Deploy", ServiceStage: ArtifactStoreStage }] }],
  primaryRegion: "us-east-1",
  secondaryRegions: [],
  pipelineProps: { serviceBuildCommands: [] },
  lazyBuild: true,
};
