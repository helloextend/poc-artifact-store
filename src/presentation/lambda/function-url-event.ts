import type { LambdaFunctionURLEvent } from "aws-lambda";

export function toWebRequest(event: LambdaFunctionURLEvent): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) if (value !== undefined) headers.set(name, value);
  const method = event.requestContext.http.method;
  const hasBody = event.body !== undefined && method !== "GET" && method !== "HEAD";
  const body = hasBody ? (event.isBase64Encoded ? Buffer.from(event.body!, "base64") : event.body) : undefined;
  const host = event.headers?.host ?? event.requestContext.domainName ?? "gateway";
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  return new Request(`https://${host}${event.rawPath}${query}`, { method, headers, ...(body !== undefined ? { body } : {}) });
}
