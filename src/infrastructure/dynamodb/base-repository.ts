import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Same shapes as `@extend/backend-utils` 8.1.1 (`PrimaryKeys`, `BaseRepository`, `connect`), which
 * orders-service and claims-management-service use. Mirrored rather than imported: the package barrel
 * eagerly requires Kafka and a dozen other peers, which took this bundle from 686 KB to 4.38 MB and
 * module load from ~58 ms to ~220 ms. Swap these imports for the package if that changes.
 */
export interface PrimaryKeys {
  itemId: string;
  sortKey: string;
}

export abstract class BaseRepository {
  constructor(
    readonly client: DynamoDBDocumentClient,
    readonly tableName: string,
  ) {}
}

/** Document client with v2-style undefined removal; `DB_ENDPOINT` points tests at DynamoDB Local. */
export const connect = (config: DynamoDBClientConfig = {}): DynamoDBDocumentClient =>
  DynamoDBDocumentClient.from(new DynamoDBClient({ ...config, endpoint: config.endpoint ?? process.env.DB_ENDPOINT }), { marshallOptions: { removeUndefinedValues: true } });
