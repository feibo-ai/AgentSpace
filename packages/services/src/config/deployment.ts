import { readEffectiveRuntimeEnv } from "@agent-space/db";

export type AgentSpaceDeploymentMode = "self_hosted" | "cloud";

export interface AttachmentRuntimeConfig {
  provider: "local" | "r2";
  localRoot?: string;
  publicBaseUrl?: string;
  maxUploadBytes: number;
  signedUrlTtlSeconds: number;
  enableLocalFallback: boolean;
  r2?: {
    accountId: string;
    bucket: string;
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
}

export interface AgentSpaceRuntimeConfig {
  deploymentMode: AgentSpaceDeploymentMode;
  databaseUrl: string;
  directDatabaseUrl?: string;
  attachments: AttachmentRuntimeConfig;
}

export function resolveAgentSpaceRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AgentSpaceRuntimeConfig {
  const effectiveEnv = readEffectiveRuntimeEnv({ env, repositoryOverridesEnv: env === process.env });
  const deploymentMode = resolveDeploymentMode(effectiveEnv);
  return {
    deploymentMode,
    databaseUrl: resolveDatabaseUrl(deploymentMode, effectiveEnv),
    directDatabaseUrl: resolveDirectDatabaseUrl(deploymentMode, effectiveEnv),
    attachments: resolveAttachmentRuntimeConfigForMode(deploymentMode, effectiveEnv),
  };
}

export function resolveAttachmentRuntimeConfig(envOrMode?: NodeJS.ProcessEnv | AgentSpaceDeploymentMode): AttachmentRuntimeConfig {
  const rawEnv = typeof envOrMode === "string" ? process.env : envOrMode ?? process.env;
  const env = typeof envOrMode === "string"
    ? readEffectiveRuntimeEnv()
    : readEffectiveRuntimeEnv({ env: rawEnv, repositoryOverridesEnv: rawEnv === process.env });
  const deploymentMode = typeof envOrMode === "string" ? envOrMode : resolveDeploymentMode(env);
  return resolveAttachmentRuntimeConfigForMode(deploymentMode, env);
}

function resolveAttachmentRuntimeConfigForMode(
  deploymentMode: AgentSpaceDeploymentMode,
  env: NodeJS.ProcessEnv,
): AttachmentRuntimeConfig {
  const maxUploadBytes = readPositiveInteger(env.ATTACHMENT_MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
  const signedUrlTtlSeconds = readPositiveInteger(env.ATTACHMENT_SIGNED_URL_TTL_SECONDS, 300);
  const publicBaseUrl = trimOptional(env.ATTACHMENT_PUBLIC_BASE_URL);
  const enableLocalFallback = env.ATTACHMENT_ENABLE_LOCAL_FALLBACK !== "false";

  if (deploymentMode === "cloud") {
    return {
      provider: "r2",
      publicBaseUrl,
      maxUploadBytes,
      signedUrlTtlSeconds,
      enableLocalFallback,
      localRoot: trimOptional(env.ATTACHMENT_LOCAL_ROOT) || trimOptional(env.SELF_HOSTED_ATTACHMENT_LOCAL_ROOT),
      r2: {
        accountId: requireEnvValue(env, "CLOUDFLARE_ACCOUNT_ID"),
        bucket: requireEnvValue(env, "CLOUDFLARE_R2_BUCKET"),
        region: trimOptional(env.CLOUDFLARE_R2_REGION) || "auto",
        endpoint: trimOptional(env.CLOUDFLARE_R2_ENDPOINT) || `https://${requireEnvValue(env, "CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
        accessKeyId: requireEnvValue(env, "CLOUDFLARE_R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnvValue(env, "CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
        forcePathStyle: env.CLOUDFLARE_R2_FORCE_PATH_STYLE !== "false",
      },
    };
  }

  return {
    provider: "local",
    localRoot: trimOptional(env.SELF_HOSTED_ATTACHMENT_LOCAL_ROOT) || trimOptional(env.ATTACHMENT_LOCAL_ROOT),
    publicBaseUrl,
    maxUploadBytes,
    signedUrlTtlSeconds,
    enableLocalFallback,
  };
}

function resolveDeploymentMode(env: NodeJS.ProcessEnv): AgentSpaceDeploymentMode {
  const rawMode = env.AGENT_SPACE_DEPLOYMENT_MODE?.trim();
  if (!rawMode || rawMode === "self_hosted") {
    return "self_hosted";
  }
  if (rawMode === "cloud") {
    return "cloud";
  }
  throw new Error(`Unsupported AGENT_SPACE_DEPLOYMENT_MODE "${rawMode}". Expected "self_hosted" or "cloud".`);
}

function resolveDatabaseUrl(mode: AgentSpaceDeploymentMode, env: NodeJS.ProcessEnv): string {
  if (mode === "cloud") {
    return requireEnvValue(env, "NEON_DATABASE_URL");
  }
  return requireEnvValue(env, "SELF_HOSTED_DATABASE_URL");
}

function resolveDirectDatabaseUrl(mode: AgentSpaceDeploymentMode, env: NodeJS.ProcessEnv): string | undefined {
  if (mode === "cloud") {
    return trimOptional(env.NEON_DATABASE_DIRECT_URL);
  }
  return trimOptional(env.SELF_HOSTED_DATABASE_DIRECT_URL);
}

function requireEnvValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = trimOptional(env[name]);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
