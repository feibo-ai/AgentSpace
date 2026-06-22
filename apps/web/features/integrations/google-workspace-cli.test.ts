import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleWorkspaceApiError } from "./google-workspace-errors";
import {
  executeGoogleWorkspaceCliSheetOperation,
  GoogleWorkspaceCliError,
  runGoogleWorkspaceCliJson,
} from "./google-workspace-cli";

describe("Google Workspace CLI adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes whitelisted args as an array and injects the token through env", async () => {
    const execFileImpl = vi.fn((file, args, options, callback) => {
      callback(null, JSON.stringify({ range: "Sheet1!A1:A2" }), "");
    });

    const result = await runGoogleWorkspaceCliJson(
      [
        "sheets",
        "spreadsheets",
        "values",
        "get",
        "--params",
        JSON.stringify({ spreadsheetId: "sheet-1", range: "Sheet1!A1:A2" }),
        "--format",
        "json",
      ],
      "secret-token",
      {
        binaryPath: "/opt/gws",
        timeoutMs: 1234,
        execFileImpl,
      },
    );

    expect(result).toEqual({ range: "Sheet1!A1:A2" });
    expect(execFileImpl).toHaveBeenCalledTimes(1);
    const [file, args, options] = execFileImpl.mock.calls[0]!;
    expect(file).toBe("/opt/gws");
    expect(args).toEqual([
      "sheets",
      "spreadsheets",
      "values",
      "get",
      "--params",
      JSON.stringify({ spreadsheetId: "sheet-1", range: "Sheet1!A1:A2" }),
      "--format",
      "json",
    ]);
    expect(args.join(" ")).not.toContain("secret-token");
    expect(options.env.GOOGLE_WORKSPACE_CLI_TOKEN).toBe("secret-token");
    expect(options.timeout).toBe(1234);
  });

  it("rejects non-whitelisted CLI shapes before spawning", async () => {
    const execFileImpl = vi.fn();

    await expect(runGoogleWorkspaceCliJson(["bash", "-lc", "echo bad"], "token", { execFileImpl }))
      .rejects.toThrow("Google Workspace CLI operation is not allowed.");
    expect(execFileImpl).not.toHaveBeenCalled();
  });

  it("reports missing CLI binaries with a clear error code", async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(Object.assign(new Error("spawn gws ENOENT"), { code: "ENOENT" }), "", "");
    });

    await expect(runGoogleWorkspaceCliJson(
      ["sheets", "spreadsheets", "values", "get", "--params", "{}", "--format", "json"],
      "token",
      { binaryPath: "/missing/gws", execFileImpl },
    )).rejects.toMatchObject({
      name: "GoogleWorkspaceApiError",
      status: 503,
      code: "google_workspace.cli_not_found",
      message: "Google Workspace CLI is not available at \"/missing/gws\".",
    } satisfies Partial<GoogleWorkspaceApiError>);
  });

  it("reports CLI timeouts distinctly", async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(Object.assign(new Error("Command timed out"), { killed: true, signal: "SIGTERM" }), "", "");
    });

    await expect(runGoogleWorkspaceCliJson(
      ["sheets", "spreadsheets", "values", "get", "--params", "{}", "--format", "json"],
      "token",
      { execFileImpl },
    )).rejects.toMatchObject({
      status: 504,
      code: "google_workspace.cli_timeout",
    } satisfies Partial<GoogleWorkspaceApiError>);
  });

  it("reports invalid JSON stdout", async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(null, "not json", "");
    });

    await expect(runGoogleWorkspaceCliJson(
      ["sheets", "spreadsheets", "values", "get", "--params", "{}", "--format", "json"],
      "token",
      { execFileImpl },
    )).rejects.toMatchObject({
      status: 502,
      code: "google_workspace.cli_invalid_json",
    } satisfies Partial<GoogleWorkspaceApiError>);
  });

  it("redacts access tokens from CLI failure details", async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(
        Object.assign(new Error("failed"), { code: 1 }),
        "",
        "403 insufficient permission for GOOGLE_WORKSPACE_CLI_TOKEN=secret-token and Bearer secret-token",
      );
    });

    await expect(runGoogleWorkspaceCliJson(
      ["sheets", "spreadsheets", "values", "append", "--params", "{}", "--json", "{}", "--format", "json"],
      "secret-token",
      {
        failureCode: "google_workspace.sheets_append_failed",
        execFileImpl,
      },
    )).rejects.toMatchObject({
      status: 403,
      code: "google_workspace.sheets_append_failed",
      message: expect.not.stringContaining("secret-token"),
    });
  });

  it("executes sheet updates through the shared CLI runner", async () => {
    const execFileImpl = vi.fn((file, args, options, callback) => {
      callback(null, JSON.stringify({
        updatedRange: "Sheet1!A1:B1",
        updatedRows: 1,
        updatedCells: 2,
      }), "");
    });

    const result = await executeGoogleWorkspaceCliSheetOperation({
      accessToken: "access-token",
      spreadsheetId: "sheet-1",
      operation: {
        operationType: "update_values",
        rangeA1: "Sheet1!A1:B1",
        values: [["ok", true]],
      },
      execFileImpl,
    });

    expect(result.updatedCells).toBe(2);
    const [file, args, options] = execFileImpl.mock.calls[0]!;
    expect(file).toBe("gws");
    expect(args).toEqual([
      "sheets",
      "spreadsheets",
      "values",
      "update",
      "--params",
      JSON.stringify({
        spreadsheetId: "sheet-1",
        range: "Sheet1!A1:B1",
        valueInputOption: "USER_ENTERED",
      }),
      "--json",
      JSON.stringify({ values: [["ok", true]] }),
      "--format",
      "json",
    ]);
    expect(options.env.GOOGLE_WORKSPACE_CLI_TOKEN).toBe("access-token");
  });

  it("maps sheet API failures to operation-specific CLI errors", async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(
        Object.assign(new Error("failed"), { code: 1 }),
        "",
        "404 Requested entity was not found.",
      );
    });

    await expect(executeGoogleWorkspaceCliSheetOperation({
      accessToken: "access-token",
      spreadsheetId: "sheet-1",
      operation: {
        operationType: "read",
        rangeA1: "Sheet1!A1:B1",
      },
      execFileImpl,
    })).rejects.toMatchObject({
      code: "google_workspace.sheets_read_failed",
      status: 404,
      reason: "notFound",
    } satisfies Partial<GoogleWorkspaceCliError>);
  });
});
