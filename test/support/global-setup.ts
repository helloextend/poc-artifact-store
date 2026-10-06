import { CreateTableCommand, DeleteTableCommand, ListTablesCommand, waitUntilTableExists } from "@aws-sdk/client-dynamodb";
import { execSync } from "node:child_process";
import { artifactTableSchema } from "../../src/infrastructure/dynamodb/table-schema.ts";
import { DB_PORT, rawClient, TEST_TABLE } from "./dynamodb-local.ts";

/** Mirrors orders-service src/test/global-setup.ts: reuse DynamoDB Local if up, else start the house container. */
export default async function globalSetup() {
  const client = rawClient();
  try {
    await client.send(new ListTablesCommand({}));
  } catch {
    execSync(`pnpm dynamo-local database start -p ${DB_PORT}`, { stdio: "inherit" });
    for (let attempt = 0; ; attempt++) {
      try {
        await client.send(new ListTablesCommand({}));
        break;
      } catch (error) {
        if (attempt > 30) throw new Error(`DynamoDB Local did not start on port ${DB_PORT}: ${(error as Error).message}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  const { TableNames = [] } = await client.send(new ListTablesCommand({}));
  if (TableNames.includes(TEST_TABLE)) await client.send(new DeleteTableCommand({ TableName: TEST_TABLE }));
  await client.send(new CreateTableCommand({ ...artifactTableSchema, TableName: TEST_TABLE }));
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: TEST_TABLE });
}
