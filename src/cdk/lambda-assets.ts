import { Code } from "aws-cdk-lib/aws-lambda";

/**
 * Skinny-lambda code asset, as in helloextend/test-service `src/cdk/lambda-assets.ts`.
 * `pnpm build` emits one bundle per handler re-exported from src/presentation/lambda/index.ts at
 * dist/<handlerPath>/index.js, so the handler string stays `index.<export>`.
 * Returns a fresh Code per call: CDK binds an asset to the first stack that uses it.
 */
export function lambdaCode(handlerPath: string): Code {
  return Code.fromAsset(`dist/${handlerPath}`);
}
