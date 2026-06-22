"use client";

import { useLanguage } from "@/features/i18n/language-provider";
import { AuthStatusScreen } from "./auth-status-screen";

export function InvitationStatusScreen({
  status,
  workspaceName,
  email,
  reasonCode,
}: {
  status: "invalid" | "accepted" | "revoked" | "expired" | "accept_failed";
  workspaceName?: string;
  email?: string;
  reasonCode?: string;
}) {
  const { tx } = useLanguage();
  const workspace = workspaceName || tx("这个工作区", "this workspace");
  const targetEmail = email || tx("当前邮箱", "this email");

  return (
    <AuthStatusScreen
      body={buildInvitationBody({ status, workspaceName, email, reasonCode, tx })}
      contextItems={buildInvitationContext({ status, workspace, targetEmail, tx })}
      eyebrow={tx("协作工作区邀请", "Collaboration workspace invite")}
      heroBody={tx(
        `${workspace} 会把消息、任务、文档和数字员工放在同一个协作空间里。先确认这条邀请当前是否有效，再按提示继续进入。`,
        `${workspace} brings messages, tasks, documents, and digital coworkers into one shared workspace. Check whether this invite is still active, then follow the next step to continue.`,
      )}
      heroTitle={tx(`你正尝试进入 ${workspace}。`, `You are trying to enter ${workspace}.`)}
      highlights={[
        tx("团队消息、任务与文档在同一处协作", "Messages, tasks, and docs stay in one workspace"),
        tx("与你的同事和 Agent 共享同一个执行上下文", "Work alongside teammates and agents in one operating context"),
        tx("登录后会继续进入对应 workspace", "Sign-in continues directly into the invited workspace"),
      ]}
      nextSteps={buildInvitationNextSteps({ status, workspace, targetEmail, reasonCode, tx })}
      nextStepsTitle={tx("接下来怎么做", "What to do next")}
      primaryAction={{
        href: "/",
        label: tx("返回登录页", "Back to sign in"),
      }}
      secondaryAction={status === "accept_failed"
        ? {
            href: "/",
            label: tx("重新发起登录", "Restart sign-in"),
          }
        : undefined}
      title={buildInvitationTitle({ status, tx })}
    />
  );
}

function buildInvitationTitle({
  status,
  tx,
}: {
  status: "invalid" | "accepted" | "revoked" | "expired" | "accept_failed";
  tx: (zh: string, en: string) => string;
}): string {
  if (status === "accepted") {
    return tx("邀请已接受", "Invitation already accepted");
  }
  if (status === "revoked") {
    return tx("邀请已撤销", "Invitation revoked");
  }
  if (status === "expired") {
    return tx("邀请已过期", "Invitation expired");
  }
  if (status === "accept_failed") {
    return tx("暂时无法接受邀请", "Unable to accept invitation");
  }
  return tx("邀请不可用", "Invitation unavailable");
}

function buildInvitationBody({
  status,
  workspaceName,
  email,
  reasonCode,
  tx,
}: {
  status: "invalid" | "accepted" | "revoked" | "expired" | "accept_failed";
  workspaceName?: string;
  email?: string;
  reasonCode?: string;
  tx: (zh: string, en: string) => string;
}): string {
  const workspace = workspaceName || tx("这个工作区", "this workspace");
  const targetEmail = email || tx("当前邮箱", "this email");

  if (status === "accepted") {
    return tx(
      `${targetEmail} 对 ${workspace} 的邀请已经被接受，可以直接登录进入工作区。`,
      `The invitation for ${targetEmail} to join ${workspace} was already accepted. You can sign in directly to enter the workspace.`,
    );
  }
  if (status === "revoked") {
    return tx(
      `${targetEmail} 对 ${workspace} 的邀请已被撤销。请联系工作区管理员重新发送邀请。`,
      `The invitation for ${targetEmail} to join ${workspace} was revoked. Ask a workspace admin to send a new invitation.`,
    );
  }
  if (status === "expired") {
    return tx(
      `${targetEmail} 对 ${workspace} 的邀请已经过期。请联系工作区管理员重新生成一条邀请。`,
      `The invitation for ${targetEmail} to join ${workspace} expired. Ask a workspace admin to generate a new invitation.`,
    );
  }
  if (status === "accept_failed") {
    return translateAcceptFailure(reasonCode, workspace, tx);
  }
  return tx("这条邀请无效、已失效，或者对应工作区已经不存在。", "This invitation is invalid, inactive, or the target workspace no longer exists.");
}

function buildInvitationContext({
  status,
  workspace,
  targetEmail,
  tx,
}: {
  status: "invalid" | "accepted" | "revoked" | "expired" | "accept_failed";
  workspace: string;
  targetEmail: string;
  tx: (zh: string, en: string) => string;
}) {
  return [
    {
      label: tx("目标工作区", "Workspace"),
      value: workspace,
    },
    {
      label: tx("受邀邮箱", "Invited email"),
      value: targetEmail,
    },
    {
      label: tx("当前状态", "Current state"),
      value: buildInvitationTitle({ status, tx }),
    },
  ];
}

function buildInvitationNextSteps({
  status,
  workspace,
  targetEmail,
  reasonCode,
  tx,
}: {
  status: "invalid" | "accepted" | "revoked" | "expired" | "accept_failed";
  workspace: string;
  targetEmail: string;
  reasonCode?: string;
  tx: (zh: string, en: string) => string;
}): string[] {
  if (status === "accepted") {
    return [
      tx(
        `返回登录页，并使用 ${targetEmail} 登录。`,
        `Go back to sign in and use ${targetEmail}.`,
      ),
      tx(
        `登录完成后会直接继续进入 ${workspace}。`,
        `After sign-in, you will continue directly into ${workspace}.`,
      ),
    ];
  }

  if (status === "revoked" || status === "expired") {
    return [
      tx(
        `联系 ${workspace} 的管理员，请他们重新发送一条新的邀请。`,
        `Ask an admin in ${workspace} to send a fresh invite.`,
      ),
      tx(
        `收到新邀请后，再使用 ${targetEmail} 登录继续加入。`,
        `Once you receive a new invite, sign in with ${targetEmail} to continue.`,
      ),
    ];
  }

  if (status === "accept_failed") {
    if (reasonCode === "workspace.invitation.email_mismatch") {
      return [
        tx(
          `退出当前账号后，改用 ${targetEmail} 重新发起登录。`,
          `Sign out of the current account, then restart sign-in with ${targetEmail}.`,
        ),
        tx(
          `登录完成后，系统会继续把你带回 ${workspace} 的邀请链路。`,
          `After sign-in, the flow will return you to the invite for ${workspace}.`,
        ),
      ];
    }

    return [
      tx(
        "先重新发起一次登录，确认邀请链接和账号状态都是最新的。",
        "Restart sign-in once to refresh the invite and account state.",
      ),
      tx(
        `如果问题仍然存在，请联系 ${workspace} 的管理员检查邀请是否仍然有效。`,
        `If the issue continues, ask an admin in ${workspace} to check whether the invite is still active.`,
      ),
    ];
  }

  return [
    tx("返回登录页，确认自己打开的是最新的邀请链接。", "Return to sign in and make sure you are using the newest invite link."),
    tx(
      `如果你仍然需要加入 ${workspace}，请联系管理员重新发送邀请。`,
      `If you still need access to ${workspace}, ask an admin to send another invite.`,
    ),
  ];
}

function translateAcceptFailure(
  reasonCode: string | undefined,
  workspaceName: string,
  tx: (zh: string, en: string) => string,
): string {
  if (reasonCode === "workspace.invitation.email_mismatch") {
    return tx(
      `当前登录账号的邮箱与 ${workspaceName} 这条邀请不一致。请改用受邀邮箱登录后再继续。`,
      `The current signed-in email does not match the invitation for ${workspaceName}. Sign in with the invited email and try again.`,
    );
  }
  if (reasonCode === "workspace.invitation.expired") {
    return tx(
      `${workspaceName} 的邀请已经过期。请联系管理员重新发送。`,
      `The invitation for ${workspaceName} has expired. Ask an admin to send a fresh one.`,
    );
  }
  if (reasonCode === "workspace.invitation.invalid" || reasonCode === "workspace.invitation.inactive") {
    return tx(
      `${workspaceName} 的邀请已经失效。请联系管理员重新发送。`,
      `The invitation for ${workspaceName} is no longer active. Ask an admin to send a new one.`,
    );
  }
  if (reasonCode === "workspace.invitation.workspace_not_found") {
    return tx("目标工作区已经不存在。", "The target workspace no longer exists.");
  }
  return tx(
    "接受邀请时出现了暂时性错误。你可以重新发起登录，或稍后再试。",
    "A temporary error occurred while accepting the invitation. Restart sign-in or try again later.",
  );
}
