import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectInput, StorageProvider } from "./storage-provider.interface";

/**
 * Backed by the AWS SDK against either real S3 (production) or LocalStack
 * (local dev, via STORAGE_ENDPOINT + STORAGE_FORCE_PATH_STYLE) — same code
 * path either way, only env vars differ.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>("storage.bucket");
    this.client = new S3Client({
      region: this.config.get<string>("storage.region"),
      endpoint: this.config.get<string>("storage.endpoint") || undefined,
      forcePathStyle: this.config.get<boolean>("storage.forcePathStyle") ?? false,
      credentials: {
        accessKeyId: this.config.get<string>("storage.accessKeyId") ?? "",
        secretAccessKey: this.config.get<string>("storage.secretAccessKey") ?? "",
      },
      // Newer SDK versions default to adding a flexible-checksum header
      // (x-amz-checksum-crc32) to PutObject requests, which then becomes
      // part of the presigned URL's signature — but a plain browser
      // `fetch(uploadUrl, { method: "PUT", body: file })` never sends that
      // header, so the upload gets rejected with "Value for
      // x-amz-checksum-crc32 header is invalid". PutObject doesn't require
      // a checksum, so only compute one when a caller explicitly asks.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  async putObject(input: PutObjectInput): Promise<{ key: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { key: input.key };
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const ttl = expiresInSeconds ?? this.config.get<number>("storage.signedUrlTtlSeconds") ?? 900;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttl,
    });
  }

  async getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string> {
    const ttl = expiresInSeconds ?? this.config.get<number>("storage.signedUrlTtlSeconds") ?? 900;
    // No ServerSideEncryption here: setting it makes x-amz-server-side-
    // encryption part of the signed request, which a plain browser
    // `fetch(uploadUrl, { method: "PUT", body: file })` never sends —
    // same signature-mismatch trap as the checksum header above. Bucket-
    // level default encryption (set on the bucket itself) covers
    // encryption-at-rest without needing this per-request header, and R2
    // doesn't honor it the way S3 does anyway.
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: ttl,
    });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = result.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
