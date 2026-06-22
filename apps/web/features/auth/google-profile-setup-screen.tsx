"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { WorkspaceRole } from "@agent-space/db";
import { completeGoogleRegistrationAction } from "@/features/auth/actions";
import { useLanguage } from "@/features/i18n/language-provider";
import { translateAuthError } from "./auth-error-messages";

type TranslationFunction = (zh: string, en: string) => string;
type SetupFlowDetail = {
  label: string;
  value: string;
};
type SetupFlowStory = {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  highlights: string[];
  panelEyebrow: string;
  panelTitle: string;
  panelBody: string;
  bannerTitle: string;
  bannerBody: string;
  details: SetupFlowDetail[];
  modeGuide: string;
  submitLabel: string;
};

function buildDefaultWorkspaceName(tx: TranslationFunction): string {
  return tx("我的个人工作区", "My personal workspace");
}

export function GoogleProfileSetupScreen({
  email,
  initialDisplayName,
  invitation,
}: {
  email: string;
  initialDisplayName: string;
  invitation?: {
    workspaceName: string;
    role: WorkspaceRole;
  };
}) {
  const { tx } = useLanguage();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [workspaceName, setWorkspaceName] = useState(() => buildDefaultWorkspaceName(tx));
  const [workspaceNameEdited, setWorkspaceNameEdited] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const story = buildSetupFlowStory({ email, invitation, workspaceName, tx });

  useEffect(() => {
    if (workspaceNameEdited) {
      return;
    }
    setWorkspaceName(buildDefaultWorkspaceName(tx));
  }, [tx, workspaceNameEdited]);

  return (
    <main className="auth-shell auth-shell--status">
      <section className="auth-card auth-card--status">
        <div className="auth-status-hero">
          <p className="auth-card__eyebrow">{story.heroEyebrow}</p>
          <h1>{story.heroTitle}</h1>
          <p className="auth-status-hero__body">{story.heroBody}</p>
          <ul className="auth-status-highlights">
            {story.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>

        <div className="auth-card__intro">
          <p className="auth-card__eyebrow">{story.panelEyebrow}</p>
          <h2>{story.panelTitle}</h2>
          <p>{story.panelBody}</p>
        </div>

        <div className="auth-invitation-banner">
          <strong>{story.bannerTitle}</strong>
          <p>{story.bannerBody}</p>
          <div className="auth-invitation-banner__grid">
            {story.details.map((detail) => (
              <div className="auth-invitation-banner__item" key={`${detail.label}-${detail.value}`}>
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            ))}
          </div>
        </div>
        <p className="auth-mode-guide">{story.modeGuide}</p>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            startTransition(async () => {
              try {
                const formData = new FormData();
                formData.set("displayName", displayName);
                formData.set("workspaceName", workspaceName);
                const result = await completeGoogleRegistrationAction(formData);
                if (!result.ok) {
                  if (result.error === "auth.google_account_link_required") {
                    router.push("/auth/link/google");
                    router.refresh();
                    return;
                  }
                  setFeedback(translateAuthError(result.error, tx));
                  return;
                }
                router.push(result.redirectPath);
                router.refresh();
              } catch (error) {
                const message = error instanceof Error
                  ? translateAuthError(error.message, tx)
                  : tx("请求失败，请稍后重试。", "Request failed. Please try again.");

                if (error instanceof Error && error.message === "auth.google_account_link_required") {
                  router.push("/auth/link/google");
                  router.refresh();
                  return;
                }

                setFeedback(message);
              }
            });
          }}
        >
          <label className="auth-field">
            <span>{tx("Google 邮箱", "Google email")}</span>
            <input disabled type="email" value={email} />
            <small className="auth-field__hint">
              {tx(
                "这是当前 Google 登录返回的邮箱，系统会用它创建你的账号身份。",
                "This is the email returned by the current Google sign-in and will be used for your account identity.",
              )}
            </small>
          </label>

          <label className="auth-field">
            <span>{tx("用户名", "Username")}</span>
            <input
              autoComplete="name"
              name="displayName"
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              placeholder={tx("输入你的用户名", "Choose your username")}
              required
              type="text"
              value={displayName}
            />
          </label>

          <label className="auth-field">
            <span>{tx("工作区名字", "Workspace name")}</span>
            <input
              autoComplete="organization"
              name="workspaceName"
              onChange={(event) => {
                setWorkspaceNameEdited(true);
                setWorkspaceName(event.currentTarget.value);
              }}
              placeholder={tx("输入工作区名字", "Choose your workspace name")}
              required
              type="text"
              value={workspaceName}
            />
            <small className="auth-field__hint">
              {tx(
                "这个名字会作为首次创建的默认工作区名称，后续仍可在设置里修改。",
                "This becomes the initial default workspace name, and you can still change it later in settings.",
              )}
            </small>
          </label>

          <div className="auth-actions auth-actions--stack">
            <button
              className="auth-button"
              disabled={isPending || displayName.trim().length === 0 || workspaceName.trim().length === 0}
              type="submit"
            >
              {isPending ? tx("处理中...", "Working...") : story.submitLabel}
            </button>
            <Link className="workspace-ghost-button auth-status-actions__secondary" href="/">
              {tx("返回登录页", "Back to sign in")}
            </Link>
            {feedback ? (
              <p className="auth-feedback" role="alert">
                {feedback}
              </p>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}

function translateInvitationRole(
  role: WorkspaceRole,
  tx: TranslationFunction,
): string {
  if (role === "owner") {
    return tx("所有者", "Owner");
  }
  if (role === "admin") {
    return tx("管理员", "Admin");
  }
  return tx("成员", "Member");
}

function buildSetupFlowStory({
  email,
  invitation,
  workspaceName,
  tx,
}: {
  email: string;
  invitation?: {
    workspaceName: string;
    role: WorkspaceRole;
  };
  workspaceName: string;
  tx: TranslationFunction;
}): SetupFlowStory {
  if (invitation) {
    const roleLabel = translateInvitationRole(invitation.role, tx);
    return {
      heroEyebrow: tx("Google 首次登录", "First-time Google sign-in"),
      heroTitle: tx(
        `确认资料后加入 ${invitation.workspaceName}，继续共享协作上下文。`,
        `Confirm your profile, then join ${invitation.workspaceName} in shared context.`,
      ),
      heroBody: tx(
        "这是你第一次用 Google 进入 AgentSpace。我们会先创建账号身份，再继续把你带回受邀工作区，而不是让你从空白状态开始。",
        "This is your first time entering AgentSpace with Google. We create your account identity first, then continue the flow back into the invited workspace instead of starting from scratch.",
      ),
      highlights: [
        tx("创建账号身份", "Create your account identity"),
        tx(`继续 ${invitation.workspaceName} 邀请`, `Continue the ${invitation.workspaceName} invite`),
        tx(`保留${roleLabel}身份`, `Keep ${roleLabel} access`),
      ],
      panelEyebrow: tx("完成首次进入", "Complete first-time setup"),
      panelTitle: tx("先确认资料，再接住这条团队邀请", "Confirm your profile before continuing the team invite"),
      panelBody: tx(
        "你现在填写的用户名会作为账号显示名，工作区名字会用于初始化默认 workspace。完成后，系统会继续处理加入团队 workspace 的链路。",
        "The display name becomes your account identity, and the workspace name initializes your default workspace. After setup, the flow continues into the invited team workspace.",
      ),
      bannerTitle: tx("首次 Google 登录也会保留邀请上下文", "First-time Google sign-in still preserves the invite context"),
      bannerBody: tx(
        "系统会先建立你的基础账号，再继续把你带回受邀的协作空间，让你进入正在发生的消息、任务和文档流。",
        "We first create the account foundation, then return you to the invited collaboration space so you can enter the live flow of messages, tasks, and docs.",
      ),
      details: [
        { label: tx("Google 邮箱", "Google email"), value: email },
        { label: tx("目标工作区", "Workspace"), value: invitation.workspaceName },
        { label: tx("角色", "Role"), value: roleLabel },
        { label: tx("完成后", "After setup"), value: tx("继续进入邀请工作区", "Continue into the invited workspace") },
      ],
      modeGuide: tx(
        "默认工作区只是你的起始空间；这条邀请仍会把你继续带回团队工作区，后续名称也可以在设置里修改。",
        "The default workspace is only your starting space. This invite still returns you to the team workspace, and you can rename things later in settings.",
      ),
      submitLabel: tx("确认资料并加入工作区", "Confirm profile and join workspace"),
    };
  }

  return {
    heroEyebrow: tx("Google 首次登录", "First-time Google sign-in"),
    heroTitle: tx("确认资料，用 Google 创建你的协作工作台。", "Confirm your profile and create your collaboration workspace with Google."),
    heroBody: tx(
      "这是你第一次用 Google 登录 AgentSpace。完成后会直接创建账号和默认 workspace，让你开始整理消息、任务、知识与 Agent 协作。",
      "This is your first time using Google to sign in to AgentSpace. After setup, we create your account and default workspace so you can start organizing messages, tasks, knowledge, and agent work.",
    ),
    highlights: [
      tx("创建默认工作区", "Create a default workspace"),
      tx("开始消息与任务协作", "Start messages and task collaboration"),
      tx("接入 Agent 与知识上下文", "Connect agents and knowledge context"),
    ],
    panelEyebrow: tx("完成首次进入", "Complete first-time setup"),
    panelTitle: tx("先补齐基础资料，再创建账号", "Fill in the basics before creating your account"),
    panelBody: tx(
      "你现在填写的用户名会作为账号显示名，工作区名字会作为首次创建的默认 workspace 名称。",
      "The display name becomes your account identity, and the workspace name becomes the initial name of your default workspace.",
    ),
    bannerTitle: tx("首次 Google 登录会直接创建你的默认工作区", "First-time Google sign-in creates your default workspace immediately"),
    bannerBody: tx(
      "完成后你会直接进入工作台，可以继续邀请同事、接入 Agent，并在同一空间里积累执行上下文。",
      "After setup, you go straight into the workspace and can start inviting teammates, connecting agents, and building execution context in one place.",
    ),
    details: [
      { label: tx("Google 邮箱", "Google email"), value: email },
      { label: tx("默认工作区", "Default workspace"), value: workspaceName },
      { label: tx("完成后", "After setup"), value: tx("直接进入新工作台", "Enter the new workspace directly") },
      { label: tx("后续", "Later"), value: tx("可继续修改名字与邀请成员", "Rename it later and invite teammates") },
    ],
    modeGuide: tx(
      "如果你还没想好正式名称，也可以先用默认工作区名字，之后再去设置里修改。",
      "If you do not have the final name yet, keep the default workspace name for now and change it later in settings.",
    ),
    submitLabel: tx("确认资料并创建账号", "Confirm profile and create account"),
  };
}
