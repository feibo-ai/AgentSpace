import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/features/i18n/language-provider";
import { MarketPageClient, type MarketPageData } from "@/features/market/market-page-client";
import { FeedbackToastProvider } from "@/shared/ui/feedback-toast-provider";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

const actionMocks = vi.hoisted(() => ({
  refreshCatalog: vi.fn(async () => ({ data: undefined })),
  requestOperation: vi.fn(async () => ({ data: undefined })),
  syncSkill: vi.fn(async () => ({ data: undefined })),
}));

vi.mock("@/features/market/actions", () => ({
  refreshRuntimeAppCatalogAction: actionMocks.refreshCatalog,
  requestRuntimeAppOperationAction: actionMocks.requestOperation,
  syncRuntimeAppSkillAction: actionMocks.syncSkill,
}));

const data: MarketPageData = {
  catalog: [
    {
      source: "clihub_harness",
      name: "mermaid",
      displayName: "Mermaid",
      description: "Render diagrams",
      version: "1.0.0",
      category: "diagram",
      entryPoint: "mmdc",
      installStrategy: "cli_hub",
      risk: "low",
    },
  ],
  catalogHealth: {
    itemCount: 1,
    lastSyncedAt: "2026-05-08T00:00:00.000Z",
    stale: false,
  },
  runtimes: [
    {
      id: "runtime-online",
      label: "Online Runtime",
      provider: "codex",
      status: "online",
      daemonKey: "daemon-online",
      cliHubReady: true,
    },
    {
      id: "runtime-offline",
      label: "Offline Runtime",
      provider: "codex",
      status: "offline",
      daemonKey: "daemon-offline",
      cliHubReady: false,
    },
  ],
  installedApps: [],
  operations: [],
  canManage: true,
};

describe("MarketPageClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    mockRefresh.mockClear();
    actionMocks.refreshCatalog.mockClear();
    actionMocks.requestOperation.mockClear();
    actionMocks.syncSkill.mockClear();
  });

  it("only shows online runtimes in the target runtime selector", () => {
    render(
      <LanguageProvider>
        <FeedbackToastProvider>
          <MarketPageClient data={data} />
        </FeedbackToastProvider>
      </LanguageProvider>,
    );

    const runtimeSelect = screen.getByRole("combobox", { name: "目标 runtime" });
    expect(runtimeSelect).toHaveValue("runtime-online");
    expect(screen.getByRole("option", { name: /Online Runtime/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Offline Runtime/ })).not.toBeInTheDocument();
  });

  it("shows the real failed operation error for the selected runtime app", () => {
    render(
      <LanguageProvider>
        <FeedbackToastProvider>
          <MarketPageClient
            data={{
              ...data,
              installedApps: [
                {
                  runtimeId: "runtime-online",
                  source: "clihub_harness",
                  name: "mermaid",
                  status: "failed",
                  enabled: true,
                  version: "1.0.0",
                  entryPoint: "mmdc",
                  lastError: "Older installed app error",
                },
              ],
              operations: [
                {
                  id: "runtime-app-op-1",
                  runtimeId: "runtime-online",
                  appSource: "clihub_harness",
                  appName: "mermaid",
                  operation: "install",
                  status: "failed",
                  createdAt: "2026-05-08T12:51:08.058Z",
                  errorMessage: "python -m pip install --user cli-anything-hub exited with code 1. No matching distribution found for cli-anything-hub",
                },
              ],
            }}
          />
        </FeedbackToastProvider>
      </LanguageProvider>,
    );

    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No matching distribution found for cli-anything-hub");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Older installed app error");
  });

  it("refreshes while runtime app operations are still active", () => {
    vi.useFakeTimers();

    render(
      <LanguageProvider>
        <FeedbackToastProvider>
          <MarketPageClient
            data={{
              ...data,
              operations: [
                {
                  id: "runtime-app-op-2",
                  runtimeId: "runtime-online",
                  appSource: "clihub_harness",
                  appName: "mermaid",
                  operation: "install",
                  status: "running",
                  createdAt: "2026-05-08T12:51:08.058Z",
                },
              ],
            }}
          />
        </FeedbackToastProvider>
      </LanguageProvider>,
    );

    expect(screen.getByText("running")).toBeInTheDocument();
    vi.advanceTimersByTime(2_500);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("uses module refresh callback for polling inside the workbench", () => {
    vi.useFakeTimers();
    const onDataChanged = vi.fn();

    render(
      <LanguageProvider>
        <FeedbackToastProvider>
          <MarketPageClient
            data={{
              ...data,
              operations: [
                {
                  id: "runtime-app-op-2",
                  runtimeId: "runtime-online",
                  appSource: "clihub_harness",
                  appName: "mermaid",
                  operation: "install",
                  status: "running",
                  createdAt: "2026-05-08T12:51:08.058Z",
                },
              ],
            }}
            onDataChanged={onDataChanged}
          />
        </FeedbackToastProvider>
      </LanguageProvider>,
    );

    vi.advanceTimersByTime(2_500);
    expect(onDataChanged).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("uses module refresh callback for actions inside the workbench", async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn();

    render(
      <LanguageProvider>
        <FeedbackToastProvider>
          <MarketPageClient data={data} onDataChanged={onDataChanged} />
        </FeedbackToastProvider>
      </LanguageProvider>,
    );

    await user.click(screen.getByRole("button", { name: /刷新目录/ }));

    expect(actionMocks.refreshCatalog).toHaveBeenCalledTimes(1);
    expect(onDataChanged).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
