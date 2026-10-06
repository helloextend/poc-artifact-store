import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import type { ContentStore } from "../../domain/repositories.ts";

export class S3ContentStore implements ContentStore {
  constructor(private readonly s3: Pick<S3Client, "send">, private readonly bucket: string) {}

  async put(key: string, content: string, contentType: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content, ContentType: `${contentType}; charset=utf-8` }));
  }

  async get(key: string) {
    const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return (await (out.Body as { transformToString(): Promise<string> }).transformToString()) ?? "";
  }
}
