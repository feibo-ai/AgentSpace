import type { WorkspaceRole } from "@agent-space/db";
import type { SettingsTx, SettingsWorkspaceInvitationItem } from "@/features/settings/settings-types";
import { formatCompactTimestamp } from "@/shared/lib/time-format";

export function describeSession(userAgent: string | undefined, tx: SettingsTx): string {
  if (!userAgent || userAgent.trim().length === 0) {
    return tx("未知设备", "Unknown device");
  }

  return userAgent;
}

export function describeSessionFingerprint(sessionId: string): string {
  if (sessionId.length <= 14) {
    return sessionId;
  }

  return `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`;
}

export function formatSessionTimestamp(value: string): string {
  return formatCompactTimestamp(value, { emptyFallback: value });
}

export function translateWorkspaceRole(role: WorkspaceRole, tx: SettingsTx): string {
  if (role === "owner") {
    return tx("所有者", "Owner");
  }
  if (role === "admin") {
    return tx("管理员", "Admin");
  }

  return tx("成员", "Member");
}

export function translateInvitationStatus(
  status: SettingsWorkspaceInvitationItem["status"],
  tx: SettingsTx,
): string {
  if (status === "accepted") {
    return tx("已接受", "Accepted");
  }
  if (status === "revoked") {
    return tx("已撤销", "Revoked");
  }
  if (status === "expired") {
    return tx("已过期", "Expired");
  }

  return tx("待接受", "Pending");
}

export function describeInvitationState(
  invitation: SettingsWorkspaceInvitationItem,
  tx: SettingsTx,
): string {
  if (invitation.status === "accepted") {
    return tx("对方已接受邀请。", "This invitation has been accepted.");
  }
  if (invitation.status === "revoked") {
    return tx("这条邀请已被撤销。", "This invitation was revoked.");
  }
  if (invitation.status === "expired") {
    return tx("这条邀请已过期，可重新发送。", "This invitation expired and can be reissued.");
  }

  const expiresAt = new Date(invitation.expiresAt).getTime();
  const hoursLeft = Math.round((expiresAt - Date.now()) / (1000 * 60 * 60));
  if (Number.isFinite(hoursLeft) && hoursLeft >= 0 && hoursLeft <= 48) {
    return tx(`将在 ${hoursLeft} 小时内过期。`, `Expires in ${hoursLeft} hour(s).`);
  }

  return tx("等待对方接受邀请。", "Waiting for the invitee to accept.");
}

export function translateSettingsActionError(error: unknown, tx: SettingsTx): string {
  const message = error instanceof Error ? error.message : String(error);
  switch (message) {
    case "auth.profile.missing_display_name":
      return tx("请填写用户名。", "Username is required.");
    case "workspace.profile.missing_name":
      return tx("请填写工作区名称。", "Workspace name is required.");
    case "workspace.invitation.missing_email":
      return tx("请填写邀请邮箱。", "Invitation email is required.");
    case "workspace.invitation.not_found":
      return tx("未找到该邀请。", "Invitation not found.");
    case "workspace.invitation.already_accepted":
      return tx("该邀请已被接受，不能重新发送。", "This invitation was already accepted and cannot be reissued.");
    case "workspace.members.missing_email":
      return tx("请填写邮箱。", "Email is required.");
    case "workspace.members.account_not_found":
      return tx("该邮箱尚未注册账户。", "No account exists for that email.");
    case "workspace.members.already_member":
      return tx("该用户已经在当前工作区中。", "That user is already in this workspace.");
    case "workspace.members.owner_only":
      return tx("只有所有者可以管理 owner 角色。", "Only owners can manage the owner role.");
    case "workspace.members.already_owner":
      return tx("该成员已经是所有者。", "That member is already an owner.");
    case "workspace.members.cannot_manage_self":
      return tx("暂不支持修改或移除你自己的成员身份。", "You cannot change or remove your own membership here.");
    case "workspace.members.last_owner":
      return tx("至少需要保留一位所有者。", "At least one owner must remain.");
    case "workspace.members.not_found":
      return tx("未找到该成员。", "Member not found.");
    case "workspace.members.missing_user":
      return tx("缺少成员标识。", "Member identifier is required.");
    case "channel.invitation.not_found":
      return tx("未找到该群邀请。", "Channel invitation not found.");
    case "channel.invitation.not_pending":
      return tx("该群邀请已经处理过。", "This channel invitation has already been handled.");
    case "channel.invitation.email_mismatch":
      return tx("当前账号邮箱与群邀请邮箱不一致。", "This account email does not match the channel invitation email.");
    default:
      return message || tx("操作失败。", "Action failed.");
  }
}
