"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/features/i18n/language-provider";
import { useDialogSurface } from "@/shared/lib/use-dialog-surface";
import { AppIcon } from "@/shared/ui/app-icon";
import { FeedbackBanner } from "@/shared/ui/feedback-banner";
import { HoverTooltip } from "@/shared/ui/hover-tooltip";

interface AddContainerModalProps {
  readonly command: string;
  readonly daemonId: string;
  readonly daemonTokenId: string;
  readonly mode?: "connect" | "update";
  readonly onClose: () => void;
  readonly onSuccess: (runtimeId?: string) => void;
}

export function AddContainerModal({
  command,
  daemonId,
  daemonTokenId,
  mode = "connect",
  onClose,
  onSuccess,
}: AddContainerModalProps) {
  const { tx } = useLanguage();
  const isUpdate = mode === "update";
  const { surfaceRef, handleBackdropMouseDown, labelId } = useDialogSurface<HTMLDivElement>(onClose);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "waiting" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const pollTimerRef = useRef<number | null>(null);
  const setupSteps = isUpdate
    ? [
        tx(
          "复制命令，并在这台服务器原来的登录用户下运行。",
          "Copy the command and run it as the same OS user on this server.",
        ),
        tx("命令会读取现有 daemon.env 的安装路径，并写入新的接入令牌。", "The command reads the install paths from the existing daemon.env and writes a fresh access token."),
        tx("确认运行完毕后点击“我已运行”。", "Once it finishes, click \"I ran it\"."),
      ]
    : [
        tx(
          "复制命令，并发送给你的 Agent 让它运行，或直接在已安装执行引擎的服务器运行。",
          "Copy the command and send it to your agent to run, or run it directly on a server with an execution engine installed.",
        ),
        tx("确认运行完毕后点击“我已运行”。", "Once it finishes, click \"I ran it\"."),
      ];

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function pollStatusOnce(): Promise<void> {
    const response = await fetch(`/api/daemon/onboarding-status?daemonKey=${encodeURIComponent(daemonId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Polling failed with ${response.status}.`);
    }

    const payload = (await response.json()) as {
      status: "pending" | "online" | "offline";
      runtimeCount: number;
      runtimes: Array<{ id: string; status: string }>;
    };

    if (payload.status === "online" && payload.runtimeCount > 0) {
      setStatus("success");
      setStatusMessage(
        tx(
          `检测到服务器已上线，共 ${payload.runtimeCount} 个执行引擎。`,
          `Server is online with ${payload.runtimeCount} execution engine(s).`,
        ),
      );
      onSuccess(payload.runtimes[0]?.id);
      return;
    }

    if (payload.status === "online" && payload.runtimeCount === 0) {
      setStatus("error");
      setStatusMessage(
        tx(
          "检测到服务器已上线，但没有返回可用执行引擎。请检查 provider 安装与 daemon 日志。",
          "The server is online but did not report any runnable execution engines. Check the provider installation and daemon logs.",
        ),
      );
      return;
    }

    if (payload.status === "offline") {
      setStatus("error");
      setStatusMessage(
        tx("检测到服务器已注册但当前离线，请检查目标服务器上的服务日志。", "The server registered but is currently offline. Check the service logs on the target server."),
      );
    }
  }

  function startPolling(): void {
    setStatus("waiting");
    setStatusMessage(isUpdate ? tx("正在等待服务器更新后重新上线。", "Waiting for the server to come back online after updating.") : tx("正在等待服务器上线。", "Waiting for the new server to come online."));

    void pollStatusOnce().catch((error) => {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : String(error));
    });

    pollTimerRef.current = window.setInterval(() => {
      void pollStatusOnce().catch((error) => {
        setStatus("error");
        setStatusMessage(error instanceof Error ? error.message : String(error));
      });
    }, 3000);
  }

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "success" && status !== "error") {
      return;
    }
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [status]);

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} role="presentation">
      <div aria-labelledby={labelId} aria-modal="true" className="modal-card modal-card--compact" ref={surfaceRef} role="dialog" tabIndex={-1}>
        <div className="modal-card__header">
          <div>
            <div className="agents-pane__title-row">
              <h3 id={labelId}>{isUpdate ? tx("更新 Runtime", "Update runtime") : tx("接入服务器", "Connect server")}</h3>
              <HoverTooltip
                align="center"
                content={tx(
                  "目前支持：Codex / Claude Code / OpenCode / OpenClaw / NanoBot",
                  "Currently supported: Codex / Claude Code / OpenCode / OpenClaw / NanoBot",
                )}
              >
                {({ describedBy }) => (
                  <button
                    aria-describedby={describedBy}
                    aria-label={tx("查看当前支持的执行引擎", "View supported execution engines")}
                    className="inline-help-tooltip__button"
                    type="button"
                  >
                    ?
                  </button>
                )}
              </HoverTooltip>
            </div>
          </div>
          <button aria-label={tx("关闭弹窗", "Close modal")} className="modal-close" onClick={onClose} type="button">
            <AppIcon name="close" />
          </button>
        </div>

        <div className="modal-card__body">
          <div className="agent-command-modal__summary" role="list">
            <article className="agent-command-modal__summary-card" role="listitem">
              <span>{tx("服务器 ID", "Server ID")}</span>
              <strong>{daemonId}</strong>
            </article>
            <article className="agent-command-modal__summary-card" role="listitem">
              <span>{isUpdate ? tx("令牌来源", "Token source") : tx("令牌 ID", "Token ID")}</span>
              <strong>{daemonTokenId}</strong>
            </article>
          </div>

          <div className="agent-command-modal__steps">
            {setupSteps.map((step, index) => (
              <div className="agent-command-modal__step" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>

          <label className="form-field">
            <span>{isUpdate ? tx("更新命令", "Update command") : tx("安装命令", "Install command")}</span>
            <textarea
              autoFocus
              className="agent-command-modal__textarea"
              readOnly
              rows={4}
              value={command}
            />
          </label>
          {statusMessage ? (
            <FeedbackBanner
              feedback={{
                tone: status === "error" ? "error" : "success",
                message: statusMessage,
              }}
            />
          ) : null}
          <div className="agent-command-modal__notes">
            <p className="panel-note">
              {tx(
                isUpdate
                  ? "命令包含新令牌，并会覆盖目标机器 daemon.env 里的旧令牌。请只在对应服务器执行，并避免泄露。"
                  : "命令包含新令牌。请立即复制，只在目标机器执行，并避免泄露。",
                isUpdate
                  ? "This command contains a fresh token and replaces the old token in daemon.env on the target machine. Run it only on that server and avoid leaking it."
                  : "This command contains a fresh token. Copy it now, run it only on the target machine, and avoid leaking it.",
              )}
            </p>
          </div>
        </div>

        <div className="modal-card__footer">
          <button className="modal-secondary-button" onClick={onClose} type="button">
            {tx("关闭", "Close")}
          </button>
          <button
            className="modal-secondary-button"
            disabled={status === "waiting"}
            onClick={() => startPolling()}
            type="button"
          >
            {status === "waiting" ? tx("等待中...", "Waiting...") : tx("我已运行", "I ran it")}
          </button>
          <button className="primary-button" onClick={() => void handleCopy()} type="button">
            {copied ? tx("已复制", "Copied") : tx("复制命令", "Copy command")}
          </button>
        </div>
      </div>
    </div>
  );
}
