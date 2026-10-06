import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { Artifact, Share, Version } from "../../domain/artifact.ts";
import { conflict } from "../../domain/errors.ts";
import type { ArtifactRepository } from "../../domain/repositories.ts";
import { BaseRepository } from "./base-repository.ts";
import { EntityType, itemKeys, OWNER_INDEX } from "./table-schema.ts";

const isConditionFailure = (e: unknown) => ["ConditionalCheckFailedException", "TransactionCanceledException"].includes((e as Error).name);
const strip = <T>(item: Record<string, unknown> | undefined): T | null => {
  if (!item) return null;
  const { itemId: _i, sortKey: _s, entityType: _e, ...rest } = item;
  return rest as T;
};

export class DynamoArtifactRepository extends BaseRepository implements ArtifactRepository {
  async get(id: string) {
    return strip<Artifact>((await this.client.send(new GetCommand({ TableName: this.tableName, Key: itemKeys.artifact(id) }))).Item);
  }

  async create(a: Artifact, v: Version) {
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: this.tableName, Item: { ...itemKeys.artifact(a.id), entityType: EntityType.artifact, ...a }, ConditionExpression: "attribute_not_exists(itemId)" } },
        { Put: { TableName: this.tableName, Item: { ...itemKeys.version(a.id, v.version), entityType: EntityType.version, ...v } } },
      ] }));
    } catch (e) {
      if (isConditionFailure(e)) throw conflict(`artifact ${a.id} already exists`);
      throw e;
    }
  }

  async addVersion(a: Artifact, v: Version, expected: number) {
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: this.tableName, Item: { ...itemKeys.artifact(a.id), entityType: EntityType.artifact, ...a }, ConditionExpression: "latestVersion = :expected", ExpressionAttributeValues: { ":expected": expected } } },
        { Put: { TableName: this.tableName, Item: { ...itemKeys.version(a.id, v.version), entityType: EntityType.version, ...v }, ConditionExpression: "attribute_not_exists(itemId)" } },
      ] }));
    } catch (e) {
      if (isConditionFailure(e)) throw conflict(`artifact ${a.id} changed; reload and try again`);
      throw e;
    }
  }

  async getVersion(id: string, n: number) {
    return strip<Version>((await this.client.send(new GetCommand({ TableName: this.tableName, Key: itemKeys.version(id, n) }))).Item);
  }

  async listByOwner(email: string, limit: number) {
    const r = await this.client.send(new QueryCommand({ TableName: this.tableName, IndexName: OWNER_INDEX, KeyConditionExpression: "ownerEmail = :o", ExpressionAttributeValues: { ":o": email }, ScanIndexForward: false, Limit: limit }));
    return (r.Items ?? []).map((i) => strip<Artifact>(i)!);
  }

  async putShare(s: Share) {
    // Share items carry no ownerEmail/updatedAt, so they stay out of the Owner index.
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...itemKeys.share(s.artifactId, s.principal), entityType: EntityType.share, ...s } }));
  }

  async listShares(id: string) {
    const r = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: "itemId = :i AND begins_with(sortKey, :p)", ExpressionAttributeValues: { ":i": itemKeys.artifact(id).itemId, ":p": "SHARE::" } }));
    return (r.Items ?? []).map((i) => strip<Share>(i)!);
  }
}
