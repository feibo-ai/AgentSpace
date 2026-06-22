import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction, registerAction } from "@/features/auth/actions";
import { LanguageProvider } from "@/features/i18n/language-provider";
import { AuthScreen } from "./auth-screen";

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
  loginAction: vi.fn(),
  registerAction: vi.fn(),
}));

describe("AuthScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockReset();
    mockRefresh.mockReset();
    vi.mocked(loginAction).mockReset();
    vi.mocked(registerAction).mockReset();
  });

  it("uses the server-provided absolute Google start URL", () => {
    render(
      <LanguageProvider>
        <AuthScreen
          googleStartUrl="https://hire-an-agent.online/api/auth/google/start"
          hasUsers
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "https://hire-an-agent.online/api/auth/google/start",
    );
  });

  it("keeps a workspace join code in password and Google auth flows", () => {
    render(
      <LanguageProvider initialLanguage="zh">
        <AuthScreen
          googleStartUrl="https://hire-an-agent.online/api/auth/google/start"
          hasUsers
          initialWorkspaceJoinCode="A7K2M9Q4"
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("textbox", { name: /^工作区邀请码/ })).toHaveValue("A7K2M9Q4");
    expect(screen.getByRole("link", { name: "使用 Google 登录" })).toHaveAttribute(
      "href",
      "https://hire-an-agent.online/api/auth/google/start?joinCode=A7K2M9Q4",
    );
  });

  it("surfaces returned login account errors without navigating", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValueOnce({ ok: false, error: "auth.account_not_found" });

    render(
      <LanguageProvider initialLanguage="zh">
        <AuthScreen hasUsers />
      </LanguageProvider>,
    );

    await user.type(screen.getByLabelText("邮箱"), "missing@example.com");
    await user.type(screen.getByLabelText("密码"), "secret-password");
    await user.click(screen.getByRole("button", { name: "登录进入工作台" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("账号不存在。");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("explains the product and post-sign-in workspace structure for returning users", () => {
    render(
      <LanguageProvider initialLanguage="zh">
        <AuthScreen hasUsers />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "让 Agent 像真实员工一样协作，像关键系统一样受控。" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "登录并继续" })).toBeInTheDocument();
    expect(screen.getAllByText("Agent 保持不变，runtime 按任务切换").length).toBeGreaterThan(0);
    expect(screen.getAllByText("访问、执行、外发与授权全程可审计").length).toBeGreaterThan(0);
  });

  it("only asks for display name, email, and password in register mode", () => {
    render(
      <LanguageProvider initialLanguage="zh">
        <AuthScreen hasUsers={false} />
      </LanguageProvider>,
    );

    expect(screen.getByRole("textbox", { name: "你的名字" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "组织名称" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "你的角色" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "第一个群组" })).not.toBeInTheDocument();
  });

  it("surfaces invitation context and keeps the invitation token in the Google entry path", () => {
    render(
      <LanguageProvider initialLanguage="zh">
        <AuthScreen
          hasUsers
          invitation={{
            token: "invite-1",
            workspaceName: "Mars Labs",
            email: "mina@example.com",
            role: "member",
          }}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "加入 Mars Labs，在同一工作台里继续消息、任务、文档与 Agent 协作。" })).toBeInTheDocument();
    expect(screen.getByText("这条邀请会把你带进真实协作流")).toBeInTheDocument();
    expect(screen.getByText("直接进入共享收件箱")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录并进入工作区" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "使用 Google 进入工作区" })).toHaveAttribute(
      "href",
      "/api/auth/google/start?invitationToken=invite-1",
    );
    expect(screen.getByRole("textbox", { name: /^邮箱/ })).toHaveValue("mina@example.com");
    expect(screen.getByRole("textbox", { name: /^邮箱/ })).toBeDisabled();
    expect(screen.getByText("这条邀请已锁定到受邀邮箱。如需改用其他邮箱，请让工作区管理员重新发送邀请。")).toBeInTheDocument();
  });
});
