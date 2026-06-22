import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { DaemonTaskInputBundle, DaemonTaskOutputBundle } from "./daemon-api.ts";
import { getRuntimeOutputDir } from "./runtime-output.ts";
import { collectRuntimeOutputBundleFiles } from "./runtime-output-manifests.ts";

export function clearTaskOutputArtifacts(workDir: string): void {
  rmSync(join(workDir, "last-message.txt"), { force: true });
  rmSync(getRuntimeOutputDir(workDir), { recursive: true, force: true });
}

export function materializeInputBundle(workDir: string, bundle: DaemonTaskInputBundle): void {
  for (const file of bundle.files) {
    const targetPath = resolveBundleTargetPath(workDir, file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, Buffer.from(file.contentBase64, "base64"));
  }
}

export function collectRuntimeOutputBundle(workDir: string): DaemonTaskOutputBundle | undefined {
  const runtimeOutputDir = getRuntimeOutputDir(workDir);
  if (!existsSync(runtimeOutputDir)) {
    return undefined;
  }

  const files = collectRuntimeOutputBundleFiles(workDir);
  if (files.length === 0) {
    return undefined;
  }
  return {
    version: 1,
    format: "json-inline-v1",
    files,
  };
}

export function sanitizePathSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "task";
}

function resolveBundleTargetPath(workDir: string, bundlePath: string): string {
  const candidatePath = bundlePath.trim();
  if (!candidatePath) {
    throw new Error("Bundle file path is required.");
  }
  if (isAbsolute(candidatePath)) {
    throw new Error(`Bundle file path must be relative: ${candidatePath}`);
  }

  const resolvedPath = resolve(workDir, candidatePath);
  const relativePath = relative(workDir, resolvedPath);
  if (
    relativePath === "" ||
    relativePath === "." ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  ) {
    return resolvedPath;
  }

  throw new Error(`Bundle file path escapes workDir: ${candidatePath}`);
}
