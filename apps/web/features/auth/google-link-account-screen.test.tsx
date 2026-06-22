import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/features/i18n/language-provider";
import { GoogleLinkAccountScreen } from "./google-link-account-screen";

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
  confirmGoogleAccountLinkAction: vi.fn(async () => ({ ok: true })),
}));

describe("GoogleLinkAccountScreen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
  });

  it("renders invitation continuation context when present", () => {
    render(
      <LanguageProvider>
        <GoogleLinkAccountScreen
          email="mina@example.com"
          invitation={{
            workspaceName: "Mars Labs",
            role: "admin",
          }}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "先验证这个账号，再继续进入 Mars Labs。" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("mina@example.com")).toBeDisabled();
    expect(screen.getByText("你不是在新建账号，而是在继续已有协作身份")).toBeInTheDocument();
    expect(screen.getByText("继续 Mars Labs 邀请")).toBeInTheDocument();
    expect(screen.getByText("管理员")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "验证并继续进入工作区" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回登录页" })).toHaveAttribute("href", "/");
  });
});
