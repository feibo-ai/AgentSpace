import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/features/i18n/language-provider";
import { GoogleProfileSetupScreen } from "./google-profile-setup-screen";

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/features/auth/actions", () => ({
  completeGoogleRegistrationAction: vi.fn(async () => ({ ok: true, redirectPath: "/w/mars-labs/inbox" })),
}));

describe("GoogleProfileSetupScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockReset();
    mockRefresh.mockReset();
  });

  it("prefills the username and workspace name for first-time Google setup", () => {
    render(
      <LanguageProvider initialLanguage="zh">
        <GoogleProfileSetupScreen
          email="mina@example.com"
          initialDisplayName="Mina"
          invitation={{
            workspaceName: "Mars Labs",
            role: "admin",
          }}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "确认资料后加入 Mars Labs，继续共享协作上下文。" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("mina@example.com")).toBeDisabled();
    expect(screen.getByDisplayValue("Mina")).toBeInTheDocument();
    expect(screen.getByDisplayValue("我的个人工作区")).toBeInTheDocument();
    expect(screen.getByText("首次 Google 登录也会保留邀请上下文")).toBeInTheDocument();
    expect(screen.getByText("继续 Mars Labs 邀请")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认资料并加入工作区" })).toBeInTheDocument();
  });

  it("uses English by default for first-time Google setup", async () => {
    render(
      <LanguageProvider>
        <GoogleProfileSetupScreen
          email="mina@example.com"
          initialDisplayName="Mina"
        />
      </LanguageProvider>,
    );

    expect(await screen.findByDisplayValue("My personal workspace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirm your profile and create your collaboration workspace with Google." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm profile and create account" })).toBeInTheDocument();
  });
});
