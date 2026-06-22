import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/features/i18n/language-provider";
import { AddContainerModal } from "./add-container-modal";

describe("AddContainerModal", () => {
  it("renders onboarding steps and daemon identifiers", () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => {}),
      },
    });

    render(
      <LanguageProvider>
        <AddContainerModal
          command={"bash install.sh"}
          daemonId="daemon-abc"
          daemonTokenId="token-xyz"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("dialog", { name: "接入服务器" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "接入服务器" })).toBeInTheDocument();
    expect(screen.getByText("复制命令，并发送给你的 Agent 让它运行，或直接在已安装执行引擎的服务器运行。")).toBeInTheDocument();
    expect(screen.getByText("daemon-abc")).toBeInTheDocument();
    expect(screen.getByText("token-xyz")).toBeInTheDocument();
    expect(screen.getByText("确认运行完毕后点击“我已运行”。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭弹窗" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制命令" })).toBeInTheDocument();
  });
});
