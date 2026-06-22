import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getDaemonTaskOutputStagingDir,
  materializeOutputBundleToStaging,
} from "./output-bundle";

const workspaceId = "workspace-output-bundle-test";
const taskId = "task-output-bundle-test";

afterEach(() => {
  rmSync(getDaemonTaskOutputStagingDir(taskId, workspaceId), { recursive: true, force: true });
});

describe("materializeOutputBundleToStaging", () => {
  it("accepts runtime-output bundle files", () => {
    const stagingDir = materializeOutputBundleToStaging(taskId, workspaceId, {
      version: 1,
      format: "json-inline-v1",
      files: [
        {
          path: "runtime-output/agent-output.json",
          contentBase64: Buffer.from(JSON.stringify({ text: "done" }), "utf8").toString("base64"),
        },
      ],
    });

    expect(existsSync(join(stagingDir, "runtime-output", "agent-output.json"))).toBe(true);
  });

  it("rejects paths outside runtime-output", () => {
    expect(() =>
      materializeOutputBundleToStaging(taskId, workspaceId, {
        version: 1,
        format: "json-inline-v1",
        files: [
          {
            path: "artifacts/chart.png",
            contentBase64: Buffer.from("bad", "utf8").toString("base64"),
          },
        ],
      }),
    ).toThrow(/runtime-output/i);
  });

  it("rejects too many bundle files", () => {
    expect(() =>
      materializeOutputBundleToStaging(taskId, workspaceId, {
        version: 1,
        format: "json-inline-v1",
        files: Array.from({ length: 65 }, (_, index) => ({
          path: `runtime-output/artifacts/file-${index}.txt`,
          contentBase64: Buffer.from("x", "utf8").toString("base64"),
        })),
      }),
    ).toThrow(/too many files/i);
  });
});
