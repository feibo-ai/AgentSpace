import { createHash, createHmac } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Readable } from "node:stream";
import {
  type AttachmentRuntimeConfig,
  resolveAttachmentRuntimeConfig,
} from "../config/deployment.ts";

export interface StoredAttachmentObject {
  provider: "local" | "r2";
  bucket?: string;
  region?: string;
  endpoint?: string;
  key?: string;
  url?: string;
  storedPath: string;
  sizeBytes: number;
  sha256: string;
}

export interface AttachmentStoragePutInput {
  workspaceId: string;
  attachmentId: string;
  fileName: string;
  contentBytes: Uint8Array;
  localPath: string;
  mediaType?: string;
}

export interface AttachmentStorageReadInput {
  storageProvider?: string;
  storageBucket?: string;
  storageRegion?: string;
  storageEndpoint?: string;
  storageKey?: string;
  storedPath: string;
}

export interface AttachmentStorageObjectMetadata {
  provider: "local" | "r2";
  bucket?: string;
  region?: string;
  endpoint?: string;
  key?: string;
  storedPath: string;
  sizeBytes?: number;
  contentType?: string;
  etag?: string;
  lastModified?: string;
}

export interface AttachmentStorageClient {
  putObject(input: AttachmentStoragePutInput): Promise<StoredAttachmentObject>;
  putObjectSync(input: AttachmentStoragePutInput): StoredAttachmentObject;
  getObject(input: AttachmentStorageReadInput): Promise<Uint8Array>;
  headObject(input: AttachmentStorageReadInput): Promise<AttachmentStorageObjectMetadata | null>;
  deleteObject(input: AttachmentStorageReadInput): Promise<void>;
  deleteObjectSync(input: AttachmentStorageReadInput): void;
  createReadUrl(input: AttachmentStorageReadInput): Promise<string | null>;
}

export function createAttachmentStorageClient(config = resolveAttachmentRuntimeConfig()): AttachmentStorageClient {
  if (config.provider === "r2") {
    return new R2AttachmentStorageClient(config);
  }
  return new LocalAttachmentStorageClient();
}

export function buildAttachmentStorageKey(input: {
  workspaceId: string;
  attachmentId: string;
  fileName: string;
  createdAt?: Date;
}): string {
  const createdAt = input.createdAt ?? new Date();
  const year = String(createdAt.getUTCFullYear());
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  return [
    "workspaces",
    sanitizeObjectKeySegment(input.workspaceId),
    "attachments",
    year,
    month,
    sanitizeObjectKeySegment(input.attachmentId),
    sanitizeObjectKeySegment(input.fileName) || "attachment.bin",
  ].join("/");
}

export function sha256Hex(contentBytes: Uint8Array): string {
  return createHash("sha256").update(contentBytes).digest("hex");
}

class LocalAttachmentStorageClient implements AttachmentStorageClient {
  async putObject(input: AttachmentStoragePutInput): Promise<StoredAttachmentObject> {
    return this.putObjectSync(input);
  }

  putObjectSync(input: AttachmentStoragePutInput): StoredAttachmentObject {
    mkdirSync(dirname(input.localPath), { recursive: true });
    writeFileSync(input.localPath, input.contentBytes);
    return {
      provider: "local",
      storedPath: input.localPath,
      sizeBytes: input.contentBytes.byteLength,
      sha256: sha256Hex(input.contentBytes),
    };
  }

  async getObject(input: AttachmentStorageReadInput): Promise<Uint8Array> {
    return readFileSync(input.storedPath);
  }

  async headObject(input: AttachmentStorageReadInput): Promise<AttachmentStorageObjectMetadata | null> {
    try {
      const stat = statSync(input.storedPath);
      if (!stat.isFile()) {
        return null;
      }
      return {
        provider: "local",
        storedPath: input.storedPath,
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
      };
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(input: AttachmentStorageReadInput): Promise<void> {
    this.deleteObjectSync(input);
  }

  deleteObjectSync(input: AttachmentStorageReadInput): void {
    rmSync(input.storedPath, { force: true });
  }

  async createReadUrl(_input: AttachmentStorageReadInput): Promise<string | null> {
    return null;
  }
}

class R2AttachmentStorageClient implements AttachmentStorageClient {
  private readonly config: Required<AttachmentRuntimeConfig>["r2"];
  private readonly publicBaseUrl?: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(config: AttachmentRuntimeConfig) {
    if (!config.r2) {
      throw new Error("Cloud attachment storage requires CLOUDFLARE_R2_* configuration.");
    }
    this.config = config.r2;
    this.publicBaseUrl = config.publicBaseUrl;
    this.signedUrlTtlSeconds = config.signedUrlTtlSeconds;
  }

  async putObject(input: AttachmentStoragePutInput): Promise<StoredAttachmentObject> {
    const object = this.buildStoredObject(input);
    const response = await this.request({
      method: "PUT",
      key: object.key,
      body: Buffer.from(input.contentBytes),
      contentType: input.mediaType,
    });
    if (!response.ok) {
      throw new Error(`R2 upload failed with status ${response.status}: ${await response.text()}`);
    }
    return object;
  }

  putObjectSync(input: AttachmentStoragePutInput): StoredAttachmentObject {
    const object = this.buildStoredObject(input);
    const body = Buffer.from(input.contentBytes);
    const signed = this.buildSignedRequest({
      method: "PUT",
      key: object.key,
      body,
      contentType: input.mediaType,
    });
    const args = [
      "--fail",
      "-sS",
      "-X",
      "PUT",
      signed.url,
      "-H",
      `Authorization: ${signed.headers.Authorization}`,
      "-H",
      `x-amz-content-sha256: ${signed.headers["x-amz-content-sha256"]}`,
      "-H",
      `x-amz-date: ${signed.headers["x-amz-date"]}`,
      "--data-binary",
      "@-",
    ];
    if (input.mediaType) {
      args.splice(args.length - 2, 0, "-H", `Content-Type: ${input.mediaType}`);
    }
    const result = spawnSync("curl", args, {
      input: body,
      maxBuffer: 1024 * 1024,
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const output = Buffer.concat([
        Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? ""),
        Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? ""),
      ]).toString("utf8");
      throw new Error(`R2 upload failed: ${output.trim() || `curl exited with status ${result.status}`}`);
    }
    return object;
  }

  private buildStoredObject(input: AttachmentStoragePutInput): StoredAttachmentObject & { key: string } {
    const storageKey = buildAttachmentStorageKey(input);

    return {
      provider: "r2",
      bucket: this.config.bucket,
      region: this.config.region,
      endpoint: this.config.endpoint,
      key: storageKey,
      url: this.publicBaseUrl ? `${this.publicBaseUrl.replace(/\/+$/, "")}/${storageKey}` : undefined,
      storedPath: `r2://${this.config.bucket}/${storageKey}`,
      sizeBytes: input.contentBytes.byteLength,
      sha256: sha256Hex(input.contentBytes),
    };
  }

  async getObject(input: AttachmentStorageReadInput): Promise<Uint8Array> {
    const key = input.storageKey?.trim();
    if (!key) {
      throw new Error("Missing object storage key.");
    }
    const response = await this.request({ method: "GET", key });
    if (!response.ok) {
      throw new Error(`R2 read failed with status ${response.status}: ${await response.text()}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async headObject(input: AttachmentStorageReadInput): Promise<AttachmentStorageObjectMetadata | null> {
    const key = input.storageKey?.trim();
    if (!key) {
      return null;
    }
    const response = await this.request({ method: "HEAD", key });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`R2 head failed with status ${response.status}: ${await response.text()}`);
    }
    return {
      provider: "r2",
      bucket: input.storageBucket ?? this.config.bucket,
      region: input.storageRegion ?? this.config.region,
      endpoint: input.storageEndpoint ?? this.config.endpoint,
      key,
      storedPath: input.storedPath,
      sizeBytes: parseContentLength(response.headers.get("content-length")),
      contentType: response.headers.get("content-type") ?? undefined,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
    };
  }

  async deleteObject(input: AttachmentStorageReadInput): Promise<void> {
    const key = input.storageKey?.trim();
    if (!key) {
      return;
    }
    const response = await this.request({ method: "DELETE", key });
    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 delete failed with status ${response.status}: ${await response.text()}`);
    }
  }

  deleteObjectSync(input: AttachmentStorageReadInput): void {
    const key = input.storageKey?.trim();
    if (!key) {
      return;
    }
    const signed = this.buildSignedRequest({ method: "DELETE", key });
    const result = spawnSync("curl", [
      "-sS",
      "-o",
      "-",
      "-w",
      "\n%{http_code}",
      "-X",
      "DELETE",
      signed.url,
      "-H",
      `Authorization: ${signed.headers.Authorization}`,
      "-H",
      `x-amz-content-sha256: ${signed.headers["x-amz-content-sha256"]}`,
      "-H",
      `x-amz-date: ${signed.headers["x-amz-date"]}`,
    ], {
      maxBuffer: 1024 * 1024,
    });
    if (result.error) {
      throw result.error;
    }
    const output = Buffer.concat([
      Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? ""),
      Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? ""),
    ]).toString("utf8");
    if (result.status !== 0) {
      throw new Error(`R2 delete failed: ${output.trim() || `curl exited with status ${result.status}`}`);
    }
    const statusCode = parseCurlStatusCode(output);
    if (statusCode !== undefined && (statusCode === 404 || (statusCode >= 200 && statusCode < 300))) {
      return;
    }
    if (statusCode !== undefined) {
      throw new Error(`R2 delete failed with status ${statusCode}: ${output.trim()}`);
    }
  }

  async createReadUrl(input: AttachmentStorageReadInput): Promise<string | null> {
    const key = input.storageKey?.trim();
    if (!key) {
      return null;
    }
    return this.buildPresignedGetUrl(key);
  }

  private async request(input: {
    method: "GET" | "HEAD" | "PUT" | "DELETE";
    key: string;
    body?: Buffer;
    contentType?: string;
  }): Promise<Response> {
    const signed = this.buildSignedRequest(input);
    return fetch(signed.url, {
      method: input.method,
      headers: signed.headers,
      body: input.body ? new Uint8Array(input.body) : undefined,
    });
  }

  private buildSignedRequest(input: {
    method: "GET" | "HEAD" | "PUT" | "DELETE";
    key: string;
    body?: Buffer;
    contentType?: string;
  }): {
    url: string;
    headers: Record<string, string>;
  } {
    const base = new URL(this.config.endpoint);
    const host = base.host;
    const canonicalUri = `/${encodePathSegment(this.config.bucket)}/${input.key.split("/").map(encodePathSegment).join("/")}`;
    const now = new Date();
    const xAmzDate = formatAmzDate(now);
    const ymd = formatDateStamp(now);
    const payloadHash = hashHex(input.body ?? "");
    const canonicalHeaders =
      `host:${host}\n`
      + `x-amz-content-sha256:${payloadHash}\n`
      + `x-amz-date:${xAmzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      input.method,
      canonicalUri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const credentialScope = `${ymd}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      xAmzDate,
      credentialScope,
      hashHex(canonicalRequest),
    ].join("\n");
    const signature = signAwsV4({
      secretAccessKey: this.config.secretAccessKey,
      dateStamp: ymd,
      region: this.config.region,
      stringToSign,
    });
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, `
      + `SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const headers: Record<string, string> = {
      Authorization: authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": xAmzDate,
    };
    if (input.contentType) {
      headers["Content-Type"] = input.contentType;
    }

    return {
      url: `${base.origin}${canonicalUri}`,
      headers,
    };
  }

  private buildPresignedGetUrl(key: string): string {
    const base = new URL(this.config.endpoint);
    const host = base.host;
    const canonicalUri = `/${encodePathSegment(this.config.bucket)}/${key.split("/").map(encodePathSegment).join("/")}`;
    const now = new Date();
    const xAmzDate = formatAmzDate(now);
    const ymd = formatDateStamp(now);
    const credentialScope = `${ymd}/${this.config.region}/s3/aws4_request`;
    const expires = Math.min(Math.max(this.signedUrlTtlSeconds, 1), 604800);
    const queryParams = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.config.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": xAmzDate,
      "X-Amz-Expires": String(expires),
      "X-Amz-SignedHeaders": "host",
    });
    const canonicalQueryString = Array.from(queryParams.entries())
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .sort()
      .join("&");
    const canonicalRequest = [
      "GET",
      canonicalUri,
      canonicalQueryString,
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      xAmzDate,
      credentialScope,
      hashHex(canonicalRequest),
    ].join("\n");
    const signature = signAwsV4({
      secretAccessKey: this.config.secretAccessKey,
      dateStamp: ymd,
      region: this.config.region,
      stringToSign,
    });
    queryParams.set("X-Amz-Signature", signature);
    return `${base.origin}${canonicalUri}?${queryParams.toString()}`;
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function parseContentLength(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseCurlStatusCode(output: string): number | undefined {
  const match = output.match(/(\d{3})\s*$/);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sanitizeObjectKeySegment(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .join("-")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function hashHex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function signAwsV4(input: {
  secretAccessKey: string;
  dateStamp: string;
  region: string;
  stringToSign: string;
}): string {
  const kDate = hmacSha256(`AWS4${input.secretAccessKey}`, input.dateStamp);
  const kRegion = hmacSha256(kDate, input.region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  return createHmac("sha256", kSigning).update(input.stringToSign, "utf8").digest("hex");
}

export function readableToUint8Array(readable: Readable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on("data", (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    readable.on("error", reject);
    readable.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
