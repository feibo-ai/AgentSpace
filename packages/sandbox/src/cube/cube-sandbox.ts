import type { Sandbox } from "../interface.ts";
import { LocalSandbox } from "../local/local-sandbox.ts";
import type { ExecCommand, ExecResult, FileEntry, SandboxConnectOptions, SandboxStatus } from "../types.ts";
import { CubeApiError, CubeApiRouteNotAvailableError, CubeSandboxClient } from "./cube-client.ts";
import type { CubeSandboxConnection } from "./cube-client.ts";
import { resolveCubeSandboxConfig } from "./cube-config.ts";
import type { CubeSandboxConfig } from "./cube-config.ts";

export const CUBE_EXEC_NOT_READY_MESSAGE = [
  "CubeSandbox provisioning is wired up, but remote command execution is not yet connected to Cube's envd/E2B data plane.",
  "The current scaffold can create, pause, snapshot, and destroy Cube sandboxes while keeping file operations on the local daemon workDir.",
  "Keep using the local provider for real task execution until TODO 46 finishes the remote exec transport.",
].join(" ");

export class CubeSandbox implements Sandbox {
  readonly id: string;

  private readonly config: CubeSandboxConfig;
  private readonly client: CubeSandboxClient;
  private readonly localFiles: LocalSandbox;
  private connection: CubeSandboxConnection;
  private statusValue: SandboxStatus;

  private constructor(
    config: CubeSandboxConfig,
    client: CubeSandboxClient,
    connection: CubeSandboxConnection,
  ) {
    this.config = config;
    this.client = client;
    this.connection = connection;
    this.id = connection.sandboxId;
    this.localFiles = new LocalSandbox(config.workDir, config.runtimeId);
    this.statusValue = "active";
  }

  static async connect(options: SandboxConnectOptions): Promise<CubeSandbox> {
    const config = resolveCubeSandboxConfig(options);
    const client = new CubeSandboxClient({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      requestTimeoutMs: config.requestTimeoutMs,
    });
    const connection = await client.createSandbox({
      templateId: config.templateId,
      timeoutSeconds: config.timeoutSeconds,
      allowInternetAccess: config.allowInternetAccess,
      network: config.network,
      metadata: config.metadata,
    });
    return new CubeSandbox(config, client, connection);
  }

  get status(): SandboxStatus {
    return this.statusValue;
  }

  get remoteWorkDir(): string | undefined {
    return this.config.mountWorkDir ? this.config.mountPath : undefined;
  }

  get connectionInfo(): CubeSandboxConnection {
    return { ...this.connection };
  }

  async readFile(path: string): Promise<string> {
    return this.localFiles.readFile(path);
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await this.localFiles.writeFile(path, contents);
  }

  async readDir(path: string): Promise<FileEntry[]> {
    return this.localFiles.readDir(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.localFiles.exists(path);
  }

  async exec(_command: ExecCommand): Promise<ExecResult> {
    throw new Error(CUBE_EXEC_NOT_READY_MESSAGE);
  }

  async snapshot(): Promise<string> {
    try {
      const snapshot = await this.client.createSnapshot(this.id, buildSnapshotName(this.config.runtimeId));
      return snapshot.snapshotId;
    } catch (error) {
      if (error instanceof CubeApiRouteNotAvailableError) {
        return this.localFiles.snapshot();
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.statusValue === "stopped" || this.statusValue === "hibernated") {
      return;
    }

    try {
      this.statusValue = "hibernating";
      await this.client.pauseSandbox(this.id);
      this.statusValue = "hibernated";
    } catch (error) {
      if (isMissingSandboxError(error)) {
        this.statusValue = "stopped";
        return;
      }
      this.statusValue = "failed";
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (this.statusValue === "stopped") {
      return;
    }

    try {
      await this.client.deleteSandbox(this.id);
      this.statusValue = "stopped";
    } catch (error) {
      if (isMissingSandboxError(error)) {
        this.statusValue = "stopped";
        return;
      }
      this.statusValue = "failed";
      throw error;
    }
  }

  async refreshStatus(): Promise<SandboxStatus> {
    const detail = await this.client.getSandbox(this.id);
    this.connection = detail;
    this.statusValue = mapCubeState(detail.state);
    return this.statusValue;
  }
}

function buildSnapshotName(runtimeId: string): string {
  return `${runtimeId}-${Date.now().toString(36)}`;
}

function mapCubeState(state: string): SandboxStatus {
  const normalized = state.trim().toLowerCase();
  if (normalized === "paused") {
    return "hibernated";
  }
  if (normalized === "running") {
    return "active";
  }
  return "failed";
}

function isMissingSandboxError(error: unknown): boolean {
  return error instanceof CubeApiError && error.statusCode === 404;
}
