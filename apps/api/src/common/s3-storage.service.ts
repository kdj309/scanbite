import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../config/env";

/**
 * Generic S3-compatible object storage primitives — one shared client and
 * one configured bucket for the whole app. Domain-specific storage needs
 * (label photos today, anything else later) should depend on this rather
 * than each opening their own S3 client.
 */
@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get("S3_BUCKET", { infer: true });
    this.client = new S3Client({
      endpoint: config.get("S3_ENDPOINT", { infer: true }),
      region: config.get("S3_REGION", { infer: true }),
      forcePathStyle: config.get("S3_FORCE_PATH_STYLE", { infer: true }),
      credentials: {
        accessKeyId: config.get("S3_ACCESS_KEY", { infer: true }),
        secretAccessKey: config.get("S3_SECRET_KEY", { infer: true }),
      },
    });
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async getObject(key: string): Promise<Buffer | undefined> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : undefined;
    } catch (error) {
      // GetObject's modeled 404 is NoSuchKey; HeadObject's (used by
      // objectExists) is NotFound — different shapes for the same "missing
      // key" condition depending on which S3 operation you called.
      if (error instanceof NoSuchKey || error instanceof NotFound) {
        return undefined;
      }
      throw error;
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch (error) {
      if (error instanceof NotFound) {
        return false;
      }
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  /** A temporary, unauthenticated GET URL — for handing a photo to a client. */
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  }

  /** Throws if the configured bucket isn't reachable — for health checks. */
  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}
