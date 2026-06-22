"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { WorkspaceRole } from "@agent-space/db";
import { confirmGoogleAccountLinkAction } from "@/features/auth/actions";
import { useLanguage } from "@/features/i18n/language-provider";
import { translateAuthError } from "./auth-error-messages";

type TranslationFunction = (zh: string, en: string) => string;
type LinkFlowDetail = {
  label: string;
  value: string;
};
type LinkFlowStory = {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  highlights: string[];
  panelEyebrow: string;
  panelTitle: string;
  panelBody: string;
  bannerTitle: string;
  bannerBody: string;
  details: LinkFlowDetail[];
  modeGuide: string;
  submitLabel: string;
};

export function GoogleLinkAccountScreen({
  email,
  invitation,
}: {
  email: string;
  invitation?: {
    workspaceName: string;
    role: WorkspaceRole;
  };
}) {
  const { tx } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const story = buildLinkFlowStory({ email, invitation, tx });

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
                formData.set("password", password);
                const result = await confirmGoogleAccountLinkAction(formData);
                if (!result.ok) {
                  setFeedback(translateAuthError(result.error, tx));
                  return;
                }
                router.push(result.redirectPath ?? "/");
                router.refresh();
              } catch (error) {
                const message = error instanceof Error
                  ? translateAuthError(error.message, tx)
                  : tx("请求失败，请稍后重试。", "Request failed. Please try again.");
                setFeedback(message);
              }
            });
          }}
        >
          <label className="auth-field">
            <span>{tx("现有账号邮箱", "Existing account email")}</span>
            <input disabled type="email" value={email} />
            <small className="auth-field__hint">
              {tx(
                "这是本次 Google 登录返回的邮箱，也是系统里已经存在的账号邮箱。",
                "This is the email returned by Google and the existing account email we found in the system.",
              )}
            </small>
          </label>

          <label className="auth-field">
            <span>{tx("账号密码", "Account password")}</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              placeholder={tx("输入现有账号密码", "Enter the existing account password")}
              required
              type="password"
              value={password}
            />
          </label>

          <div className="auth-actions auth-actions--stack">
            <button className="auth-button" disabled={isPending || password.trim().length === 0} type="submit">
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

function buildLinkFlowStory({
  email,
  invitation,
  tx,
}: {
  email: string;
  invitation?: {
    workspaceName: string;
    role: WorkspaceRole;
  };
  tx: TranslationFunction;
}): LinkFlowStory {
  if (invitation) {
    const roleLabel = translateInvitationRole(invitation.role, tx);
    return {
      heroEyebrow: tx("Google 账号确认", "Google account confirmation"),
      heroTitle: tx(
        `先验证这个账号，再继续进入 ${invitation.workspaceName}。`,
        `Verify this account, then continue into ${invitation.workspaceName}.`,
      ),
      heroBody: tx(
        "这一步不会创建重复账号，而是确认你已有的身份，并把这次 Google 登录接回正确的协作工作区。",
        "This step does not create a duplicate account. It confirms your existing identity and reconnects this Google sign-in to the correct collaboration workspace.",
      ),
      highlights: [
        tx(`继续 ${invitation.workspaceName} 邀请`, `Continue the ${invitation.workspaceName} invite`),
        tx(`保留${roleLabel}身份`, `Keep ${roleLabel} access`),
        tx("继续共享协作上下文", "Resume the shared collaboration context"),
      ],
      panelEyebrow: tx("确认现有身份", "Confirm your existing account"),
      panelTitle: tx("输入已有账号密码，接住这条邀请", "Enter your existing password to continue this invite"),
      panelBody: tx(
        "确认成功后，系统会把这个已有账号与当前 Google 登录绑定，并继续处理你加入团队工作区的链路。",
        "After confirmation, we link this existing account with the current Google sign-in and continue the flow into the invited team workspace.",
      ),
      bannerTitle: tx("你不是在新建账号，而是在继续已有协作身份", "You are not creating a new account. You are continuing an existing collaboration identity."),
      bannerBody: tx(
        "检测到这个邮箱已经存在。只要验证密码，系统就会把你带回对应工作区，而不是让你从空白状态重新开始。",
        "We found an existing account for this email. After password verification, we return you to the correct workspace instead of starting from scratch.",
      ),
      details: [
        { label: tx("现有邮箱", "Existing email"), value: email },
        { label: tx("目标工作区", "Workspace"), value: invitation.workspaceName },
        { label: tx("角色", "Role"), value: roleLabel },
        { label: tx("验证后", "After verification"), value: tx("继续进入邀请工作区", "Continue into the invited workspace") },
      ],
      modeGuide: tx(
        "我们只需要当前账号密码来确认身份，不会覆盖你已有的工作区数据。",
        "We only need the current password to confirm identity. Existing workspace data stays untouched.",
      ),
      submitLabel: tx("验证并继续进入工作区", "Verify and continue to workspace"),
    };
  }

  return {
    heroEyebrow: tx("Google 账号确认", "Google account confirmation"),
    heroTitle: tx("先验证这个账号，再继续 Google 登录。", "Verify this account before continuing with Google sign-in."),
    heroBody: tx(
      "检测到这个邮箱已经有账号。验证通过后，我们会把已有账号与这次 Google 登录连接起来，让你直接回到正在进行的工作。",
      "We found an existing account for this email. After verification, we connect that account to this Google sign-in so you can jump back into the work already in motion.",
    ),
    highlights: [
      tx("不重复创建账号", "No duplicate account"),
      tx("保留已有工作区", "Keep existing workspaces"),
      tx("继续最近工作", "Resume recent work"),
    ],
    panelEyebrow: tx("确认现有身份", "Confirm your existing account"),
    panelTitle: tx("输入当前账号密码完成绑定", "Enter your current password to finish linking"),
    panelBody: tx(
      "确认成功后，这个邮箱的现有账号会和本次 Google 登录绑定到一起，之后可以直接用 Google 回到工作台。",
      "Once confirmed, the existing account for this email is linked to this Google sign-in so you can use Google directly next time.",
    ),
    bannerTitle: tx("已有账号会被直接接回 Google 登录", "Your existing account will be connected directly to Google sign-in"),
    bannerBody: tx(
      "这一步只做身份确认，不会改动你当前的工作区、消息、任务或文档上下文。",
      "This step only confirms identity. It does not alter your existing workspaces, messages, tasks, or document context.",
    ),
    details: [
      { label: tx("现有邮箱", "Existing email"), value: email },
      { label: tx("操作类型", "Action"), value: tx("绑定 Google 登录", "Link Google sign-in") },
      { label: tx("完成后", "After linking"), value: tx("下次可直接用 Google 登录", "Use Google directly next time") },
      { label: tx("工作区", "Workspace"), value: tx("保留现有工作区与成员关系", "Keep existing workspaces and memberships") },
    ],
    modeGuide: tx(
      "只需要一次密码确认，之后这个邮箱就能直接用 Google 登录。",
      "A single password confirmation is enough. After that, this email can use Google sign-in directly.",
    ),
    submitLabel: tx("验证并继续 Google 登录", "Verify and continue with Google"),
  };
}
