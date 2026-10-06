import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { connect } from "../../src/infrastructure/dynamodb/base-repository.ts";

// Same endpoint, port and fake region orders-service hard-codes in src/test/global-setup.ts.
export const DB_PORT = Number(process.env.DYNAMO_DB_PORT ?? 8000);
export const DB_ENDPOINT = `http://localhost:${DB_PORT}`;
export const DB_REGION = "fake-region";
export const TEST_TABLE = "poc-artifact-store-test";

const credentials = { accessKeyId: "local", secretAccessKey: "local" };
export const rawClient = () => new DynamoDBClient({ endpoint: DB_ENDPOINT, region: DB_REGION, credentials });
export const documentClient = () => connect({ endpoint: DB_ENDPOINT, region: DB_REGION, credentials });
