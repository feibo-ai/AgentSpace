import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/features/i18n/language-provider";
import { InvitationStatusScreen } from "./invitation-status-screen";

describe("InvitationStatusScreen", () => {
  it("renders translated expired invitation messaging", () => {
    render(
      <LanguageProvider>
        <InvitationStatusScreen
          email="mina@example.com"
          status="expired"
          workspaceName="Mars Labs"
        />
      </LanguageProvider>,
    );

    expect(screen.getByText("你正尝试进入 Mars Labs。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "邀请已过期" })).toBeInTheDocument();
    expect(screen.getByText("mina@example.com 对 Mars Labs 的邀请已经过期。请联系工作区管理员重新生成一条邀请。")).toBeInTheDocument();
    expect(screen.getByText("团队消息、任务与文档在同一处协作")).toBeInTheDocument();
    expect(screen.getByText("目标工作区")).toBeInTheDocument();
    expect(screen.getByText("受邀邮箱")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "接下来怎么做" })).toBeInTheDocument();
    expect(screen.getByText("联系 Mars Labs 的管理员，请他们重新发送一条新的邀请。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回登录页" })).toHaveAttribute("href", "/");
  });

  it("renders a dedicated explanation for invitation email mismatch", () => {
    render(
      <LanguageProvider>
        <InvitationStatusScreen
          email="mina@example.com"
          reasonCode="workspace.invitation.email_mismatch"
          status="accept_failed"
          workspaceName="Mars Labs"
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "暂时无法接受邀请" })).toBeInTheDocument();
    expect(screen.getByText("当前登录账号的邮箱与 Mars Labs 这条邀请不一致。请改用受邀邮箱登录后再继续。")).toBeInTheDocument();
    expect(screen.getByText("退出当前账号后，改用 mina@example.com 重新发起登录。")).toBeInTheDocument();
    expect(screen.getByText("登录完成后，系统会继续把你带回 Mars Labs 的邀请链路。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "重新发起登录" })).toHaveAttribute("href", "/");
  });
});
