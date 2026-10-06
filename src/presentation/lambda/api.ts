import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import { createHandler } from "../../main/container.ts";
import { toWebRequest } from "./function-url-event.ts";

let handlerPromise: ReturnType<typeof createHandler> | null = null;

/** Function URL handler (buffered). Responses are small JSON or HTML, so no streaming is needed. */
export async function handler(event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> {
  handlerPromise ??= createHandler(process.env);
  const res = await (await handlerPromise)(toWebRequest(event));
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  return { statusCode: res.status, headers, body: await res.text() };
}
