import type { CreateTableCommandInput } from "@aws-sdk/client-dynamodb";
import type { PrimaryKeys } from "./base-repository.ts";

/**
 * Single table, house conventions (itemId/sortKey, ENTITY:: prefixes, entityType on every item).
 * Owner GSI is sparse: only META items carry ownerEmail, so it answers "my artifacts, newest first".
 */
export const OWNER_INDEX = "Owner";
export const ENTITY_TYPE_INDEX = "EntityType";

export const artifactTableSchema: CreateTableCommandInput = {
  TableName: process.env.TABLE_NAME || "poc-artifact-store",
  AttributeDefinitions: [
    { AttributeName: "itemId", AttributeType: "S" },
    { AttributeName: "sortKey", AttributeType: "S" },
    { AttributeName: "entityType", AttributeType: "S" },
    { AttributeName: "ownerEmail", AttributeType: "S" },
    { AttributeName: "updatedAt", AttributeType: "S" },
  ],
  KeySchema: [{ AttributeName: "itemId", KeyType: "HASH" }, { AttributeName: "sortKey", KeyType: "RANGE" }],
  GlobalSecondaryIndexes: [
    { IndexName: ENTITY_TYPE_INDEX, KeySchema: [{ AttributeName: "entityType", KeyType: "HASH" }, { AttributeName: "sortKey", KeyType: "RANGE" }], Projection: { ProjectionType: "ALL" } },
    { IndexName: OWNER_INDEX, KeySchema: [{ AttributeName: "ownerEmail", KeyType: "HASH" }, { AttributeName: "updatedAt", KeyType: "RANGE" }], Projection: { ProjectionType: "ALL" } },
  ],
  BillingMode: "PAY_PER_REQUEST",
};

export const EntityType = { artifact: "artifact", version: "artifactVersion", share: "artifactShare" } as const;
const A = "ARTIFACT::";
export const itemKeys = {
  artifact: (id: string): PrimaryKeys => ({ itemId: `${A}${id}`, sortKey: "META::" }),
  version: (id: string, n: number): PrimaryKeys => ({ itemId: `${A}${id}`, sortKey: `VERSION::${String(n).padStart(6, "0")}` }),
  share: (id: string, principal: string): PrimaryKeys => ({ itemId: `${A}${id}`, sortKey: `SHARE::${principal}` }),
};
