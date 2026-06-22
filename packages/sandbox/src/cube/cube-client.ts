import type { CubeSandboxNetworkConfig } from "./cube-config.ts";

interface CubeApiSandboxPayload {
  templateID: string;
  sandboxID: string;
  clientID: string;
  envdVersion: string;
  envdAccessToken?: string | null;
  trafficAccessToken?: string | null;
  domain?: string | null;
}

interface CubeApiSandboxDetailPayload extends CubeApiSandboxPayload {
  state?: string;
}

interface CubeApiSnapshotPayload {
  snapshotID: string;
  names: string[];
}

export interface CubeSandboxConnection {
  templateId: string;
  sandboxId: string;
  clientId: string;
  envdVersion: string;
  envdAccessToken?: string;
  trafficAccessToken?: string;
  domain?: string;
}

export interface CubeSandboxDetail extends CubeSandboxConnection {
  state: string;
}

export interface CubeSandboxSnapshot {
  snapshotId: string;
  names: string[];
}

export interface CubeCreateSandboxRequest {
  templateId: string;
  timeoutSeconds: number;
  allowInternetAccess?: boolean;
  network?: CubeSandboxNetworkConfig;
  metadata?: Record<string, string>;
}

export class CubeApiError extends Error {
  readonly statusCode: number;
  readonly responseBody?: unknown;

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message);
    this.name = "CubeApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class CubeApiRouteNotAvailableError extends CubeApiError {
  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message, statusCode, responseBody);
    this.name = "CubeApiRouteNotAvailableError";
  }
}

export interface CubeSandboxClientOptions {
  apiUrl: string;
  apiKey: string;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

export class CubeSandboxClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CubeSandboxClientOptions) {
    this.apiUrl = options.apiUrl;
    this.apiKey = options.apiKey;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createSandbox(request: CubeCreateSandboxRequest): Promise<CubeSandboxConnection> {
    const response = await this.request<CubeApiSandboxPayload>("/sandboxes", {
      method: "POST",
      body: JSON.stringify({
        templateID: request.templateId,
        timeout: request.timeoutSeconds,
        autoPause: false,
        ...(request.allowInternetAccess === undefined ? {} : { allow_internet_access: request.allowInternetAccess }),
        ...(request.network ? { network: serializeNetwork(request.network) } : {}),
        ...(request.metadata ? { metadata: request.metadata } : {}),
      }),
    }, [201]);

    return normalizeConnection(response);
  }

  async connectSandbox(sandboxId: string, timeoutSeconds: number): Promise<CubeSandboxConnection> {
    const response = await this.request<CubeApiSandboxPayload>(`/sandboxes/${encodeURIComponent(sandboxId)}/connect`, {
      method: "POST",
      body: JSON.stringify({ timeout: timeoutSeconds }),
    }, [200]);

    return normalizeConnection(response);
  }

  async getSandbox(sandboxId: string): Promise<CubeSandboxDetail> {
    const response = await this.request<CubeApiSandboxDetailPayload>(`/sandboxes/${encodeURIComponent(sandboxId)}`, {
      method: "GET",
    }, [200]);

    return {
      ...normalizeConnection(response),
      state: response.state ?? "running",
    };
  }

  async pauseSandbox(sandboxId: string): Promise<void> {
    await this.request<void>(`/sandboxes/${encodeURIComponent(sandboxId)}/pause`, {
      method: "POST",
    }, [204]);
  }

  async deleteSandbox(sandboxId: string): Promise<void> {
    await this.request<void>(`/sandboxes/${encodeURIComponent(sandboxId)}`, {
      method: "DELETE",
    }, [204]);
  }

  async createSnapshot(sandboxId: string, name?: string): Promise<CubeSandboxSnapshot> {
    const response = await this.request<CubeApiSnapshotPayload>(`/sandboxes/${encodeURIComponent(sandboxId)}/snapshots`, {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    }, [201]);

    return {
      snapshotId: response.snapshotID,
      names: response.names,
    };
  }

  private async request<T>(path: string, init: RequestInit, allowedStatuses: number[]): Promise<T> {
    const response = await this.fetchImpl(new URL(path, `${this.apiUrl}/`), {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (allowedStatuses.includes(response.status)) {
      if (response.status === 204) {
        return undefined as T;
      }

      return parseJsonResponse<T>(response);
    }

    const body = await parseResponseBody(response);
    const message = extractErrorMessage(response.status, body);
    if (response.status === 404 && path.endsWith("/snapshots") && isRouteLevelNotFound(body)) {
      throw new CubeApiRouteNotAvailableError(message, response.status, body);
    }

    throw new CubeApiError(message, response.status, body);
  }
}

function serializeNetwork(network: CubeSandboxNetworkConfig): Record<string, string[]> {
  return {
    ...(network.allowOut ? { allow_out: network.allowOut } : {}),
    ...(network.denyOut ? { deny_out: network.denyOut } : {}),
  };
}

function normalizeConnection(payload: CubeApiSandboxPayload): CubeSandboxConnection {
  return {
    templateId: payload.templateID,
    sandboxId: payload.sandboxID,
    clientId: payload.clientID,
    envdVersion: payload.envdVersion,
    envdAccessToken: payload.envdAccessToken ?? undefined,
    trafficAccessToken: payload.trafficAccessToken ?? undefined,
    domain: payload.domain ?? undefined,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await parseResponseBody(response);
  return body as T;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(statusCode: number, body: unknown): string {
  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
  }

  return `Cube API request failed with status ${statusCode}.`;
}

function isRouteLevelNotFound(body: unknown): boolean {
  if (body === undefined) {
    return true;
  }

  if (typeof body === "string") {
    return body.trim() === "" || body.includes("Not Found");
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    return typeof record.message === "string" && record.message.includes("Not Found");
  }

  return false;
}
